import "server-only";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth";
import { possibleDuplicates, rowToEdition, type Edition } from "@/lib/catalog/editions";
import { normalizeIsbn } from "@/lib/isbn";
import { createClient } from "@/lib/supabase/server";

export const CATALOG_FILTERS = ["all", "drafts", "no-cover", "no-isbn", "duplicates"] as const;
export type CatalogFilter = (typeof CATALOG_FILTERS)[number];
export const PAGE_SIZE = 50;

type Supabase = Awaited<ReturnType<typeof createClient>>;
const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** % and _ are wildcards in ILIKE; a search for them means the characters themselves. */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Ids of editions that look entered twice. Reads only titles and authors, so it stays cheap. */
async function duplicateIds(supabase: Supabase): Promise<string[]> {
  const { data, error } = await supabase.from("editions").select("id, title, authors");
  if (error) throw new Error(`Couldn't load the catalog: ${error.message}`);
  return [...possibleDuplicates(data)];
}

/** How many people's books link to each edition (admins only; counts across all users). */
async function copiesOf(supabase: Supabase, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("edition_copies", { edition_ids: ids });
  if (error) throw new Error(`Couldn't count copies: ${error.message}`);
  return new Map(data.map((r) => [r.edition_id, Number(r.copies)]));
}

export interface CatalogPage {
  editions: (Edition & { copies: number })[];
  total: number;
}

/** One page of the catalog: search by title, author, publisher, series or ISBN, plus a filter. */
export async function searchCatalog(q: string, filter: CatalogFilter, page: number): Promise<CatalogPage> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase.from("editions").select("*", { count: "exact" });

  const text = q.trim();
  const isbn = normalizeIsbn(text);
  if (isbn) query = query.eq("isbn", isbn);
  else if (text) query = query.ilike("search_text", `%${likeEscape(text.toLowerCase())}%`);

  if (filter === "drafts") query = query.eq("status", "draft");
  if (filter === "no-cover") query = query.is("cover_path", null).is("cover_url", null);
  if (filter === "no-isbn") query = query.is("isbn", null);
  if (filter === "duplicates") query = query.in("id", await duplicateIds(supabase));

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.order("title").order("id").range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`Couldn't load the catalog: ${error.message}`);
  const copies = await copiesOf(supabase, data.map((e) => e.id));
  return {
    editions: data.map((row) => ({ ...rowToEdition(row, supabaseUrl()), copies: copies.get(row.id) ?? 0 })),
    total: count ?? data.length,
  };
}

/** Totals for the filter chips. */
export const getCatalogCounts = cache(async (): Promise<Record<CatalogFilter, number>> => {
  await requireAdmin();
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const editions = () => supabase.from("editions").select("id", head);
  const [results, dupes] = await Promise.all([
    Promise.all([
      editions(),
      editions().eq("status", "draft"),
      editions().is("cover_path", null).is("cover_url", null),
      editions().is("isbn", null),
    ]),
    duplicateIds(supabase),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Couldn't count the catalog: ${failed.error.message}`);
  const [all, drafts, noCover, noIsbn] = results.map((r) => r.count ?? 0);
  return { all, drafts, "no-cover": noCover, "no-isbn": noIsbn, duplicates: dupes.length };
});

export interface EditionDetail {
  edition: Edition;
  copies: number;
  /** Your own book linked to this edition, if you have one. */
  myBookId?: string;
}

export const getEdition = cache(async (id: string): Promise<EditionDetail | null> => {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("editions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the edition: ${error.message}`);
  if (!data) return null;
  // RLS shows only your own books, so this finds your copy (if any).
  const [{ data: mine }, copies] = await Promise.all([
    supabase.from("books").select("id").eq("edition_id", id).is("deleted_at", null).limit(1).maybeSingle(),
    copiesOf(supabase, [id]),
  ]);
  return { edition: rowToEdition(data, supabaseUrl()), copies: copies.get(id) ?? 0, myBookId: mine?.id };
});
