import type { Book, BookFormat, BookStatus } from "@/lib/types";

export const SORT_KEYS = ["title", "author", "added", "finished", "rating", "pages", "published"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const SORT_LABEL: Record<SortKey, string> = {
  title: "Title",
  author: "Author",
  added: "Date added",
  finished: "Date finished",
  rating: "Rating",
  pages: "Pages",
  published: "Year published",
};

/** The natural direction when a sort is first picked (newest / highest first for dates and numbers). */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  title: "asc",
  author: "asc",
  added: "desc",
  finished: "desc",
  rating: "desc",
  pages: "desc",
  published: "desc",
};

/** Details a book can be missing; the Stats page links to the Library filtered by these. */
export const MISSING_FIELDS = ["finish-date", "pages", "genre", "cover"] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

export const MISSING_LABEL: Record<MissingField, string> = {
  "finish-date": "No finish date",
  pages: "No page count",
  genre: "No genre",
  cover: "No cover",
};

export function isMissing(b: Book, field: MissingField): boolean {
  if (field === "finish-date") return b.readings.some((r) => r.outcome === "finished" && !r.finishedAt);
  if (field === "pages") return !b.pages;
  if (field === "genre") return b.genres.length === 0;
  return !b.coverSrc;
}

export interface BookFilters {
  q: string;
  status: BookStatus[];
  genre: string[];
  tag: string[];
  author: string | null;
  language: string[];
  format: BookFormat[];
  publisher: string[];
  series: string | null;
  /** The Library shows the books on your shelves; false shows the ones you read but don't own. */
  owned: boolean | null;
  favorite: boolean | null;
  /** Only books read more than once. */
  reread: boolean | null;
  ratingMin: number | null;
  ratingMax: number | null;
  finishedYear: number | null;
  pagesMin: number | null;
  pagesMax: number | null;
  /** Books missing any of these details. */
  missing: MissingField[];
  /** Authors' countries (ISO codes); needs the author → countries map. */
  country: string[];
}

export const EMPTY_FILTERS: BookFilters = {
  q: "",
  status: [],
  genre: [],
  tag: [],
  author: null,
  language: [],
  format: [],
  publisher: [],
  series: null,
  owned: null,
  favorite: null,
  reread: null,
  ratingMin: null,
  ratingMax: null,
  finishedYear: null,
  pagesMin: null,
  pagesMax: null,
  missing: [],
  country: [],
};

/**
 * Lower-case and strip accents so "Емма" matches "емма" and "Mio" matches "Mío".
 * (Ukrainian й/ї lose their marks too, so search is forgiving about them.)
 */
export function normalize(text: string): string {
  return text.toLocaleLowerCase("uk").normalize("NFD").replace(/\p{M}/gu, "");
}

const anyOf = <T>(selected: T[], values: T[]) => selected.length === 0 || selected.some((s) => values.includes(s));
const within = (value: number | undefined, min: number | null, max: number | null) =>
  (min === null && max === null) || (value !== undefined && (min === null || value >= min) && (max === null || value <= max));

