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
 * - Abandoned: close the open reading today as abandoned.
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
      return open ? { update: { id: open.id, finishedAt: today, outcome: "abandoned" } } : {};
    default:
      return {};
  }
}
