import { describe, expect, it } from "vitest";
import type { Book, Reading } from "@/lib/types";
import { challengeYears, computeChallenge } from "./challenge";

const finished = (finishedAt?: string): Reading => ({ id: finishedAt ?? "x", finishedAt, outcome: "finished" });
const book = (readings: Reading[], pages?: number) => ({ id: Math.random().toString(), readings, pages }) as unknown as Book;

// 2026: 3 in Jan, 2 in Mar, 1 in Jun; a 2025 finish, an undated one and an abandoned one don't count.
const books = [
  book([finished("2026-01-05"), finished("2025-12-30")], 300),
  book([finished("2026-01-20")], 200),
  book([finished("2026-01-28")]),
  book([finished("2026-03-03"), finished("2026-03-25")], 100),
  book([finished("2026-06-10")], 400),
  book([finished()]),
  book([{ id: "a", finishedAt: "2026-02-01", outcome: "abandoned" }]),
];

describe("computeChallenge", () => {
  // 1 July 2026: day 182 of 365 → ~49.9% of the year.
  const c = computeChallenge(books, 2026, 24, "2026-07-01");

  it("counts finished readings per month, including re-reads, and pages", () => {
    expect(c.months.map((m) => m.read)).toEqual([3, 0, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
    expect(c.read).toBe(6);
    expect(c.pages).toBe(300 + 200 + 100 + 100 + 400);
  });

  it("builds running totals up to the current month, and the plan for every month", () => {
    expect(c.months.slice(0, 8).map((m) => m.cumulative)).toEqual([3, 3, 5, 5, 5, 6, 6, null]);
    expect(c.months[5].plan).toBe(12);
    expect(c.months[11].plan).toBe(24);
  });

  it("compares with the plan and works out the pace needed", () => {
    expect(c.status).toBe("behind");
    expect(c.difference).toBe(-6); // 6 read vs ~12 expected
    expect(c.remaining).toBe(18);
    expect(c.neededPerMonth).toBe(3); // 18 books over ~6 months
    expect(c.planPerMonth).toBe(2);
    expect(c.projected).toBe(12);
    expect(c.bestMonth?.month).toBe("Jan");
  });

  it("reports ahead / on track", () => {
    expect(computeChallenge(books, 2026, 8, "2026-07-01").status).toBe("ahead");
    expect(computeChallenge(books, 2026, 12, "2026-07-01").status).toBe("on-track");
  });

  it("judges past years as met or missed, and handles no goal", () => {
    expect(computeChallenge(books, 2025, 1, "2026-07-01").status).toBe("met");
    expect(computeChallenge(books, 2025, 5, "2026-07-01").status).toBe("missed");
    const noGoal = computeChallenge(books, 2026, null, "2026-07-01");
    expect(noGoal.status).toBe("no-goal");
    expect(noGoal.months[0].plan).toBeNull();
  });
});

describe("challengeYears", () => {
  it("offers the current year, goal years and years with dated finishes, newest first", () => {
    expect(challengeYears(books, 2027, [2024])).toEqual([2027, 2026, 2025, 2024]);
  });
});
