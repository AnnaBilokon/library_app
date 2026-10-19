"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ExternalLink, EyeOff, Gift, Plus, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { markReleasePicksSeen } from "@/app/actions/release-picks";
import { setReleaseHidden } from "@/app/actions/releases";
import { BookCover } from "@/components/books/book-cover";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Release, ReleaseKind, ReleaseSource } from "@/lib/data/releases";
import { byReleaseDate, releaseLabel } from "@/lib/releases/labels";
import { cn } from "@/lib/utils";
import { ReleaseCheck } from "./release-check";
import { SourcesEditor } from "./sources-editor";

const KIND_LABEL: Record<ReleaseKind, string> = { new: "New", coming: "Coming soon" };

export interface PickInfo {
  editionId: string;
  reason: string;
  seen: boolean;
}

/** New releases: what the check found on the publishers' pages, filtered your way, with picks for you on top. */
export function ReleasesView({
  releases,
  sources,
  isAdmin,
  picks,
  today,
}: {
  releases: Release[];
  sources: ReleaseSource[];
  isAdmin: boolean;
  picks: PickInfo[];
  today: string;
}) {
  const [genres, setGenres] = useState<string[]>([]);
  const [sort, setSort] = useState<"found" | "release">("found");
  const [kind, setKind] = useState<ReleaseKind | "all">("all");
  const [sourceId, setSourceId] = useState<string>("all");
  const [hideMine, setHideMine] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  const genreCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of releases) for (const g of r.edition.genres) m.set(g, (m.get(g) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [releases]);

  const filtered = releases.filter(
    (r) =>
      (showHidden || !r.hidden) &&
      (!hideMine || !r.mine) &&
      (kind === "all" || r.source.kind === kind) &&
      (sourceId === "all" || r.source.id === sourceId) &&
      (genres.length === 0 || r.edition.genres.some((g) => genres.includes(g))),
  );
  // Newest found first (as loaded), or by release date: soonest first, undated last.
  const shown = sort === "release" ? [...filtered].sort((a, b) => byReleaseDate(a.edition, b.edition)) : filtered;

  // Picks for you: the ones you don't have and didn't hide, on top. Seeing this page marks them seen.
  const reasons = useMemo(() => new Map(picks.map((p) => [p.editionId, p.reason])), [picks]);
  const forYou = releases.filter((r) => reasons.has(r.edition.id) && !r.hidden && !r.mine);
  const anyUnseen = picks.some((p) => !p.seen);
  useEffect(() => {
    if (anyUnseen) void markReleasePicksSeen();
  }, [anyUnseen]);
  const hiddenCount = releases.filter((r) => r.hidden).length;
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-border hover:bg-muted",
      active && "bg-primary text-primary-foreground ring-primary hover:bg-primary/90",
    );

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <div className="flex flex-col gap-4">
          <ReleaseCheck sources={sources} />
          <SourcesEditor sources={sources} />
        </div>
      )}

      {forYou.length > 0 && (
        <section aria-labelledby="for-you-title" className="flex flex-col gap-4 rounded-3xl bg-accent/60 p-5 md:p-6 dark:bg-accent/50">
          <h2 id="for-you-title" className="flex items-center gap-2 font-heading text-2xl font-semibold text-heading">
            <Sparkles className="size-5 text-primary dark:text-highlight" aria-hidden />
            For you
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {forYou.map((r) => (
              <ReleaseCard key={r.edition.id} release={r} reason={reasons.get(r.edition.id)} today={today} />
            ))}
          </ul>
        </section>
      )}

      {releases.length === 0 ? (
        <p className="rounded-2xl bg-muted/60 p-6 text-muted-foreground">
          {isAdmin ? "Nothing found yet. Press Check for new releases to read the publishers' pages." : "No new releases yet."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {genreCounts.length > 0 && (
              <nav aria-label="Genres" className="flex flex-wrap gap-1.5">
                <button type="button" className={chip(genres.length === 0)} onClick={() => setGenres([])}>
                  All genres
                </button>
                {genreCounts.map(([g, n]) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={genres.includes(g)}
                    className={chip(genres.includes(g))}
                    onClick={() => setGenres((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]))}
                  >
                    {g}
                    <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                ))}
              </nav>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div role="radiogroup" aria-label="New or coming soon" className="flex rounded-full bg-muted p-1">
                {(["all", "new", "coming"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={cn("h-8 rounded-full px-3", kind === k && "bg-background font-medium shadow-sm")}
                  >
                    {k === "all" ? "All" : KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                aria-label="Source"
                className="h-9 rounded-full border border-input bg-background px-3 text-sm"
              >
                <option value="all">All publishers</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={hideMine} onChange={(e) => setHideMine(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Hide books I already have
              </label>
              <select value={sort} onChange={(e) => setSort(e.target.value as "found" | "release")} aria-label="Sort" className="h-9 rounded-full border border-input bg-background px-3 text-sm">
                <option value="found">Newest found</option>
                <option value="release">Release date</option>
              </select>
              {hiddenCount > 0 && (
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  Show not interested ({hiddenCount})
                </label>
              )}
            </div>
            <p className="text-sm text-muted-foreground" role="status">
              {shown.length} of {releases.length} {releases.length === 1 ? "book" : "books"}
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((r) => (
              <ReleaseCard key={r.edition.id} release={r} reason={reasons.get(r.edition.id)} today={today} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ReleaseCard({ release: { edition: e, source, mine, hidden }, reason, today }: { release: Release; reason?: string; today: string }) {
  const when = releaseLabel(e, today);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const toggleHidden = () =>
    start(async () => {
      const r = await setReleaseHidden(e.id, !hidden);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <li className={cn("flex flex-col gap-2", hidden && "opacity-50")}>
      {/* Hover (or focus) shows the start of the description; a click opens all of it. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/cover relative block rounded-sm text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`About “${e.title}”`}
      >
        <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="(min-width: 1280px) 190px, (min-width: 768px) 22vw, 45vw" />
        {e.description && (
          <span
            lang={e.language}
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden flex-col justify-end overflow-hidden rounded-sm bg-black/80 p-3 text-xs leading-snug text-white opacity-0 transition-opacity group-hover/cover:opacity-100 group-focus-visible/cover:opacity-100 sm:flex"
          >
            <span className="line-clamp-[12]">{e.description}</span>
            <span className="mt-1.5 font-semibold underline underline-offset-2">Read more</span>
          </span>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
            source.kind === "coming" ? "bg-highlight text-highlight-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {KIND_LABEL[source.kind]}
        </span>
      </button>
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => setOpen(true)} lang={e.language} className="line-clamp-2 text-left font-heading text-[15px] leading-snug font-semibold text-heading hover:underline">
          {e.title}
        </button>
        {e.authors.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{e.authors.join(", ")}</span>}
        <span className="line-clamp-1 text-xs text-muted-foreground">{[e.publisher ?? source.label, e.publishedYear].filter(Boolean).join(" · ")}</span>
        {when && (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="line-clamp-1">{when}</span>
          </span>
        )}
        {reason && <span className="line-clamp-3 text-xs leading-snug text-primary italic dark:text-highlight">{reason}</span>}
      </div>
      {e.genres.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {e.genres.map((g) => (
            <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {g}
            </span>
          ))}
        </div>
      )}
      {mine ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-highlight">
          <Check className="size-4" aria-hidden />
          {mine === "wishlist" ? "On your wishlist" : "In your library"}
        </span>
      ) : (
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <Link href={`/books/new?edition=${e.id}`} className={cn(buttonVariants({ size: "sm" }), "flex-1 rounded-full")} aria-label={`Add “${e.title}” to my library`}>
              <Plus aria-hidden />
              Library
            </Link>
            <Link
              href={`/books/new?edition=${e.id}&wishlist=1`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 rounded-full")}
              aria-label={`Add “${e.title}” to my wishlist`}
            >
              <Gift aria-hidden />
              Wishlist
            </Link>
          </div>
          <button
            type="button"
            onClick={toggleHidden}
            disabled={pending}
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {hidden ? <Undo2 className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
            {hidden ? "Show again" : "Not interested"}
          </button>
        </div>
      )}
      <ReleaseDetails release={{ edition: e, source, mine, hidden }} when={when} reason={reason} open={open} onOpenChange={setOpen} />
    </li>
  );
}

/** Everything about a release: the full description, details, the publisher's page, and the add buttons. */
function ReleaseDetails({
  release: { edition: e, source, mine },
  when,
  reason,
  open,
  onOpenChange,
}: {
  release: Release;
  when?: string;
  reason?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const site = e.sourceUrl ? new URL(e.sourceUrl).hostname.replace(/^www\./, "") : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
          <div className="mx-auto w-32 sm:w-full">
            <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="144px" />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <DialogHeader className="gap-1 text-left">
              <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {KIND_LABEL[source.kind]} · {source.label}
              </span>
              <DialogTitle lang={e.language} className="font-heading text-2xl leading-tight text-heading">
                {e.title}
              </DialogTitle>
              <DialogDescription>
                {[e.authors.join(", "), e.publisher, e.publishedYear, e.pages && `${e.pages} pages`].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>
            {when && (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                {when}
              </p>
            )}
            {reason && (
              <p className="flex gap-1.5 rounded-xl bg-accent/70 p-3 text-sm dark:bg-accent/60">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary dark:text-highlight" aria-hidden />
                {reason}
              </p>
            )}
            {e.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {e.genres.map((g) => (
                  <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {e.description ? (
              <p lang={e.language} className="text-sm leading-relaxed whitespace-pre-line">
                {e.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No description from the publisher yet.</p>
            )}
            {e.sourceUrl && (
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
                On {site}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {mine ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-highlight">
                <Check className="size-4" aria-hidden />
                {mine === "wishlist" ? "On your wishlist" : "In your library"}
              </span>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/books/new?edition=${e.id}`} className={cn(buttonVariants(), "rounded-full")}>
                  <Plus aria-hidden />
                  Add to my library
                </Link>
                <Link href={`/books/new?edition=${e.id}&wishlist=1`} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
                  <Gift aria-hidden />
                  Add to wishlist
                </Link>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
