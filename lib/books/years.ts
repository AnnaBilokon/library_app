import type { Book } from "@/lib/types";

export interface YearSection {
  /** null = finished, but the date isn't known. */
  year: number | null;
  books: Book[];
}

/**
 * Splits books (already sorted) into sections by the year of their last finish:
 * newest year first, "date unknown" last. The order inside each section is kept.
 */
export function groupByFinishedYear(books: Book[]): YearSection[] {
  const byYear = new Map<number | null, Book[]>();
  for (const b of books) {
    const year = b.lastFinishedAt ? Number(b.lastFinishedAt.slice(0, 4)) : null;
    byYear.set(year, [...(byYear.get(year) ?? []), b]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a))
    .map(([year, list]) => ({ year, books: list }));
}
