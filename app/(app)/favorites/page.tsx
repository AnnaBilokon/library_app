import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FavouritesView } from "@/components/books/favourites-view";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Favourites" };

export default function FavouritesPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Link
        href="/library"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>
      <PageHeader eyebrow="Your shelves" title="Favourites" description="The books you love, all in one place." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <Favourites />
      </Suspense>
    </main>
  );
}

async function Favourites() {
  const books = await getBooks();
  return <FavouritesView books={books.filter((b) => b.favorite)} />;
}
