import { bookCountries, type AuthorCountries } from "@/lib/countries";
import type { Book } from "@/lib/types";

/** One CSV cell: quoted when it holds a comma, quote or line break (quotes doubled). */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: [string, (b: Book, map: AuthorCountries) => unknown][] = [
  ["Title", (b) => b.title],
  ["Authors", (b) => b.authors],
  ["Author countries", (b, map) => bookCountries(b, map)],
  ["Status", (b) => (b.wanted ? "wishlist" : b.soldAt ? "sold" : b.status)],
  ["Rating", (b) => b.rating],
  ["Favourite", (b) => (b.favorite ? "yes" : "")],
  ["Genres", (b) => b.genres],
  ["Tags", (b) => b.tags],
  ["Language", (b) => b.language],
  ["Original language", (b) => b.originalLanguage],
  ["Format", (b) => b.format],
  ["Publisher", (b) => b.publisher],
  ["Year published", (b) => b.publishedYear],
  ["Pages", (b) => b.pages],
  ["ISBN", (b) => b.isbn],
  ["Series", (b) => b.series],
  ["Series #", (b) => b.seriesIndex],
  ["Owned", (b) => (b.owned ? "yes" : "no")],
  ["Added", (b) => b.acquiredAt ?? b.createdAt.slice(0, 10)],
  ["Price paid", (b) => b.purchasePrice],
  ["Currency", (b) => b.currency],
  ["Times read", (b) => b.timesRead],
  ["Started", (b) => b.readings.map((r) => r.startedAt).filter(Boolean)],
  ["Finished", (b) => b.readings.filter((r) => r.outcome === "finished").map((r) => r.finishedAt ?? "date unknown")],
  ["Did not finish", (b) => b.readings.filter((r) => r.outcome === "abandoned").map((r) => [r.finishedAt, r.progressPage && `p. ${r.progressPage}`, r.stopReason].filter(Boolean).join(" · "))],
  ["Sold on", (b) => b.soldAt],
  ["Sold for", (b) => (b.saleOriginalPrice !== undefined ? `${b.saleOriginalPrice} ${b.saleOriginalCurrency}` : b.salePrice)],
  ["Wishlist price", (b) => b.wishPrice],
  ["Review", (b) => b.review],
  ["Notes", (b) => b.notes],
];

/**
 * Your library as a spreadsheet: one row per book. Starts with a byte-order mark so Excel reads the
 * Ukrainian text as UTF-8; lists inside a cell are separated by "; ".
 */
export function booksToCsv(books: Book[], map: AuthorCountries): string {
  const header = COLUMNS.map(([name]) => csvCell(name)).join(",");
  const rows = [...books].sort((a, b) => a.title.localeCompare(b.title, "uk")).map((b) => COLUMNS.map(([, get]) => csvCell(get(b, map))).join(","));
  return "﻿" + [header, ...rows].join("\r\n") + "\r\n";
}

/** "my-library-2026-10-10.csv" */
export const exportFileName = (date: string, ext: "csv" | "json") => `my-library-${date}.${ext}`;
