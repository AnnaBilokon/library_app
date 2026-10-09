import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WishlistBoard } from "@/components/wishlist/wishlist-board";
import { getBooks } from "@/lib/data/books";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 pt-6 pb-12 md:px-8 md:pt-10">
      <PageHeader
        eyebrow="Books to get"
        title="Wishlist"
        actions={
          <Link href="/books/new?wishlist=1" className={buttonVariants({ className: "h-11 rounded-full px-5 text-[15px]" })}>
            <Plus aria-hidden />
            Add to wishlist
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <WishlistData />
      </Suspense>
    </main>
  );
}

async function WishlistData() {
  const books = (await getBooks()).filter((b) => b.wanted);
  // key: start from the server's state whenever the wishlist changes elsewhere.
  return <WishlistBoard key={books.map((b) => `${b.id}:${b.priority ?? ""}`).join()} books={books} />;
}
