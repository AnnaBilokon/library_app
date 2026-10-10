"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Crown, Minus, PartyPopper, Swords, ThumbsDown } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { Flag } from "@/components/countries/flag";
import { BookishFacts } from "@/components/dashboard/bookish-facts";
import { useCountUp, useInView } from "@/components/dashboard/motion";
import { YearShelf } from "@/components/dashboard/year-shelf";
import { formatMoney } from "@/lib/books/labels";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { YearInBooks } from "@/lib/year-in-books";

const fmt = (n: number) => n.toLocaleString("en");
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
const money = (m: { total: number; currency: string }[]) => m.map((x) => formatMoney(x.total, x.currency)).join(" + ");

/** A part of the story that rises into place the first time you scroll to it. */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn(inView ? "story-in" : "opacity-0 motion-reduce:opacity-100", className)}>
      {children}
    </div>
  );
}

/** Your year in books, told from top to bottom: the totals, the best book, the top picks, the months, the numbers. */
export function YearStory({ y, years }: { y: YearInBooks; years: number[] }) {
  const [heroRef, heroIn] = useInView<HTMLDivElement>();
  const books = useCountUp(y.books, heroIn, 1600);
  const pages = useCountUp(y.pages, heroIn, 1600);
  const champion = y.bestOfYear ?? y.topRated;

  return (
    <div className="flex flex-col gap-16 pb-10">
      <nav aria-label="Year" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-1 rounded-full bg-muted p-1">
          {years.map((yr) => (
            <li key={yr}>
              <Link
                href={`/year-in-books?year=${yr}`}
                aria-current={yr === y.year ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  yr === y.year && "bg-background text-foreground shadow-sm",
                )}
              >
                {yr}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* The opening: two big numbers counting up. */}
      <section ref={heroRef} aria-label="Totals" className="flex flex-col items-center gap-4 rounded-[2rem] bg-gradient-to-br from-highlight/60 via-card to-accent/70 px-6 py-14 text-center ring-1 ring-border/60">
        <p className="text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase">Your year in books</p>
        <h2 className="font-heading text-6xl font-semibold text-heading md:text-8xl">{y.year}</h2>
        <p className="font-heading text-3xl text-heading md:text-4xl">
          <span className="font-semibold tabular-nums">{fmt(books)}</span> {y.books === 1 ? "book" : "books"}
          {y.pages > 0 && (
            <>
              {" · "}
              <span className="font-semibold tabular-nums">{fmt(pages)}</span> pages
            </>
          )}
        </p>
        {y.goal && (
          <p className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", y.goal.met ? "bg-chart-actual text-white" : "bg-muted")}>
            {y.goal.met && <PartyPopper className="size-4" aria-hidden />}
            {y.goal.met ? `Goal of ${y.goal.goal} reached!` : `${y.books} of your ${y.goal.goal}-book goal`}
          </p>
        )}
        {y.averageRating !== null && <p className="text-sm text-muted-foreground">Average rating ★ {y.averageRating}</p>}
      </section>

      {champion && (
        <Reveal>
          <section aria-labelledby="best-title" className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="relative w-44 shrink-0 md:w-52">
              <BookCover title={champion.title} authors={champion.authors} src={champion.coverSrc} lang={champion.language} sizes="208px" className="shadow-book-hover" />
              <span className="absolute -top-3 -right-3 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Crown className="size-5" aria-hidden />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <p id="best-title" className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                {y.bestOfYear ? "Book of the year · your Book Battle winner" : `Your top-rated book${y.topRated ? ` · ★ ${y.topRated.rating}` : ""}`}
              </p>
              <Link href={`/books/${champion.id}`} lang={champion.language} className="font-heading text-4xl leading-tight font-semibold text-balance text-heading hover:underline md:text-5xl">
                {champion.title}
              </Link>
              {champion.authors.length > 0 && <p className="text-xl text-muted-foreground">{champion.authors.join(", ")}</p>}
              {!y.bestOfYear && (
                <Link href={`/battle?year=${y.year}`} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
                  <Swords className="size-4" aria-hidden /> Decide your book of the year in the Book Battle
                </Link>
              )}
              {y.worstOfYear && <SmallBook book={y.worstOfYear} label="…and the one you'd rather forget" icon={<ThumbsDown className="size-4" aria-hidden />} />}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section aria-label="Your favourites" className="grid gap-4 sm:grid-cols-3">
          <Tile label="Most-read author" value={y.topAuthor?.name ?? "—"} note={y.topAuthor ? plural(y.topAuthor.books, "book", "books") : undefined} />
          <Tile label="Most-read genre" value={y.topGenre?.name ?? "—"} note={y.topGenre ? plural(y.topGenre.books, "book", "books") : undefined} />
          <Tile
            label="Most-read country"
            value={y.topCountry ? y.topCountry.name : "—"}
            flag={y.topCountry?.code}
            note={y.topCountry ? `${plural(y.topCountry.books.length, "book", "books")} · ${plural(y.countries, "country", "countries")} in all` : undefined}
          />
        </section>
      </Reveal>

      {(y.newAuthors > 0 || y.newCountries.length > 0) && (
        <Reveal>
          <section aria-labelledby="new-title" className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border/60 md:p-8">
            <h2 id="new-title" className="font-heading text-2xl font-semibold text-heading">
              New discoveries
            </h2>
            <p className="text-lg">
              <span className="font-semibold">{plural(y.newAuthors, "new author", "new authors")}</span>
              {y.newCountries.length > 0 && (
                <>
                  {" and "}
                  <span className="font-semibold">{plural(y.newCountries.length, "new country", "new countries")}</span> on your map
                </>
              )}
              .
            </p>
            {y.newCountries.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {y.newCountries.map((c) => (
                  <li key={c.code} className="inline-flex h-9 items-center gap-2 rounded-full bg-muted/70 pr-3.5 pl-2.5 text-sm font-medium">
                    <Flag code={c.code} decorative className="h-3.5 w-[21px]" />
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>
      )}

      <Reveal>
        <MonthBars months={y.months} best={y.bestMonth} />
      </Reveal>

      <Reveal>
        <YearShelf books={y.shelf} goal={y.goal?.goal ?? null} year={y.year} genres={y.genres} />
      </Reveal>

      <Reveal>
        <BookishFacts facts={y.facts} year={y.year} />
      </Reveal>

      {y.favourites.length > 0 && (
        <Reveal>
          <section aria-labelledby="fav-title" className="flex flex-col gap-4">
            <h2 id="fav-title" className="font-heading text-2xl font-semibold text-heading">
              Your favourites
            </h2>
            <ul className="flex flex-wrap gap-5">
              {y.favourites.slice(0, 8).map((b) => (
                <li key={b.id} className="w-24 md:w-28">
                  <Link href={`/books/${b.id}`} className="flex flex-col gap-1.5">
                    <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="112px" />
                    <span lang={b.language} className="line-clamp-2 text-xs font-medium">
                      {b.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {(y.spent.length > 0 || y.earned.length > 0) && (
        <Reveal>
          <section aria-label="Money" className="grid gap-4 sm:grid-cols-2">
            <Tile label="Spent on books" value={y.spent.length ? money(y.spent) : "—"} />
            <Tile label="Earned from selling" value={y.earned.length ? money(y.earned) : "—"} note={y.sold ? plural(y.sold, "book sold", "books sold") : undefined} />
          </section>
        </Reveal>
      )}

      {y.previous && (
        <Reveal>
          <section aria-labelledby="compare-title" className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border/60 md:p-8">
            <h2 id="compare-title" className="font-heading text-2xl font-semibold text-heading">
              Compared with {y.year - 1}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Delta label="Books" now={y.books} before={y.previous.books} />
              <Delta label="Pages" now={y.pages} before={y.previous.pages} />
              <Delta label="Average rating" now={y.averageRating} before={y.previous.averageRating} decimals />
            </div>
          </section>
        </Reveal>
      )}

      <p className="text-center text-sm text-muted-foreground">
        More in{" "}
        <Link href={`/stats?year=${y.year}`} className="underline underline-offset-4">
          Stats
        </Link>{" "}
        and on the{" "}
        <Link href={`/?year=${y.year}`} className="underline underline-offset-4">
          Dashboard
        </Link>
        .
      </p>
    </div>
  );
}

function SmallBook({ book, label, icon }: { book: Book; label: string; icon: React.ReactNode }) {
  return (
    <Link href={`/books/${book.id}`} className="mt-3 inline-flex items-center gap-3 rounded-2xl bg-muted/60 p-2.5 pr-4 text-left hover:bg-muted">
      <BookCover title={book.title} src={book.coverSrc} sizes="40px" className="w-10 shrink-0" compact />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span lang={book.language} className="truncate font-medium">
          {book.title}
        </span>
      </span>
    </Link>
  );
}

function Tile({ label, value, note, flag }: { label: string; value: string; note?: string; flag?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-3xl bg-card p-5 ring-1 ring-border/60">
      <span className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{label}</span>
      <span className="flex items-center gap-2 font-heading text-2xl leading-tight font-semibold text-heading">
        {flag && <Flag code={flag} decorative className="h-4 w-6" />}
        <span className="min-w-0 break-words">{value}</span>
      </span>
      {note && <span className="text-sm text-muted-foreground">{note}</span>}
    </div>
  );
}

/** Books per month as bars that grow when they come into view; the best month stands out. */
function MonthBars({ months, best }: { months: { label: string; books: number }[]; best: { label: string; books: number } | null }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const max = Math.max(1, ...months.map((m) => m.books));
  return (
    <section aria-labelledby="months-title" className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border/60 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="months-title" className="font-heading text-2xl font-semibold text-heading">
          Month by month
        </h2>
        {best && <p className="text-sm text-muted-foreground">Best month: {best.label}, with {plural(best.books, "book", "books")}</p>}
      </div>
      <div ref={ref} className="flex h-44 items-end gap-1.5 sm:gap-3" role="img" aria-label={months.map((m) => `${m.label} ${m.books}`).join(", ")}>
        {months.map((m, i) => (
          <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold tabular-nums">{m.books || ""}</span>
            <div
              className={cn("w-full max-w-10 rounded-t-[4px] transition-[height] duration-700 ease-out motion-reduce:transition-none", m.label === best?.label ? "bg-chart-actual" : "bg-chart-actual/45")}
              style={{ height: inView ? `${(m.books / max) * 100}%` : "0%", transitionDelay: `${i * 50}ms`, minHeight: m.books ? 4 : 0 }}
            />
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Delta({ label, now, before, decimals }: { label: string; now: number | null; before: number | null; decimals?: boolean }) {
  const diff = now !== null && before !== null ? (decimals ? Math.round((now - before) * 10) / 10 : now - before) : null;
  const Icon = diff === null || diff === 0 ? Minus : diff > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{now === null ? "—" : decimals ? `★ ${now}` : fmt(now)}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {diff === null ? "nothing to compare" : diff === 0 ? "the same as before" : `${diff > 0 ? "+" : ""}${decimals ? diff : fmt(diff)} vs ${before === null ? "—" : decimals ? `★ ${before}` : fmt(before)}`}
      </span>
    </div>
  );
}
