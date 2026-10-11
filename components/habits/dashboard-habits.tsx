"use client";

import Link from "next/link";
import { Sprout } from "lucide-react";
import type { Habit, HabitSession } from "@/lib/habits";
import type { Book } from "@/lib/types";
import { HabitCard } from "./habit-card";

/** Your habits at the top of the Dashboard, or a small invitation to start one. */
export function DashboardHabits({ habits, sessions, books }: { habits: Habit[]; sessions: HabitSession[]; books: Book[] }) {
  if (habits.length === 0) {
    return (
      <Link
        href="/habits"
        className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border px-5 py-4 text-sm hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Sprout className="size-5 shrink-0 text-chart-actual" aria-hidden />
        <span>
          <span className="font-semibold">Build a reading habit</span>
          <span className="text-muted-foreground"> · e.g. non-fiction 3 times a week for 15 minutes, with streaks and badges →</span>
        </span>
      </Link>
    );
  }
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {habits.map((h) => (
        <HabitCard key={h.id} habit={h} sessions={sessions} books={books} />
      ))}
    </div>
  );
}
