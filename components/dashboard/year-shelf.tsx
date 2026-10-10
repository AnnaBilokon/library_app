"use client";

import Link from "next/link";
import type { ShelfBook } from "@/lib/bookish";
import { cn } from "@/lib/utils";
import { useInView } from "./motion";

const ROW = 176; // height of one shelf row: the tallest spine plus headroom
const MAX_EMPTY = 60;

/** Spine height from the page count: longer books stand taller (unknown: a middling height). */
const spineHeight = (pages?: number) => (pages ? Math.round(110 + Math.min(1, pages / 800) * 50) : 132);
const spineWidth = (pages?: number) => (pages ? Math.round(22 + Math.min(1, pages / 800) * 14) : 28);

/**
 * The books you finished this year as spines on a bookshelf, sliding in one after another, with
 * dashed outlines for the books still to read to reach your goal. Hover for the title; click to open.
 */
export function YearShelf({ books, goal, year }: { books: ShelfBook[]; goal: number | null; year: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const empty = goal ? Math.max(0, goal - books.length) : 0;
  const shownEmpty = Math.min(empty, MAX_EMPTY);

  return (
    <section aria-labelledby="shelf-title" className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border/60 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="shelf-title" className="font-heading text-2xl font-semibold text-heading">
          Your {year} shelf
        </h2>
        <p className="text-sm text-muted-foreground">
          {books.length} {books.length === 1 ? "book" : "books"}
          {goal ? ` · ${empty > 0 ? `${empty} more to fill it` : "full!"}` : ""}
        </p>
      </div>
      <div
        ref={ref}
        className="flex flex-wrap items-end gap-x-1.5 gap-y-3 px-2"
        // A plank under every row: rows are a fixed height, so a repeating gradient lines up with them.
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW - 8}px, color-mix(in oklab, var(--secondary) 70%, var(--muted-foreground)) ${ROW - 8}px, color-mix(in oklab, var(--secondary) 70%, var(--muted-foreground)) ${ROW}px, transparent ${ROW}px, transparent ${ROW + 12}px)`,
        }}
      >
        {books.length === 0 && empty === 0 && <p className="py-10 text-sm text-muted-foreground">Finish a book this year to put it on the shelf.</p>}
        {books.map((b, i) => (
          <div key={`${b.id}-${b.finishedAt}`} className="flex flex-col justify-end pb-2" style={{ height: ROW }}>
            <Link
              href={`/books/${b.id}`}
              title={`${b.title}${b.authors.length ? ` · ${b.authors.join(", ")}` : ""}`}
              aria-label={`${b.title}, finished ${b.finishedAt}`}
              className={cn(
                "group relative flex items-center justify-center overflow-hidden rounded-t-[3px] rounded-b-[2px] shadow-[inset_-3px_0_0_rgb(0_0_0/0.18),inset_2px_0_0_rgb(255_255_255/0.12)] transition-transform hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                inView ? "spine-in" : "opacity-0 motion-reduce:opacity-100",
              )}
              style={{
                height: spineHeight(b.pages),
                width: spineWidth(b.pages),
                background: `var(--jacket-${b.jacket}-bg)`,
                color: `var(--jacket-${b.jacket}-fg)`,
                animationDelay: `${Math.min(i, 40) * 45}ms`,
              }}
            >
              <span className="absolute inset-x-0 top-2 h-px opacity-60" style={{ background: `var(--jacket-${b.jacket}-line)` }} aria-hidden />
              <span className="absolute inset-x-0 bottom-2 h-px opacity-60" style={{ background: `var(--jacket-${b.jacket}-line)` }} aria-hidden />
              <span lang="uk" className="line-clamp-1 max-h-[85%] px-0.5 font-heading text-[11px] leading-none font-semibold [writing-mode:vertical-rl]">
                {b.title}
              </span>
            </Link>
          </div>
        ))}
        {Array.from({ length: shownEmpty }, (_, i) => (
          <div key={`empty-${i}`} className="flex flex-col justify-end pb-2" style={{ height: ROW }} aria-hidden>
            <span
              className={cn("block rounded-t-[3px] border-2 border-dashed border-border", inView ? "spine-in" : "opacity-0 motion-reduce:opacity-100")}
              style={{ height: 132, width: 28, animationDelay: `${Math.min(books.length + i, 50) * 45}ms` }}
            />
          </div>
        ))}
        {empty > shownEmpty && <span className="self-center pb-2 text-sm text-muted-foreground">+{empty - shownEmpty} more</span>}
      </div>
    </section>
  );
}
