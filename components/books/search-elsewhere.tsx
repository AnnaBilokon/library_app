"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { searchMatcher } from "@/lib/books/filters";
import type { Book } from "@/lib/types";
import { BookCover } from "./book-cover";
import { useCatalogSearch } from "./find-in-catalog";

const WHERE = (b: Book) => (b.wanted ? "on your wishlist" : b.soldAt ? "sold" : b.forSale ? "on the sell shelf" : "elsewhere");

/**
 * Under a Library search: matches the current view leaves out (the other shelf, the wishlist, sold
 * books) and catalog editions you don't have yet, each one click away.
 */
export function SearchElsewhere({
  q,
  otherShelf,
  onShowOtherShelf,
  otherBooks,
  myEditionIds,
}: {
  q: string;
  /** Matches on the shelf you're not looking at, and its name ("Read, not owned" or "Your shelves"). */
  otherShelf: { count: number; label: string };
  onShowOtherShelf: () => void;
  /** Books outside the Library: wishlist, sold, hidden for sale. */
  otherBooks: Book[];
  /** Editions you already have a book for, left out of the catalog matches. */
  myEditionIds: Set<string>;
}) {
  const others = useMemo(() => (q.trim() ? otherBooks.filter(searchMatcher(q)) : []), [q, otherBooks]);
  const { results } = useCatalogSearch(q);
  const catalog = (results ?? []).filter((e) => !myEditionIds.has(e.id)).slice(0, 4);

  if (!q.trim() || (otherShelf.count === 0 && others.length === 0 && catalog.length === 0)) return null;

  return (
    <aside aria-label="More matches" className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
      {otherShelf.count > 0 && (
        <p>
          {otherShelf.count === 1 ? "1 more match" : `${otherShelf.count} more matches`} in{" "}
          <button type="button" onClick={onShowOtherShelf} className="font-medium underline underline-offset-4 hover:text-primary">
            {otherShelf.label}
          </button>
        </p>
      )}
      {others.length > 0 && (
        <p className="flex flex-wrap gap-x-1">
          <span>Also</span>
          {others.slice(0, 5).map((b, i) => (
            <span key={b.id}>
              <Link href={`/books/${b.id}`} lang={b.language} className="font-medium underline underline-offset-4 hover:text-primary">
                {b.title}
              </Link>{" "}
              <span className="text-muted-foreground">({WHERE(b)})</span>
              {i < Math.min(others.length, 5) - 1 && ","}
            </span>
          ))}
        </p>
      )}
      {catalog.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-medium">In the catalog, not in your library yet</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {catalog.map((e) => (
              <li key={e.id} className="flex items-center gap-4 rounded-xl bg-background p-3">
                <div className="w-14 shrink-0">
                  <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="56px" compact />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span lang={e.language} className="line-clamp-2 text-base leading-snug font-medium">
                    {e.title}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {[e.authors.join(", "), e.publisher, e.publishedYear].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <Link
                  href={`/books/new?edition=${e.id}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-medium ring-1 ring-border hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                  Add
                  <span className="sr-only"> “{e.title}” to my library</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
