"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { debounce, useQueryStates } from "nuqs";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  type SortKey,
} from "@/lib/books/filters";
import { FORMAT_LABEL, languageLabel, STATUS_LABEL } from "@/lib/books/labels";
import { libraryParams, libraryUrlKeys } from "@/lib/books/search-params";
import { BOOK_STATUSES, type Book, type BookFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookFiltersPanel } from "./book-filters";
import { BookGrid } from "./book-grid";
import { BookTable } from "./book-table";
import { STATUS_ICON } from "./status-badge";

import { LAYOUT_COOKIE, type LibraryLayout } from "@/lib/books/layout";

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
  const activeCount = countActiveFilters(filters);

  const update = (patch: Partial<BookFilters>) => void setParams(patch);
  const setSort = (key: SortKey) => void setParams({ sort: key, dir: key === sort ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key] });
  const clearFilters = () => void setParams({ ...CLEARED });

  const [layout, setLayout] = useLayout(initialLayout);

  if (books.length === 0) {
    return (
      <EmptyState title="Your library is empty" text="Books you add will appear here. Adding books arrives in the next phase." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search, filters, sort, layout */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.q}
            onChange={(e) => void setParams({ q: e.target.value }, { limitUrlUpdates: debounce(300) })}
            placeholder="Search title, author, series, notes…"
            aria-label="Search books"
            className="h-9 pl-8"
          />
        </div>

        <Sheet>
          <SheetTrigger render={<Button variant="outline" className="h-9" />}>
            <SlidersHorizontal aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
            <SheetHeader className="border-b">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                {results.length} of {books.length} books match
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <BookFiltersPanel filters={filters} facets={facets} onChange={update} />
            </div>
            <SheetFooter className="border-t">
              <Button variant="outline" onClick={clearFilters} disabled={activeCount === 0}>
                Clear all filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1">
          <Select
            value={sort}
            onValueChange={(v) => v && setSort(v)}
            items={SORT_KEYS.map((k) => ({ value: k, label: SORT_LABEL[k] }))}
          >
            <SelectTrigger className="h-9! w-40" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => void setParams({ dir: dir === "asc" ? "desc" : "asc" })}
            aria-label={dir === "asc" ? "Sorted ascending; switch to descending" : "Sorted descending; switch to ascending"}
          >
            {dir === "asc" ? <ArrowUpNarrowWide aria-hidden /> : <ArrowDownWideNarrow aria-hidden />}
          </Button>
        </div>

        <ToggleGroup
          variant="outline"
          value={[layout]}
          onValueChange={(v) => v[0] && setLayout(v[0] as LibraryLayout)}
          aria-label="Layout"
          className="ml-auto"
        >
          <ToggleGroupItem value="grid" aria-label="Grid of covers" className="size-9">
            <LayoutGrid aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table" className="size-9">
            <Rows3 aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Quick status filter */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by status">
        {BOOK_STATUSES.map((s) => {
          const count = facets.status.find((f) => f.value === s)?.count ?? 0;
          if (count === 0) return null;
          const on = filters.status.includes(s);
          const Icon = STATUS_ICON[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => update({ status: on ? filters.status.filter((x) => x !== s) : [...filters.status, s] })}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {STATUS_LABEL[s]}
              <span className={cn("text-xs tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>{count}</span>
            </button>
          );
        })}
      </div>

      <ActiveFilters filters={filters} onChange={update} onClear={clearFilters} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {results.length === books.length ? `${books.length} books` : `${results.length} of ${books.length} books`}
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="No books match"
          text="Try a different search or remove some filters."
          action={
            <Button variant="outline" onClick={() => void setParams({ ...CLEARED, q: null })}>
              Clear search and filters
            </Button>
          }
        />
      ) : layout === "grid" ? (
        <BookGrid books={results} duplicateIds={duplicateIds} />
      ) : (
        <BookTable books={results} sort={sort} dir={dir} onSort={setSort} initialColumns={initialColumns} />
      )}
    </div>
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
  many("genre", (v) => v);
  many("tag", (v) => `#${v}`);
  many("language", languageLabel);
  many("format", (v) => FORMAT_LABEL[v as BookFormat] ?? v);
  many("publisher", (v) => v);
  if (filters.author) chips.push({ key: "author", label: `Author: ${filters.author}`, remove: () => onChange({ author: null }) });
  if (filters.series) chips.push({ key: "series", label: `Series: ${filters.series}`, remove: () => onChange({ series: null }) });
  if (filters.owned !== null)
    chips.push({ key: "owned", label: filters.owned ? "Owned" : "Not owned", remove: () => onChange({ owned: null }) });
  if (filters.favorite) chips.push({ key: "fav", label: "Favourites", remove: () => onChange({ favorite: null }) });
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
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-highlight pr-1 pl-2.5 text-xs font-medium text-highlight-foreground">
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
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
