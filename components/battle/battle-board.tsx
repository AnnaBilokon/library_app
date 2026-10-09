"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crown, Loader2, Lock, Plus, ThumbsDown, Trophy } from "lucide-react";
import { toast } from "sonner";
import { setBattlePick } from "@/app/actions/battle";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BattleState, Bracket, MonthRound, QuarterRound, Round } from "@/lib/battle";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COPY: Record<Bracket, { pick: string; champion: (y: number) => string; icon: typeof Crown }> = {
  best: { pick: "pick the best", champion: (y) => `Book of the year ${y}`, icon: Crown },
  worst: { pick: "pick the worst", champion: (y) => `Worst book of ${y}`, icon: ThumbsDown },
};

/** What the cover picker is choosing: one book for a place, or the two that go on in a quarter. */
type Picker =
  | { kind: "one"; slot: string; title: string; hint: string; options: Book[]; current: string | null }
  | { kind: "two"; slot: string; title: string; hint: string; options: Book[]; dropped: string | null };

type Save = (slot: string, bookId: string | null) => void;

export function BattleBoard({ battle, years }: { battle: BattleState; years: number[] }) {
  const { year, bracket } = battle;
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<Picker | null>(null);

  const save: Save = (slot, bookId) =>
    startTransition(async () => {
      const r = await setBattlePick(year, bracket, slot, bookId);
      if (!r.ok) toast.error(r.error);
    });

  const ctx: Ctx = { battle, pending, open: setPicker };

  return (
    <div className="flex flex-col gap-8" aria-busy={pending}>
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

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {pending && <Loader2 className="size-4 animate-spin" aria-label="Saving" />}
        Tap a <span className="inline-block h-4 w-3 rounded-[2px] border-2 border-dashed border-primary/60 align-middle" aria-hidden /> place to choose a book. Locked
        rounds open as the ones before them are decided.
      </p>

      {/* Wide screens: January–June comes in from the left, July–December from the right. */}
      <div className="bracket hidden items-center justify-center xl:flex">
        <Group inputs={[<Half key="h1" half={0} ctx={ctx} />]} output={<ChampionSlot ctx={ctx} />} />
        <div dir="rtl" className="flex items-center">
          <div className="bracket-in">
            <div>
              <Half half={1} ctx={ctx} />
            </div>
          </div>
          <div className="bracket-out w-5 self-stretch" />
        </div>
      </div>

      {/* Narrower screens: the two halves, then the final, one under the other. */}
      <div className="bracket flex flex-col gap-10 xl:hidden">
        {[0, 1].map((h) => (
          <section key={h} className="flex flex-col gap-3">
            <h2 className="font-heading text-xl font-semibold text-heading">{h === 0 ? "January – June" : "July – December"}</h2>
            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <Half half={h as 0 | 1} ctx={ctx} />
            </div>
          </section>
        ))}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-heading">Final</h2>
          <Group gap="1.5rem" inputs={[<SemiSlot key="s1" index={0} ctx={ctx} />, <SemiSlot key="s2" index={1} ctx={ctx} />]} output={<ChampionSlot ctx={ctx} />} />
        </section>
      </div>

      {picker && <CoverPicker key={picker.slot} picker={picker} bracket={bracket} onClose={() => setPicker(null)} save={save} />}
    </div>
  );
}

interface Ctx {
  battle: BattleState;
  pending: boolean;
  open: (p: Picker) => void;
}

// ───────────────────────── bracket ─────────────────────────

/** Inputs joined by a "]" into one output, with an arrow (see .bracket-* in globals.css). */
function Group({ inputs, output, gap = "1rem" }: { inputs: React.ReactNode[]; output: React.ReactNode; gap?: string }) {
  return (
    <div className="flex items-center">
      <div className="bracket-in" style={{ "--bracket-gap": gap } as React.CSSProperties}>
        {inputs.map((node, i) => (
          <div key={i}>{node}</div>
        ))}
      </div>
      <div className="bracket-out">{output}</div>
    </div>
  );
}

/** Two quarters into a semi-final. */
function Half({ half, ctx }: { half: 0 | 1; ctx: Ctx }) {
  const qs = ctx.battle.quarters.slice(half * 2, half * 2 + 2);
  return <Group gap="2.25rem" inputs={qs.map((q) => <Quarter key={q.quarter} q={q} ctx={ctx} />)} output={<SemiSlot index={half} ctx={ctx} />} />;
}

