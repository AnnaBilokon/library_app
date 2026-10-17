"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Gift, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { setReleaseHidden } from "@/app/actions/releases";
import { BookCover } from "@/components/books/book-cover";
import { buttonVariants } from "@/components/ui/button";
import type { Release, ReleaseKind, ReleaseSource } from "@/lib/data/releases";
import { cn } from "@/lib/utils";
import { ReleaseCheck } from "./release-check";
import { SourcesEditor } from "./sources-editor";

const KIND_LABEL: Record<ReleaseKind, string> = { new: "New", coming: "Coming soon" };

/** New releases: what the check found on the publishers' pages, filtered your way. */
export function ReleasesView({ releases, sources, isAdmin }: { releases: Release[]; sources: ReleaseSource[]; isAdmin: boolean }) {
  const [genres, setGenres] = useState<string[]>([]);
  const [kind, setKind] = useState<ReleaseKind | "all">("all");
  const [sourceId, setSourceId] = useState<string>("all");
  const [hideMine, setHideMine] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  const genreCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of releases) for (const g of r.edition.genres) m.set(g, (m.get(g) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [releases]);

  const shown = releases.filter(
    (r) =>
      (showHidden || !r.hidden) &&
      (!hideMine || !r.mine) &&
      (kind === "all" || r.source.kind === kind) &&
      (sourceId === "all" || r.source.id === sourceId) &&
      (genres.length === 0 || r.edition.genres.some((g) => genres.includes(g))),
  );
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
              <ReleaseCard key={r.edition.id} release={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ReleaseCard({ release: { edition: e, source, mine, hidden } }: { release: Release }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggleHidden = () =>
    start(async () => {
      const r = await setReleaseHidden(e.id, !hidden);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <li className={cn("flex flex-col gap-2", hidden && "opacity-50")}>
      <div className="relative">
        <BookCover title={e.title} authors={e.authors} src={e.coverSrc} lang={e.language} sizes="(min-width: 1280px) 190px, (min-width: 768px) 22vw, 45vw" />
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
            source.kind === "coming" ? "bg-highlight text-highlight-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {KIND_LABEL[source.kind]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span lang={e.language} className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold text-heading">
          {e.title}
        </span>
        {e.authors.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{e.authors.join(", ")}</span>}
        <span className="line-clamp-1 text-xs text-muted-foreground">{[e.publisher ?? source.label, e.publishedYear].filter(Boolean).join(" · ")}</span>
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
    </li>
  );
}
