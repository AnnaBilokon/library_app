import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { LibraryView } from "@/components/books/library-view";
import { COLUMNS_COOKIE, LAYOUT_COOKIE, parseColumns, type LibraryLayout } from "@/lib/books/layout";
import { LibrarySkeleton } from "@/components/books/library-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Library" };

/**
 * A Server Component: it runs only on the server and sends HTML, never its own JS.
 * The heading prerenders instantly; the books stream in behind <Suspense>
 * because they depend on who is signed in.
 */
export default function LibraryPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Library" description="Every book on your shelves." />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryData />
      </Suspense>
    </main>
  );
}

async function LibraryData() {
  const [books, cookieStore] = await Promise.all([getBooks(), cookies()]);
  const saved = cookieStore.get(LAYOUT_COOKIE)?.value;
  const layout: LibraryLayout = saved === "table" ? "table" : "grid";
  // LibraryView is a Client Component ("use client"): it gets the data as props and handles
  // the interactive parts (search, filters, sorting) in the browser.
  const columns = parseColumns(cookieStore.get(COLUMNS_COOKIE)?.value);
  return <LibraryView books={books} initialLayout={layout} initialColumns={columns} />;
}