/** Three months into the two that go on, and those two into the quarter's champion. */
function Quarter({ q, ctx }: { q: QuarterRound; ctx: Ctx }) {
  return (
    <Group
      gap="0.5rem"
      inputs={q.months.map((m) => <MonthSlot key={m.slot} m={m} ctx={ctx} />)}
      output={<Group gap="1rem" inputs={keepSlots(q, ctx)} output={<QuarterSlot q={q} ctx={ctx} />} />}
    />
  );
}

function MonthSlot({ m, ctx }: { m: MonthRound; ctx: Ctx }) {
  const label = MONTH_SHORT[m.month];
  if (m.future) return <Slot size="xs" label={label} state="empty" note="Not yet" />;
  if (m.options.length === 0) return <Slot size="xs" label={label} state="empty" note="No books" />;
  if (m.auto) return <Slot size="xs" label={label} state="auto" book={m.winner} bracket={ctx.battle.bracket} />;
  const open = () =>
    ctx.open({
      kind: "one",
      slot: m.slot,
      title: `${MONTH_NAMES[m.month]}: ${COPY[ctx.battle.bracket].pick}`,
      hint: `${m.options.length} books finished in ${MONTH_NAMES[m.month]}. Scroll and tap a cover.`,
      options: m.options,
      current: m.winner?.id ?? null,
    });
  return <Slot size="xs" label={label} state={m.winner ? "set" : "pick"} book={m.winner} bracket={ctx.battle.bracket} onClick={open} disabled={ctx.pending} />;
}

function keepSlots(q: QuarterRound, ctx: Ctx): React.ReactNode[] {
  const label = `Q${q.quarter + 1}`;
  const { bracket } = ctx.battle;
  if (q.keep.open) {
    const kept = q.keep.dropped ? q.keep.options.filter((b) => b.id !== q.keep.dropped!.id) : [];
    const open = () =>
      ctx.open({
        kind: "two",
        slot: q.keep.slot,
        title: `Q${q.quarter + 1} (${q.label}): keep two`,
        hint: "Tap the two monthly winners that go on. The third is out.",
        options: q.keep.options,
        dropped: q.keep.dropped?.id ?? null,
      });
    return [0, 1].map((i) => (
      <Slot key={i} size="xs" label={label} state={kept[i] ? "set" : "pick"} book={kept[i] ?? null} bracket={bracket} onClick={open} disabled={ctx.pending} />
    ));
  }
  if (q.settled) {
    return [0, 1].map((i) =>
      q.entrants[i] ? (
        <Slot key={i} size="xs" label={label} state="auto" book={q.entrants[i]} bracket={bracket} />
      ) : (
        <Slot key={i} size="xs" label={label} state="empty" note={q.entrants.length ? "Bye" : "—"} />
      ),
    );
  }
  return [0, 1].map((i) => <Slot key={i} size="xs" label={label} state="locked" />);
}

function QuarterSlot({ q, ctx }: { q: QuarterRound; ctx: Ctx }) {
  const label = `Q${q.quarter + 1}`;
  const d = q.duel;
  if (q.settled && q.entrants.length === 0) return <Slot size="sm" label={label} state="empty" note="—" />;
  return (
    <RoundSlot
      round={d}
      size="sm"
      label={label}
      ctx={ctx}
      title={`Q${q.quarter + 1} (${q.label}): ${COPY[ctx.battle.bracket].pick}`}
      hint="The two that went on. Tap the quarter's champion."
    />
  );
}

function SemiSlot({ index, ctx }: { index: number; ctx: Ctx }) {
  const qs = ctx.battle.quarters.slice(index * 2, index * 2 + 2);
  const label = `Semi ${index + 1}`;
  if (qs.every((q) => q.settled && q.entrants.length === 0)) return <Slot size="sm" label={label} state="empty" note="—" />;
  return (
    <RoundSlot
      round={ctx.battle.semis[index]}
      size="sm"
      label={label}
      ctx={ctx}
      title={`Semi-final ${index + 1}: ${index === 0 ? "Q1 v Q2" : "Q3 v Q4"}`}
      hint={`The champions of ${index === 0 ? "January – March and April – June" : "July – September and October – December"}.`}
    />
  );
}

