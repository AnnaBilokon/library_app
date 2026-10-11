import type { Achievement } from "@/lib/habits";
import { formatDate } from "@/lib/books/labels";
import { cn } from "@/lib/utils";

const status = (a: Achievement) =>
  a.unlocked ? `earned ${a.on ? formatDate(a.on) : ""}`.trim() : a.progress ? `${a.progress.value} of ${a.progress.target}` : "not yet";

/** Small round badges: in colour once earned, greyed out (with how far along you are) until then. */
export function BadgeRow({ achievements }: { achievements: Achievement[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Badges">
      {achievements.map((a) => (
        <li key={a.id}>
          <span
            title={`${a.title}: ${a.description} (${status(a)})`}
            aria-label={`${a.title}, ${status(a)}`}
            className={cn(
              "grid size-10 place-items-center rounded-full text-xl ring-1",
              a.unlocked ? "bg-highlight/70 ring-highlight shadow-sm" : "bg-muted opacity-50 ring-border grayscale",
            )}
          >
            {a.emoji}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Every badge with its name, what it takes, and when you earned it or how far along you are. */
export function BadgeGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {achievements.map((a) => (
        <li key={a.id} className={cn("flex items-center gap-3 rounded-2xl p-3 ring-1", a.unlocked ? "bg-highlight/25 ring-highlight/60" : "bg-muted/40 ring-border/60")}>
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-2xl", a.unlocked ? "bg-highlight/70 shadow-sm" : "bg-muted opacity-50 grayscale")} aria-hidden>
            {a.emoji}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold">{a.title}</span>
            <span className="text-xs text-muted-foreground">{a.description}</span>
            {a.unlocked ? (
              <span className="text-xs font-medium">Earned {a.on && formatDate(a.on)}</span>
            ) : (
              a.progress && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span className="h-1.5 w-20 rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-chart-actual" style={{ width: `${(a.progress.value / a.progress.target) * 100}%` }} />
                  </span>
                  {a.progress.value} / {a.progress.target}
                </span>
              )
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
