import type { Metadata } from "next";
import { Suspense } from "react";
import { BattleBoard } from "@/components/battle/battle-board";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { computeBattle, type Bracket } from "@/lib/battle";
import { getBattlePicks } from "@/lib/data/battle";
import { getBooks } from "@/lib/data/books";
import { statsYears } from "@/lib/stats";

export const metadata: Metadata = { title: "Book battle" };

export default function BattlePage({ searchParams }: PageProps<"/battle">) {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Your year in books" title="Book battle" />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-3xl" />}>
        <BattleData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BattleData({ searchParams }: { searchParams: PageProps<"/battle">["searchParams"] }) {
  const [books, params] = await Promise.all([getBooks(), searchParams]);
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = Number(today.slice(0, 4));
  const years = [...new Set([thisYear, ...statsYears(books)])].sort((a, b) => b - a);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // ?year=2025 and ?bracket=worst; anything else falls back to this year's best books.
  const asked = Number(one(params.year));
  const year = years.includes(asked) ? asked : thisYear;
  const bracket: Bracket = one(params.bracket) === "worst" ? "worst" : "best";
  const picks = await getBattlePicks(year);
  const battle = computeBattle(books, picks[bracket], year, bracket, today);
  // key: start from the server's state after every save.
  return <BattleBoard key={`${year}-${bracket}-${JSON.stringify(picks[bracket])}`} battle={battle} years={years} />;
}
