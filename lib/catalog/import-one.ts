import "server-only";
import type { CurrentUser } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import { readBookPage } from "@/lib/prefill/read";
import { importEditionCoverFromUrl } from "./covers";
import { rowToEdition } from "./editions";
import type { ImportLine } from "./import";
import { lookUpIsbn } from "./isbn-lookup";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ImportResult =
  | { status: "added"; editionId: string; title: string; authors: string[]; coverSrc?: string; site: string; coverNote?: string }
  | { status: "exists"; editionId: string; title: string }
  | { status: "failed"; reason: string };

const clean = (text: string | undefined, max: number) => text?.trim().slice(0, max) || null;

/**
 * Imports one link or ISBN into the catalog as a draft waiting in To review. Never adds an
 * edition twice: an ISBN, or a link, already in the catalog is reported as "exists". The caller
 * checks that the user is an admin (RLS does too).
 */
export async function importOne(
  supabase: Supabase,
  user: CurrentUser,
  item: Exclude<ImportLine, { kind: "invalid" }>,
  { releaseSourceId }: { releaseSourceId?: string } = {},
): Promise<ImportResult> {
  const existing = async (column: "isbn" | "source_url", value: string) => {
    const { data } = await supabase.from("editions").select("id, title").eq(column, value).limit(1).maybeSingle();
    return data ? ({ status: "exists", editionId: data.id, title: data.title } as const) : null;
  };

  const known = item.kind === "isbn" ? await existing("isbn", item.isbn) : await existing("source_url", item.url);
  if (known) return known;

  let details;
  if (item.kind === "isbn") {
    details = await lookUpIsbn(item.isbn);
    if (!details) return { status: "failed", reason: "Not found in Google Books or Open Library. Paste the book's page link instead." };
  } else {
    const page = await readBookPage(item.url);
    if (!page.ok) return { status: "failed", reason: page.error };
    details = page.data;
  }
  if (!details.title?.trim()) return { status: "failed", reason: "Found no title for it." };
  if (details.isbn) {
    const found = await existing("isbn", details.isbn);
    if (found) return found;
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
      release_source_id: releaseSourceId ?? null,
      // Imported details can be wrong: nobody else sees it until an admin approves it.
      status: "draft",
      reviewed_at: null,
    })
    .select("*")
    .single();
  if (error) {
    // Another line (or another admin) added the same ISBN a moment ago.
    if (error.code === "23505" && details.isbn) {
      const found = await existing("isbn", details.isbn);
      if (found) return found;
    }
    return { status: "failed", reason: `Couldn't save: ${error.message}` };
  }

  let coverNote: string | undefined;
  if (details.coverUrl) {
    const cover = await importEditionCoverFromUrl(supabase, user, row.id, details.coverUrl);
    if (!cover.ok) coverNote = cover.error;
  }
  const { data: saved } = await supabase.from("editions").select("*").eq("id", row.id).single();
  const edition = rowToEdition(saved ?? row, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  return { status: "added", editionId: edition.id, title: edition.title, authors: edition.authors, coverSrc: edition.coverSrc, site: details.site, coverNote };
}
