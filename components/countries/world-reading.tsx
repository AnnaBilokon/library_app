"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown, Globe } from "lucide-react";
import { libraryUrl } from "@/lib/books/library-url";
import { worldReading, type AuthorCountries } from "@/lib/countries";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CountriesGoal } from "./countries-goal";
import { Flag } from "./flag";

// The map outlines (~100 KB) load only when this section is on screen.
const WorldMap = dynamic(() => import("./world-map").then((m) => m.WorldMap), {
  ssr: false,
  loading: () => <div className="aspect-[960/470] w-full animate-pulse rounded-xl bg-muted" />,
});

const TOP = 10;

/**
 * Where the books you finished come from, by the authors' countries: flags with counts, a world
 * map shaded by number of books, and a ranked list you can open to see the books.
 */
export function WorldReadingSection({ books, map, year, countriesGoal = null }: { books: Book[]; map: AuthorCountries; year: number; countriesGoal?: number | null }) {
  const everCountries = useMemo(() => worldReading(books, map, null).countries.length, [books, map]);
  const [allYears, setAllYears] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const w = useMemo(() => worldReading(books, map, allYears ? null : year), [books, map, year, allYears]);
  const scope = allYears ? "ever" : `in ${year}`;
  const max = Math.max(1, ...w.countries.map((c) => c.books.length));
  // The full list when asked for, or when the country picked (flag or map) isn't in the top ones.
  const listAll = showAll || (open !== null && w.countries.findIndex((c) => c.code === open) >= TOP);

  return (
    <section aria-labelledby="world-title" className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-border/60 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="world-title" className="flex items-center gap-2 font-heading text-2xl font-semibold text-heading">
            <Globe className="size-5 text-muted-foreground" aria-hidden />
            Read around the world
          </h2>
          <p className="text-sm text-muted-foreground">
            {w.countries.length > 0
              ? `Authors from ${w.countries.length} ${w.countries.length === 1 ? "country" : "countries"} ${scope}`
              : `No countries ${scope} yet`}
            {w.total > 0 && ` · ${w.total} ${w.total === 1 ? "book" : "books"} finished`}
            {!allYears && w.countries.some((c) => c.isNew) && ` · ${w.countries.filter((c) => c.isNew).length} new`}
          </p>
        </div>
        <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Period">
          {[false, true].map((all) => (
            <button
              key={String(all)}
              type="button"
              aria-pressed={allYears === all}
              onClick={() => setAllYears(all)}
              className={cn(
                "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                allYears === all && "bg-background text-foreground shadow-sm",
              )}
            >
              {all ? "All years" : year}
            </button>
          ))}
        </div>
      </div>

      <CountriesGoal key={String(countriesGoal)} goal={countriesGoal} reached={everCountries} />

      {w.countries.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Countries">
          {w.countries.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => setOpen(open === c.code ? null : c.code)}
                aria-pressed={open === c.code}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full bg-muted/70 pr-3 pl-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  open === c.code && "bg-highlight text-highlight-foreground hover:bg-highlight",
                )}
              >
                <Flag code={c.code} decorative className="h-3.5 w-[21px]" />
                {c.name}
                <span className="tabular-nums opacity-70">{c.books.length}</span>
                {c.isNew && <span className="rounded-full bg-chart-actual px-1.5 text-[10px] leading-4 font-semibold tracking-wide text-white uppercase">new</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <WorldMap countries={w.countries} selected={open} onSelect={(code) => setOpen(open === code ? null : code)} />

        <div className="flex flex-col gap-3">
          {/* Two tabs: the top ten, or every country you read (also opens when you pick one outside the top). */}
          <div className="flex w-fit rounded-full bg-muted p-1" role="tablist" aria-label="Countries list">
            {[false, true].map((all) => (
              <button
                key={String(all)}
                type="button"
                role="tab"
                aria-selected={listAll === all}
                onClick={() => {
                  setShowAll(all);
                  if (!all) setOpen(null);
                }}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  listAll === all && "bg-background text-foreground shadow-sm",
                )}
              >
                {all ? `All countries (${w.countries.length})` : "Top countries"}
              </button>
            ))}
          </div>
          {w.countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add where your authors are from on a book&apos;s page (next to the author&apos;s name) or in{" "}
              <Link href="/settings#author-countries" className="underline underline-offset-4">
                Settings
              </Link>
              .
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {(listAll ? w.countries : w.countries.slice(0, TOP)).map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === c.code ? null : c.code)}
                    aria-expanded={open === c.code}
                    className="flex w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Flag code={c.code} decorative />
                      <span className="flex-1 truncate font-medium">{c.name}</span>
                      {c.rating !== null && <span className="text-xs text-muted-foreground tabular-nums">★ {c.rating}</span>}
                      <span className="font-semibold tabular-nums">{c.books.length}</span>
                      <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open === c.code && "rotate-180")} aria-hidden />
                    </span>
                    <span className="h-1.5 rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-chart-actual" style={{ width: `${(c.books.length / max) * 100}%` }} />
                    </span>
                  </button>
                  {open === c.code && (
                    <ul className="mt-1 mb-2 flex flex-col gap-0.5 pl-9 text-sm">
                      {c.books.map((b) => (
                        <li key={b.id} className="truncate">
                          <Link href={`/books/${b.id}`} lang={b.language} className="hover:underline">
                            {b.title}
                          </Link>
                          {b.authors.length > 0 && <span className="text-muted-foreground"> · {b.authors.join(", ")}</span>}
                        </li>
                      ))}
                      <li className="mt-1 flex flex-wrap gap-x-3 text-xs">
                        {c.unread > 0 && <span className="text-muted-foreground">{c.unread} unread on your shelves</span>}
                        <Link href={libraryUrl({ country: [c.code] })} className="font-medium underline underline-offset-4">
                          Open in the Library
                        </Link>
                      </li>
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {w.unknown.length > 0 && (
            <p className="mt-auto text-xs text-muted-foreground">
              {w.unknown.length} {w.unknown.length === 1 ? "book is" : "books are"} by authors without a country yet.{" "}
              <Link href="/settings#author-countries" className="underline underline-offset-4 hover:text-foreground">
                Add countries
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
