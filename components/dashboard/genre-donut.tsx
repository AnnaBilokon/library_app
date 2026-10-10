"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { GenreSlice } from "@/lib/bookish";
import { useInView } from "./motion";

// Fixed order (slot 1 = most read): checked colours from globals.css, neutral for "Other" (only past 14 genres).
const color = (i: number, genre: string) => (genre === "Other" ? "var(--genre-other)" : `var(--genre-${i + 1})`);

/**
 * This year's genres as a donut that sweeps in when it comes into view. Every slice is also in the
 * legend with its count and share, so nothing depends on telling colours apart or on hovering.
 */
export function GenreDonut({ slices, year }: { slices: GenreSlice[]; year: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const total = slices.reduce((s, g) => s + g.count, 0);
  const config = Object.fromEntries(slices.map((g, i) => [g.genre, { label: g.genre, color: color(i, g.genre) }])) satisfies ChartConfig;

  return (
    <section aria-labelledby="genres-title" className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 id="genres-title" className="font-heading text-lg font-semibold text-heading">
          Genres in {year}
        </h3>
        <p className="text-sm text-muted-foreground">What the books you finished were about</p>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No finished books with a date in {year} yet.</p>
      ) : (
        <div ref={ref} className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative size-48 shrink-0">
            {inView && (
              <ChartContainer config={config} className="aspect-square size-48">
                <PieChart accessibilityLayer>
                  <ChartTooltip content={<ChartTooltipContent nameKey="genre" hideIndicator={false} />} />
                  <Pie data={slices} dataKey="count" nameKey="genre" innerRadius={58} outerRadius={90} paddingAngle={0} stroke="var(--card)" strokeWidth={2} animationDuration={900}>
                    {slices.map((g, i) => (
                      <Cell key={g.genre} fill={color(i, g.genre)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">{total}</span>
              <span className="text-xs text-muted-foreground">{total === 1 ? "book" : "books"}</span>
            </div>
          </div>
          <ul className="flex w-full flex-col gap-1.5">
            {slices.map((g, i) => (
              <li key={g.genre} className="flex items-center gap-2.5 text-sm">
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: color(i, g.genre) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{g.genre}</span>
                <span className="font-semibold tabular-nums">{g.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((g.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
