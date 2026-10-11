import type { Book } from "@/lib/types";

export interface Habit {
  id: string;
  name: string;
  sessionsPerWeek: number;
  minMinutes: number;
  /** Books in any of these genres count as this habit's books (empty = any book). */
  genres: string[];
  /** Or one book in particular. */
  bookId?: string;
  createdAt: string;
}

export interface HabitSession {
  id: string;
  habitId: string;
  /** yyyy-mm-dd */
  date: string;
  minutes: number;
  bookId?: string;
}

export interface HeatDay {
  date: string;
  minutes: number;
  /** Long enough to count for the habit. */
  counted: boolean;
  future: boolean;
}

export type AchievementId = "first" | "full-week" | "streak-4" | "streak-8" | "minutes-300" | "finished" | "perfect-month";

export interface Achievement {
  id: AchievementId;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** The day it was earned. */
  on?: string;
  /** How far along you are while it's still locked. */
  progress?: { value: number; target: number };
}

export interface HabitProgress {
  week: { start: string; done: number; target: number; daysLeft: number; complete: boolean };
  today: { minutes: number } | null;
  /** Weeks in a row with the habit done (this week counts once it's done; it never breaks a streak while in progress). */
  streak: number;
  bestStreak: number;
  totalMinutes: number;
  totalSessions: number;
  weeksDone: number;
  /** The last weeks, oldest first, Monday to Sunday. */
  heatmap: HeatDay[][];
  achievements: Achievement[];
}

const DAY = 86_400_000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
/** Monday of the week (weeks run Monday to Sunday). */
export function mondayOf(iso: string): string {
  const n = toDay(iso);
  const weekday = (new Date(n * DAY).getUTCDay() + 6) % 7; // Monday = 0
  return fromDay(n - weekday);
}
const addDays = (iso: string, days: number) => fromDay(toDay(iso) + days);

/** Whether a book belongs to the habit (its book, or one of its genres; any book when neither is set). */
export function habitBook(habit: Pick<Habit, "genres" | "bookId">, book: Pick<Book, "id" | "genres">): boolean {
  if (habit.bookId) return book.id === habit.bookId;
  if (habit.genres.length === 0) return true;
  return book.genres.some((g) => habit.genres.includes(g));
}

const HEAT_WEEKS = 26;

/**
 * Everything the habit card and page show, from the habit, its sessions and your books (for the
 * "finished a book" badge). `today` is your local date.
 */
