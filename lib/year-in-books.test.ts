import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { reportYears, yearInBooks } from "./year-in-books";

let n = 0;
const book = (title: string, finished: string[], o: Partial<Book> = {}) =>
  ({
    id: title,
    title,
    authors: ["Автор"],
    genres: ["Fiction"],
    tags: [],
    wanted: false,
    owned: true,
    forSale: false,
    forgotten: false,
    favorite: false,
    status: "finished",
    currency: "UAH",
    readings: finished.map((d) => ({ id: `r${++n}`, outcome: "finished", finishedAt: d })),
    timesRead: finished.length,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...o,
  }) as Book;

const books = [
  book("Перша", ["2026-01-10"], { rating: 5, pages: 300, authors: ["Жадан"], favorite: true }),
  book("Друга", ["2026-01-20"], { rating: 3, pages: 200, authors: ["Жадан"] }),
  book("Третя", ["2026-03-05"], { rating: 4, authors: ["Гейман"], genres: ["Fantasy"] }),
  book("Торішня", ["2025-06-01"], { rating: 2, pages: 100, authors: ["Інший"] }),
];
const opts = { picks: { best: {}, worst: {} }, countries: { Жадан: ["UA"], Гейман: ["GB"], Інший: ["UA"] }, goal: 3, today: "2026-10-10" };

describe("year in books", () => {
  it("lists the years worth a report", () => {
    expect(reportYears(books)).toEqual([2026, 2025]);
  });

  it("sums up the year", () => {
    const y = yearInBooks(books, 2026, opts);
    expect(y.books).toBe(3);
    expect(y.pages).toBe(500);
    expect(y.averageRating).toBe(4);
    expect(y.topAuthor).toEqual({ name: "Жадан", books: 2 });
    expect(y.topGenre).toEqual({ name: "Fiction", books: 2 });
    expect(y.topCountry?.code).toBe("UA");
    expect(y.countries).toBe(2);
    // UA was read in 2025 already; GB is new.
    expect(y.newCountries.map((c) => c.code)).toEqual(["GB"]);
    expect(y.newAuthors).toBe(2);
    expect(y.bestMonth).toEqual({ label: "Jan", books: 2 });
    expect(y.topRated?.title).toBe("Перша");
    expect(y.favourites.map((b) => b.title)).toEqual(["Перша"]);
    expect(y.goal).toEqual({ goal: 3, met: true });
    expect(y.previous).toEqual({ books: 1, pages: 100, averageRating: 2 });
    // No battle decided: no champion, the top-rated book stands in.
    expect(y.bestOfYear).toBeNull();
  });

  it("has nothing to compare with in the first year", () => {
    expect(yearInBooks(books, 2025, { ...opts, goal: null }).previous).toBeNull();
  });
});
