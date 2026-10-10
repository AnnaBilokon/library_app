import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { bookishFacts, compareHeight, genreSlices, genreTiles, jacketFor, shelfBooks } from "./bookish";

const book = (title: string, finished: string[], o: Partial<Book> = {}) =>
  ({ id: title, title, authors: [], genres: [], wanted: false, readings: finished.map((d, i) => ({ id: `${title}${i}`, outcome: "finished", finishedAt: d })), ...o }) as unknown as Book;

describe("bookish", () => {
  it("puts each reading of the year on the shelf, oldest first", () => {
    const shelf = shelfBooks([book("B", ["2026-05-01"]), book("A", ["2026-01-02", "2026-09-09"]), book("Old", ["2025-03-01"]), book("Wish", ["2026-02-01"], { wanted: true })], 2026);
    expect(shelf.map((s) => `${s.title} ${s.finishedAt}`)).toEqual(["A 2026-01-02", "B 2026-05-01", "A 2026-09-09"]);
    expect(shelf[0].jacket).toBe(jacketFor("A"));
    expect(jacketFor("anything")).toBeGreaterThanOrEqual(1);
    expect(jacketFor("anything")).toBeLessThanOrEqual(5);
  });

  it("compares the stack with everyday things", () => {
    expect(compareHeight(30)).toEqual({ count: 1.2, thing: "cats" });
    expect(compareHeight(5)).toEqual({ count: 0.5, thing: "coffee mugs" });
    expect(compareHeight(100)).toEqual({ count: 1, thing: "guitar" });
  });

  it("works out pages, words, hours and War and Peaces, assuming 300 pages when unknown", () => {
    const facts = bookishFacts([
      { id: "1", title: "Long", authors: [], pages: 925, finishedAt: "2026-01-01", jacket: 1 },
      { id: "2", title: "Short", authors: [], pages: 120, finishedAt: "2026-02-01", jacket: 2 },
      { id: "3", title: "Unknown", authors: [], finishedAt: "2026-03-01", jacket: 3 },
    ]);
    expect(facts.pages).toBe(1345);
    expect(facts.assumed).toBe(1);
    expect(facts.warAndPeace).toBe(1.1);
    expect(facts.words).toBe(370000);
    expect(facts.hours).toBe(34);
    expect(facts.longest?.title).toBe("Long");
    expect(facts.shortest?.title).toBe("Short");
    expect(facts.stackCm).toBe(9.6);
  });

  it("lists every genre, most read first", () => {
    const books = ["A", "A", "A", "B", "B", "C", "D", "E", "F", "G"].map((g, i) => book(`b${i}`, ["2026-04-01"], { genres: [g] }));
    expect(genreSlices(books, 2026)).toEqual([
      { genre: "A", count: 3 },
      { genre: "B", count: 2 },
      { genre: "C", count: 1 },
      { genre: "D", count: 1 },
      { genre: "E", count: 1 },
      { genre: "F", count: 1 },
      { genre: "G", count: 1 },
    ]);
    expect(genreSlices(books.slice(0, 6), 2026)).toHaveLength(3);
  });

  it("colours each book by its main genre, like the donut, in reading order", () => {
    const books = [
      book("F1", ["2026-01-01"], { genres: ["Fantasy", "Romance"] }),
      book("F2", ["2026-02-01"], { genres: ["Fantasy"] }),
      book("H", ["2026-03-01"], { genres: ["History"] }),
      book("R", ["2026-04-01"], { genres: ["Romance"] }),
      book("None", ["2026-05-01"]),
      book("Old", ["2025-05-01"], { genres: ["Classic"] }),
    ];
    const { tiles, legend } = genreTiles(books, 2026);
    expect(tiles.map((t) => [t.title, t.genre, t.slot])).toEqual([
      ["F1", "Fantasy", 1],
      ["F2", "Fantasy", 1],
      ["H", "History", 3],
      ["R", "Romance", 2],
      ["None", "No genre", 4],
    ]);
    // Slots follow the donut's order (Romance also counts F1), so the colours always agree.
    const slices = genreSlices(books, 2026).map((s) => s.genre);
    for (const t of tiles) expect(slices[t.slot - 1]).toBe(t.genre);
    expect(legend.map((l) => [l.genre, l.count])).toEqual([
      ["Fantasy", 2],
      ["Romance", 1],
      ["History", 1],
      ["No genre", 1],
    ]);
  });

  it("gives every genre its own colour, and only past fourteen uses Other", () => {
    const genres = Array.from({ length: 16 }, (_, i) => `G${String(i + 1).padStart(2, "0")}`);
    const books = genres.map((g, i) => book(g, [`2026-01-${String(i + 1).padStart(2, "0")}`], { genres: [g] }));
    books.push(book("G01 again", ["2026-02-01"], { genres: ["G01"] }));
    const { tiles, legend } = genreTiles(books, 2026);
    expect(new Set(tiles.filter((t) => t.slot > 0).map((t) => t.slot)).size).toBe(14);
    expect(tiles.filter((t) => t.slot === 0).map((t) => t.title)).toEqual(["G15", "G16"]);
    expect(legend.at(-1)).toEqual({ genre: "Other", slot: 0, count: 2 });
    // Seven genres: no Other at all.
    expect(genreTiles(books.slice(0, 7), 2026).tiles.every((t) => t.slot > 0)).toBe(true);
  });
});
