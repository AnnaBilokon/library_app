import type { BookStatus, Reading, ReadingOutcome } from "@/lib/types";

export interface ReadingChange {
  /** A new reading to create. */
  insert?: { startedAt: string | null; finishedAt: string | null; outcome: ReadingOutcome | null };
  /** Changes to an existing reading. */
  update?: { id: string; finishedAt: string; outcome: ReadingOutcome };
}

/** The reading that's still going (no outcome yet), if any. */
export function openReading(readings: Reading[]): Reading | undefined {
  return [...readings].reverse().find((r) => r.outcome === undefined);
}

/**
 * What to record when the status changes, so dates fill themselves in:
 * - Reading:   start a new reading today (unless one is already open, e.g. resuming from Paused).
 * - Finished:  close the open reading today; if there isn't one, record a reading finished today.
 * - Did not finish: close the open reading today as abandoned; if there isn't one, record one,
 *   so the page you stopped at and your reason have somewhere to live.
 * - To read / Paused: nothing to record.
 * `today` comes from the browser so it's the user's local date, not the server's.
 */
export function planStatusChange(readings: Reading[], status: BookStatus, today: string): ReadingChange {
  const open = openReading(readings);
  switch (status) {
    case "reading":
      return open ? {} : { insert: { startedAt: today, finishedAt: null, outcome: null } };
    case "finished":
      return open
        ? { update: { id: open.id, finishedAt: today, outcome: "finished" } }
        : { insert: { startedAt: null, finishedAt: today, outcome: "finished" } };
    case "abandoned":
      return open
        ? { update: { id: open.id, finishedAt: today, outcome: "abandoned" } }
        : { insert: { startedAt: null, finishedAt: today, outcome: "abandoned" } };
    default:
      return {};
  }
}

export interface ReadingRowLike {
  outcome: ReadingOutcome | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/**
 * The status a book's readings imply, so adding or editing reading dates keeps the status right:
 * - a reading still going → Reading (or stays Paused if it was paused)
 * - otherwise the most recent ended reading decides: Finished or Did not finish
 * - no readings at all → the status stays as it is
 */
export function statusFromReadings(readings: ReadingRowLike[], current: BookStatus): BookStatus {
  if (readings.length === 0) return current;
  if (readings.some((r) => r.outcome === null)) return current === "paused" ? "paused" : "reading";
  const when = (r: ReadingRowLike) => r.finished_at ?? r.started_at ?? r.created_at.slice(0, 10);
  const latest = [...readings].sort((a, b) => when(b).localeCompare(when(a)) || b.created_at.localeCompare(a.created_at))[0];
  return latest.outcome === "abandoned" ? "abandoned" : "finished";
}
