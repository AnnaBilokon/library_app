import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/types";
import { habitBook, habitProgress, mondayOf, newlyUnlocked, weekNudge, type Habit, type HabitSession } from "./habits";

const habit: Habit = { id: "h", name: "Non-fiction", sessionsPerWeek: 3, minMinutes: 15, genres: ["Non-fiction"], createdAt: "2026-09-01T10:00:00Z" };
let n = 0;
const s = (date: string, minutes = 20): HabitSession => ({ id: `s${++n}`, habitId: "h", date, minutes });
/** Three sessions in the week starting on this Monday. */
const fullWeek = (monday: string) => [0, 2, 4].map((d) => s(new Date(Date.parse(`${monday}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10)));

describe("habits", () => {
  it("knows weeks run Monday to Sunday", () => {
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // a Sunday
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
  });

  it("counts this week's sessions of at least the minimum, and nudges", () => {
    const p = habitProgress(habit, [s("2026-10-05"), s("2026-10-06", 10), s("2026-10-07")], [], "2026-10-08");
    expect(p.week).toMatchObject({ start: "2026-10-05", done: 2, target: 3, daysLeft: 4, complete: false });
    expect(weekNudge(p)).toBe("1 more to go · 4 days left");
    expect(p.today).toBeNull();
    const sunday = habitProgress(habit, [s("2026-10-05")], [], "2026-10-11");
    expect(weekNudge(sunday)).toBe("2 more to go · 1 day left: a fresh start on Monday");
  });

  it("keeps a streak of done weeks, without this unfinished week breaking it", () => {
    const sessions = [...fullWeek("2026-09-14"), ...fullWeek("2026-09-21"), ...fullWeek("2026-09-28"), ...fullWeek("2026-10-05"), s("2026-10-12")];
    const p = habitProgress(habit, sessions, [], "2026-10-13");
    expect(p.streak).toBe(4);
    expect(p.bestStreak).toBe(4);
    expect(p.weeksDone).toBe(4);
    const broken = habitProgress(habit, [...fullWeek("2026-09-14"), ...fullWeek("2026-09-28")], [], "2026-10-13");
    expect(broken.streak).toBe(0);
    expect(broken.bestStreak).toBe(1);
  });

  it("unlocks badges on the day they're earned, and shows progress on locked ones", () => {
    const sessions = [...fullWeek("2026-09-14"), ...fullWeek("2026-09-21"), ...fullWeek("2026-09-28"), ...fullWeek("2026-10-05")];
    const books = [{ id: "b", genres: ["Non-fiction"], readings: [{ id: "r", outcome: "finished", finishedAt: "2026-09-30" }] }] as unknown as Book[];
    const p = habitProgress(habit, sessions, books, "2026-10-11");
    const a = Object.fromEntries(p.achievements.map((x) => [x.id, x]));
    expect(a.first).toMatchObject({ unlocked: true, on: "2026-09-14" });
    expect(a["full-week"]).toMatchObject({ unlocked: true, on: "2026-09-18" });
    expect(a["streak-4"]).toMatchObject({ unlocked: true, on: "2026-10-09" });
    expect(a["streak-8"]).toMatchObject({ unlocked: false, progress: { value: 4, target: 8 } });
    expect(a["minutes-300"]).toMatchObject({ unlocked: false, progress: { value: 240, target: 300 } });
    expect(a.finished).toMatchObject({ unlocked: true, on: "2026-09-30" });
    // September 2026 has Mondays 7, 14, 21, 28: the 7th wasn't done.
    expect(a["perfect-month"].unlocked).toBe(false);
  });

  it("gives a perfect month when every week starting in it is done", () => {
    const sessions = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].flatMap(fullWeek);
    const p = habitProgress({ ...habit, createdAt: "2026-09-01T00:00:00Z" }, sessions, [], "2026-10-11");
    expect(p.achievements.find((x) => x.id === "perfect-month")).toMatchObject({ unlocked: true, on: "2026-10-02" });
  });

  it("tells which badges a new session unlocks", () => {
    const before = habitProgress(habit, [s("2026-10-05"), s("2026-10-06")], [], "2026-10-07");
    const after = habitProgress(habit, [s("2026-10-05"), s("2026-10-06"), s("2026-10-07")], [], "2026-10-07");
    expect(newlyUnlocked(before, after).map((x) => x.id)).toEqual(["full-week"]);
  });

  it("draws a heatmap of the last 26 weeks, Monday first", () => {
    const p = habitProgress(habit, [s("2026-10-07", 30), s("2026-10-08", 5)], [], "2026-10-08");
    expect(p.heatmap).toHaveLength(26);
    const last = p.heatmap.at(-1)!;
    expect(last[0].date).toBe("2026-10-05");
    expect(last[2]).toMatchObject({ minutes: 30, counted: true, future: false });
    expect(last[3]).toMatchObject({ minutes: 5, counted: false });
    expect(last[6].future).toBe(true);
  });

  it("matches books by the habit's book or genres", () => {
    expect(habitBook(habit, { id: "x", genres: ["Non-fiction", "History"] })).toBe(true);
    expect(habitBook(habit, { id: "x", genres: ["Fiction"] })).toBe(false);
    expect(habitBook({ genres: [], bookId: "b" }, { id: "b", genres: [] })).toBe(true);
    expect(habitBook({ genres: [] }, { id: "x", genres: ["Romance"] })).toBe(true);
  });
});
