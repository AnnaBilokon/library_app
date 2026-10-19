import { formatDate } from "@/lib/books/labels";
import type { Edition } from "@/lib/catalog/editions";

/**
 * When a release comes out, for a card: "Coming 15 Nov 2026" / "Out 23 Jun 2026" from an exact
 * date, otherwise the publisher's own words ("Очікується наприкінці 2026 року"), or nothing.
 */
export function releaseLabel(edition: Pick<Edition, "releaseDate" | "releaseNote">, today: string): string | undefined {
  if (edition.releaseDate) return `${edition.releaseDate > today ? "Coming" : "Out"} ${formatDate(edition.releaseDate)}`;
  return edition.releaseNote;
}

/** For "Release date" sorting: dated ones by date (soonest first), then undated. */
export function byReleaseDate(a: Pick<Edition, "releaseDate">, b: Pick<Edition, "releaseDate">): number {
  if (a.releaseDate && b.releaseDate) return a.releaseDate.localeCompare(b.releaseDate);
  return a.releaseDate ? -1 : b.releaseDate ? 1 : 0;
}
