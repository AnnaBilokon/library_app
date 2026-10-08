import type { BookFormat, BookStatus } from "@/lib/types";

export const STATUS_LABEL: Record<BookStatus, string> = {
  "to-read": "To read",
  reading: "Reading",
  paused: "Paused",
  finished: "Finished",
  abandoned: "Abandoned",
};

export const FORMAT_LABEL: Record<BookFormat, string> = {
  paper: "Paper",
  ebook: "E-book",
  audio: "Audiobook",
};

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/** "uk" → "Ukrainian". Falls back to the code itself. */
export function languageLabel(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "2024-03-05" → "5 Mar 2024". Dates are calendar dates, so format them in UTC. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
