import type { Book } from "@/lib/types";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface MonthStat {
  month: (typeof MONTHS)[number];
  /** Books finished in this month. */
  read: number;
  /** Books finished so far this year, up to the end of this month (null for months still to come). */
  cumulative: number | null;
  /** Where the plan says you should be by the end of this month. */
  plan: number | null;
  pages: number;
}

export type ChallengeStatus = "ahead" | "on-track" | "behind" | "met" | "missed" | "no-goal" | "not-started";

export interface Challenge {
  year: number;
  goal: number | null;
  read: number;
  pages: number;
  months: MonthStat[];
  /** 0–1: how much of the year has passed (1 for past years, 0 for future ones). */
  elapsed: number;
  status: ChallengeStatus;
  /** Books ahead (+) or behind (−) the plan today, rounded. */
  difference: number;
  /** Books still to read to reach the goal. */
  remaining: number;
  /** Books per month needed from today to reach the goal on time (current year only). */
  neededPerMonth: number | null;
  /** Books the goal asks for per month. */
  planPerMonth: number | null;
  /** Books you'd finish the year with at your current pace (current year only). */
  projected: number | null;
  averagePerMonth: number;
  bestMonth: MonthStat | null;
}

function dayOfYear(date: Date): number {
  return Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}
const daysInYear = (year: number) => (new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365);

/**
 * The yearly reading challenge. A book counts once for every finished reading dated in that
 * year (so a re-read counts again). Readings without a finish date can't be placed in a year.
 * `today` is the user's local date (YYYY-MM-DD).
 */
export function computeChallenge(books: Book[], year: number, goal: number | null, today: string): Challenge {
  const months: MonthStat[] = MONTHS.map((month) => ({ month, read: 0, cumulative: null, plan: null, pages: 0 }));
  for (const b of books) {
    for (const r of b.readings) {
      if (r.outcome !== "finished" || !r.finishedAt?.startsWith(String(year))) continue;
      const m = Number(r.finishedAt.slice(5, 7)) - 1;
      months[m].read += 1;
      months[m].pages += b.pages ?? 0;
    }
  }

  const now = new Date(`${today}T00:00:00Z`);
  const currentYear = now.getUTCFullYear();
  const elapsed = year < currentYear ? 1 : year > currentYear ? 0 : dayOfYear(now) / daysInYear(year);
  const lastMonth = year < currentYear ? 11 : year > currentYear ? -1 : now.getUTCMonth();

  let running = 0;
  months.forEach((m, i) => {
    running += m.read;
    m.cumulative = i <= lastMonth ? running : null;
    m.plan = goal ? Math.round(((goal * (i + 1)) / 12) * 10) / 10 : null;
  });

  const read = running;
  const pages = months.reduce((sum, m) => sum + m.pages, 0);
  const remaining = goal ? Math.max(0, goal - read) : 0;
  const expectedNow = goal ? goal * elapsed : 0;
  const rawDifference = read - expectedNow;
  const difference = Math.round(rawDifference);

  let status: ChallengeStatus;
  if (!goal) status = "no-goal";
  else if (elapsed >= 1) status = read >= goal ? "met" : "missed";
  else if (elapsed === 0) status = "not-started";
  else if (read >= goal) status = "met";
  else if (rawDifference >= 0.5) status = "ahead";
  else if (rawDifference <= -0.5) status = "behind";
  else status = "on-track";

  const isCurrent = year === currentYear;
  const monthsLeft = (1 - elapsed) * 12;
  const neededPerMonth = isCurrent && goal && monthsLeft > 0 ? Math.round((remaining / monthsLeft) * 10) / 10 : null;
  const projected = isCurrent && elapsed > 0 ? Math.round(read / elapsed) : null;
  const monthsCounted = Math.max(1, lastMonth + 1);
  const best = months.reduce<MonthStat | null>((top, m) => (m.read > 0 && (!top || m.read > top.read) ? m : top), null);

  return {
    year,
    goal,
    read,
    pages,
    months,
    elapsed,
    status,
    difference,
    remaining,
    neededPerMonth,
    planPerMonth: goal ? Math.round((goal / 12) * 10) / 10 : null,
    projected,
    averagePerMonth: Math.round((read / monthsCounted) * 10) / 10,
    bestMonth: best,
  };
}

/** Years worth offering in the year picker: the current one plus any with dated finished readings. */
export function challengeYears(books: Book[], currentYear: number, goalYears: number[]): number[] {
  const years = new Set<number>([currentYear, ...goalYears]);
  for (const b of books) for (const r of b.readings) if (r.outcome === "finished" && r.finishedAt) years.add(Number(r.finishedAt.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}
