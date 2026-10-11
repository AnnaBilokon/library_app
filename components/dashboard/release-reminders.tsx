"use client";

import Link from "next/link";
import { CalendarClock, Store } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { formatDate } from "@/lib/books/labels";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { releaseLabel, releaseReminders, RELEASE_WINDOW_DAYS, type ReleaseReminder } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

/**
 * Wishlist books with a release date close by, as covers: the ones just out (time to look for
 * them) and the ones coming within a month, side by side and wrapping on small screens. Hidden
 * when there are none.
 */
export function ReleaseReminders({ books }: { books: Book[] }) {
  const today = todayLocal();
  const { soon, out } = releaseReminders(books, today);
  if (soon.length + out.length === 0) return null;

  return (
    <section aria-labelledby="releases-title" className="flex flex-col gap-4 rounded-3xl bg-highlight/50 p-5 md:p-6 dark:bg-highlight/15">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="releases-title" className="flex items-center gap-2 font-heading text-xl font-semibold text-heading">
          <CalendarClock className="size-5" aria-hidden />
          From your wishlist
        </h2>
        <Link href="/wishlist" className="text-sm font-medium underline-offset-4 hover:underline">
          Open the wishlist
        </Link>
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-6">
        {out.length > 0 && <Group title="Out now: start looking" items={out} today={today} fresh />}
        {soon.length > 0 && <Group title={`Coming in the next ${RELEASE_WINDOW_DAYS} days`} items={soon} today={today} />}
      </div>
    </section>
  );
}

function Group({ title, items, today, fresh = false }: { title: string; items: ReleaseReminder[]; today: string; fresh?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {/* Phones: one row you scroll sideways; wider screens: covers wrap. */}
      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pt-1 pb-2 sm:flex-wrap sm:overflow-visible">
        {items.map(({ book, date }) => (
          <li key={book.id} className="w-28 shrink-0 sm:w-32">
            <Link href={`/books/${book.id}`} className="group flex flex-col gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <div className="relative">
                <BookCover
                  title={book.title}
                  authors={book.authors}
                  src={book.coverSrc}
                  lang={book.language}
                  sizes="128px"
                  compact
                  className="transition-transform group-hover:-translate-y-0.5"
                />
                {/* When it comes out, on the cover: dark once it's out, coral while it's coming. */}
                <span
                  className={cn(
                    "absolute inset-x-1.5 bottom-1.5 truncate rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums shadow-sm",
                    fresh ? "bg-primary text-primary-foreground" : "bg-soon text-soon-foreground",
                  )}
                >
                  {releaseLabel(date, today, formatDate)}
                </span>
              </div>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span lang={book.language} className="line-clamp-2 font-heading text-sm leading-snug font-semibold text-heading group-hover:underline">
                  {book.title}
                </span>
                {book.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>}
                {book.whereToBuy && (
                  <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <Store className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{book.whereToBuy}</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
