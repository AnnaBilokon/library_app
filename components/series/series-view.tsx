"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Layers, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { setSeriesTotal } from "@/app/actions/series";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { libraryUrl, newBookUrl } from "@/lib/books/library-url";
import type { SeriesSummary, VolumeState } from "@/lib/series";
import { cn } from "@/lib/utils";

type Tab = "all" | SeriesSummary["status"];

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reading", label: "In progress" },
  { id: "caught-up", label: "Caught up" },
  { id: "not-started", label: "Not started" },
  { id: "finished", label: "Finished" },
];

const STATE_LABEL: Record<VolumeState, string> = {
  read: "Read",
  reading: "Reading",
  owned: "On your shelf",
  wishlist: "On your wishlist",
  missing: "Don't have it",
};

/**
 * Each series gets its own colour (stable, from its name) out of the checked genre colours,
 * leaving out orange and red so the coral of wishlist books always stands apart.
 */
const SERIES_SLOTS = [1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14];
function seriesSlot(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SERIES_SLOTS[h % SERIES_SLOTS.length];
}

/**
 * A volume's box in the series colour: solid once read, a lighter shade with an outline while
 * reading, a pale tint on your shelf. Wishlist (coral outline) and missing (dashed) look the same
 * in every series. The number and the legend's words carry the meaning too, not colour alone.
 */
