import { describe, expect, it } from "vitest";
import { normalizeIsbn } from "@/lib/isbn";
import { bookInputSchema, bookInputToRow, readingInputSchema, readingInputToRow } from "@/lib/schemas";
import { openReading, planStatusChange, statusFromReadings } from "./reading-logic";

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
    expect(readingInputToRow(readingInputSchema.parse({ startedAt: "2024-01-01", outcome: "in-progress" }))).toMatchObject({
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

  it("records not finishing (closing the open reading, or a new one); to-read and paused record nothing", () => {
    expect(planStatusChange([open], "abandoned", today)).toEqual({ update: { id: "r2", finishedAt: today, outcome: "abandoned" } });
    expect(planStatusChange([done], "abandoned", today)).toEqual({ insert: { startedAt: null, finishedAt: today, outcome: "abandoned" } });
    expect(planStatusChange([open], "paused", today)).toEqual({});
    expect(planStatusChange([open], "to-read", today)).toEqual({});
  });

  it("finds the latest open reading", () => {
    expect(openReading([done, open])?.id).toBe("r2");
    expect(openReading([done])).toBeUndefined();
  });
});

describe("reading progress and did-not-finish details", () => {
  it("keeps progress and the reason for a DNF reading", () => {
    const row = readingInputToRow(
      readingInputSchema.parse({ outcome: "abandoned", finishedAt: "2026-10-01", progress: { mode: "page", value: 120 }, stopReason: " Too slow " }),
    );
    expect(row).toMatchObject({ outcome: "abandoned", progress_page: 120, progress_percent: null, stop_reason: "Too slow" });
  });

  it("stores a percentage for a reading in progress, and clears it when finished", () => {
    expect(readingInputToRow(readingInputSchema.parse({ outcome: "in-progress", progress: { mode: "percent", value: 40 } }))).toMatchObject({
      progress_page: null,
      progress_percent: 40,
      stop_reason: null,
    });
    expect(readingInputToRow(readingInputSchema.parse({ outcome: "finished", progress: { mode: "page", value: 10 }, stopReason: "x" }))).toMatchObject({
      progress_page: null,
      progress_percent: null,
      stop_reason: null,
    });
  });

  it("rejects impossible progress", () => {
    expect(readingInputSchema.safeParse({ outcome: "in-progress", progress: { mode: "percent", value: 120 } }).success).toBe(false);
    expect(readingInputSchema.safeParse({ outcome: "in-progress", progress: { mode: "page", value: 1.5 } }).success).toBe(false);
  });
});

describe("reading rating", () => {
  it("keeps the rating for an ended reading and drops it while still reading", () => {
    expect(readingInputToRow(readingInputSchema.parse({ outcome: "finished", rating: 4 }))).toMatchObject({ rating: 4 });
    expect(readingInputToRow(readingInputSchema.parse({ outcome: "in-progress", rating: 4 }))).toMatchObject({ rating: null });
    expect(readingInputSchema.safeParse({ outcome: "finished", rating: 6 }).success).toBe(false);
  });
});

describe("wishlist books are never owned", () => {
  it("drops 'owned' when the book is on the wishlist", () => {
    const base = { title: "Колега", authors: [], status: "to-read" as const, favorite: false, genres: [], tags: [] };
    expect(bookInputToRow(bookInputSchema.parse({ ...base, owned: true, wanted: true }))).toMatchObject({ owned: false, wanted: true });
    expect(bookInputToRow(bookInputSchema.parse({ ...base, owned: true, wanted: false }))).toMatchObject({ owned: true, wanted: false });
  });
});

describe("statusFromReadings", () => {
  const r = (outcome: "finished" | "abandoned" | null, finished_at: string | null, started_at: string | null = null, created_at = "2026-10-09T10:00:00Z") => ({
    outcome,
    finished_at,
    started_at,
    created_at,
  });

  it("finishes the book when a finished reading is added", () => {
    expect(statusFromReadings([r("finished", "2024-05-01")], "to-read")).toBe("finished");
  });

  it("follows the most recent reading", () => {
    expect(statusFromReadings([r("finished", "2023-01-01"), r("abandoned", "2025-06-01")], "finished")).toBe("abandoned");
    expect(statusFromReadings([r("abandoned", "2023-01-01"), r("finished", "2025-06-01")], "abandoned")).toBe("finished");
  });

  it("an open reading means Reading, but keeps Paused", () => {
    expect(statusFromReadings([r("finished", "2024-01-01"), r(null, null, "2026-10-01")], "finished")).toBe("reading");
    expect(statusFromReadings([r(null, null, "2026-10-01")], "paused")).toBe("paused");
  });

  it("leaves the status alone when there are no readings", () => {
    expect(statusFromReadings([], "to-read")).toBe("to-read");
  });
});
