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

export default function NewBookPage() {
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
        <NewBookForm />
      </Suspense>
    </main>
  );
}

async function NewBookForm() {
  // Existing books feed autocomplete (authors, genres, publishers) and the duplicate warning.
  const books = await getBooks();
  return <BookForm suggestions={buildSuggestions(books)} />;
}
