import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ChallengeView } from "@/components/dashboard/challenge-view";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BOOKS_READ_VIEW_COOKIE } from "@/lib/books/layout";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBooks } from "@/lib/data/books";
import { getGoals } from "@/lib/data/goals";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Your reading year" title="Dashboard" />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </main>
  );
}

async function DashboardData() {
  const [books, goals, authorCountries, cookieStore] = await Promise.all([getBooks(), getGoals(), getAuthorCountries(), cookies()]);
  const view = cookieStore.get(BOOKS_READ_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";
  return <ChallengeView books={books} goals={goals} authorCountries={authorCountries} initialBooksView={view} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading your reading year">
      <Skeleton className="h-9 w-48 rounded-full" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
