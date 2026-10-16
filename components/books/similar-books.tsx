"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Gift, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createBook } from "@/app/actions/books";
import { suggestSimilar } from "@/app/actions/similar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NewSuggestion, SimilarBooks as Suggestions } from "@/lib/books/similar";
import type { Book } from "@/lib/types";
import { BookCover } from "./book-cover";

/**
 * "Books like this": on request, Claude picks unread books from your shelves and new ones you
 * can add to the wishlist. Asking costs an API call, so it never runs on its own.
 */
export function SimilarBooks({ book }: { book: Book }) {
  const [result, setResult] = useState<Suggestions | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      const r = await suggestSimilar(book.id);
      if (r.ok) setResult(r.data);
      else toast.error(r.error);
    });

  return (
    <section aria-labelledby="similar-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="similar-title" className="font-heading text-2xl font-semibold text-heading">
          Books like this
        </h2>
        {result && !pending && (
          <Button variant="ghost" size="sm" onClick={ask}>
            <RotateCw aria-hidden />
            Ask again
          </Button>
        )}
      </div>

      {pending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <p role="status" className="text-sm text-muted-foreground">
            Claude is looking through your shelves. This takes about half a minute.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="aspect-[2/3] w-14 shrink-0" />
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : result ? (
        <Results book={book} result={result} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">Unread books from your shelves that go well with this one, and new ones for your wishlist.</p>
          <Button variant="outline" onClick={ask}>
            <Sparkles aria-hidden />
            Find similar books
          </Button>
        </div>
      )}
    </section>
  );
}

function Results({ book, result }: { book: Book; result: Suggestions }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">From your shelves</h3>
        {result.fromShelves.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2">
            {result.fromShelves.map(({ book: b, reason }) => (
              <li key={b.id} className="flex gap-3">
                <Link href={`/books/${b.id}`} tabIndex={-1} aria-hidden className="w-14 shrink-0">
                  <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="56px" compact />
                </Link>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/books/${b.id}`} lang={b.language} className="font-medium underline-offset-4 hover:underline">
                    {b.title}
                  </Link>
                  {b.authors.length > 0 && <p className="text-sm text-muted-foreground">{b.authors.join(", ")}</p>}
                  <p className="text-sm leading-snug">{reason}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing unread on your shelves is much like this one.</p>
        )}
      </div>

      {result.newBooks.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">New to you</h3>
          <ul className="grid gap-5 sm:grid-cols-2">
            {result.newBooks.map((s) => (
              <NewBook key={`${s.title}|${s.authors.join()}`} suggestion={s} likeTitle={book.title} lang={book.language} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Suggested by Claude. It can get a title or an author wrong, so check before you buy.</p>
    </div>
  );
}

function NewBook({ suggestion: s, likeTitle, lang }: { suggestion: NewSuggestion; likeTitle: string; lang?: string }) {
  const [addedId, setAddedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const r = await createBook({
        title: s.title,
        authors: s.authors,
        status: "to-read",
        favorite: false,
        genres: s.genres,
        tags: [],
        owned: false,
        wanted: true,
        publishedYear: s.year,
        wishlistReason: `Like “${likeTitle}”: ${s.reason}`,
      });
      if (!r.ok) return void toast.error(r.error);
      setAddedId(r.data.id);
      toast.success(`Added “${s.title}” to your wishlist`);
    });

  return (
    <li className="flex gap-3">
      <div className="w-14 shrink-0">
        <BookCover title={s.title} authors={s.authors} sizes="56px" lang={lang} compact />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <p className="font-medium">{s.title}</p>
        <p className="text-sm text-muted-foreground">{[s.authors.join(", "), s.year].filter(Boolean).join(" · ")}</p>
        <p className="text-sm leading-snug">{s.reason}</p>
        {addedId ? (
          <Link href={`/books/${addedId}`} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline dark:text-highlight">
            <Check className="size-4" aria-hidden />
            On your wishlist
          </Link>
        ) : (
          <Button variant="outline" size="sm" className="mt-1.5" onClick={add} disabled={pending}>
            <Gift aria-hidden />
            {pending ? "Adding…" : "Add to wishlist"}
          </Button>
        )}
      </div>
    </li>
  );
}
