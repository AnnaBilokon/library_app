import { MONTHS } from "@/lib/challenge";
import type { Book } from "@/lib/types";

/**
 * Book battle: a yearly tournament of the books you finished, in two brackets (best and worst).
 *   month    pick one of the books finished that month (a single book goes through on its own)
 *   quarter  the three monthly winners: keep two, then pick one of those two
 *   semi     Q1 v Q2 and Q3 v Q4
 *   final    the two semi-final winners: the book of the year
 * Stored picks only count while they're still among the options, so changing an early round
 * never leaves a later round pointing at a book that isn't there any more.
 */
export const BRACKETS = ["best", "worst"] as const;
export type Bracket = (typeof BRACKETS)[number];

export type Slot = string;
export type Picks = Partial<Record<Slot, string>>;

export const monthSlot = (m: number) => `m${String(m + 1).padStart(2, "0")}`;
export const SLOT_PATTERN = /^(m(0[1-9]|1[0-2])|q[1-4](-drop)?|s[12]|final)$/;

/** Slots decided after (and from) this one; they're cleared when it changes. */
export function downstreamSlots(slot: Slot): Slot[] {
  const final = ["final"];
  if (slot === "final") return [];
  if (slot === "s1" || slot === "s2") return final;
  const q = slot.startsWith("m") ? Math.floor((Number(slot.slice(1)) - 1) / 3) + 1 : Number(slot[1]);
  const semi = q <= 2 ? "s1" : "s2";
  if (slot.endsWith("-drop")) return [`q${q}`, semi, ...final];
  if (slot.startsWith("q")) return [semi, ...final];
  return [`q${q}-drop`, `q${q}`, semi, ...final];
}

export interface Round {
  slot: Slot;
  /** The books to choose from. */
  options: Book[];
  /** The chosen book, or the only option. */
  winner: Book | null;
  /** Decided without a choice (only one book). */
  auto: boolean;
  /** Can be decided now. */
  open: boolean;
}

export interface MonthRound extends Round {
  month: number;
  label: string;
  /** The month hasn't started yet. */
  future: boolean;
}

export interface QuarterRound {
  quarter: number;
  label: string;
  months: MonthRound[];
  /** Monthly winners that made it to the quarter. */
  entrants: Book[];
  /** Keep two of three (only when there are three entrants). */
  keep: Round & { dropped: Book | null };
  /** The quarter's champion (from the two kept, or the only entrant). */
  duel: Round;
}

export interface BattleState {
  year: number;
  bracket: Bracket;
  quarters: QuarterRound[];
  semis: Round[];
  final: Round;
  champion: Book | null;
}

/** Books with a finished reading in that month, in finishing order. */
export function monthCandidates(books: Book[], year: number, month: number): Book[] {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  return books
    .flatMap((b) => b.readings.filter((r) => r.outcome === "finished" && r.finishedAt?.startsWith(key)).map((r) => ({ b, date: r.finishedAt! })))
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((x) => x.b)
    .filter((b, i, all) => all.findIndex((o) => o.id === b.id) === i);
}

function round(slot: Slot, options: Book[], picks: Picks, open: boolean): Round {
  if (options.length === 1) return { slot, options, winner: options[0], auto: true, open: false };
  const picked = options.find((b) => b.id === picks[slot]) ?? null;
  return { slot, options, winner: open ? picked : null, auto: false, open: open && options.length > 1 };
}

const QUARTER_LABEL = ["Jan – Mar", "Apr – Jun", "Jul – Sep", "Oct – Dec"];

/**
 * The whole bracket for a year. `today` (YYYY-MM-DD) decides which months have started and
 * whether a quarter is over, so a round only opens once everything feeding it is known.
 */
export function computeBattle(allBooks: Book[], picks: Picks, year: number, bracket: Bracket, today: string): BattleState {
  const books = allBooks.filter((b) => !b.wanted);
  const monthStarted = (m: number) => `${year}-${String(m + 1).padStart(2, "0")}` <= today.slice(0, 7);
  const monthOver = (m: number) => `${year}-${String(m + 1).padStart(2, "0")}` < today.slice(0, 7);

  const quarters: QuarterRound[] = [0, 1, 2, 3].map((q) => {
    const months: MonthRound[] = [0, 1, 2].map((i) => {
      const m = q * 3 + i;
      const r = round(monthSlot(m), monthCandidates(books, year, m), picks, true);
      return { ...r, month: m, label: MONTHS[m], future: !monthStarted(m) };
    });
    // The quarter opens when every month is decided, or is over and had nothing to decide.
    const settled = months.every((m) => m.winner || (m.options.length === 0 && monthOver(m.month)));
    const entrants = months.flatMap((m) => (m.winner ? [m.winner] : []));
    const slot = `q${q + 1}`;

    const keepOpen = settled && entrants.length === 3;
    const droppedId = keepOpen ? picks[`${slot}-drop`] : undefined;
    const dropped = entrants.find((b) => b.id === droppedId) ?? null;
    const keep = { slot: `${slot}-drop`, options: keepOpen ? entrants : [], winner: null, dropped, auto: false, open: keepOpen };

    const finalists = entrants.length === 3 ? (dropped ? entrants.filter((b) => b !== dropped) : []) : entrants;
    const duel = round(slot, finalists, picks, settled && finalists.length > 0);
    return { quarter: q, label: QUARTER_LABEL[q], months, entrants, keep, duel: settled ? duel : { ...duel, winner: null, auto: false, open: false } };
  });

  // A later round waits until both sides are known; an empty side lets the other through.
  const side = (qs: QuarterRound[]) => {
    const done = qs.every((q) => q.duel.winner || (q.entrants.length === 0 && q.months.every((m) => m.options.length === 0 && monthOver(m.month))));
    return { done, books: qs.flatMap((q) => (q.duel.winner ? [q.duel.winner] : [])) };
  };
  const semis = [side(quarters.slice(0, 2)), side(quarters.slice(2, 4))].map((s, i) => {
    const r = round(`s${i + 1}`, s.books, picks, s.done);
    return s.done ? r : { ...r, winner: null, auto: false, open: false };
  });
  const finalDone = semis.every((s, i) => s.winner || (s.options.length === 0 && side(quarters.slice(i * 2, i * 2 + 2)).done));
  const finalOptions = semis.flatMap((s) => (s.winner ? [s.winner] : []));
  const final = round("final", finalOptions, picks, finalDone);
  const finalRound = finalDone ? final : { ...final, winner: null, auto: false, open: false };

  return { year, bracket, quarters, semis, final: finalRound, champion: finalRound.winner };
}
