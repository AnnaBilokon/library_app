"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import { describePattern, parsePattern, walkListing } from "@/lib/catalog/collect";
import { parseImportList } from "@/lib/catalog/import";
import { importOne, type ImportResult } from "@/lib/catalog/import-one";
import { decodeHtml, FetchError, safeFetch } from "@/lib/net/safe-fetch";
import { createClient } from "@/lib/supabase/server";

export type { ImportResult } from "@/lib/catalog/import-one";

/**
 * Imports one line of a pasted list (a link or an ISBN) into the catalog as a draft waiting in
 * To review. The page calls this line by line, so a long list never hits a time limit and shows
 * progress as it goes. An edition with the same ISBN or link is never added twice.
 */
export async function importCatalogLine(line: string): Promise<ActionResult<ImportResult>> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: "Admins only." };
  const parsed = z.string().max(2000).safeParse(line);
  const [item] = parsed.success ? parseImportList(parsed.data) : [];
  if (!item || item.kind === "invalid") return { ok: true, data: { status: "failed", reason: "Not a link or an ISBN." } };
  const result = await importOne(await createClient(), user, item);
  if (result.status === "added") revalidatePath("/admin", "layout");
  return { ok: true, data: result };
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
