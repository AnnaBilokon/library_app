import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { askPrompt, resolveAsk, type AskAnswer, type AskOptions } from "./ask";
import { EMPTY_FILTERS, filterBooks } from "./filters";

const options: AskOptions = {
  genres: [{ value: "Fantasy", count: 43 }, { value: "Thriller/Detective", count: 63 }],
  tags: ["затишна історія", "легке читання"],
  authors: [{ value: "Ілларіон Павлюк", count: 2 }],
  publishers: [{ value: "Віват", count: 30 }],
  languages: [{ value: "uk", count: 564 }, { value: "en", count: 11 }],
  series: [],
  countries: ["GB", "UA"],
};

const blank: AskAnswer = {
  status: [],
  genres: [],
  tags: [],
  author: null,
  languages: [],
  formats: [],
  publishers: [],
  series: null,
  countries: [],
  favorite: null,
  rereadOnly: null,
  notOwned: null,
  ratingMin: null,
  ratingMax: null,
  pagesMin: null,
  pagesMax: null,
  finishedFrom: null,
  finishedTo: null,
  text: null,
  sort: null,
  sortDir: null,
  understood: "",
};

describe("asking the library", () => {
  it("keeps only values that exist here, written the library's way", () => {
    const r = resolveAsk(
      { ...blank, genres: ["fantasy", "Horror"], tags: ["Затишна історія", "made up"], author: "ілларіон павлюк", countries: ["ua", "XX"], publishers: ["віват"] },
      options,
    );
    expect(r.filters).toMatchObject({ genre: ["Fantasy"], tag: ["затишна історія"], author: "Ілларіон Павлюк", country: ["UA"], publisher: ["Віват"] });
  });

  it("maps flags, ranges and dates, and drops nonsense", () => {
    const r = resolveAsk(
      { ...blank, notOwned: true, favorite: true, rereadOnly: false, ratingMin: 4.2, ratingMax: 9, pagesMax: 250.4, finishedFrom: "2026-06-01", finishedTo: "last august", sort: "finished", sortDir: null, understood: " Books ", text: "  " },
      options,
    );
    expect(r.filters).toMatchObject({ owned: false, favorite: true, reread: null, ratingMin: 4, ratingMax: 5, pagesMax: 250, finishedFrom: "2026-06-01", finishedTo: null, q: "" });
    expect(r.sort).toBe("finished");
    expect(r.dir).toBe("desc");
    expect(r.understood).toBe("Books");
  });

  it("tells Claude today's date and what each filter can be", () => {
    const prompt = askPrompt("що я читала минулого літа?", options, "2026-10-17");
    expect(prompt).toContain("Today is 2026-10-17.");
    expect(prompt).toContain("затишна історія; легке читання");
    expect(prompt).toMatch(/UA \(.+\)/);
    expect(prompt).toContain("uk (Ukrainian, 564 books)");
  });
});

describe("finished between", () => {
  const book = (title: string, finished: string[]) =>
    ({
      id: title,
      title,
      authors: [],
      genres: [],
      tags: [],
      owned: true,
      status: "finished",
      readings: finished.map((d, i) => ({ id: `${title}${i}`, finishedAt: d, outcome: "finished" })),
    }) as unknown as Book;
  const books = [book("June", ["2026-06-15"]), book("May", ["2026-05-31"]), book("Re-read in July", ["2020-01-01", "2026-07-02"]), book("Never", [])];
  const titles = (bs: Book[]) => bs.map((b) => b.title);

  it("keeps books with a reading finished in the range, either end optional", () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, finishedFrom: "2026-06-01", finishedTo: "2026-08-31" }))).toEqual(["June", "Re-read in July"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, finishedTo: "2026-05-31" }))).toEqual(["May", "Re-read in July"]);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, finishedFrom: "2026-07-01" }))).toEqual(["Re-read in July"]);
  });
});
