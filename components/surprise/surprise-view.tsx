"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, ListPlus, Loader2, PackageOpen, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { setBookStatus, setForgotten } from "@/app/actions/books";
import { changeQueue } from "@/app/actions/queue";
import { BookCover } from "@/components/books/book-cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayLocal } from "@/lib/dates";
import { inLibrary } from "@/lib/selling";
import { applyGenre, poolBooks, recentGenres, spin, type GenreChoice, type Pool } from "@/lib/surprise";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

const POOL_LABEL: Record<Pool, string> = { unread: "Unread", all: "All books", forgotten: "Forgotten box" };
const ITEM = 128; // cover width (112) + gap (16), for centring the reel
const SPIN_MS = 3400;

type Phase = { kind: "idle" } | { kind: "spinning"; reel: Book[]; pick: Book } | { kind: "revealed"; pick: Book };

/**
 * "Surprise me": choose where to pick from (unread, all, the Forgotten box) and a genre, then spin.
 * A reel of covers races past and slows onto the pick, sparkles burst and the card flips over.
 */
export function SurpriseView({ books }: { books: Book[] }) {
  const [pool, setPool] = useState<Pool>("unread");
  const [genre, setGenre] = useState<GenreChoice>({ kind: "any" });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const seen = useRef(new Set<string>());
  const reelBox = useRef<HTMLDivElement>(null);

  const recent = useMemo(() => recentGenres(books), [books]);
  const base = useMemo(() => poolBooks(books, pool), [books, pool]);
  const candidates = useMemo(() => applyGenre(base, genre, recent), [base, genre, recent]);
  const genres = useMemo(() => [...new Set(base.flatMap((b) => b.genres))].sort((a, b) => a.localeCompare(b, "uk")), [base]);
  // The dropdown: Any genre, Something different, then every genre in this pool (value strings).
  const genreItems = [
    { value: "any", label: "Any genre" },
    { value: "different", label: "✦ Something different" },
    ...genres.map((g) => ({ value: `g:${g}`, label: g })),
  ];
  const genreValue = genre.kind === "genre" ? `g:${genre.genre}` : genre.kind;
  const fromValue = (v: string): GenreChoice => (v === "any" ? { kind: "any" } : v === "different" ? { kind: "different" } : { kind: "genre", genre: v.slice(2) });
  const counts = useMemo(() => Object.fromEntries((["unread", "all", "forgotten"] as const).map((p) => [p, poolBooks(books, p).length])) as Record<Pool, number>, [books]);

  const go = () => {
    const result = spin(candidates, seen.current);
    if (!result) return;
    seen.current.add(result.pick.id);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase({ kind: "revealed", pick: result.pick });
      return;
    }
    // Start with the reel at rest, then on the next frame let it race to the pick (centred).
    setAnimate(false);
    setOffset(0);
    setPhase({ kind: "spinning", reel: result.reel, pick: result.pick });
    const width = reelBox.current?.clientWidth ?? 600;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffset(-((result.reel.length - 1) * ITEM) + width / 2 - (ITEM - 16) / 2);
      }),
    );
  };

  const choosePool = (p: Pool) => {
    setPool(p);
    setGenre({ kind: "any" });
    setPhase({ kind: "idle" });
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Pick from" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1 sm:w-fit" role="group" aria-label="Pick from">
          {(["unread", "all", "forgotten"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pool === p}
              onClick={() => choosePool(p)}
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none",
                pool === p && "bg-background text-foreground shadow-sm",
              )}
            >
              {p === "forgotten" && <PackageOpen className="size-4" aria-hidden />}
              {POOL_LABEL[p]}
              <span className="text-xs tabular-nums opacity-60">{counts[p]}</span>
            </button>
          ))}
        </div>
        {genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium" id="genre-label">
              Genre
            </span>
            <Select value={genreValue} onValueChange={(v) => v && setGenre(fromValue(v))} items={genreItems}>
              <SelectTrigger className="h-10 w-64 rounded-full" aria-labelledby="genre-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {genreItems.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {genre.kind === "different" && recent.length > 0 && <span className="text-xs text-muted-foreground">Not {recent.join(", ")}, which you read lately</span>}
          </div>
        )}
      </section>

      <section aria-label="Surprise me" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-highlight/50 via-card to-accent/60 px-4 py-8 ring-1 ring-border/60 md:px-8 md:py-10">
        {/* Always here, full width: tells the reel how wide it is so the pick lands in the middle. */}
        <div ref={reelBox} className="h-0" aria-hidden />
        {phase.kind === "idle" && <Deck count={candidates.length} pool={pool} onSpin={go} books={candidates} />}

        {phase.kind === "spinning" && (
          <div className="flex flex-col items-center gap-6" aria-live="polite">
            <p className="font-heading text-xl text-heading">Shuffling the shelf…</p>
            <div className="relative w-full overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
              <div
                className="flex gap-4"
                style={{ transform: `translateX(${offset}px)`, transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.1, 1)` : "none" }}
                onTransitionEnd={() => setPhase({ kind: "revealed", pick: phase.pick })}
              >
                {phase.reel.map((b, i) => (
                  <div key={`${b.id}-${i}`} className="w-28 shrink-0">
                    <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="112px" />
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-32 -translate-x-1/2 rounded-xl ring-3 ring-highlight" aria-hidden />
            </div>
          </div>
        )}

        {phase.kind === "revealed" && (
          <Reveal key={phase.pick.id} book={phase.pick} fromBox={phase.pick.forgotten} onAgain={go} canAgain={candidates.length > 1} onReset={() => setPhase({ kind: "idle" })} />
        )}
      </section>

      <ForgottenBox books={books} />
    </div>
  );
}

/** Before a spin: a little fanned deck of the pool's covers, floating, and the big button. */
function Deck({ count, pool, onSpin, books }: { count: number; pool: Pool; onSpin: () => void; books: Book[] }) {
  // A stable handful of covers to fan out (the first ones; the pick itself is random).
  const fan = books.slice(0, 5);
  return (
    <div className="flex flex-col items-center gap-7 text-center">
      <div className="surprise-float relative h-44 w-64" aria-hidden>
        {fan.length === 0 ? (
          <div className="absolute inset-x-20 inset-y-0 rounded-md border-2 border-dashed border-border" />
        ) : (
          fan.map((b, i) => {
            const mid = (fan.length - 1) / 2;
            return (
              <div
                key={b.id}
                className="absolute top-2 left-1/2 w-24 origin-bottom shadow-book"
                style={{ transform: `translateX(-50%) rotate(${(i - mid) * 9}deg) translateY(${Math.abs(i - mid) * 6}px)`, zIndex: i }}
              >
                <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="128px" />
              </div>
            );
          })
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button onClick={onSpin} disabled={count === 0} className="surprise-glow h-14 rounded-full px-8 text-lg">
          <Sparkles className="size-5" aria-hidden />
          Surprise me
        </Button>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? pool === "forgotten"
              ? "Your Forgotten box is empty. Add books below."
              : "No books match. Try another genre."
            : `Picking from ${count} ${count === 1 ? "book" : "books"}`}
        </p>
      </div>
    </div>
  );
}

// A ring of golden stars at varied distances and sizes, bursting out from behind the cover.
const SPARKS = Array.from({ length: 22 }, (_, i) => ({ r: i * (360 / 22) + ((i * 13) % 9), d: 120 + ((i * 41) % 90), size: i % 4 === 0 ? 26 : i % 3 === 0 ? 18 : 12, delay: (i % 5) * 70 }));

/** The pick: sparkles burst, the card flips over, and what to do next. */
function Reveal({ book, fromBox, onAgain, canAgain, onReset }: { book: Book; fromBox: boolean; onAgain: () => void; canAgain: boolean; onReset: () => void }) {
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(false);
  const queued = book.queuePosition !== undefined;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string, then?: () => void) =>
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.error ?? "Couldn't save.");
        return;
      }
      toast.success(message);
      then?.();
    });

  return (
    <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-center md:gap-10">
      <div className="relative w-44 shrink-0 md:w-52">
        {/* A warm glow behind the cover, and golden stars bursting out from its centre. */}
        <div
          className="surprise-halo pointer-events-none absolute top-1/2 left-1/2 size-80 rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, #f5b301 45%, transparent) 0%, transparent 65%)" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="surprise-sparkle absolute top-0 left-0"
              style={{ "--r": `${s.r}deg`, "--d": `-${s.d}px`, animationDelay: `${s.delay}ms`, color: i % 3 === 1 ? "var(--chart-actual)" : "#f5b301" } as React.CSSProperties}
            >
              <Sparkles style={{ width: s.size, height: s.size }} className="drop-shadow-[0_0_6px_rgb(245_179_1_/_0.6)]" />
            </span>
          ))}
        </div>
        <div className="surprise-flip relative">
          <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="208px" priority className="shadow-book-hover" />
        </div>
      </div>

      <div className="surprise-flip flex max-w-md flex-col items-center gap-3 text-center [animation-delay:150ms] md:items-start md:text-left">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{fromBox ? "From your Forgotten box" : "Your next book could be"}</p>
        <h2 lang={book.language} className="font-heading text-3xl leading-tight font-semibold text-balance text-heading md:text-4xl">
          {book.title}
        </h2>
        {book.authors.length > 0 && <p className="text-lg text-muted-foreground">{book.authors.join(", ")}</p>}
        <p className="text-sm text-muted-foreground">{[book.genres[0], book.pages && `${book.pages} pages`, book.timesRead > 0 && `read ${book.timesRead}×`].filter(Boolean).join(" · ")}</p>
        {book.description && <p className="line-clamp-4 text-sm leading-relaxed">{book.description}</p>}

        {started ? (
          <p className="flex items-center gap-2 font-medium">
            <BookOpen className="size-4" aria-hidden /> Enjoy it!{" "}
            <Link href={`/books/${book.id}`} className="underline underline-offset-4">
              Open the book
            </Link>
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap justify-center gap-2 md:justify-start">
            <Button className="rounded-full" disabled={pending} onClick={() => run(() => setBookStatus(book.id, "reading", todayLocal()), `Reading “${book.title}” from today`, () => setStarted(true))}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BookOpen aria-hidden />}
              Start reading
            </Button>
            {!queued && (
              <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => run(() => changeQueue(book.id, "append"), `“${book.title}” is in Up next`)}>
                <ListPlus aria-hidden />
                Up next
              </Button>
            )}
            <Link href={`/books/${book.id}`} className={buttonVariants({ variant: "ghost", className: "rounded-full" })}>
              Open
            </Link>
            {canAgain && (
              <Button variant="ghost" className="rounded-full" disabled={pending} onClick={onAgain}>
                <RotateCcw aria-hidden />
                Spin again
              </Button>
            )}
          </div>
        )}
        <button type="button" onClick={onReset} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Back to the deck
        </button>
      </div>
    </div>
  );
}

/** Books you chose to be reminded of; "Surprise me" can pick from them. */
function ForgottenBox({ books }: { books: Book[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = books.filter((b) => b.forgotten && inLibrary(b));

  const toggle = (book: Book, on: boolean) =>
    startTransition(async () => {
      const r = await setForgotten(book.id, on);
      if (!r.ok) toast.error(r.error);
      else toast.success(on ? `“${book.title}” is in the Forgotten box` : `Took “${book.title}” out of the box`);
    });

  return (
    <section aria-labelledby="forgotten-title" className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border/60 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="forgotten-title" className="flex items-center gap-2 font-heading text-2xl font-semibold text-heading">
            <PackageOpen className="size-5 text-muted-foreground" aria-hidden />
            Forgotten box
            <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{box.length}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Books you&apos;d like to be reminded of. Pick “Forgotten box” above to spin from them.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add books
        </Button>
      </div>
      {box.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Empty for now. Add books you keep meaning to get to, or ones you&apos;d love to reread.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
          {box.map((b) => (
            <li key={b.id} className="group relative flex flex-col gap-1.5">
              <Link href={`/books/${b.id}`} className="rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none">
                <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="128px" />
              </Link>
              <span lang={b.language} className="line-clamp-2 text-xs leading-snug font-medium">
                {b.title}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(b, false)}
                aria-label={`Take ${b.title} out of the Forgotten box`}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddToBox books={books} onClose={() => setAdding(false)} onToggle={toggle} pending={pending} />}
    </section>
  );
}

function AddToBox({ books, onClose, onToggle, pending }: { books: Book[]; onClose: () => void; onToggle: (b: Book, on: boolean) => void; pending: boolean }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => inLibrary(b) && b.status !== "reading" && (!q || b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q))))
      .slice(0, 60);
  }, [books, query]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to the Forgotten box</DialogTitle>
          <DialogDescription>Search your library and add the books you&apos;d like to be reminded of.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or author" aria-label="Search your library" className="h-10 pl-8" autoFocus />
        </div>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {results.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <BookCover title={b.title} src={b.coverSrc} sizes="32px" className="w-8 shrink-0" compact />
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={b.language} className="truncate text-sm font-medium">
                  {b.title}
                </span>
                {b.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{b.authors.join(", ")}</span>}
              </span>
              <Button size="sm" variant={b.forgotten ? "secondary" : "outline"} className="rounded-full" disabled={pending} onClick={() => onToggle(b, !b.forgotten)}>
                {b.forgotten ? "In the box" : "Add"}
              </Button>
            </li>
          ))}
          {results.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No book matches “{query}”.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
