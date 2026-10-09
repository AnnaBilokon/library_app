"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { debounce, useQueryStates } from "nuqs";
import { ArrowDownUp, LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { findDuplicateIds } from "@/lib/books/duplicates";
import {
  countActiveFilters,
  DEFAULT_DIR,
  EMPTY_FILTERS,
  facets as computeFacets,
  filterBooks,
  SORT_KEYS,
  SORT_LABEL,
  sortBooks,
  type BookFilters,
  type SortDir,
  type SortKey,
} from "@/lib/books/filters";
import { FORMAT_LABEL, languageLabel, STATUS_LABEL } from "@/lib/books/labels";
import { LAYOUT_COOKIE, type LibraryLayout } from "@/lib/books/layout";
import { libraryParams, libraryUrlKeys } from "@/lib/books/search-params";
import { BOOK_STATUSES, type Book, type BookFormat, type BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookFiltersPanel } from "./book-filters";
import { groupByFinishedYear } from "@/lib/books/years";
import { BookGrid } from "./book-grid";
import { BookTable } from "./book-table";
import { ReadingShelf } from "./reading-shelf";

const CLEARED = Object.fromEntries(Object.keys(EMPTY_FILTERS).map((k) => [k, null])) as Record<keyof BookFilters, null>;

interface LibraryViewProps {
  books: Book[];
  initialLayout: LibraryLayout;
  initialColumns: Record<string, boolean>;
}

export function LibraryView({ books, initialLayout, initialColumns }: LibraryViewProps) {
  // Like a reactive `route.query` in Nuxt: reading and writing these updates the URL,
  // so a filtered view survives a refresh and can be shared as a link.
  const [params, setParams] = useQueryStates(libraryParams, { urlKeys: libraryUrlKeys });
  const { sort, dir, ...filters } = params;

  // Typing stays responsive: React renders the (possibly long) result list a moment later.
  const deferredFilters = useDeferredValue(filters);
  const results = useMemo(
    () => sortBooks(filterBooks(books, deferredFilters), sort, dir),
    [books, deferredFilters, sort, dir],
  );
  const facets = useMemo(() => computeFacets(books), [books]);
  const duplicateIds = useMemo(() => findDuplicateIds(books), [books]);

  const panelFilters = countActiveFilters({ ...filters, status: [] });
  const browsing = filters.q === "" && countActiveFilters(filters) === 0;

  const update = (patch: Partial<BookFilters>) => void setParams(patch);
  const setSort = (key: SortKey, nextDir?: SortDir) =>
    void setParams({ sort: key, dir: nextDir ?? (key === sort ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key]) });
  const clearFilters = () => void setParams({ ...CLEARED });

  const [layout, setLayout] = useLayout(initialLayout);

  if (books.length === 0) {
    return <EmptyState title="Your library is empty" text="Books you add will appear here. Adding books arrives in the next phase." />;
  }

  return (
    <div className="flex flex-col gap-10">
      <Stats books={books} />

      {browsing && <ReadingShelf books={books} />}

      <section aria-label="All books" className="flex flex-col gap-6">
        {/* Search + quiet controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-full md:max-w-xl md:basis-auto">
            <span className="sr-only">Search books</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => void setParams({ q: e.target.value }, { limitUrlUpdates: debounce(300) })}
              placeholder="Search by title, author, series or notes"
              className="h-11 w-full rounded-full bg-card pr-4 pl-11 text-[15px] shadow-sm ring-1 ring-border transition-shadow outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted/60"
            />
          </label>

          <div className="flex items-center gap-1 md:ml-auto">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" className="h-10 rounded-full px-4" />}>
                <SlidersHorizontal aria-hidden />
                Filters
                {panelFilters > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                    {panelFilters}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent side="right" className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
                <SheetHeader className="border-b">
                  <SheetTitle className="font-heading text-xl">Filters</SheetTitle>
                  <SheetDescription>
                    {results.length} of {books.length} books match
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <BookFiltersPanel filters={filters} facets={facets} onChange={update} />
                </div>
                <SheetFooter className="border-t">
                  <Button variant="outline" onClick={clearFilters} disabled={panelFilters === 0}>
                    Clear all filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <SortMenu sort={sort} dir={dir} onChange={setSort} />

            <div className="ml-1 flex rounded-full bg-muted p-1" role="group" aria-label="Layout">
              {(
                [
                  ["grid", LayoutGrid, "Covers"],
                  ["table", Rows3, "Table"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={layout === value}
                  aria-label={label}
                  onClick={() => setLayout(value)}
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    layout === value && "bg-background text-foreground shadow-sm",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>

        <StatusTabs
          counts={facets.status}
          total={books.length}
          selected={filters.status}
          onSelect={(status) =>
            // Finished books are easiest to browse newest first, by year.
            status === "finished"
              ? void setParams({ status: ["finished"], sort: "finished", dir: "desc" })
              : update({ status: status ? [status] : [] })
          }
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length === books.length ? `${books.length} books` : `${results.length} of ${books.length} books`}
            {" · "}sorted by {SORT_LABEL[sort].toLowerCase()}
          </p>
          <ActiveFilters filters={filters} onChange={update} onClear={clearFilters} />
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No books match"
            text="Try a different search or remove some filters."
            action={
              <Button variant="outline" className="rounded-full" onClick={() => void setParams({ ...CLEARED, q: null })}>
                Clear search and filters
              </Button>
            }
          />
        ) : layout === "grid" ? (
          sort === "finished" ? (
            <YearSections books={results} dir={dir} duplicateIds={duplicateIds} />
          ) : (
            <BookGrid books={results} duplicateIds={duplicateIds} />
          )
        ) : (
          <BookTable books={results} sort={sort} dir={dir} onSort={setSort} initialColumns={initialColumns} />
        )}
      </section>
    </div>
  );
}

/** The masthead numbers under the page title. */
function Stats({ books }: { books: Book[] }) {
  const read = books.filter((b) => b.timesRead > 0 || b.status === "finished").length;
  const items = [
    [books.length, "books"],
    [read, "read"],
    [books.filter((b) => b.status === "to-read").length, "waiting"],
    [books.filter((b) => b.favorite).length, "favourites"],
  ] as const;
  return (
    <dl className="grid grid-cols-4 gap-3 sm:flex sm:gap-x-10">
      {items.map(([value, label]) => (
        <div key={label} className="flex flex-col">
          <dd className="order-1 font-heading text-2xl font-semibold text-heading tabular-nums sm:text-3xl md:text-4xl dark:text-highlight">
            {value}
          </dd>
          <dt className="order-2 truncate text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:text-xs sm:tracking-[0.14em]">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function StatusTabs({
  counts,
  total,
  selected,
  onSelect,
}: {
  counts: { value: string; count: number }[];
  total: number;
  selected: BookStatus[];
  onSelect: (status: BookStatus | null) => void;
}) {
  const tabs: [BookStatus | null, string, number][] = [
    [null, "All", total],
    ...BOOK_STATUSES.map((s): [BookStatus, string, number] => [s, STATUS_LABEL[s], counts.find((c) => c.value === s)?.count ?? 0]).filter(
      ([, , n]) => n > 0,
    ),
  ];
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div role="tablist" aria-label="Filter by status" className="flex min-w-max gap-6 border-b border-border/70">
        {tabs.map(([status, label, count]) => {
          const active = status === null ? selected.length === 0 : selected.length === 1 && selected[0] === status;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(status)}
              className={cn(
                "-mb-px flex items-baseline gap-1.5 border-b-2 border-transparent pb-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
                active && "border-primary text-heading dark:border-highlight",
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SortMenu({ sort, dir, onChange }: { sort: SortKey; dir: SortDir; onChange: (key: SortKey, dir?: SortDir) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 rounded-full px-4" />}>
        <ArrowDownUp aria-hidden />
        <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
        <span className="sr-only sm:hidden">Sort: {SORT_LABEL[sort]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onChange(v as SortKey, DEFAULT_DIR[v as SortKey])}>
            {SORT_KEYS.map((k) => (
              <DropdownMenuRadioItem key={k} value={k} closeOnClick>
                {SORT_LABEL[k]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={dir} onValueChange={(v) => onChange(sort, v as SortDir)}>
            <DropdownMenuRadioItem value="asc" closeOnClick>
              {sort === "title" || sort === "author" ? "A → Z" : "Lowest / oldest first"}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc" closeOnClick>
              {sort === "title" || sort === "author" ? "Z → A" : "Highest / newest first"}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Grid/table choice, remembered in a cookie so the server renders the right one on the next visit. */
function useLayout(initial: LibraryLayout) {
  const [layout, setLayout] = useState(initial);
  const set = (value: LibraryLayout) => {
    document.cookie = `${LAYOUT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    setLayout(value);
  };
  return [layout, set] as const;
}

function ActiveFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: BookFilters;
  onChange: (patch: Partial<BookFilters>) => void;
  onClear: () => void;
}) {
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const many = <K extends "genre" | "tag" | "language" | "format" | "publisher">(key: K, label: (v: string) => string) => {
    const values = filters[key] as string[];
    for (const v of values) {
      chips.push({ key: `${key}:${v}`, label: label(v), remove: () => onChange({ [key]: values.filter((x) => x !== v) }) });
    }
  };
  if (filters.status.length > 1) {
    for (const s of filters.status)
      chips.push({ key: `status:${s}`, label: STATUS_LABEL[s], remove: () => onChange({ status: filters.status.filter((x) => x !== s) }) });
  }
  many("genre", (v) => v);
  many("tag", (v) => `#${v}`);
  many("language", languageLabel);
  many("format", (v) => FORMAT_LABEL[v as BookFormat] ?? v);
  many("publisher", (v) => v);
  if (filters.author) chips.push({ key: "author", label: filters.author, remove: () => onChange({ author: null }) });
  if (filters.series) chips.push({ key: "series", label: `Series: ${filters.series}`, remove: () => onChange({ series: null }) });
  if (filters.owned !== null)
    chips.push({ key: "owned", label: filters.owned ? "Owned" : "Not owned", remove: () => onChange({ owned: null }) });
  if (filters.favorite) chips.push({ key: "fav", label: "Favourites", remove: () => onChange({ favorite: null }) });
  if (filters.reread) chips.push({ key: "rr", label: "Read more than once", remove: () => onChange({ reread: null }) });
  if (filters.finishedYear !== null)
    chips.push({ key: "year", label: `Finished in ${filters.finishedYear}`, remove: () => onChange({ finishedYear: null }) });
  if (filters.ratingMin !== null || filters.ratingMax !== null)
    chips.push({
      key: "rating",
      label: `Rating ${filters.ratingMin ?? 0}–${filters.ratingMax ?? 5}★`,
      remove: () => onChange({ ratingMin: null, ratingMax: null }),
    });
  if (filters.pagesMin !== null || filters.pagesMax !== null)
    chips.push({
      key: "pages",
      label: `${filters.pagesMin ?? 0}–${filters.pagesMax ?? "∞"} pages`,
      remove: () => onChange({ pagesMin: null, pagesMax: null }),
    });

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-highlight pr-1 pl-3 text-xs font-medium text-highlight-foreground">
          {c.label}
          <button
            type="button"
            onClick={c.remove}
            aria-label={`Remove filter ${c.label}`}
            className="grid size-5 place-items-center rounded-full hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="px-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Clear all
      </button>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/60 px-6 py-20 text-center">
      <h2 className="font-heading text-xl font-semibold text-heading">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/** Books sorted by finish date, split into one section per year ("date unknown" last). */
function YearSections({ books, dir, duplicateIds }: { books: Book[]; dir: SortDir; duplicateIds: Set<string> }) {
  const sections = groupByFinishedYear(books);
  const known = sections.filter((s) => s.year !== null);
  const unknown = sections.filter((s) => s.year === null);
  const ordered = [...(dir === "asc" ? known.reverse() : known), ...unknown];
  return (
    <div className="flex flex-col gap-12">
      {ordered.map((section) => (
        <section key={section.year ?? "unknown"} aria-labelledby={`year-${section.year ?? "unknown"}`} className="flex flex-col gap-6">
          <h2
            id={`year-${section.year ?? "unknown"}`}
            className="sticky top-16 z-20 -mx-4 flex items-baseline gap-3 bg-background/90 px-4 py-2 font-heading text-3xl font-semibold text-heading backdrop-blur md:mx-0 md:px-0"
          >
            {section.year ?? "Date unknown"}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {section.books.length} {section.books.length === 1 ? "book" : "books"}
            </span>
          </h2>
          <BookGrid books={section.books} duplicateIds={duplicateIds} priorityCount={0} />
        </section>
      ))}
    </div>
  );
}
