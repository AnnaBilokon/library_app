import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { YearStory } from "@/components/year/year-story";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBattlePicks } from "@/lib/data/battle";
import { getBooks } from "@/lib/data/books";
import { getGoals } from "@/lib/data/goals";
import { reportYears, yearInBooks } from "@/lib/year-in-books";

export const metadata: Metadata = { title: "Year in Books" };

export default function YearInBooksPage({ searchParams }: PageProps<"/year-in-books">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Suspense fallback={<Skeleton className="h-[36rem] w-full rounded-[2rem]" />}>
        <YearData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function YearData({ searchParams }: { searchParams: PageProps<"/year-in-books">["searchParams"] }) {
  const [books, countries, goals, params] = await Promise.all([getBooks(), getAuthorCountries(), getGoals(), searchParams]);
  const today = new Date().toISOString().slice(0, 10);
  const years = reportYears(books);
  if (years.length === 0) {
    return <p className="rounded-3xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border/60">Finish a book (with a date) to get your Year in Books.</p>;
  }
  // ?year=2025, or the latest year with books.
  const asked = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const year = years.includes(asked) ? asked : years[0];
  const picks = await getBattlePicks(year);
  return <YearStory y={yearInBooks(books, year, { picks, countries, goal: goals[year] ?? null, today })} years={years} />;
}
