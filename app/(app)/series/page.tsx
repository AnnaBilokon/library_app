import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CollectionTabs } from "@/components/series/collection-tabs";
import { SeriesView } from "@/components/series/series-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";
import { getSeriesTotals } from "@/lib/data/series";
import { seriesTracker } from "@/lib/series";

export const metadata: Metadata = { title: "Series" };

export default function SeriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Your collections" title="Series" />
      <CollectionTabs current="series" />
      <Suspense fallback={<SeriesSkeleton />}>
        <SeriesData />
      </Suspense>
    </main>
  );
}

async function SeriesData() {
  const [books, totals] = await Promise.all([getBooks(), getSeriesTotals()]);
  return <SeriesView series={seriesTracker(books, totals)} />;
}

function SeriesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your series">
      <Skeleton className="h-10 w-80 rounded-full" />
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
