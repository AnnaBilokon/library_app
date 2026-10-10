import { computeBattle, type Picks } from "@/lib/battle";
import { bookishFacts, genreTiles, shelfBooks, type BookishFacts, type GenreTile, type ShelfBook } from "@/lib/bookish";
import { MONTHS } from "@/lib/challenge";
import { worldReading, type AuthorCountries, type CountryCount } from "@/lib/countries";
import { computeExtras, computeStats, type Money } from "@/lib/stats";
import type { Book } from "@/lib/types";

export interface YearInBooks {
  year: number;
  books: number;
  pages: number;
  averageRating: number | null;
  /** Your Book Battle winners, if the final was decided. */
  bestOfYear: Book | null;
  worstOfYear: Book | null;
  /** When the battle isn't decided: the highest-rated book of the year instead. */
  topRated: Book | null;
  favourites: Book[];
  topAuthor: { name: string; books: number } | null;
  topGenre: { name: string; books: number } | null;
  topCountry: CountryCount | null;
  countries: number;
  newCountries: CountryCount[];
  newAuthors: number;
  months: { label: string; books: number }[];
  bestMonth: { label: string; books: number } | null;
  facts: BookishFacts;
  shelf: ShelfBook[];
  /** The shelf again, as boxes coloured by genre. */
  genres: { tiles: GenreTile[]; legend: { genre: string; slot: number; count: number }[] };
  spent: Money[];
  earned: Money[];
  sold: number;
  /** Last year's totals, for the comparison (null when you read nothing then). */
  previous: { books: number; pages: number; averageRating: number | null } | null;
  goal: { goal: number; met: boolean } | null;
}

/**
 * Everything for the year's report, from data the app already has: stats, battle picks, author
 * countries and the reading goal. `today` decides which battle rounds count as open.
 */
export function yearInBooks(
  books: Book[],
  year: number,
  opts: { picks: { best: Picks; worst: Picks }; countries: AuthorCountries; goal: number | null; today: string },
): YearInBooks {
  const stats = computeStats(books, year);
  const extras = computeExtras(books, year);
  const world = worldReading(books, opts.countries, year);
  const best = computeBattle(books, opts.picks.best, year, "best", opts.today).champion;
  const worst = computeBattle(books, opts.picks.worst, year, "worst", opts.today).champion;
  const shelf = shelfBooks(books, year);
  const months = MONTHS.map((label, m) => ({ label, books: shelf.filter((b) => Number(b.finishedAt.slice(5, 7)) === m + 1).length }));
  const bestMonth = months.reduce<{ label: string; books: number } | null>((top, m) => (m.books > (top?.books ?? 0) ? m : top), null);
  const prev = computeStats(books, year - 1);

  return {
    year,
    books: stats.readings,
    pages: stats.pages,
    averageRating: stats.averageRating,
    bestOfYear: best,
    worstOfYear: worst,
    topRated: extras.topRated[0] ?? null,
    favourites: extras.favourites,
    topAuthor: stats.authors[0] ? { name: stats.authors[0].label, books: stats.authors[0].count } : null,
    topGenre: stats.genresRead[0] ? { name: stats.genresRead[0].label, books: stats.genresRead[0].count } : null,
    topCountry: world.countries[0] ?? null,
    countries: world.countries.length,
    newCountries: world.countries.filter((c) => c.isNew),
    newAuthors: extras.authorsNewVsFamiliar?.fresh ?? 0,
    months,
    bestMonth,
    facts: bookishFacts(shelf),
    shelf,
    genres: genreTiles(books, year),
    spent: stats.money.spent,
    earned: stats.money.earned,
    sold: stats.money.soldBooks,
    previous: prev.readings > 0 ? { books: prev.readings, pages: prev.pages, averageRating: prev.averageRating } : null,
    goal: opts.goal ? { goal: opts.goal, met: stats.readings >= opts.goal } : null,
  };
}

/** Years worth a report: those with a dated finished reading, newest first. */
export function reportYears(books: Book[]): number[] {
  const years = new Set<number>();
  for (const b of books) for (const r of b.readings) if (r.outcome === "finished" && r.finishedAt) years.add(Number(r.finishedAt.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}
