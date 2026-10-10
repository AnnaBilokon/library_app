import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookForm } from "@/components/books/book-form";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { buildSuggestions } from "@/lib/books/suggestions";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Add a book" };

export default function NewBookPage({ searchParams }: PageProps<"/books/new">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Link
        href="/library"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>
      <PageHeader eyebrow="New on the shelf" title="Add a book" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <NewBookForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NewBookForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Existing books feed autocomplete (authors, genres, publishers) and the duplicate warning.
  const [books, params] = await Promise.all([getBooks(), searchParams]);
  // Opened from the Wishlist page (?wishlist=1): preset "on my wishlist, not owned".
  // From the series/author trackers: ?author=…&series=…&index=… fill those in too.
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const index = Number(one(params.index));
  const preset = {
    authors: one(params.author) ? [one(params.author)!.slice(0, 200)] : undefined,
    series: one(params.series)?.slice(0, 200),
    seriesIndex: Number.isInteger(index) && index > 0 && index <= 1000 ? index : undefined,
  };
  return <BookForm suggestions={buildSuggestions(books)} forWishlist={params.wishlist === "1"} preset={preset} />;
}
