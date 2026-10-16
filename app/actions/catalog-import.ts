"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { importEditionCoverFromUrl } from "@/lib/catalog/covers";
import { rowToEdition } from "@/lib/catalog/editions";
import { parseImportList } from "@/lib/catalog/import";
import { lookUpIsbn } from "@/lib/catalog/isbn-lookup";
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
