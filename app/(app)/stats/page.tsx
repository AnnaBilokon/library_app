import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatsView } from "@/components/stats/stats-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";
import { computeStats, statsYears } from "@/lib/stats";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="All your reading" title="Stats" />
      <Suspense fallback={<StatsSkeleton />}>
        <StatsData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsData({ searchParams }: { searchParams: PageProps<"/stats">["searchParams"] }) {
  const [books, params] = await Promise.all([getBooks(), searchParams]);
  const years = statsYears(books);
  // ?year=2025 picks one year; anything else (or a year with no books) shows all years.
  const asked = Number(Array.isArray(params.year) ? params.year[0] : params.year);
  const year = years.includes(asked) ? asked : null;
  return <StatsView stats={computeStats(books, year)} years={years} />;
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading your stats">
      <Skeleton className="h-11 w-72 rounded-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
