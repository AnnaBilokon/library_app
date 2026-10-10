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
 * Wishlist books with a release date close by: the ones just out (time to look for them) and the
 * ones coming within a month. Hidden when there are none.
 */
export function ReleaseReminders({ books }: { books: Book[] }) {
  const today = todayLocal();
  const { soon, out } = releaseReminders(books, today);
  if (soon.length + out.length === 0) return null;

  return (
    <section aria-labelledby="releases-title" className="flex flex-col gap-4 rounded-3xl bg-highlight/60 p-5 md:p-6 dark:bg-highlight/25">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="releases-title" className="flex items-center gap-2 font-heading text-xl font-semibold text-heading">
          <CalendarClock className="size-5" aria-hidden />
          {out.length > 0 ? "Out now from your wishlist" : "Coming soon from your wishlist"}
        </h2>
        <Link href="/wishlist" className="text-sm font-medium underline-offset-4 hover:underline">
          Open the wishlist
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {out.length > 0 && <Group title="Out now: start looking" items={out} today={today} fresh />}
        {soon.length > 0 && <Group title={`Coming in the next ${RELEASE_WINDOW_DAYS} days`} items={soon} today={today} />}
      </div>
    </section>
  );
}

function Group({ title, items, today, fresh = false }: { title: string; items: ReleaseReminder[]; today: string; fresh?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-1">
        {items.map(({ book, date }) => (
          <li key={book.id}>
            <Link href={`/books/${book.id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-background/60 focus-visible:bg-background/60 focus-visible:outline-none">
              <BookCover title={book.title} src={book.coverSrc} sizes="36px" className="w-9 shrink-0" compact />
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={book.language} className="truncate font-heading text-sm font-semibold text-heading">
                  {book.title}
                </span>
                <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                  {book.authors.join(", ")}
                  {book.whereToBuy && (
                    <>
                      {book.authors.length > 0 && " · "}
                      <Store className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{book.whereToBuy}</span>
                    </>
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                  fresh ? "bg-primary text-primary-foreground" : "bg-soon text-soon-foreground",
                )}
              >
                {releaseLabel(date, today, formatDate)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
