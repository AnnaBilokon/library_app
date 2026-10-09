import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SellBoard } from "@/components/selling/sell-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";
import { splitSelling } from "@/lib/selling";

export const metadata: Metadata = { title: "Sell" };

export default function SellPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Books to let go" title="Sell" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <SellData />
      </Suspense>
    </main>
  );
}

async function SellData() {
  const { toSell, sold } = splitSelling(await getBooks());
  return <SellBoard toSell={toSell} sold={sold} />;
}
