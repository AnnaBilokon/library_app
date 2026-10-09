import Link from "next/link";
import { Star } from "lucide-react";
import { FORMAT_LABEL, formatMoney, languageLabel } from "@/lib/books/labels";
import { libraryUrl } from "@/lib/books/library-url";
import { SPENDING_SINCE, type Money, type Stats } from "@/lib/stats";
import type { BookFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TimelineChart } from "./stats-charts";

const fmt = (n: number) => n.toLocaleString("en");
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
const SPENDING_START = new Date(`${SPENDING_SINCE}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const money = (m: Money[]) => (m.length ? m.map((x) => formatMoney(x.total, x.currency)).join(" + ") : "—");

/** All-time (or one year's) reading: key numbers, books over time, ratings, genres, authors, pace, money. */
export function StatsView({ stats: s, years }: { stats: Stats; years: number[] }) {
  const scope = s.year === null ? "all years" : String(s.year);
  return (
    <div className="flex flex-col gap-8">
      <YearPicker years={years} current={s.year} />

      {s.readings === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted-foreground ring-1 ring-border/60">
          No finished books {s.year === null ? "yet" : `with a date in ${s.year}`}. Mark books as finished to see your stats.
        </p>
      ) : (
        <>
          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile label="Books read" value={fmt(s.booksRead)} hint={s.year === null && s.undated > 0 ? `${fmt(s.undated)} without a finish date` : undefined} />
            <StatTile
              label="Pages read"
              value={s.pagesKnown ? fmt(s.pages) : "—"}
              hint={s.pagesKnown < s.readings ? `From ${plural(s.pagesKnown, "book", "books")} with a page count` : undefined}
            />
            <StatTile label="Average rating" value={s.averageRating !== null ? `★ ${s.averageRating}` : "—"} />
            <StatTile label="Re-reads" value={fmt(s.rereads)} />
            <StatTile label="Didn't finish" value={fmt(s.dnf)} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card
              title={s.year === null ? "Books per year" : `Books per month in ${s.year}`}
              subtitle={s.year === null && s.undated > 0 ? `Only books with a finish date (${fmt(s.undated)} have none)` : "Books you finished"}
            >
              <TimelineChart timeline={s.timeline} />
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Show the numbers</summary>
                <table className="mt-3 w-full tabular-nums">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-4 font-medium">{s.year === null ? "Year" : "Month"}</th>
                      <th className="py-1.5 pr-4 font-medium">Books</th>
                      <th className="py-1.5 font-medium">Pages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {s.timeline.map((t) => (
                      <tr key={t.label}>
                        <td className="py-1.5 pr-4">{t.label}</td>
                        <td className="py-1.5 pr-4">{t.books}</td>
                        <td className="py-1.5">{t.pages ? fmt(t.pages) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Card>
            <Card title="Your ratings" subtitle={`How you rated the books you finished (${scope})`}>
              <BarList rows={s.ratings.map((r) => ({ key: String(r.stars), label: <Stars n={r.stars} />, value: r.count }))} />
            </Card>
          </div>

          <GenreInsight stats={s} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Genres you read most" subtitle={`Books you finished (${scope}), with your average rating`}>
              <BarList
                rows={s.genresRead.map((g) => ({
                  key: g.label,
                  label: g.label,
                  value: g.count,
                  note: g.rating !== null ? `★ ${g.rating}` : undefined,
                  href: libraryUrl({ genre: [g.label], status: ["finished"], finishedYear: s.year }),
                }))}
                empty="No genres on your finished books yet."
              />
            </Card>
            <Card title="Genres on your shelves" subtitle="Books you own now, and how many of them you haven't read">
              <BarList
                rows={s.genresShelf.map((g) => ({
                  key: g.label,
                  label: g.label,
                  value: g.count,
                  note: g.unread ? `${fmt(g.unread)} unread` : "all read",
                  href: libraryUrl({ genre: [g.label], owned: true }),
                }))}
                empty="No genres on your books yet."
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Authors you read most" subtitle={`Books finished, re-reads included (${scope})`}>
              <BarList rows={s.authors.map((a) => ({ key: a.label, label: a.label, value: a.count, href: libraryUrl({ author: a.label }) }))} empty="No authors yet." />
            </Card>
            <div className="flex flex-col gap-6">
              <PaceCard pace={s.pace} />
              <Card title="Money" subtitle={s.year === null ? "Everything you've noted" : `Bought and sold in ${s.year}`}>
                <dl className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-sm text-muted-foreground">Spent on books</dt>
                    <dd className="text-2xl font-semibold">{money(s.money.spent)}</dd>
                    <dd className="text-xs text-muted-foreground">
                      {s.year !== null && s.year < Number(SPENDING_SINCE.slice(0, 4))
                        ? `Counted from ${SPENDING_START}`
                        : `${plural(s.money.spentBooks, "book", "books")} since ${SPENDING_START}`}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-sm text-muted-foreground">Earned from selling</dt>
                    <dd className="text-2xl font-semibold">{money(s.money.earned)}</dd>
                    <dd className="text-xs text-muted-foreground">
                      <Link href="/sell" className="hover:text-foreground hover:underline">
                        {plural(s.money.soldBooks, "book", "books")} sold
                      </Link>
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AfterReading stats={s} scope={scope} />
            {s.languages.length > 1 && (
                <Card title="Languages" subtitle={`Books you finished (${scope})`}>
                  <BarList rows={s.languages.map((l) => ({ key: l.label, label: languageLabel(l.label), value: l.count }))} />
                </Card>
              )}
              {s.formats.length > 1 && (
                <Card title="Formats" subtitle={`Books you finished (${scope})`}>
                  <BarList rows={s.formats.map((f) => ({ key: f.label, label: FORMAT_LABEL[f.label as BookFormat] ?? f.label, value: f.count }))} />
                </Card>
              )}
          </div>
        </>
      )}
    </div>
  );
}

/** Of the books you read: how many stayed on your shelf, wait on the sell shelf, or were sold. */
function AfterReading({ stats: s, scope }: { stats: Stats; scope: string }) {
  const a = s.afterReading;
  const owned = a.kept + a.forSale + a.sold;
  const keptShare = owned ? Math.round((a.kept / owned) * 100) : null;
  const rows = [
    { key: "kept", label: "Stayed on your shelf", value: a.kept, href: libraryUrl({ status: ["finished"], owned: true, finishedYear: s.year }) },
    { key: "forSale", label: "On the sell shelf", value: a.forSale, href: "/sell" },
    { key: "sold", label: "Sold", value: a.sold, href: "/sell" },
    ...(a.notOwned ? [{ key: "notOwned", label: "Not yours (borrowed or given away)", value: a.notOwned }] : []),
  ];
  return (
    <Card title="After reading" subtitle={`What happened to the books you finished (${scope})`}>
      {keptShare !== null && (
        <p className="text-2xl font-semibold">
          {keptShare}% <span className="text-sm font-normal text-muted-foreground">of the books you owned stayed on your shelf</span>
        </p>
      )}
      <BarList rows={rows} />
    </Card>
  );
}

function YearPicker({ years, current }: { years: number[]; current: number | null }) {
  const options: { label: string; href: string; value: number | null }[] = [
    { label: "All years", href: "/stats", value: null },
    ...years.map((y) => ({ label: String(y), href: `/stats?year=${y}`, value: y })),
  ];
  return (
    <nav aria-label="Year" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-full bg-muted p-1">
        {options.map((o) => (
          <li key={o.label}>
            <Link
              href={o.href}
              aria-current={o.value === current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                o.value === current && "bg-background text-foreground shadow-sm",
              )}
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One sentence comparing what you read with what you own. */
function GenreInsight({ stats: s }: { stats: Stats }) {
  const read = s.genresRead[0];
  const shelf = s.genresShelf[0];
  if (!read || !shelf) return null;
  return (
    <p className="-mb-2 font-heading text-xl leading-snug text-heading text-balance md:text-2xl">
      {read.label === shelf.label ? (
        <>
          <span className="font-semibold">{read.label}</span> leads both what you read and what fills your shelves.
        </>
      ) : (
        <>
          You read <span className="font-semibold">{read.label}</span> most, but <span className="font-semibold">{shelf.label}</span> fills your
          shelves ({plural(shelf.count, "book", "books")}
          {shelf.unread ? `, ${fmt(shelf.unread)} unread` : ""}).
        </>
      )}
    </p>
  );
}

function PaceCard({ pace }: { pace: Stats["pace"] }) {
  return (
    <Card title="Reading pace" subtitle={pace ? `From ${plural(pace.count, "book", "books")} with start and finish dates` : "How long a book takes you"}>
      {pace ? (
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-semibold">
            {plural(pace.averageDays, "day", "days")} <span className="text-sm font-normal text-muted-foreground">per book on average</span>
          </p>
          <dl className="grid gap-1 text-sm">
            <PaceRow label="Fastest" book={pace.fastest} />
            {pace.count > 1 && <PaceRow label="Longest" book={pace.longest} />}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Add start and finish dates to your readings to see how long books take you.</p>
      )}
    </Card>
  );
}

function PaceRow({ label, book }: { label: string; book: { id: string; title: string; days: number } }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">
        <Link href={`/books/${book.id}`} className="font-medium hover:underline">
          {book.title}
        </Link>{" "}
        <span className="text-muted-foreground">· {plural(book.days, "day", "days")}</span>
      </dd>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} ${n === 1 ? "star" : "stars"}`}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="size-3.5 fill-current text-amber-500" aria-hidden />
      ))}
    </span>
  );
}

interface BarRow {
  key: string;
  label: React.ReactNode;
  value: number;
  note?: string;
  href?: string;
}

/** Horizontal bars with the number written next to each, so nothing depends on reading the bar. */
function BarList({ rows, empty }: { rows: BarRow[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const label = r.href ? (
          <Link href={r.href} className="truncate hover:underline">
            {r.label}
          </Link>
        ) : (
          <span className="truncate">{r.label}</span>
        );
        return (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 font-medium">{label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{fmt(r.value)}</span>
                {r.note && <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-chart-actual" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold text-heading">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
