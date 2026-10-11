"use client";

import Link from "next/link";
import { CalendarClock, Store } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { releaseReminders, RELEASE_WINDOW_DAYS, type ReleaseReminder } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** "in 7 days", "tomorrow", "today", "yesterday", "3 days ago". */
function countdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/**
 * Wishlist books coming out (or just out) as tickets to their release day, with a timeline of
 * the month either side of today on top. Hidden when there are none.
 */
export function ReleaseReminders({ books }: { books: Book[] }) {
  const today = todayLocal();
  const { soon, out } = releaseReminders(books, today);
  if (soon.length + out.length === 0) return null;
  // The ones just out first (time to look for them), then the soonest coming.
  const all = [...out, ...soon];

  return (
    <section aria-labelledby="releases-title" className="flex flex-col gap-5 rounded-3xl bg-accent p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="releases-title" className="flex items-center gap-2 font-heading text-xl font-semibold text-heading">
          <CalendarClock className="size-5" aria-hidden />
          Release days
        </h2>
        <p className="text-sm text-muted-foreground">
          {out.length > 0 && <>{out.length} out now · </>}
          {soon.length > 0 && <>{soon.length} coming · </>}
          <Link href="/wishlist" className="font-medium text-foreground underline-offset-4 hover:underline">
            Open the wishlist
          </Link>
        </p>
      </div>

      <Timeline items={all} />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {all.map((r) => (
          <li key={r.book.id}>
            <Ticket r={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The month before and after today on one line, with a marker on each book's release day. */
function Timeline({ items }: { items: ReleaseReminder[] }) {
  const pos = (days: number) => `${((days + RELEASE_WINDOW_DAYS) / (RELEASE_WINDOW_DAYS * 2)) * 100}%`;
  return (
    <div className="px-3 pt-2 pb-6" aria-hidden>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-primary/30 via-border to-soon/50">
        {/* Today */}
        <span className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" style={{ left: "50%" }} />
        <span className="absolute top-4 -translate-x-1/2 text-[11px] font-semibold text-foreground" style={{ left: "50%" }}>
          Today
        </span>
        <span className="absolute top-4 left-0 text-[11px] text-muted-foreground">{RELEASE_WINDOW_DAYS} days ago</span>
        <span className="absolute top-4 right-0 text-[11px] text-muted-foreground">in {RELEASE_WINDOW_DAYS} days</span>
        {items.map((r) => (
          <span
            key={r.book.id}
            title={`${r.book.title}: ${countdown(r.days)}`}
            className={cn(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-accent",
              r.days <= 0 ? "bg-primary" : "bg-soon",
            )}
            style={{ left: pos(r.days) }}
          />
        ))}
      </div>
    </div>
  );
}

/** A ticket to the release: a stub with the date (tear line and notches), the book, a countdown. */
function Ticket({ r }: { r: ReleaseReminder }) {
  const { book, date, days } = r;
  const out = days <= 0;
  const d = utc(date);
  return (
    <Link
      href={`/books/${book.id}`}
      className="group relative flex h-full overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60 transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {/* Stub: the release date */}
      <div className={cn("flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 py-4", out ? "bg-primary text-primary-foreground" : "bg-soon text-soon-foreground")}>
        <span className={cn("text-[11px] font-semibold tracking-[0.14em] uppercase", !out && "opacity-80")}>{out ? "Out now" : weekday.format(d)}</span>
        <span className="font-heading text-3xl leading-none font-bold tabular-nums">{d.getUTCDate()}</span>
        <span className="text-xs font-semibold tracking-[0.12em] uppercase">{month.format(d)}</span>
      </div>
      {/* Tear line with notches cut out of the top and bottom */}
      <span className="relative w-0 border-l-2 border-dashed border-border" aria-hidden>
        <span className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-accent" />
        <span className="absolute -bottom-2.5 -left-2.5 size-5 rounded-full bg-accent" />
      </span>
      {/* The book */}
      <div className="flex min-w-0 flex-1 items-center gap-3 p-3 pl-4">
        <BookCover title={book.title} src={book.coverSrc} lang={book.language} sizes="48px" compact className="w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span lang={book.language} className="line-clamp-2 font-heading text-sm leading-snug font-semibold text-heading group-hover:underline">
            {book.title}
          </span>
          {book.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className={cn("font-semibold tabular-nums", out ? "text-foreground" : "text-soon-foreground dark:text-soon")}>{out ? `Out ${countdown(days)}` : countdown(days)}</span>
            {book.whereToBuy && (
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <Store className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{book.whereToBuy}</span>
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