export function filterBooks(books: Book[], f: BookFilters, authorCountries: Record<string, string[]> = {}): Book[] {
  const terms = normalize(f.q).split(/\s+/).filter(Boolean);
  return books.filter((b) => {
    if (terms.length) {
      const haystack = normalize([b.title, ...b.authors, b.series ?? "", b.publisher ?? "", b.notes ?? ""].join(" "));
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    if (!anyOf(f.status, [b.status])) return false;
    if (!anyOf(f.genre, b.genres)) return false;
    if (!anyOf(f.tag, b.tags)) return false;
    if (f.author && !b.authors.includes(f.author)) return false;
    if (!anyOf(f.language, b.language ? [b.language] : [])) return false;
    if (!anyOf(f.format, b.format ? [b.format] : [])) return false;
    if (!anyOf(f.publisher, b.publisher ? [b.publisher] : [])) return false;
    if (f.series && b.series !== f.series) return false;
    // Your shelves by default; books you read elsewhere (borrowed, sold before, ebooks) on request.
    if (f.owned === false ? b.owned : !b.owned) return false;
    if (f.favorite !== null && b.favorite !== f.favorite) return false;
    if (f.reread && b.timesRead < 2) return false;
    if (!within(b.rating, f.ratingMin, f.ratingMax)) return false;
    if (!within(b.pages, f.pagesMin, f.pagesMax)) return false;
    if (f.missing.length && !f.missing.some((m) => isMissing(b, m))) return false;
    if (f.country.length && !b.authors.some((a) => (authorCountries[a] ?? []).some((c) => f.country.includes(c)))) return false;
    if (f.finishedYear !== null && !b.readings.some((r) => r.finishedAt?.startsWith(String(f.finishedYear))))
      return false;
    return true;
  });
}

const collator = new Intl.Collator(["uk", "en"], { sensitivity: "base", numeric: true });

/** Sort by surname: the last word of the first author ("Джейн Остін" → "Остін"). */
function authorKey(b: Book): string {
  const first = b.authors[0] ?? "";
  const parts = first.trim().split(/\s+/);
  return `${parts.at(-1) ?? ""} ${parts.slice(0, -1).join(" ")}`;
}

const sortValue: Record<SortKey, (b: Book) => string | number | undefined> = {
  title: (b) => b.title,
  author: (b) => (b.authors.length ? authorKey(b) : undefined),
  // When it joined your library: added in the app, or bought later (a wishlist book).
  added: (b) => (b.acquiredAt && `${b.acquiredAt}T00:00:00Z` > b.createdAt ? `${b.acquiredAt}T00:00:00Z` : b.createdAt),
  finished: (b) => b.lastFinishedAt,
  rating: (b) => b.rating,
  pages: (b) => b.pages,
  published: (b) => b.publishedYear,
};

/** Returns a new array. Books without a value go last in either direction; ties fall back to title. */
export function sortBooks(books: Book[], key: SortKey, dir: SortDir): Book[] {
  const get = sortValue[key];
  const sign = dir === "asc" ? 1 : -1;
  return [...books].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === undefined || vb === undefined) {
      if (va !== vb) return va === undefined ? 1 : -1;
    } else {
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb));
      if (c !== 0) return c * sign;
    }
    return collator.compare(a.title, b.title);
  });
}

export function countActiveFilters(f: BookFilters): number {
  let n = 0;
  for (const key of Object.keys(EMPTY_FILTERS) as (keyof BookFilters)[]) {
    if (key === "q") continue;
    const v = f[key];
    if (Array.isArray(v) ? v.length > 0 : v !== null) n++;
  }
  return n;
}

export interface FacetOption {
  value: string;
  count: number;
}

/** Values present in the library, with counts, most common first. Drives the filter options. */
export function facets(books: Book[]) {
  const tally = (pick: (b: Book) => (string | undefined)[]) => {
    const map = new Map<string, number>();
    for (const b of books) for (const v of new Set(pick(b))) if (v) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map]
      .map(([value, count]): FacetOption => ({ value, count }))
      .sort((a, b) => b.count - a.count || collator.compare(a.value, b.value));
  };
  const years = new Set<number>();
  for (const b of books) for (const r of b.readings) if (r.finishedAt) years.add(Number(r.finishedAt.slice(0, 4)));

  return {
    status: tally((b) => [b.status]),
    genre: tally((b) => b.genres),
    tag: tally((b) => b.tags),
    author: tally((b) => b.authors),
    language: tally((b) => [b.language]),
    format: tally((b) => [b.format]),
    publisher: tally((b) => [b.publisher]),
    series: tally((b) => [b.series]),
    finishedYears: [...years].sort((a, b) => b - a),
    hasRatings: books.some((b) => b.rating !== undefined),
    hasPages: books.some((b) => b.pages !== undefined),
    maxPages: Math.max(0, ...books.map((b) => b.pages ?? 0)),
  };
}

export type Facets = ReturnType<typeof facets>;
