"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { Check, Loader2, Pencil, Target, TrendingDown, TrendingUp, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { setYearlyGoal } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { challengeYears, computeChallenge, type Challenge } from "@/lib/challenge";
import { libraryUrl } from "@/lib/books/library-url";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MonthlyChart, ProgressChart } from "./challenge-charts";

const plural = (n: number, one: string, many: string) => `${n} ${Math.abs(n) === 1 ? one : many}`;
const fmt = (n: number) => new Intl.NumberFormat("en-GB").format(n);

export function ChallengeView({ books, goals }: { books: Book[]; goals: Record<number, number> }) {
  const today = todayLocal();
  const currentYear = Number(today.slice(0, 4));
  // The year lives in the URL (?year=2025), so a past year can be bookmarked.
  const [year, setYear] = useQueryState("year", parseAsInteger.withDefault(currentYear));
  const years = useMemo(() => challengeYears(books, currentYear, Object.keys(goals).map(Number)), [books, currentYear, goals]);
  const goal = goals[year] ?? null;
  const c = useMemo(() => computeChallenge(books, year, goal, today), [books, year, goal, today]);
  const undated = useMemo(() => books.reduce((n, b) => n + b.readings.filter((r) => r.outcome === "finished" && !r.finishedAt).length, 0), [books]);

  return (
    <div className="flex flex-col gap-8">
      {/* Filters: one row, above everything they scope. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Year">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={y === year}
            onClick={() => void setYear(y === currentYear ? null : y)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              y === year && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <Headline challenge={c} />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Pages read" value={fmt(c.pages)} />
        <StatTile label="Average per month" value={String(c.averagePerMonth)} />
        <StatTile label="Best month" value={c.bestMonth ? `${c.bestMonth.month} · ${c.bestMonth.read}` : "—"} />
        {c.year === currentYear ? (
          <StatTile label="At this pace" value={c.projected !== null ? plural(c.projected, "book", "books") : "—"} />
        ) : (
          <StatTile label="Books finished" value={String(c.read)} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Progress vs plan" subtitle={goal ? `Books read so far in ${c.year}, against a steady pace to ${goal}` : `Books read so far in ${c.year}`}>
          <ProgressChart months={c.months} goal={goal} />
        </ChartCard>
        <ChartCard title="Books per month" subtitle={c.planPerMonth ? `The line is your plan: ${c.planPerMonth} a month` : "Set a goal to see your monthly target"}>
          <MonthlyChart months={c.months} planPerMonth={c.planPerMonth} />
        </ChartCard>
      </div>

      {/* The same numbers as a table, so nothing depends on reading a chart or hovering. */}
      <details className="group rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <summary className="cursor-pointer text-sm font-medium">Show the monthly numbers</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Finished</th>
                <th className="py-2 pr-4 font-medium">Total so far</th>
                {goal && <th className="py-2 pr-4 font-medium">Plan</th>}
                <th className="py-2 font-medium">Pages</th>
              </tr>
            </thead>
            <tbody>
              {c.months.map((m) => (
                <tr key={m.month} className="border-t border-border/60">
                  <td className="py-2 pr-4">{m.month}</td>
                  <td className="py-2 pr-4">{m.read}</td>
                  <td className="py-2 pr-4">{m.cumulative ?? "—"}</td>
                  {goal && <td className="py-2 pr-4">{m.plan}</td>}
                  <td className="py-2">{m.pages ? fmt(m.pages) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {undated > 0 && (
        <p className="text-sm text-muted-foreground">
          {plural(undated, "finished reading has", "finished readings have")} no finish date, so {undated === 1 ? "it isn't" : "they aren't"} counted in any year.{" "}
          <Link href={libraryUrl({ status: ["finished"], sort: "finished", dir: "desc" })} className="font-medium text-primary underline-offset-4 hover:underline dark:text-highlight">
            Add dates
          </Link>{" "}
          (they&apos;re under &ldquo;Date unknown&rdquo;).
        </p>
      )}
    </div>
  );
}

function Headline({ challenge: c }: { challenge: Challenge }) {
  const pct = c.goal ? Math.min(100, Math.round((c.read / c.goal) * 100)) : 0;
  return (
    <section aria-labelledby="challenge-title" className="flex flex-col gap-6 rounded-3xl bg-accent/70 p-6 md:p-8 dark:bg-accent/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="challenge-title" className="font-heading text-xl font-semibold text-heading md:text-2xl">
            {c.year} reading challenge
          </h2>
          <GoalEditor year={c.year} goal={c.goal} />
        </div>
        <StatusChip challenge={c} />
      </div>

      {c.goal ? (
        <>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            {/* Hero figure: the one number the dashboard leads with (sans, proportional digits). */}
            <span className="font-sans text-6xl leading-none font-semibold tracking-tight text-heading md:text-7xl dark:text-foreground">{c.read}</span>
            <span className="pb-1.5 text-lg text-muted-foreground">of {plural(c.goal, "book", "books")}</span>
          </div>
          <div
            role="meter"
            aria-label={`${c.read} of ${c.goal} books`}
            aria-valuemin={0}
            aria-valuemax={c.goal}
            aria-valuenow={Math.min(c.read, c.goal)}
            className="h-3 w-full overflow-hidden rounded-full bg-background/80"
          >
            <div className="h-full rounded-full bg-(--chart-actual) transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[15px]">
            <PaceSentence challenge={c} />
          </p>
        </>
      ) : (
        <p className="text-[15px]">
          {c.read > 0 ? `You've finished ${plural(c.read, "book", "books")} in ${c.year}. ` : ""}
          Set a goal to see your plan, the pace you need and whether you&apos;re on track.
        </p>
      )}
    </section>
  );
}

function PaceSentence({ challenge: c }: { challenge: Challenge }) {
  if (!c.goal) return null;
  if (c.status === "met") {
    const over = c.read - c.goal;
    return <>Goal reached{over > 0 ? `, and ${plural(over, "book", "books")} over` : ""}. Well done!</>;
  }
  if (c.status === "missed") return <>You finished {c.read} of {c.goal}: {plural(c.goal - c.read, "book", "books")} short of the goal.</>;
  if (c.status === "not-started") return <>The year hasn&apos;t started yet. The plan is {c.planPerMonth} books a month.</>;
  return (
    <>
      {plural(c.remaining, "book", "books")} to go. To finish on time, read about <strong>{c.neededPerMonth} a month</strong> for the rest of the year
      {c.planPerMonth !== null && c.neededPerMonth !== null && c.neededPerMonth !== c.planPerMonth && <> (the plan was {c.planPerMonth})</>}.
    </>
  );
}

/** Status: always an icon and words, never colour alone. */
function StatusChip({ challenge: c }: { challenge: Challenge }) {
  const map = {
    ahead: { icon: TrendingUp, text: `${plural(c.difference, "book", "books")} ahead of plan`, tone: "good" },
    "on-track": { icon: Check, text: "On track", tone: "good" },
    behind: { icon: TrendingDown, text: `${plural(-c.difference, "book", "books")} behind plan`, tone: "warn" },
    met: { icon: Trophy, text: "Goal reached", tone: "good" },
    missed: { icon: X, text: "Goal missed", tone: "warn" },
    "not-started": { icon: Target, text: "Not started yet", tone: "neutral" },
    "no-goal": { icon: Target, text: "No goal yet", tone: "neutral" },
  } as const;
  const s = map[c.status];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
        s.tone === "good" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
        s.tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        s.tone === "neutral" && "bg-background text-muted-foreground",
      )}
    >
      <s.icon className="size-4" aria-hidden />
      {s.text}
    </span>
  );
}

function GoalEditor({ year, goal }: { year: number; goal: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goal ? String(goal) : "");
  const [pending, startTransition] = useTransition();

  const save = (next: number | null) =>
    startTransition(async () => {
      const r = await setYearlyGoal(year, next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(next ? `Goal for ${year}: ${plural(next, "book", "books")}` : "Goal removed");
      setOpen(false);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          />
        }
      >
        {goal ? (
          <>
            Goal: {plural(goal, "book", "books")} <Pencil className="size-3.5" aria-hidden />
          </>
        ) : (
          <span className="font-medium text-primary dark:text-highlight">Set a goal for {year}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(value.trim() ? Number(value) : null);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Books to read in {year}
            <Input type="number" inputMode="numeric" min={1} max={1000} value={value} onChange={(e) => setValue(e.target.value)} className="h-10" autoFocus />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="rounded-full px-4" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save
            </Button>
            {goal && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => save(null)} disabled={pending}>
                Remove goal
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-semibold text-heading">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
