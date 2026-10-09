import Link from "next/link";
import { Heart } from "lucide-react";
import { STATUS_LABEL } from "@/lib/books/labels";
import type { Book, BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { lastStop, progressInfo } from "@/lib/books/progress";
import { openReading } from "@/lib/books/reading-logic";
import { BookCover } from "./book-cover";
import { BookQuickActions } from "./book-quick-actions";
import { AuthorLinks } from "./name-links";
import { ProgressBar } from "./reading-tools";

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
          <BookCard book={book} duplicate={duplicateIds.has(book.id)} priority={i < priorityCount} actions />
        </li>
      ))}
    </ul>
  );
}

export function BookCard({
  book,
  duplicate,
  priority,
  sizes = SIZES,
  hideRibbon,
  hideProgress,
  actions,
}: {
  book: Book;
  duplicate?: boolean;
  priority?: boolean;
  sizes?: string;
  /** The Up next queue shows its own "Next read" ribbon instead. */
  hideRibbon?: boolean;
  /** The Reading now shelf shows its own progress row with a quick update. */
  hideProgress?: boolean;
  /** Library grid: Up next / Reading now / Finished on hover (a menu on touch screens). */
  actions?: boolean;
}) {
  const ribbon = hideRibbon ? undefined : RIBBON[book.status];
  const meta = [book.genres[0], book.publishedYear].filter(Boolean).join(" · ");
  const progress =
    !hideProgress && (book.status === "reading" || book.status === "paused") ? progressInfo(openReading(book.readings), book.pages) : null;
  // Did not finish: where you stopped (the reason shows on hover and on the book page).
  const stop = book.status === "abandoned" ? lastStop(book.readings) : undefined;
  const stoppedAt = stop ? progressInfo(stop, book.pages) : null;

  return (
    // The cover and the title both open the book; the quick actions sit beside them (buttons
    // can't go inside a link). Only the title link is a tab stop.
    <div className="group flex flex-col gap-3">
      <div className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-has-[a:focus-visible]:-translate-y-1.5">
        <Link href={`/books/${book.id}`} tabIndex={-1} aria-hidden className="block rounded-sm outline-none">
          <BookCover
            title={book.title}
            authors={book.authors}
            src={book.coverSrc}
            lang={book.language}
            sizes={sizes}
            priority={priority}
            className="transition-shadow duration-300 group-hover:shadow-book-hover group-has-[a:focus-visible]:shadow-book-hover group-has-[a:focus-visible]:ring-3 group-has-[a:focus-visible]:ring-ring/60"
          />
        </Link>
        {ribbon && (
          <span
            className={cn(
              "pointer-events-none absolute top-3 left-0 rounded-r-full py-0.5 pr-2.5 pl-2 text-[10px] font-semibold tracking-wider uppercase shadow-sm",
              ribbon,
            )}
          >
            {STATUS_LABEL[book.status]}
          </span>
        )}
        {book.timesRead >= 2 && (
          <span
            className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur"
            title={`Read ${book.timesRead} times`}
          >
            ×{book.timesRead}
            <span className="sr-only"> read {book.timesRead} times</span>
          </span>
        )}
        {book.favorite && (
          <span className="pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-background/90 text-red-500 shadow-sm backdrop-blur dark:text-red-400">
            <Heart className="size-3.5 fill-current" aria-label="Favourite" />
          </span>
        )}
        {actions && <BookQuickActions book={book} />}
      </div>
      {stop && (stoppedAt || stop.stopReason) && (
        <p className="-mt-1 truncate px-0.5 text-[11px] text-muted-foreground" title={stop.stopReason}>
          {stoppedAt ? `Stopped at ${stoppedAt.label}` : "Stopped"}
          {stop.stopReason && <span className="italic"> · “{stop.stopReason}”</span>}
        </p>
      )}
      {progress && (
        <div className="-mt-1 flex items-center gap-2 px-0.5">
          <ProgressBar percent={progress.percent ?? 0} className="flex-1" />
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{progress.percent !== undefined ? `${progress.percent}%` : progress.label}</span>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <Link href={`/books/${book.id}`} className="rounded-sm outline-none">
        <h3 lang={book.language} className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold text-heading decoration-highlight decoration-2 underline-offset-4 group-hover:underline">
          {book.title}
        </h3>
        </Link>
        {book.authors.length > 0 && (
          <p className="truncate text-sm text-muted-foreground">
            <AuthorLinks authors={book.authors} lang={book.language} quiet />
          </p>
        )}
        {(meta || duplicate) && (
          <p className="truncate text-xs text-muted-foreground/90">
            {meta}
            {duplicate && <span className="ml-1 italic">{meta ? "· " : ""}possible duplicate</span>}
          </p>
        )}
      </div>
    </div>
  );
}
