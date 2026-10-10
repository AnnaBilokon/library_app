"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { Check, Heart, Plus, Search } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { AuthorFlags } from "@/components/countries/author-countries-context";
import { Input } from "@/components/ui/input";
import type { AuthorCollection } from "@/lib/author-collections";
import { libraryUrl, newBookUrl } from "@/lib/books/library-url";
import { normalize } from "@/lib/books/filters";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

type Show = "all" | "wishlist";

/**
 * Authors you collect: the books you have in full colour, the ones on your wishlist greyed out,
 * with counts and a quick way to add another of their books to the wishlist.
 */
export function AuthorCollectionsView({ collections }: { collections: AuthorCollection[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const query = normalize(useDeferredValue(q));
  const shown = collections.filter((c) => (show === "all" || c.wanted.length > 0) && (!query || normalize(c.author).includes(query)));

  if (collections.length === 0) {
    return <p className="max-w-prose text-[15px] text-muted-foreground">Authors show up here once you have (or want) two or more of their books.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Find an author</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an author" className="h-10 rounded-full pl-9" />
        </label>
        <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Authors">
          {(
            [
              ["all", `All (${collections.length})`],
              ["wishlist", `With wishlist books (${collections.filter((c) => c.wanted.length > 0).length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={show === id}
              onClick={() => setShow(id)}
              className={cn(
                "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                show === id && "bg-background text-foreground shadow-sm",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-3 text-xs text-muted-foreground sm:ml-auto">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-3 rounded-[2px] bg-chart-actual" aria-hidden /> You have it
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-3 rounded-[2px] bg-muted-foreground/40" aria-hidden /> On your wishlist
          </span>
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No authors match.</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {shown.map((c) => (
            <AuthorCard key={c.author} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuthorCard({ c }: { c: AuthorCollection }) {
  const total = c.have.length + c.wanted.length;
  return (
    <section aria-labelledby={`author-${c.author}`} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`author-${c.author}`} className="flex items-center gap-2 font-heading text-lg font-semibold text-heading">
            <Link href={libraryUrl({ author: c.author })} className="truncate hover:underline">
              {c.author}
            </Link>
            <AuthorFlags authors={[c.author]} />
          </h2>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">
              {c.have.length} of {total}
            </span>{" "}
            <span className="text-muted-foreground">
              you have · {c.read} read{c.wanted.length > 0 && ` · ${c.wanted.length} on your wishlist`}
            </span>
          </p>
        </div>
      </div>
      <span className="h-1.5 rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-chart-actual" style={{ width: `${(c.have.length / total) * 100}%` }} />
      </span>

      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-6 2xl:grid-cols-8" aria-label={`Books by ${c.author}`}>
        {c.have.map((b) => (
          <Cover key={b.id} book={b} kind={b.timesRead > 0 || b.status === "finished" ? "read" : "have"} />
        ))}
        {c.wanted.map((b) => (
          <Cover key={b.id} book={b} kind="wanted" />
        ))}
        <li>
          <Link
            href={newBookUrl({ wishlist: true, author: c.author })}
            className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-[2px_5px_5px_2px] border-2 border-dashed border-border p-1 text-center text-[11px] leading-tight text-muted-foreground hover:border-foreground/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden />
            Add to wishlist
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** Bright for books you have (a tick once read), greyed out for wishlist ones (with a heart). */
function Cover({ book, kind }: { book: Book; kind: "read" | "have" | "wanted" }) {
  const state = kind === "read" ? "read" : kind === "have" ? "you have it" : "on your wishlist";
  return (
    <li>
      <Link href={`/books/${book.id}`} title={`${book.title} (${state})`} aria-label={`${book.title}, ${state}`} className="group/cover relative block rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none">
        <BookCover
          title={book.title}
          authors={book.authors}
          src={book.coverSrc}
          lang={book.language}
          sizes="96px"
          compact
          className={cn("transition-[filter,opacity,transform] group-hover/cover:-translate-y-0.5", kind === "wanted" && "opacity-45 grayscale group-hover/cover:opacity-80 group-hover/cover:grayscale-0")}
        />
        {kind === "read" && (
          <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-chart-actual text-white shadow-sm ring-2 ring-card">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        )}
        {kind === "wanted" && (
          <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-background text-muted-foreground shadow-sm ring-2 ring-card">
            <Heart className="size-3" aria-hidden />
          </span>
        )}
        <span lang={book.language} className={cn("mt-1.5 line-clamp-2 text-[11px] leading-snug font-medium group-hover/cover:underline", kind === "wanted" && "text-muted-foreground")}>
          {book.title}
        </span>
      </Link>
    </li>
  );
}
