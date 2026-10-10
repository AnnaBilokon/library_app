"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { Check, ChevronDown, LayoutGrid, Loader2, Pencil, Rows3, Target, TrendingDown, TrendingUp, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { setYearlyGoal } from "@/app/actions/goals";
import { BookCover } from "@/components/books/book-cover";
import { RatingStars } from "@/components/books/rating-stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { challengeYears, computeChallenge, type Challenge } from "@/lib/challenge";
import { formatDate } from "@/lib/books/labels";
import { BOOKS_READ_VIEW_COOKIE, type BooksReadView } from "@/lib/books/layout";
import { libraryUrl } from "@/lib/books/library-url";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MonthlyChart, ProgressChart } from "./challenge-charts";
import { BookishFacts } from "./bookish-facts";
import { ChallengeRing } from "./challenge-ring";
import { GenreDonut } from "./genre-donut";
import { YearShelf } from "./year-shelf";
import { bookishFacts, genreSlices, genreTiles, shelfBooks } from "@/lib/bookish";
import { WorldReadingSection } from "@/components/countries/world-reading";
import type { AuthorCountries } from "@/lib/countries";

const plural = (n: number, one: string, many: string) => `${n} ${Math.abs(n) === 1 ? one : many}`;
const fmt = (n: number) => new Intl.NumberFormat("en-GB").format(n);

