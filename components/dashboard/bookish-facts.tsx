"use client";

import Link from "next/link";
import { ASSUMED_PAGES, type BookishFacts as Facts } from "@/lib/bookish";
import { useCountUp, useInView } from "./motion";

const fmt = (n: number) => n.toLocaleString("en");

/** Fun numbers about this year's books, counting up when they come into view. */
export function BookishFacts({ facts: f, year }: { facts: Facts; year: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const pages = useCountUp(f.pages, inView);
  const words = useCountUp(f.words, inView);
  const hours = useCountUp(f.hours, inView);
  const stack = useCountUp(Math.round(f.stackCm), inView);

  return (
    <section aria-labelledby="facts-title" className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 id="facts-title" className="font-heading text-lg font-semibold text-heading">
          {year} in bookish numbers
        </h3>
        <p className="text-sm text-muted-foreground">
          {f.assumed > 0 ? `${f.assumed} of your ${f.books} books have no page count, so I counted ${ASSUMED_PAGES} pages for each of those.` : "From the page counts of the books you finished."}
        </p>
      </div>
      {f.books === 0 ? (
        <p className="text-sm text-muted-foreground">Finish a book this year to see your numbers.</p>
      ) : (
        <div ref={ref} className="grid grid-cols-2 gap-3">
          <Fact big={`${fmt(stack)} cm`} label={`your stack of books, about ${f.stackLike.count} ${f.stackLike.thing} tall`} />
          <Fact big={fmt(pages)} label="pages turned" />
          <Fact big={`${f.warAndPeace}×`} label="War and Peace, in pages" />
          <Fact big={`≈ ${fmt(words)}`} label="words read" />
          <Fact big={`≈ ${fmt(hours)} h`} label="of reading, at 40 pages an hour" />
          {f.longest && (
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Longest book</span>
              <Link href={`/books/${f.longest.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                {f.longest.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {f.longest.pages} pages{f.shortest ? ` · shortest: ${f.shortest.title} (${f.shortest.pages})` : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Fact({ big, label }: { big: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
      <span className="text-2xl font-semibold tabular-nums">{big}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
