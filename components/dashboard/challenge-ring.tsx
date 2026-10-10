"use client";

import type { Challenge } from "@/lib/challenge";
import { useCountUp, useInView } from "./motion";

const R = 52;
const CIRC = 2 * Math.PI * R;

/**
 * The challenge as a ring that draws itself when it comes into view, with the count rising in the
 * middle and a small tick where the plan says you should be today.
 */
export function ChallengeRing({ challenge: c }: { challenge: Challenge }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const count = useCountUp(c.read, inView);
  const goal = c.goal ?? 0;
  const share = goal ? Math.min(1, c.read / goal) : 0;
  const planShare = goal ? Math.min(1, c.elapsed) : 0;
  const tickAngle = planShare * 2 * Math.PI - Math.PI / 2;

  return (
    <div ref={ref} className="relative size-40 shrink-0 md:size-44" role="img" aria-label={goal ? `${c.read} of ${goal} books read` : `${c.read} books read`}>
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--background)" strokeOpacity="0.85" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke="var(--chart-actual)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={inView ? CIRC * (1 - share) : CIRC}
          className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      {goal > 0 && c.elapsed > 0 && c.elapsed < 1 && (
        // Today's plan position: a short tick across the ring, in the plan colour.
        <svg viewBox="0 0 128 128" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <line
            x1={64 + Math.cos(tickAngle) * (R - 9)}
            y1={64 + Math.sin(tickAngle) * (R - 9)}
            x2={64 + Math.cos(tickAngle) * (R + 9)}
            y2={64 + Math.sin(tickAngle) * (R + 9)}
            stroke="var(--chart-plan)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans text-5xl leading-none font-semibold tracking-tight text-heading tabular-nums dark:text-foreground">{count}</span>
        <span className="mt-1 text-sm text-muted-foreground">{goal ? `of ${goal}` : "books"}</span>
      </div>
    </div>
  );
}
