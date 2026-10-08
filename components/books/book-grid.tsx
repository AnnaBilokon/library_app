import Link from "next/link";
import { Heart } from "lucide-react";
import type { Book } from "@/lib/types";
import { BookCover } from "./book-cover";
import { StatusBadge } from "./status-badge";

/** Cover grid: 2 columns on a phone, growing with the screen. */
export function BookGrid({ books, duplicateIds }: { books: Book[]; duplicateIds: Set<string> }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {books.map((book, i) => (
        <li key={book.id}>
          <Link
            href={`/books/${book.id}`}
            className="group flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
              <BookCover
                title={book.title}
                authors={book.authors}
                src={book.coverSrc}
                lang={book.language}
                sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 16vw, (min-width: 1024px) 19vw, (min-width: 768px) 23vw, (min-width: 640px) 31vw, 46vw"
                priority={i < 6}
              />
              {book.favorite && (
                <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-background/90 text-primary shadow-sm">
                  <Heart className="size-3.5 fill-current" aria-label="Favourite" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 lang={book.language} className="line-clamp-2 font-heading text-sm leading-snug font-semibold group-hover:underline">
                {book.title}
              </h3>
              {book.authors.length > 0 && (
                <p lang={book.language} className="truncate text-xs text-muted-foreground">
                  {book.authors.join(", ")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={book.status} />
                {duplicateIds.has(book.id) && (
                  <span className="rounded-full border border-dashed px-1.5 text-[10px] text-muted-foreground">Duplicate?</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
