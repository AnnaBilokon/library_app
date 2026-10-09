import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { computeBattle, downstreamSlots, monthCandidates, type Picks } from "./battle";

const book = (title: string, ...finished: string[]) =>
  ({
    id: title,
    title,
    wanted: false,
    readings: finished.map((d, i) => ({ id: `${title}${i}`, outcome: "finished", finishedAt: d })),
  }) as unknown as Book;

// Q1: Jan has two books, Feb one, Mar two. Q2: only May. Q3/Q4 empty.
const books = [
  book("Jan A", "2026-01-05"),
  book("Jan B", "2026-01-20"),
  book("Feb A", "2026-02-11"),
  book("Mar A", "2026-03-02"),
  book("Mar B", "2026-03-28"),
  book("May A", "2026-05-15"),
  book("Old", "2025-01-10"),
];
const titles = (bs: Book[]) => bs.map((b) => b.title);
const END_OF_YEAR = "2027-01-02";

describe("book battle", () => {
  it("finds the books finished in a month", () => {
    expect(titles(monthCandidates(books, 2026, 0))).toEqual(["Jan A", "Jan B"]);
    expect(titles(monthCandidates([book("Re-read", "2026-01-02", "2026-01-30")], 2026, 0))).toEqual(["Re-read"]);
  });

  it("lists what a change clears", () => {
    expect(downstreamSlots("m02")).toEqual(["q1-drop", "q1", "s1", "final"]);
    expect(downstreamSlots("m11")).toEqual(["q4-drop", "q4", "s2", "final"]);
    expect(downstreamSlots("q3-drop")).toEqual(["q3", "s2", "final"]);
    expect(downstreamSlots("q2")).toEqual(["s1", "final"]);
    expect(downstreamSlots("s2")).toEqual(["final"]);
    expect(downstreamSlots("final")).toEqual([]);
  });

  it("waits for monthly picks before a quarter opens; a single book goes through", () => {
    const s = computeBattle(books, {}, 2026, "best", END_OF_YEAR);
    const q1 = s.quarters[0];
    expect(q1.months.map((m) => [m.label, m.open, m.winner?.title ?? null])).toEqual([
      ["Jan", true, null],
      ["Feb", false, "Feb A"],
      ["Mar", true, null],
    ]);
    expect(q1.keep.open).toBe(false);
    expect(q1.duel.open).toBe(false);
    // Q2 has one book in total, so it wins the quarter without a choice.
    expect(s.quarters[1].duel).toMatchObject({ auto: true, winner: { title: "May A" } });
  });

  it("plays the whole year down to one book", () => {
    const picks: Picks = { m01: "Jan B", m03: "Mar A" };
    let s = computeBattle(books, picks, 2026, "best", END_OF_YEAR);
    expect(titles(s.quarters[0].keep.options)).toEqual(["Jan B", "Feb A", "Mar A"]);
    expect(s.quarters[0].duel.open).toBe(false);

    picks["q1-drop"] = "Feb A";
    s = computeBattle(books, picks, 2026, "best", END_OF_YEAR);
    expect(titles(s.quarters[0].duel.options)).toEqual(["Jan B", "Mar A"]);

    picks.q1 = "Mar A";
    s = computeBattle(books, picks, 2026, "best", END_OF_YEAR);
    expect(titles(s.semis[0].options)).toEqual(["Mar A", "May A"]);
    // Nothing in the second half of the year: the final waits for semi 1 only.
    expect(s.semis[1].options).toEqual([]);
    expect(s.final.open).toBe(false);

    picks.s1 = "May A";
    s = computeBattle(books, picks, 2026, "best", END_OF_YEAR);
    expect(s.final).toMatchObject({ auto: true });
    expect(s.champion?.title).toBe("May A");
  });

  it("ignores picks that are no longer among the options", () => {
    const s = computeBattle(books, { m01: "Jan B", m03: "Mar A", "q1-drop": "Feb A", q1: "Old" }, 2026, "best", END_OF_YEAR);
    expect(s.quarters[0].duel.winner).toBeNull();
    expect(s.quarters[0].duel.open).toBe(true);
  });

  it("keeps a quarter closed while its months are still running", () => {
    // 15 May: June hasn't happened yet, so Q2 can't be decided even though May has its only book.
    const s = computeBattle(books, {}, 2026, "best", "2026-05-15");
    expect(s.quarters[1].duel).toMatchObject({ winner: null, open: false });
    expect(s.quarters[1].months[2].future).toBe(true);
    expect(s.final.open).toBe(false);
  });
});
