import type { Reading } from "@/lib/types";

export interface ProgressInfo {
  /** 0–100, when it can be worked out (a % was saved, or a page plus the book's page count). */
  percent?: number;
  page?: number;
  /** e.g. "p. 120 of 340 · 35%", "p. 120", "35%". */
  label: string;
}

/** The reading you stopped (the latest one marked did not finish), for a book you didn't finish. */
export function lastStop(readings: Reading[]): Reading | undefined {
  return readings.findLast((r) => r.outcome === "abandoned");
}

/** How far into a reading you are (or where you stopped, for a book you didn't finish). */
export function progressInfo(reading: Pick<Reading, "progressPage" | "progressPercent"> | undefined, totalPages?: number): ProgressInfo | null {
  if (!reading) return null;
  const { progressPage: page, progressPercent } = reading;
  if (page !== undefined) {
    const percent = totalPages ? Math.min(100, Math.round((page / totalPages) * 100)) : undefined;
    const label = totalPages ? `p. ${page} of ${totalPages} · ${percent}%` : `p. ${page}`;
    return { page, percent, label };
  }
  if (progressPercent !== undefined) {
    const percent = Math.round(progressPercent);
    return { percent, label: `${percent}%` };
  }
  return null;
}
