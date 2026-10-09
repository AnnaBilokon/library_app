"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCard } from "./book-grid";

type Tab = "reading" | "paused";

/** The shelf at the top of the Library: books you're reading now, with paused books on a second tab. */
export function ReadingShelf({ books }: { books: Book[] }) {
  const reading = books.filter((b) => b.status === "reading");
  const paused = books.filter((b) => b.status === "paused");
  const [tab, setTab] = useState<Tab>(reading.length > 0 ? "reading" : "paused");

  if (reading.length === 0 && paused.length === 0) return null;
  const shown = tab === "reading" ? reading : paused;

  const tabs: [Tab, string, number][] = [
    ["reading", "Reading now", reading.length],
    ["paused", "Paused", paused.length],
  ];

  return (
    <section aria-label="Current reads" className="rounded-3xl bg-accent/70 px-5 py-6 md:px-8 md:py-8 dark:bg-accent/60">
      <div role="tablist" aria-label="Current reads" className="mb-6 flex items-baseline gap-6">
        {tabs.map(([value, label, count]) =>
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
                tab === value
                  ? "text-xl text-heading md:text-2xl"
                  : "text-base text-muted-foreground hover:text-foreground md:text-lg",
              )}
            >
              {label}
              <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
            </button>
          ),
        )}
      </div>

      <div role="tabpanel" id="shelf-panel" aria-labelledby={`shelf-tab-${tab}`}>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here right now. Open a book and set its status to <span className="font-medium">Reading</span>.
          </p>
        ) : (
          <ul className="-mx-5 flex snap-x scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
            {shown.map((book) => (
              <li key={book.id} className="w-32 shrink-0 snap-start sm:w-36">
                <BookCard book={book} sizes="144px" priority={tab === "reading"} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
