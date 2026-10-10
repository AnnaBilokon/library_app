import { COUNTRY_NAMES } from "@/lib/geo/country-names";
import type { Book } from "@/lib/types";

/** Author name → their country codes (one or two, ISO alpha-2). */
export type AuthorCountries = Record<string, string[]>;

export const COUNTRY_CODES = Object.keys(COUNTRY_NAMES);
export const MAX_AUTHOR_COUNTRIES = 2;

export const countryName = (code: string) => COUNTRY_NAMES[code] ?? code;
export const flagSrc = (code: string) => `/flags/${code}.svg`;
export const isCountryCode = (code: string) => code in COUNTRY_NAMES;

/** A book's countries: all its authors' countries, each once (co-authors from two countries give two). */
export function bookCountries(book: Pick<Book, "authors">, map: AuthorCountries): string[] {
  return [...new Set(book.authors.flatMap((a) => map[a] ?? []))];
}

export interface CountryCount {
  code: string;
  name: string;
  /** Books finished in the period whose authors are from this country. */
  books: Book[];
  /** Your average rating for those books (null if none rated). */
  rating: number | null;
  /** First time you read an author from this country (only when looking at one year). */
  isNew: boolean;
  /** Unread books you own by authors from this country (right now). */
  unread: number;
}

export interface WorldReading {
  countries: CountryCount[];
  /** Books finished in the period. */
  total: number;
  /** Of those, books none of whose authors has a country yet. */
  unknown: Book[];
}

/**
 * Where the books you finished (in a year, or ever) come from. A book counts once for each of its
 * countries, so a book by a Ukrainian and a British author counts for both.
 */
export function worldReading(allBooks: Book[], map: AuthorCountries, year: number | null): WorldReading {
  const read = allBooks.filter(
    (b) => !b.wanted && b.readings.some((r) => r.outcome === "finished" && (year === null || r.finishedAt?.startsWith(String(year)))),
  );
  const byCountry = new Map<string, Book[]>();
  const unknown: Book[] = [];
  for (const b of read) {
    const codes = bookCountries(b, map);
    if (codes.length === 0) unknown.push(b);
    for (const c of codes) byCountry.set(c, [...(byCountry.get(c) ?? []), b]);
  }
  // Countries you'd read before this year (an undated finish counts as before).
  const before = new Set<string>();
  if (year !== null)
    for (const b of allBooks)
      if (!b.wanted && b.readings.some((r) => r.outcome === "finished" && (!r.finishedAt || r.finishedAt < `${year}`)))
        for (const c of bookCountries(b, map)) before.add(c);
  const unreadOwned = allBooks.filter((b) => !b.wanted && b.owned && !b.soldAt && b.timesRead === 0);
  const countries = [...byCountry]
    .map(([code, books]) => {
      const ratings = books.flatMap((b) => (b.rating !== undefined ? [b.rating] : []));
      return {
        code,
        name: countryName(code),
        books,
        rating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null,
        isNew: year !== null && !before.has(code),
        unread: unreadOwned.filter((b) => bookCountries(b, map).includes(code)).length,
      };
    })
    .sort((a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name, "en"));
  return { countries, total: read.length, unknown };
}

/** Every author in your library (not wishlist), with how many books, those without a country first. */
export function authorList(books: Book[], map: AuthorCountries): { author: string; books: number; countries: string[] }[] {
  const counts = new Map<string, number>();
  for (const b of books) if (!b.wanted) for (const a of b.authors) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts]
    .map(([author, n]) => ({ author, books: n, countries: map[author] ?? [] }))
    .sort((a, b) => Number(a.countries.length > 0) - Number(b.countries.length > 0) || b.books - a.books || a.author.localeCompare(b.author, "uk"));
}
