import { describe, expect, it } from "vitest";
import { normalizeIsbn } from "@/lib/isbn";
import { bookInputSchema, bookInputToRow, readingInputSchema, readingInputToRow } from "@/lib/schemas";
import { openReading, planStatusChange } from "./reading-logic";

describe("normalizeIsbn", () => {
  it("accepts ISBN-13 with or without hyphens", () => {
    expect(normalizeIsbn("978-0-14-044913-6")).toBe("9780140449136");
    expect(normalizeIsbn("9780140449136")).toBe("9780140449136");
  });
  it("converts ISBN-10 (including an X check digit) to ISBN-13", () => {
    expect(normalizeIsbn("0-14-044913-2")).toBe("9780140449136");
    expect(normalizeIsbn("080442957X")).toBe("9780804429573");
  });
  it("rejects wrong check digits and junk", () => {
    expect(normalizeIsbn("9780140449137")).toBeNull();
    expect(normalizeIsbn("hello")).toBeNull();
  });
});

const base = {
  title: "  Емма ",
  authors: ["Джейн Остін", "Джейн Остін"],
  status: "to-read" as const,
  favorite: false,
  genres: ["Classic"],
  tags: [],
  owned: true,
};

describe("bookInputSchema + bookInputToRow", () => {
  it("trims, dedupes and maps to DB columns", () => {
    const input = bookInputSchema.parse({ ...base, isbn: "0-14-044913-2", language: "uk", pages: 320, publisher: " КСД " });
    expect(bookInputToRow(input)).toMatchObject({
      title: "Емма",
      authors: ["Джейн Остін"],
      isbn: "9780140449136",
      language: "uk",
      pages: 320,
      publisher: "КСД",
      rating: null,
      format: null,
    });
  });

  it("treats empty number inputs (NaN) and empty strings as missing", () => {
    const row = bookInputToRow(bookInputSchema.parse({ ...base, pages: Number.NaN, acquiredAt: "", language: "" }));
    expect(row).toMatchObject({ pages: null, acquired_at: null, language: null });
  });

  it("rejects bad input", () => {
    expect(bookInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...base, isbn: "123" }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...base, rating: 4.3 }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...base, startedAt: "2024-05-02", finishedAt: "2024-05-01" }).success).toBe(false);
  });
});

describe("readingInputSchema", () => {
  it("drops the finish date for a reading in progress", () => {
    expect(readingInputSchema.safeParse({ startedAt: "2024-01-01", finishedAt: "2024-02-01", outcome: "in-progress" }).success).toBe(false);
    expect(readingInputToRow(readingInputSchema.parse({ startedAt: "2024-01-01", outcome: "in-progress" }))).toEqual({
      started_at: "2024-01-01",
      finished_at: null,
      outcome: null,
    });
  });
});

describe("planStatusChange", () => {
  const today = "2026-10-09";
  const done = { id: "r1", startedAt: "2024-01-01", finishedAt: "2024-02-01", outcome: "finished" as const };
  const open = { id: "r2", startedAt: "2026-09-01" };

  it("starts a reading today, unless one is already open", () => {
    expect(planStatusChange([done], "reading", today)).toEqual({ insert: { startedAt: today, finishedAt: null, outcome: null } });
    expect(planStatusChange([done, open], "reading", today)).toEqual({});
  });

  it("closes the open reading when finished, or records a finish today", () => {
    expect(planStatusChange([done, open], "finished", today)).toEqual({ update: { id: "r2", finishedAt: today, outcome: "finished" } });
    expect(planStatusChange([done], "finished", today)).toEqual({ insert: { startedAt: null, finishedAt: today, outcome: "finished" } });
  });

  it("records abandoning only for an open reading; to-read and paused record nothing", () => {
    expect(planStatusChange([open], "abandoned", today)).toEqual({ update: { id: "r2", finishedAt: today, outcome: "abandoned" } });
    expect(planStatusChange([done], "abandoned", today)).toEqual({});
    expect(planStatusChange([open], "paused", today)).toEqual({});
    expect(planStatusChange([open], "to-read", today)).toEqual({});
  });

  it("finds the latest open reading", () => {
    expect(openReading([done, open])?.id).toBe("r2");
    expect(openReading([done])).toBeUndefined();
  });
});
