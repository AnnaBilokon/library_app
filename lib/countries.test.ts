import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { authorList, bookCountries, countryName, isCountryCode, worldReading, type AuthorCountries } from "./countries";
import { MAP_ID_TO_CODE } from "./geo/map-ids";

const book = (title: string, authors: string[], finishedAt?: string, extra: Partial<Book> = {}) =>
  ({
    id: title,
    title,
    authors,
    wanted: false,
    readings: finishedAt ? [{ id: `${title}-r`, outcome: "finished", finishedAt }] : [],
    ...extra,
  }) as unknown as Book;

const map: AuthorCountries = { "Сергій Жадан": ["UA"], "Ніл Гейман": ["GB"], "Двоє": ["UA", "PL"] };

describe("countries", () => {
  it("knows names and codes", () => {
    expect(countryName("UA")).toBe("Ukraine");
    expect(isCountryCode("GB")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    // Every map shape has a country with a flag.
    expect(Object.values(MAP_ID_TO_CODE).every(isCountryCode)).toBe(true);
  });

  it("gives a book all its authors' countries, once each", () => {
    expect(bookCountries(book("A", ["Сергій Жадан", "Ніл Гейман"]), map)).toEqual(["UA", "GB"]);
    expect(bookCountries(book("B", ["Двоє", "Сергій Жадан"]), map)).toEqual(["UA", "PL"]);
    expect(bookCountries(book("C", ["Хтось"]), map)).toEqual([]);
  });

  it("counts finished books per country, co-authored books for each country", () => {
    const books = [
      book("Жадан 1", ["Сергій Жадан"], "2026-02-01"),
      book("Жадан 2", ["Сергій Жадан"], "2025-05-01"),
      book("Разом", ["Сергій Жадан", "Ніл Гейман"], "2026-03-01"),
      book("Невідомий", ["Хтось"], "2026-04-01"),
      book("Не прочитана", ["Ніл Гейман"]),
      book("Бажана", ["Ніл Гейман"], "2026-01-01", { wanted: true }),
    ];
    const year = worldReading(books, map, 2026);
    expect(year.total).toBe(3);
    expect(year.countries.map((c) => [c.code, c.books.length])).toEqual([
      ["UA", 2],
      ["GB", 1],
    ]);
    expect(year.unknown.map((b) => b.title)).toEqual(["Невідомий"]);
    expect(worldReading(books, map, null).countries[0]).toMatchObject({ code: "UA", name: "Ukraine" });
    expect(worldReading(books, map, null).countries[0].books).toHaveLength(3);
  });

  it("lists authors without a country first, then by number of books", () => {
    const books = [book("1", ["Сергій Жадан"]), book("2", ["Сергій Жадан"]), book("3", ["Хтось"]), book("4", ["Ніл Гейман"])];
    expect(authorList(books, map).map((a) => a.author)).toEqual(["Хтось", "Сергій Жадан", "Ніл Гейман"]);
  });
});
