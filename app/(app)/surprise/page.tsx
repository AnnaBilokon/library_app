import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SurpriseView } from "@/components/surprise/surprise-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Surprise me" };

export default function SurprisePage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Pick my next book" title="Surprise me" />
      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-3xl" />}>
        <SurpriseData />
      </Suspense>
    </main>
  );
}

async function SurpriseData() {
  return <SurpriseView books={await getBooks()} />;
}
