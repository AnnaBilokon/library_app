import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { countActiveFilters, EMPTY_FILTERS, facets, filterBooks, normalize, sortBooks } from "./filters";

function book(overrides: Partial<Book>): Book {
  return {
    id: overrides.title ?? "x",
    title: "Untitled",
    authors: [],
    status: "to-read",
    favorite: false,
    genres: [],
    tags: [],
    owned: true,
    currency: "UAH",
    wanted: false,
    readings: [],
    timesRead: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const books = [
  book({ title: "Емма", authors: ["Джейн Остін"], status: "finished", genres: ["Classic"], pages: 500, publishedYear: 2019,
    readings: [{ id: "r", finishedAt: "2024-05-01", outcome: "finished" }], lastFinishedAt: "2024-05-01" }),
  book({ title: "Лісовий бог", authors: ["Ліз Мур"], genres: ["Thriller/Detective"], favorite: true, pages: 300 }),
  book({ title: "Dear Juliet", authors: [], genres: ["Romance"], rating: 4 }),
  book({ title: "Абетка", authors: ["Іван Франко"], status: "reading", genres: ["Classic"], publishedYear: 2021 }),
];
const titles = (list: Book[]) => list.map((b) => b.title);

describe("normalize", () => {
  it("ignores case and accents", () => {
    expect(normalize("ЕММА")).toBe(normalize("емма"));
    expect(normalize("Mío")).toBe("mio");
  });
});

describe("filterBooks", () => {
  it("returns everything with no filters", () => {
    expect(filterBooks(books, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("searches title and authors, all words must match", () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, q: "остін" }))).toEqual(["Емма"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, q: "ліс мур" }))).toEqual(["Лісовий бог"]);
    expect(filterBooks(books, { ...EMPTY_FILTERS, q: "ліс франко" })).toHaveLength(0);
  });

  it("combines filters with AND, values within one filter with OR", () => {
    const f = { ...EMPTY_FILTERS, genre: ["Classic", "Romance"], status: ["to-read" as const] };
    expect(titles(filterBooks(books, f))).toEqual(["Dear Juliet"]);
  });

  it("filters by finished year, favourite and ranges", () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, finishedYear: 2024 }))).toEqual(["Емма"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, favorite: true }))).toEqual(["Лісовий бог"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, pagesMax: 400 }))).toEqual(["Лісовий бог"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, ratingMin: 3 }))).toEqual(["Dear Juliet"]);
  });
});

describe("sortBooks", () => {
  it("sorts titles with Ukrainian collation: Cyrillic first, then Latin", () => {
    expect(titles(sortBooks(books, "title", "asc"))).toEqual(["Абетка", "Емма", "Лісовий бог", "Dear Juliet"]);
  });

  it("sorts authors by surname and puts books without one last", () => {
    expect(titles(sortBooks(books, "author", "asc"))).toEqual(["Лісовий бог", "Емма", "Абетка", "Dear Juliet"]);
    expect(titles(sortBooks(books, "author", "desc")).at(-1)).toBe("Dear Juliet");
  });

  it("keeps missing values last when sorting descending", () => {
    expect(titles(sortBooks(books, "pages", "desc"))).toEqual(["Емма", "Лісовий бог", "Абетка", "Dear Juliet"]);
  });

  it("does not mutate its input", () => {
    const copy = [...books];
    sortBooks(books, "pages", "desc");
    expect(books).toEqual(copy);
  });
});

describe("facets and countActiveFilters", () => {
  it("counts values", () => {
    const f = facets(books);
    expect(f.genre[0]).toEqual({ value: "Classic", count: 2 });
    expect(f.finishedYears).toEqual([2024]);
    expect(f.hasRatings).toBe(true);
  });

  it("counts active filters but not the search text", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, q: "x", genre: ["a"], owned: false })).toBe(2);
  });
});
