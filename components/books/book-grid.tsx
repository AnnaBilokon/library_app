import Link from "next/link";
import { Heart } from "lucide-react";
import { STATUS_LABEL } from "@/lib/books/labels";
import type { Book, BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";

const SIZES = "(min-width: 1536px) 13vw, (min-width: 1280px) 15vw, (min-width: 1024px) 18vw, (min-width: 768px) 23vw, (min-width: 640px) 30vw, 45vw";

/** Ribbons only for statuses that say something; "to read" is the default for most books. */
const RIBBON: Partial<Record<BookStatus, string>> = {
  reading: "bg-highlight text-highlight-foreground",
  paused: "bg-secondary text-secondary-foreground",
  finished: "bg-primary text-primary-foreground",
  abandoned: "bg-muted text-muted-foreground",
};

/** Bookshop-window grid: 2 columns on a phone, up to 6 on a wide screen. */
export function BookGrid({ books, duplicateIds, priorityCount = 6 }: { books: Book[]; duplicateIds: Set<string>; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {books.map((book, i) => (
        <li key={book.id}>
          <BookCard book={book} duplicate={duplicateIds.has(book.id)} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function BookCard({ book, duplicate, priority, sizes = SIZES }: { book: Book; duplicate?: boolean; priority?: boolean; sizes?: string }) {
  const ribbon = RIBBON[book.status];
  const meta = [book.genres[0], book.publishedYear].filter(Boolean).join(" · ");

  return (
    <Link href={`/books/${book.id}`} className="group flex flex-col gap-3 rounded-sm outline-none">
      <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5">
        <BookCover
          title={book.title}
          authors={book.authors}
          src={book.coverSrc}
          lang={book.language}
          sizes={sizes}
          priority={priority}
          className="transition-shadow duration-300 group-hover:shadow-book-hover group-focus-visible:shadow-book-hover group-focus-visible:ring-3 group-focus-visible:ring-ring/60"
        />
        {ribbon && (
          <span
            className={cn(
              "absolute top-3 left-0 rounded-r-full py-0.5 pr-2.5 pl-2 text-[10px] font-semibold tracking-wider uppercase shadow-sm",
              ribbon,
            )}
          >
            {STATUS_LABEL[book.status]}
          </span>
        )}
        {book.favorite && (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-background/90 text-primary shadow-sm backdrop-blur dark:text-highlight">
            <Heart className="size-3.5 fill-current" aria-label="Favourite" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <h3 lang={book.language} className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold text-heading decoration-highlight decoration-2 underline-offset-4 group-hover:underline">
          {book.title}
        </h3>
        {book.authors.length > 0 && (
          <p lang={book.language} className="truncate text-sm text-muted-foreground">
            {book.authors.join(", ")}
          </p>
        )}
        {(meta || duplicate) && (
          <p className="truncate text-xs text-muted-foreground/90">
            {meta}
            {duplicate && <span className="ml-1 italic">{meta ? "· " : ""}possible duplicate</span>}
          </p>
        )}
      </div>
    </Link>
  );
}
