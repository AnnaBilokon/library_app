import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditionForm } from "@/components/admin/edition-form";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth";
import { buildSuggestions } from "@/lib/books/suggestions";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Add an edition" };

export default function NewEditionPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <NewEdition />
      </Suspense>
    </main>
  );
}

async function NewEdition() {
  await requireAdmin();
  // Your own books feed autocomplete for authors, genres and publishers.
  const { authors, genres, publishers } = buildSuggestions(await getBooks());
  return (
    <>
      <Link href="/admin" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none">
        <ArrowLeft className="size-4" aria-hidden />
        Catalog
      </Link>
      <PageHeader eyebrow="Catalog" title="Add an edition" />
      <EditionForm hasMyCopy={false} suggestions={{ authors, genres, publishers }} />
    </>
  );
}
