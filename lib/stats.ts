import { MONTHS } from "@/lib/challenge";
import { isSold } from "@/lib/selling";
import type { Book, Reading } from "@/lib/types";

/** A finished (or stopped) reading together with its book. */
interface Entry {
  book: Book;
  reading: Reading;
  /** This book was already finished before (a re-read). */
  reread: boolean;
}

export interface CountRow {
  label: string;
  count: number;
}

export interface GenreReadRow extends CountRow {
  /** Average of your ratings for the books read in this genre. */
  rating: number | null;
}

export interface GenreShelfRow extends CountRow {
  /** Of those, books you haven't finished yet. */
  unread: number;
}

export interface PaceBook {
  id: string;
  title: string;
  days: number;
}

export interface Stats {
  year: number | null;
  /** Different books finished. */
  booksRead: number;
  /** Finished readings, re-reads included. */
  readings: number;
  rereads: number;
  dnf: number;
  pages: number;
  /** Finished readings whose book has a page count (pages only add up for these). */
  pagesKnown: number;
  averageRating: number | null;
  /** Books per year (all years) or per month (one year). */
  timeline: { label: string; books: number; pages: number }[];
  /** Finished readings without a date (only counted in "All years"). */
  undated: number;
  /** 5★ first. */
  ratings: { stars: number; count: number }[];
  genresRead: GenreReadRow[];
  genresShelf: GenreShelfRow[];
  authors: CountRow[];
  languages: CountRow[];
  formats: CountRow[];
  pace: { averageDays: number; count: number; fastest: PaceBook; longest: PaceBook } | null;
  money: { spent: Money[]; spentBooks: number; earned: Money[]; soldBooks: number };
}

export interface Money {
  currency: string;
  total: number;
}

/** You started noting what you pay for books in September 2026; older prices are left out of spending. */
export const SPENDING_SINCE = "2026-09-01";

const inYear = (date: string | undefined, year: number | null) => year === null || (date?.startsWith(String(year)) ?? false);

function finishedEntries(books: Book[], year: number | null): Entry[] {
  return books.flatMap((book) => {
    const finished = book.readings.filter((r) => r.outcome === "finished");
    return finished
      .map((reading, i) => ({ book, reading, reread: i > 0 }))
      .filter((e) => inYear(e.reading.finishedAt, year));
  });
}

const entryRating = (e: Entry) => e.reading.rating ?? e.book.rating;

function average(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function tally(labels: string[], limit?: number): CountRow[] {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const rows = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "uk"));
  return limit ? rows.slice(0, limit) : rows;
}

function sumMoney(items: { amount: number; currency: string }[]): Money[] {
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.amount);
  return [...totals].map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }));
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** Years that have at least one dated finished reading, newest first. */
export function statsYears(books: Book[]): number[] {
  const years = new Set<number>();
  for (const b of books) for (const r of b.readings) if (r.outcome === "finished" && r.finishedAt) years.add(Number(r.finishedAt.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

/**
 * Everything on the Stats page, for all years (year = null) or one year. Wishlist books are left
 * out; sold books still count as read (you did read them), but not as on your shelves.
 */
export function computeStats(allBooks: Book[], year: number | null, topN = 8): Stats {
  const books = allBooks.filter((b) => !b.wanted);
  const entries = finishedEntries(books, year);
  const readBooks = [...new Map(entries.map((e) => [e.book.id, e.book])).values()];

  // Did not finish: stopped readings in scope, plus (all years) books marked so without one.
  const stopped = books.flatMap((b) => b.readings.filter((r) => r.outcome === "abandoned" && inYear(r.finishedAt, year)));
  const markedOnly = year === null ? books.filter((b) => b.status === "abandoned" && !b.readings.some((r) => r.outcome === "abandoned")).length : 0;

  const withPages = entries.filter((e) => e.book.pages);

  let timeline: Stats["timeline"];
  if (year === null) {
    const years = statsYears(books).sort((a, b) => a - b);
    const span = years.length ? Array.from({ length: years.at(-1)! - years[0] + 1 }, (_, i) => years[0] + i) : [];
    timeline = span.map((y) => {
      const es = entries.filter((e) => e.reading.finishedAt?.startsWith(String(y)));
      return { label: String(y), books: es.length, pages: es.reduce((s, e) => s + (e.book.pages ?? 0), 0) };
    });
  } else {
    timeline = MONTHS.map((label, m) => {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      const es = entries.filter((e) => e.reading.finishedAt?.startsWith(key));
      return { label, books: es.length, pages: es.reduce((s, e) => s + (e.book.pages ?? 0), 0) };
    });
  }

  const genreRows = tally(readBooks.flatMap((b) => b.genres), topN);
  const genresRead = genreRows.map((g) => ({
    ...g,
    rating: average(readBooks.filter((b) => b.genres.includes(g.label) && b.rating).map((b) => b.rating!)),
  }));

  const shelf = books.filter((b) => b.owned && !isSold(b));
  const genresShelf = tally(shelf.flatMap((b) => b.genres), topN).map((g) => ({
    ...g,
    unread: shelf.filter((b) => b.genres.includes(g.label) && b.timesRead === 0).length,
  }));

  const timed = entries
    .filter((e) => e.reading.startedAt && e.reading.finishedAt && e.reading.finishedAt >= e.reading.startedAt)
    .map((e) => ({ id: e.book.id, title: e.book.title, days: dayDiff(e.reading.startedAt!, e.reading.finishedAt!) }));
  const pace = timed.length
    ? {
        averageDays: Math.round(timed.reduce((s, t) => s + t.days, 0) / timed.length),
        count: timed.length,
        fastest: timed.reduce((a, b) => (b.days < a.days ? b : a)),
        longest: timed.reduce((a, b) => (b.days > a.days ? b : a)),
      }
    : null;

  // Spending counts by when the book joined your library, from SPENDING_SINCE on.
  const boughtOn = (b: Book) => b.acquiredAt ?? b.createdAt.slice(0, 10);
  const bought = books.filter((b) => b.purchasePrice !== undefined && boughtOn(b) >= SPENDING_SINCE && inYear(boughtOn(b), year));
  const sold = books.filter((b) => isSold(b) && inYear(b.soldAt, year));

  return {
    year,
    booksRead: readBooks.length,
    readings: entries.length,
    rereads: entries.filter((e) => e.reread).length,
    dnf: stopped.length + markedOnly,
    pages: withPages.reduce((s, e) => s + e.book.pages!, 0),
    pagesKnown: withPages.length,
    averageRating: average(entries.map(entryRating).filter((r): r is number => r !== undefined)),
    timeline,
    undated: year === null ? entries.filter((e) => !e.reading.finishedAt).length : 0,
    ratings: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: entries.filter((e) => Math.round(entryRating(e) ?? 0) === stars).length })),
    genresRead,
    genresShelf,
    authors: tally(entries.flatMap((e) => e.book.authors), topN),
    languages: tally(readBooks.map((b) => b.language ?? "")).filter((r) => r.label),
    formats: tally(readBooks.map((b) => b.format ?? "")).filter((r) => r.label),
    pace,
    money: {
      spent: sumMoney(bought.map((b) => ({ amount: b.purchasePrice!, currency: b.currency }))),
      spentBooks: bought.length,
      earned: sumMoney(sold.filter((b) => b.salePrice !== undefined).map((b) => ({ amount: b.salePrice!, currency: b.currency }))),
      soldBooks: sold.length,
    },
  };
}
