import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { reportYears, topRatedOfYear, yearInBooks } from "./year-in-books";

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
    expect(y.topRated.map((b) => b.title)).toEqual(["Перша"]);
    expect(y.chosenOfYear).toBeNull();
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

describe("the year's top-rated books", () => {
  const five = (title: string, finished: string, o: Partial<Book> = {}) => book(title, [finished], { rating: 5, ...o });

  it("keeps ties as ties instead of picking the last one finished", () => {
    const books = [five("A", "2026-01-10"), five("B", "2026-09-01"), book("C", ["2026-05-01"], { rating: 4 })];
    expect(topRatedOfYear(books, 2026).map((b) => b.title).sort()).toEqual(["A", "B"]);
  });

  it("prefers your favourites among books sharing the top rating", () => {
    const books = [five("A", "2026-01-10", { favorite: true }), five("B", "2026-09-01"), five("C", "2026-03-01")];
    expect(topRatedOfYear(books, 2026).map((b) => b.title)).toEqual(["A"]);
  });

  it("needs 4.5★ or more, and only counts the year's reads", () => {
    expect(topRatedOfYear([book("A", ["2026-01-10"], { rating: 4 })], 2026)).toEqual([]);
    expect(topRatedOfYear([five("Old", "2025-12-31")], 2026)).toEqual([]);
  });

  it("uses your chosen book of the year when it was read that year", () => {
    const books = [five("A", "2026-01-10"), five("B", "2026-09-01")];
    const opts = { picks: { best: {}, worst: {} }, countries: {}, goal: null, today: "2026-10-20" };
    expect(yearInBooks(books, 2026, { ...opts, chosen: "A" }).chosenOfYear?.title).toBe("A");
    expect(yearInBooks(books, 2026, { ...opts, chosen: "not read this year" }).chosenOfYear).toBeNull();
  });
});
