/** Today's date as YYYY-MM-DD in the browser's time zone (not UTC), for "started/finished today". */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-11" → "11.10.2026" (day.month.year, how dates are typed in the app). */
export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/**
 * What you typed → "2026-10-11", or null if it isn't a real date. Accepts day.month.year with dots,
 * slashes, dashes or spaces ("11.10.2026", "1/2/2026", "11-10-26" → 2026), and an empty field ("").
 */
export function dmyToIso(text: string): string | null {
  const t = text.trim();
  if (!t) return "";
  const m = /^(\d{1,2})[./\-\s]+(\d{1,2})[./\-\s]+(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const [day, month] = [Number(m[1]), Number(m[2])];
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day || year < 1000) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}
