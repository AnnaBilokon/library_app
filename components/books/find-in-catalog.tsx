"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Library, Loader2 } from "lucide-react";
import { findInCatalog } from "@/app/actions/catalog";
import { Input } from "@/components/ui/input";
import type { Edition } from "@/lib/catalog/editions";
import type { BookFormValues } from "@/lib/schemas";
import { BookCover } from "./book-cover";

/** The form fields a catalog edition fills in for a new book (everything personal stays yours). */
export function editionFormFields(e: Edition): Partial<BookFormValues> {
  return {
    title: e.title,
    authors: e.authors,
    genres: e.genres,
    language: e.language ?? "",
    publisher: e.publisher ?? "",
    publishedYear: e.publishedYear,
    pages: e.pages,
    isbn: e.isbn ?? "",
    series: e.series ?? "",
    seriesIndex: e.seriesIndex,
    description: e.description ?? "",
    editionId: e.id,
  };
}

/**
 * Run a catalog search a moment after typing stops. Results belong to the query they were found
 * for, so a stale answer never shows under a newer (or too short) query.
 */
export function useCatalogSearch(q: string) {
  const [found, setFound] = useState<{ q: string; results: Edition[]; error: string | null } | null>(null);
  const [pending, start] = useTransition();
  const text = q.trim();
  useEffect(() => {
    if (text.length < 2) return;
    const timer = setTimeout(
      () =>
        start(async () => {
          const r = await findInCatalog(text);
          setFound({ q: text, results: r.ok ? r.data : [], error: r.ok ? null : r.error });
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [text]);
  const current = found?.q === text ? found : null;
  return { results: current?.results ?? null, error: current?.error ?? null, pending };
}

/**
 * "Find it in the catalog": search the shared catalog and start the new book from an edition, so
 * title, authors, ISBN, cover and the rest come filled in.
 */
export function FindInCatalog({ onPick, ownedIds }: { onPick: (e: Edition) => void; ownedIds: Set<string> }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const { results, error, pending } = useCatalogSearch(q);
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/70 p-4">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium">
        <Library className="size-4" aria-hidden />
        Find it in the catalog
      </label>
      <div className="relative">
        <Input
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
          }}
          placeholder="Title, author or ISBN"
          className="h-10 bg-background pr-9"
          autoComplete="off"
        />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {picked ? (
        <p className="text-xs text-muted-foreground" role="status">
          Filled in from the catalog. Set your own part below (status, shelf, rating), then save.
        </p>
      ) : results && results.length === 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          Not in the catalog yet. Fill it in from a link or by hand; it&apos;ll be added for others too.
        </p>
      ) : results ? (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-label="Catalog results">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(e);
                  setPicked(e.id);
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="w-9 shrink-0">
                  <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="36px" compact />
                </div>
                <span className="flex min-w-0 flex-col">
                  <span lang={e.language} className="truncate text-sm font-medium">
                    {e.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[e.authors.join(", "), e.publisher, e.publishedYear].filter(Boolean).join(" · ")}
                  </span>
                  {ownedIds.has(e.id) && <span className="text-xs font-medium text-primary dark:text-highlight">Already in your library</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