function ChampionSlot({ ctx }: { ctx: Ctx }) {
  const { battle } = ctx;
  return (
    <div className="flex flex-col items-center gap-2">
      <RoundSlot round={battle.final} size="lg" label={String(battle.year)} ctx={ctx} title={`The final: ${COPY[battle.bracket].champion(battle.year)}`} hint="The last two books standing." />
      <Trophy className="size-5 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** A duel's result place: the winner's cover, a place to pick, or locked until both sides are known. */
function RoundSlot({ round, size, label, ctx, title, hint }: { round: Round; size: SlotSize; label: string; ctx: Ctx; title: string; hint: string }) {
  const { bracket } = ctx.battle;
  if (round.auto) return <Slot size={size} label={label} state="auto" book={round.winner} bracket={bracket} />;
  if (!round.open) return <Slot size={size} label={label} state="locked" />;
  const open = () => ctx.open({ kind: "one", slot: round.slot, title, hint, options: round.options, current: round.winner?.id ?? null });
  return <Slot size={size} label={label} state={round.winner ? "set" : "pick"} book={round.winner} bracket={bracket} onClick={open} disabled={ctx.pending} />;
}

// ───────────────────────── a place in the bracket ─────────────────────────

type SlotSize = "xs" | "sm" | "lg";
const SLOT_WIDTH: Record<SlotSize, string> = { xs: "w-12 xl:w-16", sm: "w-14 xl:w-20", lg: "w-28 xl:w-40" };

function Slot({
  size,
  label,
  state,
  book = null,
  note,
  bracket = "best",
  onClick,
  disabled,
}: {
  size: SlotSize;
  label: string;
  state: "pick" | "set" | "auto" | "locked" | "empty";
  book?: Book | null;
  note?: string;
  bracket?: Bracket;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Icon = COPY[bracket].icon;
  const chip = (
    <span className="absolute top-1 left-1 z-10 rounded-full bg-background/90 px-1.5 text-[10px] leading-4 font-semibold text-foreground shadow-sm">{label}</span>
  );
  const box = cn("relative block aspect-[2/3] rounded-sm", SLOT_WIDTH[size]);

  if (state === "set" || state === "auto") {
    const content = (
      <span className={cn(box, state === "set" && "transition-transform group-hover:-translate-y-0.5")}>
        <BookCover title={book!.title} authors={book!.authors} src={book!.coverSrc} lang={book!.language} sizes={size === "lg" ? "160px" : "80px"} compact={size !== "lg"} />
        {chip}
        <span className={cn("absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full shadow-sm", bracket === "best" ? "bg-primary text-primary-foreground" : "bg-destructive text-white")}>
          <Icon className="size-3" aria-hidden />
        </span>
      </span>
    );
    const name = `${label}: ${book!.title}${state === "auto" ? " (only book, goes through)" : ""}`;
    return (
      <div dir="ltr" className="flex flex-col items-center gap-1">
        {state === "set" ? (
          <button type="button" onClick={onClick} disabled={disabled} aria-label={`${name}. Change`} title={book!.title} className="group rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none">
            {content}
          </button>
        ) : (
          <span role="img" aria-label={name} title={book!.title}>
            {content}
          </span>
        )}
        {size === "lg" && (
          <span lang={book!.language} className="max-w-40 text-center font-heading text-sm leading-snug font-semibold text-heading">
            {book!.title}
          </span>
        )}
      </div>
    );
  }

  if (state === "pick") {
    return (
      <div dir="ltr">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={`${label}: choose a book`}
          className={cn(
            box,
            "grid place-items-center border-2 border-dashed border-primary/60 bg-card text-primary transition-colors hover:border-primary hover:bg-highlight/40 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
          )}
        >
          {chip}
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div dir="ltr">
      <span
        role="img"
        aria-label={state === "locked" ? `${label}: waiting for the round before` : `${label}: ${note ?? "empty"}`}
        className={cn(box, "grid place-items-center border-2 border-dashed text-muted-foreground", state === "locked" ? "border-border bg-muted/40" : "border-border/60 opacity-60")}
      >
        {chip}
        {state === "locked" ? <Lock className="size-4" aria-hidden /> : <span className="px-1 text-center text-[10px] leading-tight">{note}</span>}
      </span>
    </div>
  );
}

// ───────────────────────── cover picker ─────────────────────────

/** Scroll through the covers and tap one (or two, when a quarter keeps two). */
function CoverPicker({ picker, bracket, onClose, save }: { picker: Picker; bracket: Bracket; onClose: () => void; save: Save }) {
  const [chosen, setChosen] = useState<string[]>(() =>
    picker.kind === "one" ? (picker.current ? [picker.current] : []) : picker.dropped ? picker.options.filter((b) => b.id !== picker.dropped).map((b) => b.id) : [],
  );
  const twoMode = picker.kind === "two";

  const choose = (id: string) => {
    if (picker.kind === "one") {
      if (id !== picker.current) save(picker.slot, id);
      onClose();
      return;
    }
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : chosen.length === 2 ? [id] : [...chosen, id];
    setChosen(next);
    if (next.length === 2) {
      const out = picker.options.find((b) => !next.includes(b.id))!;
      if (out.id !== picker.dropped) save(picker.slot, out.id);
      onClose();
    }
  };
  const hasPick = picker.kind === "one" ? picker.current !== null : picker.dropped !== null;
  const Icon = COPY[bracket].icon;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{picker.title}</DialogTitle>
          <DialogDescription>
            {picker.hint}
            {twoMode && ` (${Math.min(chosen.length, 2)} of 2)`}
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pt-2 pb-4">
          {picker.options.map((b) => {
            const selected = chosen.includes(b.id);
            return (
              <li key={b.id} className="w-32 shrink-0 snap-start sm:w-36">
                <button
                  type="button"
                  onClick={() => choose(b.id)}
                  aria-pressed={selected}
                  className="group flex w-full flex-col gap-2 rounded-sm text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "relative block rounded-sm transition-transform group-hover:-translate-y-1 group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
                      selected && (bracket === "best" ? "ring-3 ring-primary" : "ring-3 ring-destructive"),
                    )}
                  >
                    <BookCover title={b.title} authors={b.authors} src={b.coverSrc} lang={b.language} sizes="144px" />
                    {selected && (
                      <span className={cn("absolute -top-2 -right-2 grid size-7 place-items-center rounded-full shadow", bracket === "best" ? "bg-primary text-primary-foreground" : "bg-destructive text-white")}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span lang={b.language} className="line-clamp-2 text-sm leading-snug font-semibold">
                    {b.title}
                  </span>
                  {b.authors.length > 0 && <span className="-mt-1.5 truncate text-xs text-muted-foreground">{b.authors.join(", ")}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="sm:justify-between">
          {hasPick ? (
            <Button
              variant="ghost"
              onClick={() => {
                save(picker.slot, null);
                onClose();
              }}
            >
              Clear this place
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── header pieces ─────────────────────────

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
      className={cn("flex flex-wrap items-center gap-5 rounded-3xl px-5 py-5 md:px-8", battle.bracket === "best" ? "bg-highlight text-highlight-foreground" : "bg-secondary text-secondary-foreground")}
    >
      {champ ? (
        <>
          <div className="w-16 shrink-0 md:w-20">
            <BookCover title={champ.title} authors={champ.authors} src={champ.coverSrc} lang={champ.language} sizes="80px" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
              <Icon className="size-4" aria-hidden />
              {copy.champion(battle.year)}
            </p>
            <Link href={`/books/${champ.id}`} lang={champ.language} className="font-heading text-2xl leading-tight font-semibold text-balance hover:underline md:text-3xl">
              {champ.title}
            </Link>
            {champ.authors.length > 0 && <p className="opacity-80">{champ.authors.join(", ")}</p>}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-4">
          <Trophy className="size-9 shrink-0 opacity-70" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-xl font-semibold md:text-2xl">{copy.champion(battle.year)}: not decided yet</p>
            <p className="text-sm opacity-80">{left > 0 ? `${left} ${left === 1 ? "place is" : "places are"} waiting for a book.` : "New rounds open as the months go by."}</p>
          </div>
        </div>
      )}
    </section>
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
