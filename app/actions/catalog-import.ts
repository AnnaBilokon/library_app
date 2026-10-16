"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { describePattern, parsePattern, walkListing } from "@/lib/catalog/collect";
import { importEditionCoverFromUrl } from "@/lib/catalog/covers";
import { rowToEdition } from "@/lib/catalog/editions";
import { parseImportList } from "@/lib/catalog/import";
import { lookUpIsbn } from "@/lib/catalog/isbn-lookup";
import { decodeHtml, FetchError, safeFetch } from "@/lib/net/safe-fetch";
import { readBookPage } from "@/lib/prefill/read";
import { createClient } from "@/lib/supabase/server";

export type ImportResult =
  | { status: "added"; editionId: string; title: string; authors: string[]; coverSrc?: string; site: string; coverNote?: string }
  | { status: "exists"; editionId: string; title: string }
  | { status: "failed"; reason: string };

const clean = (text: string | undefined, max: number) => text?.trim().slice(0, max) || null;

/**
 * Imports one line of a pasted list (a link or an ISBN) into the catalog as a draft waiting in
 * To review. The page calls this line by line, so a long list never hits a time limit and shows
 * progress as it goes. An edition with the same ISBN is never added twice.
 */
export async function importCatalogLine(line: string): Promise<ActionResult<ImportResult>> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: "Admins only." };
  const parsed = z.string().max(2000).safeParse(line);
  const [item] = parsed.success ? parseImportList(parsed.data) : [];
  if (!item || item.kind === "invalid") return { ok: true, data: { status: "failed", reason: "Not a link or an ISBN." } };

  const supabase = await createClient();
  const existing = async (isbn: string) => {
    const { data } = await supabase.from("editions").select("id, title").eq("isbn", isbn).maybeSingle();
    return data ? ({ status: "exists", editionId: data.id, title: data.title } as const) : null;
  };

  if (item.kind === "isbn") {
    const found = await existing(item.isbn);
    if (found) return { ok: true, data: found };
  }

  let details;
  if (item.kind === "isbn") {
    details = await lookUpIsbn(item.isbn);
    if (!details) return { ok: true, data: { status: "failed", reason: "Not found in Google Books or Open Library. Paste the book's page link instead." } };
  } else {
    const page = await readBookPage(item.url);
    if (!page.ok) return { ok: true, data: { status: "failed", reason: page.error } };
    details = page.data;
  }
  if (!details.title?.trim()) return { ok: true, data: { status: "failed", reason: "Found no title for it." } };
  if (details.isbn) {
    const found = await existing(details.isbn);
    if (found) return { ok: true, data: found };
  }

  const year = details.publishedYear && details.publishedYear >= 0 && details.publishedYear <= 2100 ? details.publishedYear : null;
  const { data: row, error } = await supabase
    .from("editions")
    .insert({
      title: details.title.trim().slice(0, 500),
      authors: (details.authors ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 20),
      publisher: clean(details.publisher, 500),
      published_year: year,
      pages: details.pages && details.pages > 0 ? details.pages : null,
      isbn: details.isbn ?? null,
      language: details.language && /^[a-z]{2,3}$/.test(details.language) ? details.language : null,
      description: clean(details.description, 20_000),
      source_url: item.kind === "link" ? item.url : null,
      // Imported details can be wrong: nobody else sees it until an admin approves it.
      status: "draft",
      reviewed_at: null,
    })
    .select("*")
    .single();
  if (error) {
    // Another line (or another admin) added the same ISBN a moment ago.
    if (error.code === "23505" && details.isbn) {
      const found = await existing(details.isbn);
      if (found) return { ok: true, data: found };
    }
    return { ok: true, data: { status: "failed", reason: `Couldn't save: ${error.message}` } };
  }

  let coverNote: string | undefined;
  if (details.coverUrl) {
    const cover = await importEditionCoverFromUrl(supabase, user, row.id, details.coverUrl);
    if (!cover.ok) coverNote = cover.error;
  }
  const { data: saved } = await supabase.from("editions").select("*").eq("id", row.id).single();
  const edition = rowToEdition(saved ?? row, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    data: { status: "added", editionId: edition.id, title: edition.title, authors: edition.authors, coverSrc: edition.coverSrc, site: details.site, coverNote },
  };
}

/** How many pages of one listing can be read at most. */
const MAX_LISTING_PAGES = 20;

export interface CollectedLinks {
  links: string[];
  /** The book-link pattern that was used, for showing and editing ("/product/"). */
  pattern: string;
  pages: number;
  /** Book links left out because an earlier import already brought them in. */
  alreadyImported: number;
  /** Why it stopped before the last page, if it did. */
  note?: string;
}

/**
 * Reads a listing page ("new releases", "coming soon") and every further page of it, and
 * returns the links to the books on them. The pattern is guessed from the first page unless the
 * admin typed one ("Book links start with").
 */
export async function collectBookLinks(rawUrl: string, patternText: string, pagesToRead = 10): Promise<ActionResult<CollectedLinks>> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: "Admins only." };
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(rawUrl.trim());
  if (!parsed.success) return { ok: false, error: "Paste the full address of the listing page, starting with https://" };
  const listingUrl = parsed.data;

  let walk;
  try {
    walk = await walkListing(listingUrl, parsePattern(z.string().max(500).catch("").parse(patternText)), async (url) => {
      const page = await safeFetch(url, { accept: "text/html,application/xhtml+xml", maxBytes: 8 * 1024 * 1024 });
      return decodeHtml(page.body, page.contentType);
    }, { maxPages: z.number().int().min(1).max(MAX_LISTING_PAGES).catch(10).parse(pagesToRead) });
  } catch (e) {
    if (e instanceof FetchError) return { ok: false, error: e.status === 403 || e.status === 429 ? "This site blocks automatic reading." : e.message };
    return { ok: false, error: "Couldn't read that page." };
  }
  if (!walk) return { ok: false, error: "Couldn't tell which links are the books. Type how book links start (for example /product/) and try again." };
  const { links, pages, note } = walk;

  // Leave out what an earlier import already brought in.
  const supabase = await createClient();
  const known = new Set<string>();
  for (let i = 0; i < links.length; i += 100) {
    const { data } = await supabase.from("editions").select("source_url").in("source_url", links.slice(i, i + 100));
    for (const e of data ?? []) if (e.source_url) known.add(e.source_url);
  }
  const fresh = links.filter((l) => !known.has(l));
  return { ok: true, data: { links: fresh, pattern: describePattern(walk.pattern), pages, alreadyImported: links.length - fresh.length, note } };
}
