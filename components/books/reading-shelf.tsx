"use client";

import { useState } from "react";
import { queueOf } from "@/lib/books/queue";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCard } from "./book-grid";
import { QueueShelf } from "./queue-shelf";
import { ShelfProgress } from "./reading-tools";

type Tab = "reading" | "queue" | "paused";

/** The shelf at the top of the Library: what you're reading, your "Up next" queue, and paused books. */
export function ReadingShelf({ books }: { books: Book[] }) {
  const reading = books.filter((b) => b.status === "reading");
  const paused = books.filter((b) => b.status === "paused");
  const queue = queueOf(books);
  const [tab, setTab] = useState<Tab>(reading.length > 0 ? "reading" : queue.length > 0 ? "queue" : "paused");

  const tabs: [Tab, string, number][] = [
    ["reading", "Reading now", reading.length],
    ["queue", "Up next", queue.length],
    ["paused", "Paused", paused.length],
  ];

  return (
    <section aria-label="Current reads" className="rounded-3xl bg-accent/70 px-5 py-6 md:px-8 md:py-8 dark:bg-accent/60">
      <div role="tablist" aria-label="Current reads" className="mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {tabs.map(([value, label, count]) =>
          // Paused only appears when there is something paused; Up next always, so it can be discovered.
          count === 0 && value === "paused" ? null : (
            <button
              key={value}
              type="button"
              role="tab"
              id={`shelf-tab-${value}`}
              aria-selected={tab === value}
              aria-controls="shelf-panel"
              onClick={() => setTab(value)}
              className={cn(
                "flex items-baseline gap-2 font-heading font-semibold transition-colors focus-visible:underline focus-visible:outline-none",
                tab === value ? "text-xl text-heading md:text-2xl" : "text-base text-muted-foreground hover:text-foreground md:text-lg",
              )}
            >
              {label}
              <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
            </button>
          ),
        )}
      </div>

      <div role="tabpanel" id="shelf-panel" aria-labelledby={`shelf-tab-${tab}`}>
        {tab === "queue" ? (
          // key: start from the server's order whenever it changes (e.g. a book was added elsewhere).
          <QueueShelf key={queue.map((b) => b.id).join()} queue={queue} />
        ) : (
          <BookRow
            books={tab === "reading" ? reading : paused}
            empty={
              tab === "reading" ? (
                <>
                  Nothing in progress. Open a book and set its status to <span className="font-medium">Reading</span>.
                </>
              ) : (
                "No paused books."
              )
            }
          />
        )}
      </div>
    </section>
  );
}

function BookRow({ books, empty }: { books: Book[]; empty: React.ReactNode }) {
  if (books.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="-mx-5 flex snap-x scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
      {books.map((book) => (
        <li key={book.id} className="w-32 shrink-0 snap-start sm:w-36">
          <BookCard book={book} sizes="144px" priority hideProgress />
          {/* key: start fresh when the saved progress changes */}
          <ShelfProgress key={book.readings.map((r) => `${r.id}:${r.progressPage}:${r.progressPercent}`).join()} book={book} />
        </li>
      ))}
    </ul>
  );
}
