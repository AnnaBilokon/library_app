import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { booksToCsv, csvCell, exportFileName } from "./export";

const book = (o: Partial<Book>) =>
  ({
    id: "1",
    title: "x",
    authors: [],
    genres: [],
    tags: [],
    status: "to-read",
    favorite: false,
    owned: true,
    wanted: false,
    forSale: false,
    forgotten: false,
    currency: "UAH",
    readings: [],
    timesRead: 0,
    createdAt: "2026-01-02T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
    ...o,
  }) as Book;

describe("export", () => {
  it("quotes cells only when needed", () => {
    expect(csvCell("Емма")).toBe("Емма");
    expect(csvCell('Він сказав "так", а потім')).toBe('"Він сказав ""так"", а потім"');
    expect(csvCell("рядок\nдругий")).toBe('"рядок\nдругий"');
    expect(csvCell(["Fantasy", "Classic"])).toBe("Fantasy; Classic");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("writes one row per book, sorted, with a BOM for Excel", () => {
    const csv = booksToCsv(
      [
        book({ title: "Ворошиловград", authors: ["Сергій Жадан"], status: "finished", rating: 5, timesRead: 1, readings: [{ id: "r", outcome: "finished", finishedAt: "2026-02-10" }] }),
        book({ title: "Американські боги", authors: ["Ніл Гейман"], soldAt: "2026-09-01", saleOriginalPrice: 50, saleOriginalCurrency: "SEK", salePrice: 225 }),
      ],
      { "Сергій Жадан": ["UA"] },
    );
    expect(csv.startsWith("﻿Title,Authors,Author countries,Status")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^Американські боги,Ніл Гейман,,sold,/);
    expect(lines[1]).toContain("50 SEK");
    expect(lines[2]).toMatch(/^Ворошиловград,Сергій Жадан,UA,finished,5,/);
    expect(lines[2]).toContain("2026-02-10");
  });

  it("names the file with the date", () => {
    expect(exportFileName("2026-10-10", "json")).toBe("my-library-2026-10-10.json");
  });
});
