"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { Stats } from "@/lib/stats";

const config = {
  books: { label: "Books", color: "var(--chart-actual)" },
  pages: { label: "Pages", color: "var(--chart-actual)" },
} satisfies ChartConfig;

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

/** Books (or pages) per year, or per month for one year. One series, so no legend: the title names it. */
export function TimelineChart({ timeline }: { timeline: Stats["timeline"] }) {
  const [measure, setMeasure] = useState<"books" | "pages">("books");
  const hasPages = timeline.some((t) => t.pages > 0);
  return (
    <div className="flex flex-col gap-3">
      {hasPages && (
        <div className="flex justify-end">
          <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Show">
            {(["books", "pages"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={measure === m}
                onClick={() => setMeasure(m)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground capitalize hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  measure === m && "bg-background text-foreground shadow-sm",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      <ChartContainer config={config} className="aspect-auto h-60 w-full">
        <BarChart data={timeline} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={axisTick} />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent hideIndicator={false} />} />
          <Bar dataKey={measure} fill={`var(--color-${measure})`} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            <LabelList
              dataKey={measure}
              position="top"
              offset={6}
              fontSize={12}
              fontWeight={600}
              fill="var(--foreground)"
              formatter={(v: unknown) => (Number(v) > 0 ? Number(v).toLocaleString("en") : "")}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
