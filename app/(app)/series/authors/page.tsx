import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthorCountriesProvider } from "@/components/countries/author-countries-context";
import { PageHeader } from "@/components/layout/page-header";
import { AuthorCollectionsView } from "@/components/series/author-collections-view";
import { CollectionTabs } from "@/components/series/collection-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { authorCollections } from "@/lib/author-collections";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Authors" };

export default function AuthorsPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader eyebrow="Your collections" title="Authors" />
      <CollectionTabs current="authors" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AuthorsData />
      </Suspense>
    </main>
  );
}

async function AuthorsData() {
  const [books, countries] = await Promise.all([getBooks(), getAuthorCountries()]);
  return (
    <AuthorCountriesProvider value={countries}>
      <AuthorCollectionsView collections={authorCollections(books)} />
    </AuthorCountriesProvider>
  );
}