function volumeBox(state: VolumeState, slot: number): { className: string; style?: React.CSSProperties } {
  const c = `var(--genre-${slot})`;
  switch (state) {
    case "read":
      return { className: "", style: { background: c, color: `var(--genre-ink-${slot})` } };
    case "reading":
      return { className: "text-foreground", style: { background: `color-mix(in oklab, ${c} 38%, var(--card))`, boxShadow: `inset 0 0 0 2px ${c}` } };
    case "owned":
      return { className: "text-foreground", style: { background: `color-mix(in oklab, ${c} 20%, var(--card))`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 55%, var(--card))` } };
    case "wishlist":
      return { className: "bg-soon/25 text-foreground ring-2 ring-soon" };
    case "missing":
      return { className: "border-2 border-dashed border-border text-muted-foreground" };
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Your series: for each, a row of numbered boxes (read, reading, on your shelf, on your wishlist,
 * or missing), how far you are, the next book to read and the numbers you don't have yet.
 */
export function SeriesView({ series }: { series: SeriesSummary[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const count = (t: Tab) => (t === "all" ? series.length : series.filter((s) => s.status === t).length);
  const shown = tab === "all" ? series : series.filter((s) => s.status === tab);

  if (series.length === 0) {
    return (
      <p className="max-w-prose text-[15px] text-muted-foreground">
        No series yet. Add a series name and number to a book (Edit → Series) and it shows up here, with the volumes you&apos;ve read and the ones you&apos;re
        missing.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1" role="tablist" aria-label="Series">
          {TABS.filter((t) => t.id === "all" || count(t.id) > 0).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                tab === t.id && "bg-background text-foreground shadow-sm",
              )}
            >
              {t.label} <span className="tabular-nums opacity-70">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="What the boxes mean">
          {(Object.keys(STATE_LABEL) as VolumeState[]).map((s) => {
            const b = volumeBox(s, 1);
            return (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn("inline-block size-3.5 rounded-[4px]", b.className)} style={b.style} aria-hidden />
                {STATE_LABEL[s]}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {shown.map((s) => (
          <SeriesCard key={s.name} s={s} />
        ))}
      </div>
    </div>
  );
}

function SeriesCard({ s }: { s: SeriesSummary }) {
  const slot = seriesSlot(s.name);
  const colour = `var(--genre-${slot})`;
  const known = s.volumes.length;
  const pct = known ? Math.round((s.read / known) * 100) : 0;
  const status =
    s.status === "finished"
      ? "Finished!"
      : s.status === "caught-up"
        ? "You've read every book you have. Set how many there are to see what's left."
        : s.status === "not-started"
          ? "Not started yet"
          : `${plural(known - s.read, "book", "books")} to go${s.total === null ? " (that you know of)" : ""}`;

  return (
    <section
      aria-labelledby={`series-${s.name}`}
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6"
      style={{ backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${colour} 9%, transparent), transparent 70%)` }}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: colour }} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`series-${s.name}`} className="flex items-center gap-2 font-heading text-lg font-semibold text-heading">
            <Layers className="size-4 shrink-0" style={{ color: colour }} aria-hidden />
            <Link href={libraryUrl({ series: s.name })} className="truncate hover:underline">
              {s.name}
            </Link>
          </h2>
          {s.authors.length > 0 && <p className="truncate text-sm text-muted-foreground">{s.authors.join(", ")}</p>}
        </div>
        <TotalEditor series={s.name} total={s.total} known={known} />
      </div>

      {known > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">
              {s.read} of {known}
            </span>{" "}
            read <span className="text-muted-foreground">· {status}</span>
          </p>
          <span className="h-1.5 rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: colour }} />
          </span>
        </div>
      )}

      <ol className="flex flex-wrap gap-1.5" aria-label={`Books in ${s.name}`}>
        {s.volumes.map((v) => {
          const book = v.books[0];
          const label = `${v.index}. ${book ? book.title : "not in your library"}: ${STATE_LABEL[v.state].toLowerCase()}`;
          const look = volumeBox(v.state, slot);
          const box = cn("grid size-10 place-items-center rounded-lg text-sm font-semibold tabular-nums transition-transform", look.className);
          return (
            <li key={v.index}>
              {book ? (
                <Link
                  href={`/books/${book.id}`}
                  title={label}
                  aria-label={label}
                  className={cn(box, "hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none")}
                  style={look.style}
                >
                  {v.index}
                </Link>
              ) : (
                // A volume you don't have: one click to put it on your wishlist (series and number filled in).
                <Link
                  href={newBookUrl({ wishlist: true, series: s.name, index: v.index, author: s.authors[0] })}
                  title={`${v.index}: add to your wishlist`}
                  aria-label={`${v.index}. Not in your library: add to your wishlist`}
                  className={cn(box, "hover:border-foreground/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none")}
                >
                  {v.index}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1 text-sm">
        {s.next && (
          <Link href={`/books/${s.next.book.id}`} className="group flex w-fit items-center gap-1.5 font-medium">
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            Next: <span className="tabular-nums">#{s.next.index}</span>
            <span lang={s.next.book.language} className="group-hover:underline">
              {s.next.book.title}
            </span>
          </Link>
        )}
        {s.missing.length > 0 && (
          <p className="text-muted-foreground">
            Not in your library yet: <span className="font-medium text-foreground tabular-nums">{s.missing.map((m) => `#${m}`).join(", ")}</span>
            <span className="text-xs"> (click a number to add it to your wishlist)</span>
          </p>
        )}
        {s.unnumbered.length > 0 && (
          <p className="text-muted-foreground">
            Without a number:{" "}
            {s.unnumbered.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ", "}
                <Link href={`/books/${b.id}`} lang={b.language} className="text-foreground hover:underline">
                  {b.title}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

/** "8 books in the series" — set it so the tracker knows what's left after the last one you have. */
function TotalEditor({ series, total, known }: { series: string; total: number | null; known: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(total ? String(total) : "");
  const [pending, startTransition] = useTransition();
  const save = (next: number | null) =>
    startTransition(async () => {
      const r = await setSeriesTotal(series, next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(next ? `${series}: ${plural(next, "book", "books")}` : "Total removed");
      setOpen(false);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          />
        }
      >
        {total ? plural(total, "book", "books") : "How many books?"} <Pencil className="size-3" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(value.trim() ? Number(value) : null);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Books in the series
            <Input type="number" inputMode="numeric" min={Math.max(1, known)} max={200} value={value} onChange={(e) => setValue(e.target.value)} className="h-10" autoFocus />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="rounded-full px-4" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save
            </Button>
            {total && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => save(null)} disabled={pending}>
                Remove
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
