"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Gift, Plus, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { suggestSimilar } from "@/app/actions/similar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SimilarBooks as Suggestions } from "@/lib/books/similar";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";

/**
 * "Books like this": on request, Claude picks unread books from your shelves that go well with
 * this one, and books from the shared catalog you don't have yet. Asking costs an API call, so it
 * never runs on its own.
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
            Claude is looking through your shelves and the catalog. This takes about 15 seconds.
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
        <div className="flex flex-col gap-6">
          <Group title="From your shelves" empty="Nothing unread on your shelves is much like this one.">
            {result.fromShelves.map(({ book: b, reason }) => (
              <Pick key={b.id} href={`/books/${b.id}`} title={b.title} authors={b.authors} coverSrc={b.coverSrc} lang={b.language} reason={reason} />
            ))}
          </Group>
          <Group title="From the catalog, not in your library yet" empty="Nothing in the catalog is close enough yet. It grows as books are added.">
            {result.fromCatalog.map(({ edition: e, reason }) => (
              <Pick key={e.id} title={e.title} authors={e.authors} coverSrc={e.coverSrc} lang={e.language} reason={reason}>
                {/* Side by side: adding it is the main action, the wishlist the second one. */}
                <div className="mt-2 flex gap-2">
                  <Link href={`/books/new?edition=${e.id}`} className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
                    <Plus aria-hidden />
                    Add to my library
                  </Link>
                  <Link href={`/books/new?edition=${e.id}&wishlist=1`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                    <Gift aria-hidden />
                    Add to wishlist
                  </Link>
                </div>
              </Pick>
            ))}
          </Group>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">Unread books from your shelves that go well with this one, and books from the catalog you don&apos;t have yet.</p>
          <Button variant="outline" onClick={ask}>
            <Sparkles aria-hidden />
            Find similar books
          </Button>
        </div>
      )}
    </section>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
      {children.length > 0 ? <ul className="grid gap-5 sm:grid-cols-2">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

/** One suggestion: cover, title (a link for your own books), authors, Claude's reason, and any actions. */
function Pick({
  href,
  title,
  authors,
  coverSrc,
  lang,
  reason,
  children,
}: {
  href?: string;
  title: string;
  authors: string[];
  coverSrc?: string;
  lang?: string;
  reason: string;
  children?: React.ReactNode;
}) {
  const cover = <BookCover title={title} authors={authors} src={coverSrc} lang={lang} sizes="56px" compact />;
  return (
    <li className="flex gap-3">
      {href ? (
        <Link href={href} tabIndex={-1} aria-hidden className="w-14 shrink-0">
          {cover}
        </Link>
      ) : (
        <div className="w-14 shrink-0">{cover}</div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        {href ? (
          <Link href={href} lang={lang} className="font-medium underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          <span lang={lang} className="font-medium">
            {title}
          </span>
        )}
        {authors.length > 0 && <p className="text-sm text-muted-foreground">{authors.join(", ")}</p>}
        <p className="text-sm leading-snug">{reason}</p>
        {children}
      </div>
    </li>
  );
}
