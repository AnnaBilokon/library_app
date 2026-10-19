"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { markReleasePicksSeen } from "@/app/actions/release-picks";
import { BookCover } from "@/components/books/book-cover";
import { buttonVariants } from "@/components/ui/button";
import type { ReleasePick } from "@/lib/data/release-picks";
import { releaseLabel } from "@/lib/releases/labels";
import { cn } from "@/lib/utils";

/**
 * "New books you may like": what the daily check (or a manual one) found for you on the
 * publishers' pages. Shown until you open New releases or dismiss it.
 */
export function ReleasePicksCard({ picks, today }: { picks: ReleasePick[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (picks.length === 0) return null;
  const dismiss = () =>
    start(async () => {
      const r = await markReleasePicksSeen();
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <section aria-labelledby="release-picks-title" className="flex flex-col gap-4 rounded-3xl bg-accent/70 p-5 md:p-6 dark:bg-accent/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="release-picks-title" className="flex items-center gap-2 font-heading text-xl font-semibold text-heading md:text-2xl">
            <Sparkles className="size-5 text-primary dark:text-highlight" aria-hidden />
            {picks.length === 1 ? "A new book you may like" : `${picks.length} new books you may like`}
          </h2>
          <p className="text-sm text-muted-foreground">From the publishers&apos; new releases, picked for your reading.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/releases" className={cn(buttonVariants(), "rounded-full")}>
            See all
          </Link>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full")}
            aria-label="Dismiss"
          >
            <X aria-hidden />
          </button>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {picks.slice(0, 6).map((p) => {
          const when = releaseLabel(p.edition, today);
          return (
            <li key={p.id}>
              <Link href="/releases" className="flex gap-3 rounded-2xl bg-background/70 p-3 hover:bg-background">
                <div className="w-16 shrink-0">
                  <BookCover title={p.edition.title} authors={p.edition.authors} src={p.edition.coverSrc} lang={p.edition.language} sizes="64px" />
                </div>
                <span className="flex min-w-0 flex-col gap-1">
                  <span lang={p.edition.language} className="line-clamp-2 font-heading text-[15px] leading-snug font-semibold text-heading">
                    {p.edition.title}
                  </span>
                  {p.edition.authors.length > 0 && <span className="line-clamp-1 text-sm text-muted-foreground">{p.edition.authors.join(", ")}</span>}
                  {when && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="line-clamp-1">{when}</span>
                    </span>
                  )}
                  <span className="line-clamp-2 text-sm leading-snug italic">{p.reason}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
