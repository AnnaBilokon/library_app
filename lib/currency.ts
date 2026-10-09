/** Currencies offered when you mark a book sold (the book's own currency is always added). */
export const SALE_CURRENCIES = ["SEK", "UAH", "EUR", "USD"] as const;

/** An amount at a rate (how many of the target one unit is worth), rounded to whole cents. */
export function convert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** "4.5032" → shown as-is; long rates are trimmed to 4 decimals. */
export function formatRate(rate: number): string {
  return String(Math.round(rate * 10_000) / 10_000);
}
