"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crown, Loader2, ThumbsDown, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { setBattlePick } from "@/app/actions/battle";
import { BookCover } from "@/components/books/book-cover";
import type { BattleState, Bracket, MonthRound, QuarterRound, Round } from "@/lib/battle";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const COPY: Record<Bracket, { pick: string; badge: string; champion: (y: number) => string; icon: typeof Crown }> = {
  best: { pick: "Pick the best", badge: "Best", champion: (y) => `Book of the year ${y}`, icon: Crown },
  worst: { pick: "Pick the worst", badge: "Worst", champion: (y) => `Worst book of ${y}`, icon: ThumbsDown },
};

/** Saves picks; while one is saving, the whole board waits so rounds can't get out of step. */
function useSave(year: number, bracket: Bracket) {
  const [pending, startTransition] = useTransition();
  const save = (slot: string, bookId: string | null) =>
    startTransition(async () => {
      const r = await setBattlePick(year, bracket, slot, bookId);
      if (!r.ok) toast.error(r.error);
    });
  return { pending, save };
}

export function BattleBoard({ battle, years }: { battle: BattleState; years: number[] }) {
  const { year, bracket } = battle;
  const { pending, save } = useSave(year, bracket);
  const copy = COPY[bracket];

  return (
    <div className={cn("flex flex-col gap-8", pending && "cursor-progress")} aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          label="Bracket"
          options={[
            { label: "Best books", href: `/battle?year=${year}`, active: bracket === "best" },
            { label: "Worst books", href: `/battle?year=${year}&bracket=worst`, active: bracket === "worst" },
          ]}
        />
        <Pills
          label="Year"
          options={years.map((y) => ({ label: String(y), href: `/battle?year=${y}${bracket === "worst" ? "&bracket=worst" : ""}`, active: y === year }))}
        />
      </div>

      <Champion battle={battle} />

      <Section title="Months and quarters" hint={`${copy.pick} book of each month. Then keep two of each quarter's three winners, and pick one.`}>
        <div className="grid gap-6 xl:grid-cols-2">
          {battle.quarters.map((q) => (
            <QuarterCard key={q.quarter} quarter={q} bracket={bracket} pending={pending} save={save} />
          ))}
        </div>
      </Section>

      <Section title="Semi-finals" hint="Jan – Jun against itself, and Jul – Dec against itself.">
        <div className="grid gap-6 md:grid-cols-2">
          {battle.semis.map((s, i) => (
            <Card key={s.slot} title={i === 0 ? "Semi-final 1 · Q1 v Q2" : "Semi-final 2 · Q3 v Q4"}>
              <DuelOrStatus round={s} bracket={bracket} pending={pending} save={save} waiting="Waits for both quarters." />
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Final" hint="The last two books standing.">
        <Card title={copy.champion(year)}>
          <DuelOrStatus round={battle.final} bracket={bracket} pending={pending} save={save} waiting="Waits for both semi-finals." large />
        </Card>
      </Section>
    </div>
  );
}

function Champion({ battle }: { battle: BattleState }) {
  const copy = COPY[battle.bracket];
  const Icon = copy.icon;
  const champ = battle.champion;
  const left = [
    ...battle.quarters.flatMap((q) => [...q.months.filter((m) => m.open && !m.winner), ...(q.keep.open && !q.keep.dropped ? [q.keep] : []), ...(q.duel.open && !q.duel.winner ? [q.duel] : [])]),
    ...battle.semis.filter((s) => s.open && !s.winner),
    ...(battle.final.open && !battle.final.winner ? [battle.final] : []),
  ].length;
  return (
    <section
      aria-label={copy.champion(battle.year)}
      className={cn(
        "flex flex-wrap items-center gap-5 rounded-3xl px-5 py-6 md:px-8",
        battle.bracket === "best" ? "bg-highlight text-highlight-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {champ ? (
        <>
          <div className="w-24 shrink-0 md:w-28">
            <BookCover title={champ.title} authors={champ.authors} src={champ.coverSrc} lang={champ.language} sizes="112px" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
              <Icon className="size-4" aria-hidden />
              {copy.champion(battle.year)}
            </p>
            <Link href={`/books/${champ.id}`} lang={champ.language} className="font-heading text-3xl leading-tight font-semibold text-balance hover:underline md:text-4xl">
              {champ.title}
            </Link>
            {champ.authors.length > 0 && <p className="text-lg opacity-80">{champ.authors.join(", ")}</p>}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-4">
          <Trophy className="size-10 shrink-0 opacity-70" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-2xl font-semibold">{copy.champion(battle.year)}: not decided yet</p>
            <p className="text-sm opacity-80">
              {left > 0 ? `${left} ${left === 1 ? "choice is" : "choices are"} waiting for you below.` : "New rounds open as the months go by."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function QuarterCard({ quarter: q, bracket, pending, save }: { quarter: QuarterRound; bracket: Bracket; pending: boolean; save: (slot: string, id: string | null) => void }) {
  const champ = q.duel.winner;
  return (
    <Card title={`Q${q.quarter + 1} · ${q.label}`} aside={champ ? <WinnerTag book={champ} bracket={bracket} /> : null}>
      <ol className="flex flex-col divide-y divide-border/60">
        {q.months.map((m) => (
          <li key={m.slot} className="py-3 first:pt-0">
            <MonthPick month={m} bracket={bracket} pending={pending} save={save} />
          </li>
        ))}
      </ol>
      {q.keep.open && <KeepTwo round={q.keep} bracket={bracket} pending={pending} save={save} />}
      {(q.duel.open || q.duel.auto) && q.duel.options.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4">
          <h4 className="text-sm font-semibold">{q.duel.auto ? "Quarter champion" : `${COPY[bracket].pick} of the quarter`}</h4>
          {q.duel.auto ? (
            <p className="text-sm text-muted-foreground">Only one book made it this far, so it wins the quarter.</p>
          ) : null}
          <Choice round={q.duel} bracket={bracket} pending={pending} onPick={(id) => save(q.duel.slot, id)} />
        </div>
      )}
    </Card>
  );
}

function MonthPick({ month: m, bracket, pending, save }: { month: MonthRound; bracket: Bracket; pending: boolean; save: (slot: string, id: string | null) => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      <div className="flex w-28 shrink-0 flex-col">
        <span className="text-sm font-semibold">{MONTH_NAMES[m.month]}</span>
        <span className="text-xs text-muted-foreground">
          {m.future
            ? "Not yet"
            : m.options.length === 0
              ? "No finished books"
              : m.auto
                ? "Only book, goes through"
                : m.winner
                  ? `${COPY[bracket].badge} of ${m.options.length}`
                  : `${COPY[bracket].pick} of ${m.options.length}`}
        </span>
      </div>
      {m.options.length > 0 && <Choice round={m} bracket={bracket} pending={pending} onPick={(id) => save(m.slot, id)} small />}
    </div>
  );
}

/** Three monthly winners: choose the two that go on (the third is knocked out). */
function KeepTwo({ round, bracket, pending, save }: { round: Round & { dropped: Book | null }; bracket: Bracket; pending: boolean; save: (slot: string, id: string | null) => void }) {
  const [editing, setEditing] = useState(!round.dropped);
  const [kept, setKept] = useState<string[]>([]);
  const toggle = (id: string) => {
    if (!editing) {
      setEditing(true);
      setKept([id]);
      return;
    }
    const next = kept.includes(id) ? kept.filter((k) => k !== id) : [...kept, id];
    if (next.length === 2) {
      const out = round.options.find((b) => !next.includes(b.id))!;
      setEditing(false);
      if (out.id !== round.dropped?.id) save(round.slot, out.id);
    }
    setKept(next.length === 2 ? [] : next);
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4">
      <h4 className="text-sm font-semibold">Keep two</h4>
      <p className="text-sm text-muted-foreground">
        {editing ? `Choose the two monthly winners that go on (${kept.length} of 2).` : "Tap a book to choose again."}
      </p>
      <ul className="flex flex-wrap gap-4">
        {round.options.map((b) => {
          const out = !editing && round.dropped?.id === b.id;
          const selected = editing ? kept.includes(b.id) : !out;
          return (
            <li key={b.id}>
              <CoverButton book={b} selected={selected} dimmed={out} disabled={pending} onClick={() => toggle(b.id)} bracket={bracket} tag={out ? "Out" : selected && !editing ? "Through" : undefined} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DuelOrStatus({
  round,
  bracket,
  pending,
  save,
  waiting,
  large,
}: {
  round: Round;
  bracket: Bracket;
  pending: boolean;
  save: (slot: string, id: string | null) => void;
  waiting: string;
  large?: boolean;
}) {
  if (round.options.length === 0 || (!round.open && !round.auto && !round.winner)) {
    return <p className="text-sm text-muted-foreground">{waiting}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {round.auto && <p className="text-sm text-muted-foreground">Only one book on this side of the bracket, so it goes through.</p>}
      <Choice round={round} bracket={bracket} pending={pending} onPick={(id) => save(round.slot, id)} large={large} versus />
    </div>
  );
}

/** Covers to pick from; the chosen one gets the crown (or thumbs down), the rest fade. Tap another to change. */
function Choice({
  round,
  bracket,
  pending,
  onPick,
  small,
  large,
  versus,
}: {
  round: Round;
  bracket: Bracket;
  pending: boolean;
  onPick: (id: string) => void;
  small?: boolean;
  large?: boolean;
  versus?: boolean;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center", small ? "gap-3" : "gap-5")}>
      {round.options.map((b, i) => (
        <li key={b.id} className="flex items-center gap-5">
          {versus && i > 0 && (
            <span className="font-heading text-lg font-semibold text-muted-foreground" aria-hidden>
              vs
            </span>
          )}
          <CoverButton
            book={b}
            bracket={bracket}
            size={small ? "sm" : large ? "lg" : "md"}
            selected={round.winner?.id === b.id}
            dimmed={round.winner !== null && round.winner.id !== b.id}
            disabled={pending || round.auto}
            onClick={() => round.winner?.id !== b.id && onPick(b.id)}
            tag={round.winner?.id === b.id ? COPY[bracket].badge : undefined}
          />
        </li>
      ))}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
    </ul>
  );
}

function CoverButton({
  book,
  bracket,
  size = "md",
  selected,
  dimmed,
  disabled,
  onClick,
  tag,
}: {
  book: Book;
  bracket: Bracket;
  size?: "sm" | "md" | "lg";
  selected: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tag?: string;
}) {
  const Icon = tag === "Out" ? X : COPY[bracket].icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${book.title}${book.authors.length ? `, ${book.authors.join(", ")}` : ""}`}
      className={cn(
        "group flex flex-col gap-1.5 rounded-sm text-left transition-opacity focus-visible:outline-none disabled:cursor-default",
        size === "sm" ? "w-16" : size === "lg" ? "w-32 md:w-36" : "w-24 md:w-28",
        dimmed && "opacity-45 hover:opacity-80",
      )}
    >
      <span
        className={cn(
          "relative block rounded-sm transition-shadow group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
          selected && (bracket === "best" ? "ring-3 ring-primary" : "ring-3 ring-destructive"),
        )}
      >
        <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes={size === "sm" ? "64px" : "144px"} compact={size === "sm"} />
        {tag && (
          <span
            className={cn(
              "absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase shadow-sm",
              tag === "Out" ? "bg-muted text-muted-foreground" : bracket === "best" ? "bg-primary text-primary-foreground" : "bg-destructive text-white",
            )}
          >
            <Icon className="size-3" aria-hidden />
            {size === "sm" ? null : tag}
          </span>
        )}
      </span>
      <span lang={book.language} className={cn("line-clamp-2 leading-snug font-medium", size === "sm" ? "text-[11px]" : "text-xs")}>
        {book.title}
      </span>
    </button>
  );
}

function WinnerTag({ book, bracket }: { book: Book; bracket: Bracket }) {
  const Icon = COPY[bracket].icon;
  return (
    <span className="inline-flex max-w-48 items-center gap-1.5 truncate rounded-full bg-muted px-3 py-1 text-xs font-semibold">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{book.title}</span>
    </span>
  );
}

function Pills({ label, options }: { label: string; options: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 max-w-full overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-full bg-muted p-1">
        {options.map((o) => (
          <li key={o.label}>
            <Link
              href={o.href}
              aria-current={o.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                o.active && "bg-background text-foreground shadow-sm",
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

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl font-semibold text-heading">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-heading">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}
