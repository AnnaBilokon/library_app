import { duplicateKey } from "@/lib/books/duplicates";
import { normalize } from "@/lib/books/filters";
import { coverPublicUrl } from "@/lib/books/mapping";
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type BookRow = Tables["books"]["Row"];
export type EditionRow = Tables["editions"]["Row"];
export type EditionStatus = Database["public"]["Enums"]["edition_status"];

/** A catalog edition as the app sees it (camelCase, no nulls). */
export interface Edition {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  language?: string;
  originalLanguage?: string;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  series?: string;
  seriesIndex?: number;
  genres: string[];
  description?: string;
  coverSrc?: string;
  coverPath?: string;
  sourceUrl?: string;
  status: EditionStatus;
  createdAt: string;
  updatedAt: string;
}

const opt = <T>(value: T | null): T | undefined => value ?? undefined;

export function rowToEdition(row: EditionRow, supabaseUrl: string): Edition {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    isbn: opt(row.isbn),
    language: opt(row.language),
    originalLanguage: opt(row.original_language),
    publisher: opt(row.publisher),
    publishedYear: opt(row.published_year),
    pages: opt(row.pages),
    series: opt(row.series),
    seriesIndex: opt(row.series_index),
    genres: row.genres,
    description: opt(row.description),
    coverSrc: row.cover_path ? coverPublicUrl(supabaseUrl, row.cover_path) : opt(row.cover_url),
    coverPath: opt(row.cover_path),
    sourceUrl: opt(row.source_url),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The details an edition and a person's book share. Everything else on a book (status, rating,
 * review, notes, tags, prices, shelves) is personal and never goes into the catalog.
 */
export const SHARED_FIELDS = [
  "title",
  "authors",
  "isbn",
  "language",
  "original_language",
  "publisher",
  "published_year",
  "pages",
  "series",
  "series_index",
  "genres",
  "description",
] as const satisfies readonly (keyof BookRow & keyof EditionRow)[];

export type SharedFields = Pick<EditionRow, (typeof SHARED_FIELDS)[number]>;

/** The shared details of a book (or an edition), ready to insert into the other table. */
export function sharedFields(row: SharedFields): SharedFields {
  return Object.fromEntries(SHARED_FIELDS.map((f) => [f, row[f]])) as SharedFields;
}

/**
 * Books that are the same edition: the same ISBN, or without one, the same title, authors and
 * publisher (ignoring case and accents).
 */
export function editionKey(row: Pick<BookRow, "isbn" | "title" | "authors" | "publisher">): string {
  if (row.isbn) return `isbn:${row.isbn}`;
  return `title:${duplicateKey(row)}|${normalize(row.publisher?.trim() ?? "")}`;
}

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");

/** Of several copies of one edition, the one with the most details (a cover counts double). */
export function pickRichest<T extends SharedFields & Pick<BookRow, "cover_path" | "cover_url">>(rows: T[]): T {
  const score = (r: T) => SHARED_FIELDS.filter((f) => filled(r[f])).length + (r.cover_path ? 2 : r.cover_url ? 1 : 0);
  return rows.reduce((best, r) => (score(r) > score(best) ? r : best));
}

/** Ids of editions that look like the same book entered twice (same title and authors). */
export function possibleDuplicates(editions: Pick<EditionRow, "id" | "title" | "authors">[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const e of editions) {
    const key = duplicateKey(e);
    groups.set(key, [...(groups.get(key) ?? []), e.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}

/** Where a catalog cover lives in the 'covers' bucket. */
export function catalogCoverPath(editionId: string, ext: string, suffix: string): string {
  return `catalog/${editionId}-${suffix}.${ext}`;
}
