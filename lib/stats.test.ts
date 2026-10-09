import { describe, expect, it } from "vitest";
import type { Book, Reading } from "@/lib/types";
import { computeStats, statsYears } from "./stats";

let n = 0;
const read = (finishedAt?: string, o: Partial<Reading> = {}): Reading => ({ id: `r${++n}`, outcome: "finished", finishedAt, ...o });
const book = (o: Partial<Book>) =>
  ({
    id: `b${++n}`,
    title: "x",
    authors: [],
    genres: [],
    owned: true,
    wanted: false,
    forSale: false,
    status: "finished",
    currency: "UAH",
    readings: [],
    timesRead: (o.readings ?? []).filter((r) => r.outcome === "finished").length,
    ...o,
  }) as Book;

const library = [
  book({ title: "A", authors: ["Ліз Мур"], genres: ["Fiction"], rating: 5, pages: 300, readings: [read("2025-03-01"), read("2026-02-10", { rating: 4 })] }),
  book({ title: "B", authors: ["Ліз Мур"], genres: ["Fiction"], rating: 3, pages: 200, readings: [read("2026-02-20", { startedAt: "2026-02-01" })] }),
  book({ title: "C", authors: ["Інший"], genres: ["History"], rating: 2, readings: [read(undefined)] }),
  book({ title: "D", genres: ["History"], status: "to-read" }),
  book({ title: "E", genres: ["History"], status: "abandoned", readings: [read("2026-05-01", { outcome: "abandoned" })] }),
  book({ title: "Sold", genres: ["Romance"], rating: 1, owned: false, soldAt: "2026-06-01", salePrice: 120, readings: [read("2026-01-05", { startedAt: "2025-12-27" })] }),
  book({ title: "Wish", genres: ["Romance"], wanted: true, owned: false, status: "to-read" }),
  book({ title: "Bought", genres: ["History"], status: "to-read", purchasePrice: 400, acquiredAt: "2026-09-12" }),
  book({ title: "Bought before prices", status: "to-read", purchasePrice: 999, acquiredAt: "2026-04-01" }),
  book({ title: "Added with a price", status: "to-read", purchasePrice: 50, createdAt: "2026-10-02T09:00:00Z" }),
];

describe("stats", () => {
  it("lists years with dated finished readings", () => {
    expect(statsYears(library)).toEqual([2026, 2025]);
  });

  it("counts all years, including undated finishes and re-reads", () => {
    const s = computeStats(library, null);
    expect(s.booksRead).toBe(4);
    expect(s.readings).toBe(5);
    expect(s.rereads).toBe(1);
    expect(s.undated).toBe(1);
    expect(s.dnf).toBe(1);
    expect(s.pages).toBe(800);
    expect(s.pagesKnown).toBe(3);
    expect(s.timeline).toEqual([
      { label: "2025", books: 1, pages: 300 },
      { label: "2026", books: 3, pages: 500 },
    ]);
  });

  it("narrows to one year, by month", () => {
    const s = computeStats(library, 2026);
    expect(s.booksRead).toBe(3);
    expect(s.rereads).toBe(1);
    expect(s.undated).toBe(0);
    expect(s.timeline[1]).toEqual({ label: "Feb", books: 2, pages: 500 });
    expect(s.timeline[0].books).toBe(1);
  });

  it("uses the reading's own rating, else the book's", () => {
    const s = computeStats(library, 2026);
    // A re-read rated 4, B 3, Sold 1
    expect(s.averageRating).toBe(2.7);
    expect(s.ratings).toEqual([
      { stars: 5, count: 0 },
      { stars: 4, count: 1 },
      { stars: 3, count: 1 },
      { stars: 2, count: 0 },
      { stars: 1, count: 1 },
    ]);
  });

  it("compares genres you read with genres on your shelves", () => {
    const s = computeStats(library, null);
    expect(s.genresRead).toEqual([
      { label: "Fiction", count: 2, rating: 4 },
      { label: "History", count: 1, rating: 2 },
      { label: "Romance", count: 1, rating: 1 },
    ]);
    // Sold and wishlist books aren't on your shelves.
    expect(s.genresShelf).toEqual([
      { label: "History", count: 4, unread: 3 },
      { label: "Fiction", count: 2, unread: 0 },
    ]);
    expect(s.authors[0]).toEqual({ label: "Ліз Мур", count: 3 });
  });

  it("works out pace from readings with both dates", () => {
    const s = computeStats(library, null);
    expect(s.pace?.count).toBe(2);
    expect(s.pace?.fastest).toMatchObject({ title: "Sold", days: 10 });
    expect(s.pace?.longest).toMatchObject({ title: "B", days: 20 });
    expect(s.pace?.averageDays).toBe(15);
    expect(computeStats([book({ readings: [read("2026-01-01")] })], null).pace).toBeNull();
  });

  it("adds up money spent (from September 2026, when prices start) and earned", () => {
    expect(computeStats(library, null).money).toEqual({ spent: [{ currency: "UAH", total: 450 }], spentBooks: 2, earned: [{ currency: "UAH", total: 120 }], soldBooks: 1 });
    expect(computeStats(library, 2026).money.spent).toEqual([{ currency: "UAH", total: 450 }]);
    expect(computeStats(library, 2025).money).toEqual({ spent: [], spentBooks: 0, earned: [], soldBooks: 0 });
  });
});
