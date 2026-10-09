import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { LibraryView } from "@/components/books/library-view";
import { COLUMNS_COOKIE, LAYOUT_COOKIE, parseColumns, type LibraryLayout } from "@/lib/books/layout";
import { LibrarySkeleton } from "@/components/books/library-skeleton";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getBooks } from "@/lib/data/books";
import { isWishlistOnly } from "@/lib/wishlist";

export const metadata: Metadata = { title: "Library" };

/**
 * A Server Component: it runs only on the server and sends HTML, never its own JS.
 * The heading prerenders instantly; the books stream in behind <Suspense>
 * because they depend on who is signed in.
 */
export default function LibraryPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:gap-10 md:px-8 md:pt-10">
      <PageHeader
        eyebrow="Your shelves"
        title="Library"
        actions={
          <Link href="/books/new" className={buttonVariants({ className: "h-11 rounded-full px-5 text-[15px]" })}>
            <Plus aria-hidden />
            Add a book
          </Link>
        }
      />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryData />
      </Suspense>
    </main>
  );
}

async function LibraryData() {
  const [all, cookieStore] = await Promise.all([getBooks(), cookies()]);
  // Books you only want (not owned yet) live on the Wishlist page, not on your shelves.
  const books = all.filter((b) => !isWishlistOnly(b));
  const saved = cookieStore.get(LAYOUT_COOKIE)?.value;
  const layout: LibraryLayout = saved === "table" ? "table" : "grid";
  // LibraryView is a Client Component ("use client"): it gets the data as props and handles
  // the interactive parts (search, filters, sorting) in the browser.
  const columns = parseColumns(cookieStore.get(COLUMNS_COOKIE)?.value);
  return <LibraryView books={books} initialLayout={layout} initialColumns={columns} wishlistCount={all.length - books.length} />;
}
