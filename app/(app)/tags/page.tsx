import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TagsManager } from "@/components/tags/tags-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Tags" };

// Tagging the whole library runs one Server Action per batch of books; a batch takes a few seconds.
export const maxDuration = 60;

export default function TagsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Library" title="Tags" description="Your own moods and themes for your books, so you can find them by feel, not just by genre." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <Tags />
      </Suspense>
    </main>
  );
}

async function Tags() {
  const [books, { tagList }] = await Promise.all([getBooks(), getSettings()]);
  return (
    <TagsManager
      initialList={tagList}
      books={books.map(({ id, title, authors, coverSrc, language, tags }) => ({ id, title, authors, coverSrc, language, tags }))}
    />
  );
}