export function ChallengeView({
  books,
  goals,
  initialBooksView = "list",
  authorCountries = {},
  countriesGoal = null,
}: {
  /** Read around the world goal (all years). */
  countriesGoal?: number | null;
  books: Book[];
  /** Where your authors are from, for the world map. */
  authorCountries?: AuthorCountries;
  goals: Record<number, number>;
  /** List or grid for "Books read", from a cookie. */
  initialBooksView?: BooksReadView;
}) {
  const today = todayLocal();
  const currentYear = Number(today.slice(0, 4));
  // The year lives in the URL (?year=2025), so a past year can be bookmarked.
  const [year, setYear] = useQueryState("year", parseAsInteger.withDefault(currentYear));
  const years = useMemo(() => challengeYears(books, currentYear, Object.keys(goals).map(Number)), [books, currentYear, goals]);
  const goal = goals[year] ?? null;
  const c = useMemo(() => computeChallenge(books, year, goal, today), [books, year, goal, today]);
  const shelf = useMemo(() => shelfBooks(books, year), [books, year]);
  const facts = useMemo(() => bookishFacts(shelf), [shelf]);
  const slices = useMemo(() => genreSlices(books, year), [books, year]);
  const tiles = useMemo(() => genreTiles(books, year), [books, year]);
  const undated = useMemo(() => books.reduce((n, b) => n + b.readings.filter((r) => r.outcome === "finished" && !r.finishedAt).length, 0), [books]);

  return (
    <div className="flex flex-col gap-8">
      {/* Filters: one row, above everything they scope. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Year">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={y === year}
            onClick={() => void setYear(y === currentYear ? null : y)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              y === year && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <Headline challenge={c} />

      {c.read > 0 && (
        <Link href={`/year-in-books?year=${c.year}`} className="-mt-3 inline-flex w-fit items-center gap-2 self-end rounded-full bg-muted px-4 py-2 text-sm font-medium hover:bg-secondary">
          ✨ Your {c.year} in books →
        </Link>
      )}

      <YearShelf books={shelf} goal={goal} year={c.year} genres={tiles} />

      <BooksRead books={books} year={c.year} initialView={initialBooksView} />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Pages read" value={fmt(c.pages)} />
        <StatTile label="Average per month" value={String(c.averagePerMonth)} />
        <StatTile label="Best month" value={c.bestMonth ? `${c.bestMonth.month} · ${c.bestMonth.read}` : "—"} />
        {c.year === currentYear ? (
          <StatTile label="At this pace" value={c.projected !== null ? plural(c.projected, "book", "books") : "—"} />
        ) : (
          <StatTile label="Books finished" value={String(c.read)} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Progress vs plan" subtitle={goal ? `Books read so far in ${c.year}, against a steady pace to ${goal}` : `Books read so far in ${c.year}`}>
          <ProgressChart months={c.months} goal={goal} />
        </ChartCard>
        <ChartCard title="Books per month" subtitle={c.planPerMonth ? `The line is your plan: ${c.planPerMonth} a month` : "Set a goal to see your monthly target"}>
          <MonthlyChart months={c.months} planPerMonth={c.planPerMonth} />
        </ChartCard>
      </div>

      {/* The same numbers as a table, so nothing depends on reading a chart or hovering. */}
      <details className="group rounded-2xl bg-card p-5 ring-1 ring-border/60">
        <summary className="cursor-pointer text-sm font-medium">Show the monthly numbers</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Finished</th>
                <th className="py-2 pr-4 font-medium">Total so far</th>
                {goal && <th className="py-2 pr-4 font-medium">Plan</th>}
                <th className="py-2 font-medium">Pages</th>
              </tr>
            </thead>
            <tbody>
              {c.months.map((m) => (
                <tr key={m.month} className="border-t border-border/60">
                  <td className="py-2 pr-4">{m.month}</td>
                  <td className="py-2 pr-4">{m.read}</td>
                  <td className="py-2 pr-4">{m.cumulative ?? "—"}</td>
                  {goal && <td className="py-2 pr-4">{m.plan}</td>}
                  <td className="py-2">{m.pages ? fmt(m.pages) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-2">
        <GenreDonut slices={slices} year={c.year} />
        <BookishFacts facts={facts} year={c.year} />
      </div>

      <WorldReadingSection books={books} map={authorCountries} year={c.year} countriesGoal={countriesGoal} />

      {undated > 0 && (
        <p className="text-sm text-muted-foreground">
          {plural(undated, "finished reading has", "finished readings have")} no finish date, so {undated === 1 ? "it isn't" : "they aren't"} counted in any year.{" "}
          <Link href={libraryUrl({ status: ["finished"], sort: "finished", dir: "desc" })} className="font-medium text-primary underline-offset-4 hover:underline dark:text-highlight">
            Add dates
          </Link>{" "}
          (they&apos;re under &ldquo;Date unknown&rdquo;).
        </p>
      )}
    </div>
  );
}

function Headline({ challenge: c }: { challenge: Challenge }) {
  const pct = c.goal ? Math.min(100, Math.round((c.read / c.goal) * 100)) : 0;
  return (
    <section aria-labelledby="challenge-title" className="flex flex-col gap-6 rounded-3xl bg-accent/70 p-6 md:p-8 dark:bg-accent/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="challenge-title" className="font-heading text-xl font-semibold text-heading md:text-2xl">
            {c.year} reading challenge
          </h2>
          <GoalEditor year={c.year} goal={c.goal} />
        </div>
        <StatusChip challenge={c} />
      </div>

      {c.goal ? (
        <>
          {/* The ring draws itself and the count rises when it scrolls into view. */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <ChallengeRing challenge={c} />
            <div className="flex flex-col gap-2 text-center sm:text-left">
              <p className="text-lg">
                <span className="font-semibold">{plural(c.read, "book", "books")}</span> of {c.goal} <span className="text-muted-foreground">({pct}%)</span>
              </p>
              <p className="text-[15px]">
                <PaceSentence challenge={c} />
              </p>
              {c.elapsed > 0 && c.elapsed < 1 && (
                <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
                  <span className="inline-block h-3 w-1 rounded-full bg-chart-plan" aria-hidden /> The tick on the ring is where the plan says you&apos;d be today.
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-[15px]">
          {c.read > 0 ? `You've finished ${plural(c.read, "book", "books")} in ${c.year}. ` : ""}
          Set a goal to see your plan, the pace you need and whether you&apos;re on track.
        </p>
      )}
    </section>
  );
}

function PaceSentence({ challenge: c }: { challenge: Challenge }) {
  if (!c.goal) return null;
  if (c.status === "met") {
    const over = c.read - c.goal;
    return <>Goal reached{over > 0 ? `, and ${plural(over, "book", "books")} over` : ""}. Well done!</>;
  }
  if (c.status === "missed") return <>You finished {c.read} of {c.goal}: {plural(c.goal - c.read, "book", "books")} short of the goal.</>;
  if (c.status === "not-started") return <>The year hasn&apos;t started yet. The plan is {c.planPerMonth} books a month.</>;
  return (
    <>
      {plural(c.remaining, "book", "books")} to go. To finish on time, read about <strong>{c.neededPerMonth} a month</strong> for the rest of the year
      {c.planPerMonth !== null && c.neededPerMonth !== null && c.neededPerMonth !== c.planPerMonth && <> (the plan was {c.planPerMonth})</>}.
    </>
  );
}

/** Status: always an icon and words, never colour alone. */
function StatusChip({ challenge: c }: { challenge: Challenge }) {
  const map = {
    ahead: { icon: TrendingUp, text: `${plural(c.difference, "book", "books")} ahead of plan`, tone: "good" },
    "on-track": { icon: Check, text: "On track", tone: "good" },
    behind: { icon: TrendingDown, text: `${plural(-c.difference, "book", "books")} behind plan`, tone: "warn" },
    met: { icon: Trophy, text: "Goal reached", tone: "good" },
    missed: { icon: X, text: "Goal missed", tone: "warn" },
    "not-started": { icon: Target, text: "Not started yet", tone: "neutral" },
    "no-goal": { icon: Target, text: "No goal yet", tone: "neutral" },
  } as const;
  const s = map[c.status];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
        s.tone === "good" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
        s.tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        s.tone === "neutral" && "bg-background text-muted-foreground",
      )}
    >
      <s.icon className="size-4" aria-hidden />
      {s.text}
    </span>
  );
}

function GoalEditor({ year, goal }: { year: number; goal: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goal ? String(goal) : "");
  const [pending, startTransition] = useTransition();

  const save = (next: number | null) =>
    startTransition(async () => {
      const r = await setYearlyGoal(year, next);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(next ? `Goal for ${year}: ${plural(next, "book", "books")}` : "Goal removed");
      setOpen(false);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          />
        }
      >
        {goal ? (
          <>
            Goal: {plural(goal, "book", "books")} <Pencil className="size-3.5" aria-hidden />
          </>
        ) : (
          <span className="font-medium text-primary dark:text-highlight">Set a goal for {year}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(value.trim() ? Number(value) : null);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Books to read in {year}
            <Input type="number" inputMode="numeric" min={1} max={1000} value={value} onChange={(e) => setValue(e.target.value)} className="h-10" autoFocus />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="rounded-full px-4" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save
            </Button>
            {goal && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => save(null)} disabled={pending}>
                Remove goal
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-semibold text-heading">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

/** Remember the list/grid choice so the server renders it next time. */
function rememberBooksReadView(view: BooksReadView) {
  document.cookie = `${BOOKS_READ_VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The books finished in the year, grouped by month, as a compact list or a grid of small covers
 * (collapsed until opened). The view choice is remembered in a cookie.
 */
function BooksRead({ books, year, initialView }: { books: Book[]; year: number; initialView: BooksReadView }) {
  const [view, setView] = useState<BooksReadView>(initialView);
  const choose = (next: BooksReadView) => {
    rememberBooksReadView(next);
    setView(next);
  };

  const entries = books
    .flatMap((book) =>
      book.readings
        .filter((r) => r.outcome === "finished" && r.finishedAt?.startsWith(String(year)))
        .map((reading) => ({ book, reading, date: reading.finishedAt! })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = new Map<number, typeof entries>();
  for (const e of entries) {
    const m = Number(e.date.slice(5, 7)) - 1;
    byMonth.set(m, [...(byMonth.get(m) ?? []), e]);
  }

  return (
    <details className="group rounded-2xl bg-card p-5 ring-1 ring-border/60">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-heading text-lg font-semibold text-heading">
        <span>
          Books read in {year} <span className="font-sans text-sm font-normal text-muted-foreground">({entries.length})</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No finished books with a date in {year} yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex justify-end">
            <div className="flex rounded-full bg-muted p-1" role="group" aria-label="View">
              {(
                [
                  ["list", Rows3, "List"],
                  ["grid", LayoutGrid, "Grid"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => choose(value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    view === value && "bg-background text-foreground shadow-sm",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
          {[...byMonth].map(([month, list]) => (
            <section key={month} aria-label={MONTH_NAMES[month]}>
              <h4 className="mb-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {MONTH_NAMES[month]} · {list.length}
              </h4>
              {view === "list" ? (
                <ul className="divide-y divide-border/60">
                  {list.map(({ book, reading, date }) => (
                    <li key={reading.id}>
                      <Link href={`/books/${book.id}`} className="flex items-center gap-3 rounded-md py-2 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                        <BookCover title={book.title} src={book.coverSrc} sizes="32px" className="w-8 shrink-0" compact />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span lang={book.language} className="truncate font-heading text-sm font-semibold text-heading">
                            {book.title}
                          </span>
                          {book.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>}
                        </span>
                        <span className="hidden sm:block">
                          <RatingStars value={reading.rating ?? book.rating} size="sm" />
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{formatDate(date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-10">
                  {list.map(({ book, reading, date }) => (
                    <li key={reading.id}>
                      <Link href={`/books/${book.id}`} className="group/book flex flex-col gap-1.5 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                        <BookCover
                          title={book.title}
                          authors={book.authors}
                          src={book.coverSrc}
                          lang={book.language}
                          sizes="(min-width: 1024px) 110px, (min-width: 640px) 18vw, 30vw"
                          className="transition-transform group-hover/book:-translate-y-0.5"
                        />
                        <span lang={book.language} className="line-clamp-2 font-heading text-xs leading-snug font-semibold text-heading group-hover/book:underline">
                          {book.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                          <RatingStars value={reading.rating ?? book.rating} size="sm" className="[&_svg]:size-3" />
                          <span className="tabular-nums">{formatDate(date).replace(/ \d{4}$/, "")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </details>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
