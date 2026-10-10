"use client";

import { useState } from "react";
import Link from "next/link";
import type { GenreTile } from "@/lib/bookish";
import { formatDate } from "@/lib/books/labels";
import { cn } from "@/lib/utils";
import { useInView } from "./motion";

const MAX_EMPTY = 300;

/** The donut's colours: slot 1–5 in the year's genre order, 0 for "Other". */
export const genreColor = (slot: number) => (slot ? `var(--genre-${slot})` : "var(--genre-other)");

/**
 * One numbered box per book of the goal. Each book you finish fills the next box with its genre's
 * colour, so the panel shows at a glance which genres you reach for. Pick a genre in the legend to
 * light up only its boxes; hover or focus a box to see the book, click to open it.
 */
export function GenreTiles({ tiles, legend, goal }: { tiles: GenreTile[]; legend: { genre: string; slot: number; count: number }[]; goal: number | null }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [only, setOnly] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const empty = Math.min(MAX_EMPTY, goal ? Math.max(0, goal - tiles.length) : 0);
  const shown = active !== null ? tiles[active] : null;

  if (tiles.length === 0 && empty === 0) return <p className="py-10 text-sm text-muted-foreground">Finish a book this year to fill the first box.</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* Legend: every genre with its count and share, so nothing depends on telling colours apart. */}
      {legend.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Genres">
          {legend.map((l) => (
            <li key={l.genre}>
              <button
                type="button"
                aria-pressed={only === l.genre}
                onClick={() => setOnly(only === l.genre ? null : l.genre)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full bg-muted/70 pr-3 pl-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  only === l.genre && "bg-background ring-2 ring-foreground/70",
                )}
              >
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: genreColor(l.slot) }} aria-hidden />
                {l.genre}
                <span className="tabular-nums opacity-70">{l.count}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round((l.count / tiles.length) * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={ref} className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5" onMouseLeave={() => setActive(null)}>
        {tiles.map((t, i) => {
          const dim = only !== null && t.genre !== only;
          return (
            <Link
              key={`${t.id}-${t.finishedAt}`}
              href={`/books/${t.id}`}
              aria-label={`${i + 1}. ${t.title}, ${t.genre}, finished ${formatDate(t.finishedAt)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "relative aspect-square rounded-md transition-[opacity,transform] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                inView ? "tile-in" : "opacity-0 motion-reduce:opacity-100",
                dim && "opacity-20!",
              )}
              style={{ background: genreColor(t.slot), animationDelay: `${Math.min(i, 80) * 25}ms` }}
            >
              <span className="absolute top-1 left-1 rounded-[4px] bg-card/90 px-1 text-[10px] leading-4 font-semibold text-foreground tabular-nums">{i + 1}</span>
            </Link>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <span
            key={`empty-${i}`}
            aria-hidden
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border text-[11px] text-muted-foreground tabular-nums",
              inView ? "tile-in" : "opacity-0 motion-reduce:opacity-100",
              only !== null && "opacity-40",
            )}
            style={{ animationDelay: `${Math.min(tiles.length + i, 80) * 25}ms` }}
          >
            {tiles.length + i + 1}
          </span>
        ))}
      </div>

      {/* What's under the pointer, in words (also for keyboard focus). */}
      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {shown ? (
          <>
            <span className="font-semibold text-foreground tabular-nums">#{active! + 1}</span> · <span lang="uk" className="font-medium text-foreground">{shown.title}</span>
            {shown.authors.length > 0 && <> · {shown.authors.join(", ")}</>} · {shown.genre} · {formatDate(shown.finishedAt)}
          </>
        ) : goal && tiles.length < goal ? (
          `${goal - tiles.length} boxes to fill. Each book you finish takes the next one.`
        ) : (
          "Point at a box to see the book. Pick a genre to see only its boxes."
        )}
      </p>
    </div>
  );
}
