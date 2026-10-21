import type { Book } from "@/lib/types";

/** The Favourites page: the books you marked ♥, grouped your way. */

export const GROUPINGS = ["year", "genre", "author", "none"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export interface FavouriteGroup {
  key: string;
  label: string;
  books: Book[];
}

export interface FavouritesSummary {
  count: number;
  averageRating: number | null;
  /** Who and what you love most: the authors and genres with the most favourites (2+). */
  topAuthors: { name: string; books: number }[];
  topGenres: { name: string; books: number }[];
}

const collator = new Intl.Collator(["uk", "en"], { sensitivity: "base", numeric: true });
/** Most recently finished first; never-finished last, by title. */
const byRecent = (a: Book, b: Book) => (b.lastFinishedAt ?? "").localeCompare(a.lastFinishedAt ?? "") || collator.compare(a.title, b.title);

function tally(books: Book[], pick: (b: Book) => string[]): { name: string; books: number }[] {
  const counts = new Map<string, number>();
  for (const b of books) for (const v of new Set(pick(b))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([name, n]) => ({ name, books: n })).sort((a, b) => b.books - a.books || collator.compare(a.name, b.name));
}

export function favouritesSummary(books: Book[]): FavouritesSummary {
  const rated = books.filter((b) => b.rating !== undefined);
  return {
    count: books.length,
    averageRating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating!, 0) / rated.length) * 10) / 10 : null,
    topAuthors: tally(books, (b) => b.authors).filter((a) => a.books >= 2).slice(0, 3),
    topGenres: tally(books, (b) => b.genres).filter((g) => g.books >= 2).slice(0, 3),
  };
}

/**
 * Favourites in groups: by the year you last finished them (newest first, unread last), by genre
 * or by author (biggest groups first; a book with two genres is in both), or all together.
 * Within a group, the most recently finished come first.
 */
export function groupFavourites(books: Book[], by: Grouping): FavouriteGroup[] {
  const sorted = [...books].sort(byRecent);
  if (by === "none") return sorted.length ? [{ key: "all", label: "All favourites", books: sorted }] : [];

  const groups = new Map<string, Book[]>();
  const add = (key: string, b: Book) => groups.set(key, [...(groups.get(key) ?? []), b]);
  for (const b of sorted) {
    if (by === "year") add(b.lastFinishedAt?.slice(0, 4) ?? "", b);
    else {
      const keys = by === "genre" ? b.genres : b.authors;
      if (keys.length === 0) add("", b);
      for (const k of keys) add(k, b);
    }
  }
  const none = by === "year" ? "Not finished yet" : by === "genre" ? "No genre" : "No author";
  return [...groups]
    .map(([key, list]) => ({ key: key || "-", label: key || none, books: list }))
    .sort((a, b) => {
      if (a.key === "-" || b.key === "-") return a.key === "-" ? 1 : -1;
      if (by === "year") return b.key.localeCompare(a.key);
      return b.books.length - a.books.length || collator.compare(a.label, b.label);
    });
}
