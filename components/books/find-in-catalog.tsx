"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Globe, Library, Loader2 } from "lucide-react";
import { findInCatalog, findOnline } from "@/app/actions/catalog";
import { Input } from "@/components/ui/input";
import type { Edition } from "@/lib/catalog/editions";
import type { OnlineBook } from "@/lib/catalog/import";
import type { BookFormValues } from "@/lib/schemas";
import { BookCover } from "./book-cover";
import { ScanIsbnButton } from "./isbn-scanner";

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
 * The online search (Google Books, Open Library) for a query: run with `search()`, or by itself
 * whenever `auto` is on. Like the catalog search, results belong to the query they were found for.
 */
function useOnlineSearch(text: string, auto: boolean) {
  const [found, setFound] = useState<{ q: string; results: OnlineBook[]; error: string | null } | null>(null);
  const [pending, start] = useTransition();
  // The query last sent, so an older answer arriving late doesn't replace a newer one.
  const sent = useRef("");
  const search = useCallback(() => {
    sent.current = text;
    start(async () => {
      const r = await findOnline(text);
      if (sent.current === text) setFound({ q: text, results: r.ok ? r.data : [], error: r.ok ? null : r.error });
    });
  }, [text]);
  useEffect(() => {
    if (auto && text.length >= 2 && sent.current !== text) search();
  }, [auto, text, search]);
  const current = found?.q === text ? found : null;
  return { results: current?.results ?? null, error: current?.error ?? null, pending, search };
}

/**
 * "Find it in the catalog": search the shared catalog and start the new book from an edition, so
 * title, authors, ISBN, cover and the rest come filled in. When the catalog doesn't have it, the
 * search goes online (Google Books, Open Library); a book found there fills in the form instead.
 */
export function FindInCatalog({
  onPick,
  onPickOnline,
  ownedIds,
  initialQuery = "",
}: {
  onPick: (e: Edition) => void;
  onPickOnline: (b: OnlineBook) => void;
  ownedIds: Set<string>;
  /** Opened from a search ("Search online for …"): start with it, and search online right away. */
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  // Where the form was filled in from: "the catalog", or the site an online result came from.
  const [picked, setPicked] = useState<string | null>(null);
  const { results, error, pending } = useCatalogSearch(q);
  const text = q.trim();
  const online = useOnlineSearch(text, results?.length === 0 || (text !== "" && text === initialQuery.trim()));
  const showOnline = text.length >= 2 && (results !== null || online.pending || online.results !== null);
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/70 p-4">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium">
        <Library className="size-4" aria-hidden />
        Find it in the catalog
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
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
          {(pending || online.pending) && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>
        {/* A scanned ISBN searches like a typed one: the catalog first, then online if it's not there. */}
        <ScanIsbnButton
          onScan={(isbn) => {
            setQ(isbn);
            setPicked(null);
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {picked ? (
        <p className="text-xs text-muted-foreground" role="status">
          {picked === "the catalog"
            ? "Filled in from the catalog. Set your own part below (status, shelf, rating), then save."
            : `Filled in from ${picked}. Check the details (online records can be rough), set your own part below, then save. It'll join the catalog for others too.`}
        </p>
      ) : (
        <>
          {results && results.length > 0 && (
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto" aria-label="Catalog results">
              {results.map((e) => (
                <li key={e.id}>
                  <ResultButton
                    title={e.title}
                    authors={e.authors}
                    cover={e.coverSrc}
                    lang={e.language}
                    details={[e.publisher, e.publishedYear]}
                    note={ownedIds.has(e.id) ? "Already in your library" : undefined}
                    onClick={() => {
                      onPick(e);
                      setPicked("the catalog");
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          {showOnline && (
            <OnlineResults
              catalogEmpty={results?.length === 0}
              {...online}
              onPick={(b) => {
                onPickOnline(b);
                setPicked(b.site);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function OnlineResults({
  catalogEmpty,
  results,
  error,
  pending,
  search,
  onPick,
}: {
  catalogEmpty: boolean;
  results: OnlineBook[] | null;
  error: string | null;
  pending: boolean;
  search: () => void;
  onPick: (b: OnlineBook) => void;
}) {
  const notInCatalog = catalogEmpty ? "Not in the catalog yet. " : "";
  if (error) {
    return (
      <p className="text-xs text-destructive" role="alert">
        {notInCatalog}
        {error}
      </p>
    );
  }
  if (pending) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        {notInCatalog}Searching online…
      </p>
    );
  }
  if (!results) {
    return (
      <button
        type="button"
        onClick={search}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-primary"
      >
        <Globe className="size-3.5" aria-hidden />
        Not here? Search online
      </button>
    );
  }
  if (results.length === 0) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        {catalogEmpty ? "Not in the catalog or online." : "Nothing else online."} Fill it in from a link or by hand; it&apos;ll be added to the
        catalog for others too.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground">
        <Globe className="size-3.5" aria-hidden />
        {catalogEmpty ? "Not in the catalog yet. Found online:" : "Found online"}
      </p>
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto" aria-label="Online results">
        {results.map((b) => (
          <li key={b.key}>
            <ResultButton
              title={b.title}
              authors={b.authors ?? []}
              cover={b.coverUrl}
              lang={b.language}
              details={[b.publisher, b.publishedYear]}
              note={b.site}
              quietNote
              onClick={() => onPick(b)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultButton({
  title,
  authors,
  cover,
  lang,
  details,
  note,
  quietNote,
  onClick,
}: {
  title: string;
  authors: string[];
  cover?: string;
  lang?: string;
  details: (string | number | undefined)[];
  note?: string;
  /** The note only says where the result came from; nothing to highlight. */
  quietNote?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl p-2.5 text-left hover:bg-background focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="w-12 shrink-0">
        <BookCover title={title} authors={authors} src={cover} lang={lang} sizes="48px" compact />
      </div>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span lang={lang} className="line-clamp-2 text-[15px] leading-snug font-medium">
          {title}
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{[authors.join(", "), ...details].filter(Boolean).join(" · ")}</span>
        {note && <span className={quietNote ? "text-xs text-muted-foreground" : "text-sm font-medium text-primary dark:text-highlight"}>{note}</span>}
      </span>
    </button>
  );
}
