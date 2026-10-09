/**
 * ISBN helpers. Books store ISBNs as 13 digits, so "0-14-044913-6" and "9780140449136" match.
 */

function isbn13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === "X" ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
}

/** Returns the 13-digit ISBN, or null if the input isn't a valid ISBN-10 or ISBN-13. */
export function normalizeIsbn(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^0-9X]/g, "");
  if (raw.length === 13 && /^\d{13}$/.test(raw)) {
    return isbn13CheckDigit(raw.slice(0, 12)) === Number(raw[12]) ? raw : null;
  }
  if (raw.length === 10 && isValidIsbn10(raw)) {
    const first12 = `978${raw.slice(0, 9)}`;
    return `${first12}${isbn13CheckDigit(first12)}`;
  }
  return null;
}
