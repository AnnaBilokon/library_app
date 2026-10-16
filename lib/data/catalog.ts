import "server-only";
import { cache } from "react";
import { requireAdmin, requireUser } from "@/lib/auth";
import { likeEscape, possibleDuplicates, rowToEdition, type Edition } from "@/lib/catalog/editions";
import { normalizeIsbn } from "@/lib/isbn";
import { createClient } from "@/lib/supabase/server";
import { catalogShortlist } from "@/lib/books/similar";
import type { Book, BookStatus } from "@/lib/types";

export const CATALOG_FILTERS = ["all", "recent", "to-review", "drafts", "no-cover", "no-isbn", "duplicates"] as const;
export type CatalogFilter = (typeof CATALOG_FILTERS)[number];
export const PAGE_SIZE = 50;
/** "Recently added" looks this many days back. */
export const RECENT_DAYS = 30;

const recentSince = () => new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
/** Filters that list the newest editions first (everything else is alphabetical). */
const NEWEST_FIRST: readonly CatalogFilter[] = ["recent", "to-review"];

type Supabase = Awaited<ReturnType<typeof createClient>>;
const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

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

  if (filter === "recent") query = query.gte("created_at", recentSince());
  if (filter === "to-review") query = query.is("reviewed_at", null);
  if (filter === "drafts") query = query.eq("status", "draft");
  if (filter === "no-cover") query = query.is("cover_path", null).is("cover_url", null);
  if (filter === "no-isbn") query = query.is("isbn", null);
  if (filter === "duplicates") query = query.in("id", await duplicateIds(supabase));

  const from = (page - 1) * PAGE_SIZE;
  const ordered = NEWEST_FIRST.includes(filter) ? query.order("created_at", { ascending: false }) : query.order("title");
  const { data, error, count } = await ordered.order("id").range(from, from + PAGE_SIZE - 1);
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
      editions().gte("created_at", recentSince()),
      editions().is("reviewed_at", null),
      editions().eq("status", "draft"),
      editions().is("cover_path", null).is("cover_url", null),
      editions().is("isbn", null),
    ]),
    duplicateIds(supabase),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Couldn't count the catalog: ${failed.error.message}`);
  const [all, recent, toReview, drafts, noCover, noIsbn] = results.map((r) => r.count ?? 0);
  return { all, recent, "to-review": toReview, drafts, "no-cover": noCover, "no-isbn": noIsbn, duplicates: dupes.length };
});

/** Your own book linked to an edition: where it is and whether it has a cover. */
export interface MyCopy {
  id: string;
  where: "shelves" | "not-owned" | "wishlist" | "sold";
  status: BookStatus;
  hasCover: boolean;
}

export interface EditionDetail {
  edition: Edition;
  copies: number;
  myCopy?: MyCopy;
}

export const getEdition = cache(async (id: string): Promise<EditionDetail | null> => {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("editions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the edition: ${error.message}`);
  if (!data) return null;
  // RLS shows only your own books, so this finds your copy (if any).
  const [{ data: mine }, copies] = await Promise.all([
    supabase
      .from("books")
      .select("id, owned, wanted, sold_at, status, cover_path, cover_url")
      .eq("edition_id", id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
    copiesOf(supabase, [id]),
  ]);
  const myCopy: MyCopy | undefined = mine
    ? {
        id: mine.id,
        where: mine.wanted ? "wishlist" : mine.sold_at ? "sold" : mine.owned ? "shelves" : "not-owned",
        status: mine.status,
        hasCover: Boolean(mine.cover_path || mine.cover_url),
      }
    : undefined;
  return { edition: rowToEdition(data, supabaseUrl()), copies: copies.get(id) ?? 0, myCopy };
});

/** An edition you can see (public, or your own draft), to start a new book from it. */
export const getVisibleEdition = cache(async (id: string): Promise<Edition | null> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("editions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the edition: ${error.message}`);
  return data ? rowToEdition(data, supabaseUrl()) : null;
});

/**
 * Catalog editions to suggest next to `book`: public ones you don't have a book for, closest
 * first (see catalogShortlist). Reads only a few columns of the whole catalog, then the full rows
 * of the shortlist.
 */
export async function getCatalogShortlist(book: Book, myEditionIds: Set<string>): Promise<Edition[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editions")
    .select("id, title, authors, genres, series, created_at")
    .eq("status", "public")
    .limit(5000);
  if (error) throw new Error(`Couldn't load the catalog: ${error.message}`);
  const ids = catalogShortlist(
    book,
    data.map((e) => ({ id: e.id, title: e.title, authors: e.authors, genres: e.genres, series: e.series ?? undefined, createdAt: e.created_at })),
    myEditionIds,
  );
  if (ids.length === 0) return [];
  const { data: rows, error: rowsError } = await supabase.from("editions").select("*").in("id", ids);
  if (rowsError) throw new Error(`Couldn't load the catalog: ${rowsError.message}`);
  const byId = new Map(rows.map((r) => [r.id, rowToEdition(r, supabaseUrl())]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