export function habitProgress(habit: Habit, sessions: HabitSession[], books: Book[], today: string): HabitProgress {
  const mine = sessions.filter((s) => s.habitId === habit.id && s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const counted = mine.filter((s) => s.minutes >= habit.minMinutes);
  const byWeek = new Map<string, HabitSession[]>();
  for (const s of counted) byWeek.set(mondayOf(s.date), [...(byWeek.get(mondayOf(s.date)) ?? []), s]);
  const done = (monday: string) => (byWeek.get(monday)?.length ?? 0) >= habit.sessionsPerWeek;
  /** The day a week became done (its target-th session). */
  const doneOn = (monday: string) => byWeek.get(monday)?.[habit.sessionsPerWeek - 1]?.date;

  const thisWeek = mondayOf(today);
  const start = mondayOf([habit.createdAt.slice(0, 10), mine[0]?.date ?? today].sort()[0]);
  const weeks: string[] = [];
  for (let w = start; w <= thisWeek; w = addDays(w, 7)) weeks.push(w);

  // Current streak: back from last week, plus this week once it's done.
  let streak = 0;
  for (let w = addDays(thisWeek, -7); w >= start && done(w); w = addDays(w, -7)) streak++;
  if (done(thisWeek)) streak++;

  // Best streak, and when runs of 4 and 8 were first reached.
  let run = 0;
  let bestStreak = 0;
  const reached: Record<number, string | undefined> = {};
  for (const w of weeks) {
    if (done(w)) {
      run++;
      bestStreak = Math.max(bestStreak, run);
      for (const n of [4, 8]) if (run === n && !reached[n]) reached[n] = doneOn(w);
    } else if (w !== thisWeek) run = 0;
  }

  const totalMinutes = mine.reduce((s, x) => s + x.minutes, 0);
  let sum = 0;
  const minutes300 = mine.find((s) => (sum += s.minutes) >= 300)?.date;

  const since = habit.createdAt.slice(0, 10);
  const finished = books
    .filter((b) => habitBook(habit, b))
    .flatMap((b) => b.readings.filter((r) => r.outcome === "finished" && r.finishedAt && r.finishedAt >= since && r.finishedAt <= today).map((r) => r.finishedAt!))
    .sort()[0];

  // A perfect month: every week whose Monday falls in that month is done (and the month has had all its Mondays).
  let perfectMonth: string | undefined;
  for (const month of [...new Set(weeks.map((w) => w.slice(0, 7)))]) {
    const mondays: string[] = [];
    for (let d = mondayOf(`${month}-07`); d.slice(0, 7) <= month; d = addDays(d, 7)) if (d.slice(0, 7) === month) mondays.push(d);
    if (mondays.every((m) => m <= thisWeek && done(m))) {
      perfectMonth = doneOn(mondays.at(-1)!);
      break;
    }
  }

  const firstFullWeek = weeks.find(done);
  const achievements: Achievement[] = [
    { id: "first", emoji: "🌱", title: "First page", description: "Your first session", on: counted[0]?.date, target: 1, value: counted.length },
    { id: "full-week", emoji: "🎯", title: "Full week", description: `${habit.sessionsPerWeek} of ${habit.sessionsPerWeek} in one week`, on: firstFullWeek && doneOn(firstFullWeek), target: habit.sessionsPerWeek, value: Math.max(0, ...weeks.map((w) => byWeek.get(w)?.length ?? 0)) },
    { id: "streak-4", emoji: "🔥", title: "On a roll", description: "4 weeks in a row", on: reached[4], target: 4, value: bestStreak },
    { id: "streak-8", emoji: "🏅", title: "Habit formed", description: "8 weeks in a row: it sticks now", on: reached[8], target: 8, value: bestStreak },
    { id: "minutes-300", emoji: "⏱️", title: "5 hours", description: "300 minutes in total", on: minutes300, target: 300, value: totalMinutes },
    { id: "finished", emoji: "📚", title: "Finished one", description: "Finished a book while keeping the habit", on: finished, target: 1, value: finished ? 1 : 0 },
    { id: "perfect-month", emoji: "🌕", title: "Perfect month", description: "Every week of a month done", on: perfectMonth, target: 4, value: Math.min(4, streak) },
  ].map(({ target, value, on, ...a }) => ({
    ...a,
    id: a.id as AchievementId,
    unlocked: Boolean(on),
    on,
    progress: on ? undefined : { value: Math.min(value, target), target },
  }));

  const minutesOn = new Map(mine.map((s) => [s.date, s.minutes]));
  const heatmap = Array.from({ length: HEAT_WEEKS }, (_, i) => {
    const monday = addDays(thisWeek, (i - HEAT_WEEKS + 1) * 7);
    return Array.from({ length: 7 }, (_, d) => {
      const date = addDays(monday, d);
      const m = minutesOn.get(date) ?? 0;
      return { date, minutes: m, counted: m >= habit.minMinutes, future: date > today };
    });
  });

  const todays = mine.find((s) => s.date === today);
  const weekDone = byWeek.get(thisWeek)?.length ?? 0;
  return {
    week: { start: thisWeek, done: weekDone, target: habit.sessionsPerWeek, daysLeft: toDay(addDays(thisWeek, 6)) - toDay(today) + 1, complete: weekDone >= habit.sessionsPerWeek },
    today: todays ? { minutes: todays.minutes } : null,
    streak,
    bestStreak,
    totalMinutes,
    totalSessions: counted.length,
    weeksDone: weeks.filter(done).length,
    heatmap,
    achievements,
  };
}

/** Badges a new session would unlock (to celebrate the moment you log it). */
export function newlyUnlocked(before: HabitProgress, after: HabitProgress): Achievement[] {
  const had = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.id));
  return after.achievements.filter((a) => a.unlocked && !had.has(a.id));
}

/** "2 more to go · 3 days left", "Week done!", … for the card. */
export function weekNudge(p: HabitProgress): string {
  const left = p.week.target - p.week.done;
  if (left <= 0) return "Week done! 🎉";
  const days = `${p.week.daysLeft} ${p.week.daysLeft === 1 ? "day" : "days"} left`;
  if (p.week.daysLeft < left) return `${left} more to go · ${days}: a fresh start on Monday`;
  return `${left} more to go · ${days}`;
}
