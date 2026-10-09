"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MonthStat } from "@/lib/challenge";

// Colours come from CSS tokens, so they follow the palette and light/dark mode.
// (Validated pairs: see --chart-actual / --chart-plan in globals.css.)
const progressConfig = {
  cumulative: { label: "Your books", color: "var(--chart-actual)" },
  plan: { label: "Plan", color: "var(--chart-plan)" },
} satisfies ChartConfig;

const monthlyConfig = {
  read: { label: "Books finished", color: "var(--chart-actual)" },
} satisfies ChartConfig;

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

/** A short line key, mirroring the line marks (not a filled box). */
function LineKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <svg width="18" height="8" aria-hidden>
        <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

/** Running total of books read vs the plan's straight line to the goal. */
export function ProgressChart({ months, goal }: { months: MonthStat[]; goal: number | null }) {
  const lastIndex = months.reduce((last, m, i) => (m.cumulative !== null ? i : last), -1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1" aria-hidden>
        <LineKey color="var(--chart-actual)" label="Your books" />
        {goal && <LineKey color="var(--chart-plan)" label={`Plan to ${goal}`} />}
      </div>
      <ChartContainer config={progressConfig} className="aspect-auto h-64 w-full">
        <ComposedChart data={months} margin={{ top: 16, right: 36, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={axisTick} />
          <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<ChartTooltipContent indicator="line" />} />
          {goal && (
            <Line dataKey="plan" type="linear" stroke="var(--color-plan)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false}>
              <LabelList
                dataKey="plan"
                content={({ x, y, index, value }) =>
                  index === 11 ? (
                    <text x={Number(x) + 6} y={Number(y) + 4} fontSize={12} fill="var(--muted-foreground)">
                      {String(value)}
                    </text>
                  ) : null
                }
              />
            </Line>
          )}
          <Area dataKey="cumulative" type="monotone" stroke="none" fill="var(--color-cumulative)" fillOpacity={0.1} connectNulls={false} isAnimationActive={false} />
          <Line
            dataKey="cumulative"
            type="monotone"
            stroke="var(--color-cumulative)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          >
            {/* Direct label at the end of your line only, with an end dot. */}
            <LabelList
              dataKey="cumulative"
              content={({ x, y, index, value }) =>
                index === lastIndex ? (
                  <g>
                    <circle cx={Number(x)} cy={Number(y)} r={5} fill="var(--color-cumulative)" stroke="var(--card)" strokeWidth={2} />
                    <text x={Number(x)} y={Number(y) - 12} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--foreground)">
                      {String(value)}
                    </text>
                  </g>
                ) : null
              }
            />
          </Line>
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

/** Books finished each month, with the plan's monthly target as a reference line. */
export function MonthlyChart({ months, planPerMonth }: { months: MonthStat[]; planPerMonth: number | null }) {
  return (
    <ChartContainer config={monthlyConfig} className="aspect-auto h-56 w-full">
      <BarChart data={months} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={axisTick} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent hideIndicator={false} />} />
        <Bar dataKey="read" fill="var(--color-read)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        {planPerMonth && (
          <ReferenceLine
            y={planPerMonth}
            stroke="var(--chart-plan)"
            strokeWidth={2}
            ifOverflow="extendDomain"
            label={{ value: `Plan ${planPerMonth}/month`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 12, dy: -14 }}
          />
        )}
      </BarChart>
    </ChartContainer>
  );
}
