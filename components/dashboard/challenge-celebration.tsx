"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { markChallengeCelebrated } from "@/app/actions/settings";
import { Confetti } from "@/components/habits/celebration";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { challengeToCelebrate } from "@/lib/challenge";
import { useCountUp, useReducedMotion } from "./motion";

const R = 52;
const CIRC = 2 * Math.PI * R;

// The browser's year (null while rendering on the server, where the time zone may differ).
const noSubscribe = () => () => {};
const useLocalYear = () => useSyncExternalStore(noSubscribe, () => new Date().getFullYear(), () => null);

/**
 * Watches every page: the moment the book that reaches this year's goal is saved (the layout
 * refreshes with it), a "challenge complete" dialog opens. Shown once per goal.
 */
export function ChallengeCelebration({
  finished,
  goals,
  celebrated,
}: {
  finished: Record<string, number>;
  goals: Record<number, number>;
  celebrated: Record<string, number>;
}) {
  const year = useLocalYear();
  // Goals closed in this visit (saved in the background, so the dialog doesn't wait for it).
  const [seen, setSeen] = useState<Record<string, number>>({});
  const due = year === null ? null : challengeToCelebrate(finished, goals, { ...celebrated, ...seen }, year);
  if (!due) return null;
  const close = () => {
    setSeen((s) => ({ ...s, [String(due.year)]: due.goal }));
    void markChallengeCelebrated(due.year, due.goal);
  };
  return <ChallengeDialog key={`${due.year}:${due.goal}`} {...due} onClose={close} />;
}

/** The ring fills up with the count rising, then the trophy pops in with a burst of confetti. */
function ChallengeDialog({ year, goal, read, onClose }: { year: number; goal: number; read: number; onClose: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const [burst, setBurst] = useState(false);
  const reduced = useReducedMotion();
  const count = useCountUp(read, drawn, 1300);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    const timer = setTimeout(() => setBurst(true), reduced ? 0 : 1300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [reduced]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="overflow-hidden pt-8 text-center sm:max-w-sm">
        {burst && <Confetti />}
        <div className="relative mx-auto size-44" role="img" aria-label={`${read} of ${goal} books read`}>
          <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="var(--chart-actual)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={drawn ? 0 : CIRC}
              className="transition-[stroke-dashoffset] duration-[1300ms] ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-sans text-5xl leading-none font-semibold tracking-tight text-heading tabular-nums dark:text-foreground">{count}</span>
            <span className="mt-1 text-sm text-muted-foreground">of {goal}</span>
          </div>
          {burst && (
            <span className="badge-pop absolute -top-3 -right-3 grid size-16 place-items-center rounded-full bg-highlight text-4xl shadow-lg" aria-hidden>
              🏆
            </span>
          )}
        </div>
        <DialogTitle className="font-heading text-2xl">Challenge complete!</DialogTitle>
        <DialogDescription className="text-base">
          {read > goal
            ? `You set out to read ${goal} books in ${year} and you've read ${read}. Well done!`
            : `You set out to read ${goal} books in ${year}, and you just finished the last one. Well done!`}
        </DialogDescription>
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="rounded-full px-6" onClick={onClose}>
            Yay!
          </Button>
          <Link href="/" onClick={onClose} className={buttonVariants({ variant: "outline", className: "rounded-full px-5" })}>
            See your challenge
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
