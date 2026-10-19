import "server-only";
import type { ActionResult } from "@/app/actions/books";
import type { CurrentUser } from "@/lib/auth";
import { describePattern, parsePattern, walkListing } from "@/lib/catalog/collect";
import { importEditionCoverFromUrl } from "@/lib/catalog/covers";
import { GENRE_BATCH } from "@/lib/catalog/genres";
import { sortIntoGenres } from "@/lib/catalog/genres-ai";
import { importOne, type ImportResult } from "@/lib/catalog/import-one";
import { decodeHtml, FetchError, safeFetch } from "@/lib/net/safe-fetch";
import { readBookPage } from "@/lib/prefill/read";
import type { createClient } from "@/lib/supabase/server";

/**
 * Checking one New releases source: walk its listing, link books the catalog already has, import
 * new ones, and read known ones again to fill in what's missing. Shared by the page's Check button
 * (one Server Action per step) and the daily job (scripts/daily-releases.ts).
 */

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CollectedRelease {
  /** Book links the catalog doesn't have yet. */
  links: string[];
  /** Known books worth reading again: no description, or a coming book with no date yet. */
  refresh: string[];
  found: number;
  /** Books already in the catalog (e.g. imported from a list) now shown under this source. */
  claimed: number;
}

/**
 * Reads a source's listing (up to its page limit) and returns the book links the catalog doesn't
 * have yet, plus known books worth reading again. Books already in the catalog but not linked to a
 * source are linked to this one, so they show on the page. Remembers the guessed book-link pattern
 * and when the source was checked.
 */
export async function collectSource(supabase: Supabase, sourceId: string): Promise<ActionResult<CollectedRelease>> {
  const { data: source } = await supabase.from("release_sources").select("*").eq("id", sourceId).single();
  if (!source) return { ok: false, error: "Unknown source." };

  let walk;
  try {
    walk = await walkListing(
      source.url,
      parsePattern(source.pattern ?? ""),
      async (url) => {
        const page = await safeFetch(url, { accept: "text/html,application/xhtml+xml", maxBytes: 8 * 1024 * 1024 });
        return decodeHtml(page.body, page.contentType);
      },
      { maxPages: source.pages },
    );
  } catch (e) {
    return { ok: false, error: e instanceof FetchError ? (e.status === 403 || e.status === 429 ? "The site blocks automatic reading." : e.message) : "Couldn't read the page." };
  }
  if (!walk) return { ok: false, error: "Couldn't tell which links are the books; set how book links start for this source." };

  const known: { id: string; source_url: string | null; release_source_id: string | null; description: string | null; release_date: string | null; release_note: string | null }[] = [];
  for (let i = 0; i < walk.links.length; i += 100) {
    const { data } = await supabase
      .from("editions")
      .select("id, source_url, release_source_id, description, release_date, release_note")
      .in("source_url", walk.links.slice(i, i + 100));
    known.push(...(data ?? []));
  }
  const unclaimed = known.filter((e) => !e.release_source_id).map((e) => e.id);
  if (unclaimed.length) await supabase.from("editions").update({ release_source_id: sourceId }).in("id", unclaimed);
  await supabase
    .from("release_sources")
    .update({ last_checked_at: new Date().toISOString(), ...(source.pattern ? {} : { pattern: describePattern(walk.pattern) }) })
    .eq("id", sourceId);

  const knownUrls = new Set(known.map((e) => e.source_url));
  const coming = source.kind === "coming";
  return {
    ok: true,
    data: {
      links: walk.links.filter((l) => !knownUrls.has(l)),
      refresh: known.filter((e) => e.source_url && (!e.description || (coming && !e.release_date && !e.release_note))).map((e) => e.source_url!),
      found: walk.links.length,
      claimed: unclaimed.length,
    },
  };
}

/** Reads one found book and adds it to the catalog as a draft from this source. */
export function importFromSource(supabase: Supabase, user: CurrentUser, sourceId: string, url: string): Promise<ImportResult> {
  return importOne(supabase, user, { kind: "link", text: url, url }, { releaseSourceId: sourceId });
}

/**
 * Reads a known book's page again and fills in what's missing: description, release date or note,
 * cover. Returns the edition id when it got a description (so it can be sorted into genres).
 */
export async function refreshDetails(supabase: Supabase, user: CurrentUser, url: string): Promise<ActionResult<string | null>> {
  const { data: edition } = await supabase
    .from("editions")
    .select("id, description, release_date, release_note, cover_path, cover_url")
    .eq("source_url", url)
    .limit(1)
    .maybeSingle();
  if (!edition) return { ok: false, error: "Not in the catalog." };
  const page = await readBookPage(url);
  if (!page.ok) return { ok: false, error: page.error };
  const patch = {
    ...(page.data.description && !edition.description ? { description: page.data.description.slice(0, 20_000) } : {}),
    ...(page.data.releaseDate && !edition.release_date ? { release_date: page.data.releaseDate } : {}),
    ...(page.data.releaseNote && !edition.release_note ? { release_note: page.data.releaseNote.slice(0, 200) } : {}),
  };
  if (Object.keys(patch).length) await supabase.from("editions").update(patch).eq("id", edition.id);
  if (page.data.coverUrl && !edition.cover_path && !edition.cover_url) await importEditionCoverFromUrl(supabase, user, edition.id, page.data.coverUrl);
  return { ok: true, data: patch.description ? edition.id : null };
}

/** Sorts editions without genres into `genres` (the reader's own), GENRE_BATCH at a time. Throws Anthropic.APIError. */
export async function sortEditionsIntoGenres(supabase: Supabase, editionIds: string[], genres: string[]): Promise<number> {
  if (genres.length === 0 || editionIds.length === 0) return 0;
  let updated = 0;
  for (let i = 0; i < editionIds.length; i += GENRE_BATCH) {
    const { data: rows } = await supabase.from("editions").select("id, title, authors, description, genres").in("id", editionIds.slice(i, i + GENRE_BATCH));
    const books = (rows ?? []).filter((r) => r.genres.length === 0).map((r) => ({ id: r.id, title: r.title, authors: r.authors, description: r.description ?? undefined }));
    if (books.length === 0) continue;
    for (const { id, genres: g } of (await sortIntoGenres(books, genres)) ?? []) {
      if (g.length === 0) continue;
      const { error } = await supabase.from("editions").update({ genres: g }).eq("id", id);
      if (!error) updated++;
    }
  }
  return updated;
}
