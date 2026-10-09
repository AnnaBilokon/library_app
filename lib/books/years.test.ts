import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { groupByFinishedYear } from "./years";

const book = (title: string, lastFinishedAt?: string) => ({ id: title, title, lastFinishedAt }) as Book;

describe("groupByFinishedYear", () => {
  it("makes newest-year-first sections with unknown dates last, keeping the given order", () => {
    const sections = groupByFinishedYear([
      book("A", "2026-09-01"),
      book("B", "2025-12-30"),
      book("C"),
      book("D", "2026-01-15"),
      book("E", "2024-03-03"),
    ]);
    expect(sections.map((s) => [s.year, s.books.map((b) => b.title)])).toEqual([
      [2026, ["A", "D"]],
      [2025, ["B"]],
      [2024, ["E"]],
      [null, ["C"]],
    ]);
  });

  it("returns no sections for no books", () => {
    expect(groupByFinishedYear([])).toEqual([]);
  });
});
