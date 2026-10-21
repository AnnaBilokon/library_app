"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { setFavorite } from "@/app/actions/books";
import { favouritesSummary, GROUPINGS, groupFavourites, type Grouping } from "@/lib/books/favourites";
import { formatDate } from "@/lib/books/labels";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { RatingStars } from "./rating-stars";

const GROUPING_LABEL: Record<Grouping, string> = { year: "Year read", genre: "Genre", author: "Author", none: "All" };

/** The books you love: a summary, then the covers grouped your way (the choice stays in the URL). */
export function FavouritesView({ books }: { books: Book[] }) {
  const [by, setBy] = useQueryState("by", parseAsStringLiteral(GROUPINGS).withDefault("year"));
  // Books un-hearted here disappear at once; Undo brings them back.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const shown = books.filter((b) => !removed.has(b.id));
  const summary = favouritesSummary(shown);
  const groups = groupFavourites(shown, by);

  if (books.length === 0) {
    return (
      <p className="rounded-3xl bg-card p-8 text-center text-muted-foreground ring-1 ring-border/60">
        No favourites yet. Tap ♥ on a book&apos;s page to keep it here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={summary.count === 1 ? "favourite" : "favourites"} value={String(summary.count)} />
        <Stat label="average rating" value={summary.averageRating !== null ? `★ ${summary.averageRating}` : "—"} />
        <Stat label="most-loved author" value={summary.topAuthors[0]?.name ?? "—"} note={summary.topAuthors[0] && `${summary.topAuthors[0].books} books`} />
        <Stat label="most-loved genre" value={summary.topGenres[0]?.name ?? "—"} note={summary.topGenres[0] && `${summary.topGenres[0].books} books`} />
      </dl>

      <div role="radiogroup" aria-label="Group by" className="flex w-fit flex-wrap rounded-full bg-muted p-1 text-sm">
        {GROUPINGS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={by === g}
            onClick={() => void setBy(g)}
            className={cn("h-8 rounded-full px-3.5", by === g && "bg-background font-medium shadow-sm")}
          >
            {GROUPING_LABEL[g]}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-5">
          {by !== "none" && (
            <h2 className="flex items-baseline gap-2 font-heading text-2xl font-semibold text-heading">
              {group.label}
              <span className="font-sans text-sm font-normal text-muted-foreground">{group.books.length}</span>
            </h2>
          )}
          <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {group.books.map((b) => (
              <FavouriteCard
                key={`${group.key}-${b.id}`}
                book={b}
                onRemoved={() => setRemoved((s) => new Set(s).add(b.id))}
                onRestored={() =>
                  setRemoved((s) => {
                    const next = new Set(s);
                    next.delete(b.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <dd className="truncate font-heading text-xl font-semibold text-heading md:text-2xl">{value}</dd>
      <dt className="text-xs text-muted-foreground">
        {label}
        {note && <span> · {note}</span>}
      </dt>
    </div>
  );
}

function FavouriteCard({ book: b, onRemoved, onRestored }: { book: Book; onRemoved: () => void; onRestored: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unheart = () =>
    start(async () => {
      onRemoved();
      const r = await setFavorite(b.id, false);
      if (!r.ok) {
        onRestored();
        return void toast.error(r.error);
      }
      toast.success(`Removed “${b.title}” from favourites`, {
        action: {
          label: "Undo",
          onClick: async () => {
            onRestored();
            const back = await setFavorite(b.id, true);
            if (!back.ok) toast.error(back.error);
            router.refresh();
          },
        },
      });
    });

  return (
    <li className="flex flex-col gap-2">
      <div className="relative">
        <Link href={`/books/${b.id}`} tabIndex={-1} aria-hidden>
          <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="(min-width: 1280px) 190px, (min-width: 768px) 22vw, 45vw" />
        </Link>
        <button
          type="button"
          onClick={unheart}
          disabled={pending}
          aria-label={`Remove “${b.title}” from favourites`}
          title="Remove from favourites"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/90 text-primary shadow-sm hover:bg-background disabled:opacity-60 dark:text-highlight"
        >
          <Heart className="size-4 fill-current" aria-hidden />
        </button>
      </div>
      <Link href={`/books/${b.id}`} lang={b.language} className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold text-heading hover:underline">
        {b.title}
      </Link>
      {b.authors.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{b.authors.join(", ")}</span>}
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {b.rating !== undefined && <RatingStars value={b.rating} size="sm" />}
        {b.lastFinishedAt && <span className="tabular-nums">{formatDate(b.lastFinishedAt)}</span>}
      </span>
    </li>
  );
}
