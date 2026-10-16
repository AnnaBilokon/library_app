"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { suggestSimilar } from "@/app/actions/similar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SimilarPick } from "@/lib/books/similar";
import type { Book } from "@/lib/types";
import { BookCover } from "./book-cover";

/**
 * "Books like this": on request, Claude picks unread books from your shelves that go well with
 * this one. Asking costs an API call, so it never runs on its own.
 */
export function SimilarBooks({ book }: { book: Book }) {
  const [picks, setPicks] = useState<SimilarPick[] | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      const r = await suggestSimilar(book.id);
      if (r.ok) setPicks(r.data);
      else toast.error(r.error);
    });

  return (
    <section aria-labelledby="similar-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="similar-title" className="font-heading text-2xl font-semibold text-heading">
          Books like this
        </h2>
        {picks && !pending && (
          <Button variant="ghost" size="sm" onClick={ask}>
            <RotateCw aria-hidden />
            Ask again
          </Button>
        )}
      </div>

      {pending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <p role="status" className="text-sm text-muted-foreground">
            Claude is looking through your shelves. This takes about 10 seconds.
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
      ) : picks ? (
        picks.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2">
            {picks.map(({ book: b, reason }) => (
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
          <p className="text-muted-foreground">Nothing unread on your shelves is much like this one.</p>
        )
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">Unread books from your shelves that go well with this one.</p>
          <Button variant="outline" onClick={ask}>
            <Sparkles aria-hidden />
            Find similar books
          </Button>
        </div>
      )}
    </section>
  );
}
