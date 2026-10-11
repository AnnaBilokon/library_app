"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Flame, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { logSession } from "@/app/actions/habits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayLocal } from "@/lib/dates";
import { habitBook, habitProgress, newlyUnlocked, weekNudge, type Achievement, type Habit, type HabitSession } from "@/lib/habits";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BadgeRow } from "./badges";
import { Celebration } from "./celebration";

const QUICK_MINUTES = [15, 20, 30, 45];

/**
 * A habit at a glance: this week's circles, the streak, a nudge, the badges and a one-tap
 * "I read today". Logging can unlock a badge, which is celebrated right away.
 */
export function HabitCard({ habit, sessions, books, detailed = false }: { habit: Habit; sessions: HabitSession[]; books: Book[]; detailed?: boolean }) {
  const today = todayLocal();
  const p = useMemo(() => habitProgress(habit, sessions, books, today), [habit, sessions, books, today]);
  const [celebrate, setCelebrate] = useState<Achievement[]>([]);

  return (
    <section aria-labelledby={`habit-${habit.id}`} className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={`habit-${habit.id}`} className="font-heading text-xl font-semibold text-heading">
            {habit.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {habit.sessionsPerWeek} {habit.sessionsPerWeek === 1 ? "time" : "times"} a week · at least {habit.minMinutes} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          {p.streak > 0 && (
            <span className="inline-flex h-8 items-center gap-1 rounded-full bg-soon px-3 text-sm font-semibold text-soon-foreground" title="Weeks in a row">
              <Flame className="size-4" aria-hidden />
              {p.streak} {p.streak === 1 ? "week" : "weeks"}
            </span>
          )}
          {!detailed && (
            <Link href="/habits" className="text-sm font-medium underline-offset-4 hover:underline">
              Details
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <WeekCircles done={p.week.done} target={p.week.target} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className={cn("text-[15px]", p.week.complete && "font-semibold")}>{weekNudge(p)}</p>
          <LogButton
            habit={habit}
            books={books}
            todayMinutes={p.today?.minutes ?? null}
            onLogged={(date, minutes) => {
              // Celebrate badges this session unlocks, straight away.
              const after = habitProgress(habit, [...sessions.filter((s) => !(s.habitId === habit.id && s.date === date)), { id: "new", habitId: habit.id, date, minutes: minutes + (sessions.find((s) => s.habitId === habit.id && s.date === date)?.minutes ?? 0) }], books, today);
              const fresh = newlyUnlocked(p, after);
              if (fresh.length) setCelebrate(fresh);
            }}
          />
        </div>
      </div>

      <BadgeRow achievements={p.achievements} />
      {celebrate.length > 0 && <Celebration achievements={celebrate} onClose={() => setCelebrate([])} />}
    </section>
  );
}

/** One circle per session this week, filled as you go. */
function WeekCircles({ done, target }: { done: number; target: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`This week: ${Math.min(done, target)} of ${target}`}>
      {Array.from({ length: target }, (_, i) => {
        const filled = i < done;
        return (
          <li
            key={i}
            className={cn(
              "grid size-11 place-items-center rounded-full border-2 transition-colors",
              filled ? "habit-pop border-chart-actual bg-chart-actual text-white" : "border-dashed border-border text-muted-foreground",
            )}
            style={filled ? { animationDelay: `${i * 90}ms` } : undefined}
          >
            {filled ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <span className="text-sm tabular-nums">{i + 1}</span>}
          </li>
        );
      })}
      {done > target && <li className="text-sm font-semibold text-muted-foreground">+{done - target}</li>}
    </ol>
  );
}

function LogButton({ habit, books, todayMinutes, onLogged }: { habit: Habit; books: Book[]; todayMinutes: number | null; onLogged: (date: string, minutes: number) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(String(habit.minMinutes));
  const [when, setWhen] = useState<"today" | "yesterday">("today");
  const [pending, startTransition] = useTransition();
  // The habit's books, the ones you're reading first.
  const candidates = useMemo(
    () =>
      books
        .filter((b) => !b.wanted && habitBook(habit, b) && (b.status === "reading" || b.status === "paused" || b.status === "to-read"))
        .sort((a, b) => Number(b.status === "reading") - Number(a.status === "reading") || a.title.localeCompare(b.title, "uk"))
        .slice(0, 50),
    [books, habit],
  );
  const [bookId, setBookId] = useState<string>(habit.bookId ?? candidates.find((b) => b.status === "reading")?.id ?? "none");
  const items = [{ value: "none", label: "No particular book" }, ...candidates.map((b) => ({ value: b.id, label: b.title }))];

  const save = () => {
    const m = Number(minutes);
    if (!Number.isInteger(m) || m < 1 || m > 1440) {
      toast.error("Minutes: a whole number from 1.");
      return;
    }
    const today = todayLocal();
    const date = when === "today" ? today : new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    startTransition(async () => {
      const r = await logSession(habit.id, date, m, bookId === "none" ? null : bookId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(m >= habit.minMinutes ? `Logged ${m} min. Nice!` : `Logged ${m} min (${habit.minMinutes} counts for the week)`);
      setOpen(false);
      onLogged(date, m);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-2">
        {todayMinutes !== null && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-chart-actual/15 px-3 text-sm font-medium">
            <Check className="size-4 text-chart-actual" aria-hidden />
            Read today · {todayMinutes} min
          </span>
        )}
        <PopoverTrigger render={<Button className="h-9 rounded-full px-4" variant={todayMinutes !== null ? "outline" : "default"} />}>
          {todayMinutes !== null ? <Plus aria-hidden /> : <Check aria-hidden />}
          {todayMinutes !== null ? "Add more" : "I read today"}
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-80">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex rounded-full bg-muted p-1" role="group" aria-label="When">
            {(["today", "yesterday"] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={when === w}
                onClick={() => setWhen(w)}
                className={cn("h-8 flex-1 rounded-full text-sm font-medium text-muted-foreground", when === w && "bg-background text-foreground shadow-sm")}
              >
                {w === "today" ? "Today" : "Yesterday"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`min-${habit.id}`} className="text-sm font-medium">
              Minutes
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_MINUTES.map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={minutes === String(q)}
                  onClick={() => setMinutes(String(q))}
                  className={cn(
                    "h-8 rounded-full px-3 text-sm font-medium ring-1 ring-border tabular-nums hover:bg-muted",
                    minutes === String(q) && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
                  )}
                >
                  {q}
                </button>
              ))}
              <Input id={`min-${habit.id}`} type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8 w-20" />
            </div>
          </div>
          {candidates.length > 0 && (
            <div className="flex flex-col gap-2">
              <span id={`book-${habit.id}`} className="text-sm font-medium">
                Book
              </span>
              <Select value={bookId} onValueChange={(v) => v && setBookId(v)} items={items}>
                <SelectTrigger className="h-10 w-full" aria-labelledby={`book-${habit.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="rounded-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Log it
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
