"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSession, endHabit } from "@/app/actions/habits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/books/labels";
import { todayLocal } from "@/lib/dates";
import { habitProgress, type Habit, type HabitSession } from "@/lib/habits";
import type { Book } from "@/lib/types";
import { BadgeGrid } from "./badges";
import { HabitCard } from "./habit-card";
import { HabitForm } from "./habit-form";
import { Heatmap } from "./heatmap";

/** Everything about one habit: the card, the half-year heatmap, all badges, sessions, editing. */
export function HabitDetails({ habit, sessions, books, genres }: { habit: Habit; sessions: HabitSession[]; books: Book[]; genres: string[] }) {
  const p = useMemo(() => habitProgress(habit, sessions, books, todayLocal()), [habit, sessions, books]);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const mine = sessions.filter((s) => s.habitId === habit.id).sort((a, b) => b.date.localeCompare(a.date));
  const titles = new Map(books.map((b) => [b.id, b.title]));

  const end = (how: "stop" | "delete") => {
    if (how === "delete" && !window.confirm(`Delete "${habit.name}" with all its sessions and badges?`)) return;
    startTransition(async () => {
      const r = await endHabit(habit.id, how);
      if (r.ok) toast.success(how === "stop" ? "Habit stopped" : "Habit deleted");
      else toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <HabitCard habit={habit} sessions={sessions} books={books} detailed />

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading text-lg font-semibold text-heading">Your last six months</h3>
          <p className="text-sm text-muted-foreground tabular-nums">
            {p.totalSessions} {p.totalSessions === 1 ? "session" : "sessions"} · {p.totalMinutes} min · {p.weeksDone} {p.weeksDone === 1 ? "week" : "weeks"} done · best streak{" "}
            {p.bestStreak}
          </p>
        </div>
        <Heatmap weeks={p.heatmap} minMinutes={habit.minMinutes} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
        <h3 className="font-heading text-lg font-semibold text-heading">Badges</h3>
        <BadgeGrid achievements={p.achievements} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-lg font-semibold text-heading">Sessions</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Edit habit
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={() => end("stop")}>
              Stop
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full text-destructive" disabled={pending} onClick={() => end("delete")}>
              Delete
            </Button>
          </div>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet. Read for {habit.minMinutes} minutes and press &ldquo;I read today&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {mine.slice(0, 30).map((s) => (
              <SessionRow key={s.id} s={s} min={habit.minMinutes} title={s.bookId ? titles.get(s.bookId) : undefined} />
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
          </DialogHeader>
          <HabitForm habit={habit} genres={genres} onDone={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionRow({ s, min, title }: { s: HabitSession; min: number; title?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="w-28 shrink-0 tabular-nums">{formatDate(s.date)}</span>
      <span className={s.minutes >= min ? "font-semibold tabular-nums" : "text-muted-foreground tabular-nums"}>{s.minutes} min</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{title}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full text-muted-foreground"
        aria-label={`Delete the session on ${formatDate(s.date)}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await deleteSession(s.id);
            if (!r.ok) toast.error(r.error);
          })
        }
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}
