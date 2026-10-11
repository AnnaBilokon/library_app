import type { HeatDay } from "@/lib/habits";
import { formatDate } from "@/lib/books/labels";

const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** Shade for a day: none, too short to count, then darker the longer you read. */
function shade(d: HeatDay, min: number): React.CSSProperties {
  if (d.future) return { background: "transparent" };
  if (d.minutes === 0) return { background: "var(--muted)" };
  if (!d.counted) return { background: "color-mix(in oklab, var(--chart-actual) 22%, var(--card))" };
  const strength = d.minutes >= min * 3 ? 100 : d.minutes >= min * 2 ? 80 : 60;
  return { background: `color-mix(in oklab, var(--chart-actual) ${strength}%, var(--card))` };
}

/** The last half year as a grid of days (weeks left to right, Monday at the top). */
export function Heatmap({ weeks, minMinutes }: { weeks: HeatDay[][]; minMinutes: number }) {
  return (
    <div className="flex flex-col gap-2 overflow-x-auto pb-1">
      <div className="flex gap-1 pl-8 text-[10px] text-muted-foreground" aria-hidden>
        {weeks.map((w, i) => (
          <span key={w[0].date} className="w-3.5 shrink-0">
            {(i === 0 || w[0].date.slice(5, 7) !== weeks[i - 1][0].date.slice(5, 7)) && month.format(new Date(`${w[0].date}T00:00:00Z`))}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <div className="flex w-7 shrink-0 flex-col gap-1 text-[10px] text-muted-foreground" aria-hidden>
          {DAYS.map((d, i) => (
            <span key={i} className="h-3.5 leading-3.5">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0].date} className="flex shrink-0 flex-col gap-1">
            {w.map((d) => (
              <span
                key={d.date}
                className="size-3.5 rounded-[3px]"
                style={shade(d, minMinutes)}
                title={d.future ? undefined : `${formatDate(d.date)}: ${d.minutes ? `${d.minutes} min` : "no reading"}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 pl-8 text-[11px] text-muted-foreground">
        Less
        {[0, 1, 60, 80, 100].map((s, i) => (
          <span
            key={i}
            className="size-3 rounded-[3px]"
            style={{ background: s === 0 ? "var(--muted)" : `color-mix(in oklab, var(--chart-actual) ${s === 1 ? 22 : s}%, var(--card))` }}
            aria-hidden
          />
        ))}
        More · lightest: under {minMinutes} min
      </p>
    </div>
  );
}
