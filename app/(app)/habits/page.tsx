import type { Metadata } from "next";
import { Suspense } from "react";
import { HabitDetails } from "@/components/habits/habit-details";
import { NewHabit } from "@/components/habits/new-habit";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";
import { getHabitSessions, getHabits } from "@/lib/data/habits";

export const metadata: Metadata = { title: "Habits" };

export default function HabitsPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Little and often" title="Reading habits" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <HabitsData />
      </Suspense>
    </main>
  );
}

async function HabitsData() {
  const [habits, sessions, books] = await Promise.all([getHabits(), getHabitSessions(), getBooks()]);
  const genres = [...new Set(books.flatMap((b) => b.genres))].sort((a, b) => a.localeCompare(b, "en"));
  return (
    <div className="flex flex-col gap-10">
      {habits.map((h) => (
        <HabitDetails key={h.id} habit={h} sessions={sessions} books={books} genres={genres} />
      ))}
      <NewHabit genres={genres} first={habits.length === 0} />
    </div>
  );
}
