import { BOOK_STATUSES, type Book, type BookStatus, type WishPriority } from "@/lib/types";

/** Where a wishlist book sits on the Wishlist page. */
export type WishGroup = "inbox" | "most" | "maybe";

export const WISH_GROUPS: { id: WishGroup; title: string; hint: string }[] = [
  { id: "inbox", title: "Just added", hint: "New wishlist books land here. Drag them into a box below." },
  { id: "most", title: "Most wanted", hint: "Books you really want next." },
  { id: "maybe", title: "Heard it's good", hint: "Not decided yet, but people recommend them." },
];

/** Stored as the book's wishlist priority: high = most wanted, low = heard it's good, none = just added. */
export const GROUP_PRIORITY: Record<WishGroup, WishPriority | null> = { inbox: null, most: "high", maybe: "low" };

export function wishGroup(book: Pick<Book, "priority">): WishGroup {
  if (book.priority === "high" || book.priority === "medium") return "most";
  if (book.priority === "low") return "maybe";
  return "inbox";
}

/**
 * Books on the wishlist live only on the Wishlist page, never in the Library.
 * (A wishlist book is never "owned": it becomes owned when you mark it bought.)
 */
export const isWishlistOnly = (b: Pick<Book, "wanted">) => b.wanted;

/** Wishlist books split into the three groups, newest first. */
export function groupWishlist(books: Book[]): Record<WishGroup, Book[]> {
  const groups: Record<WishGroup, Book[]> = { inbox: [], most: [], maybe: [] };
  for (const b of books.filter((x) => x.wanted).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    groups[wishGroup(b)].push(b);
  }
  return groups;
}

/** Total expected cost by currency (prices without a value are skipped). */
export function wishlistCost(books: Book[]): { currency: string; total: number; priced: number }[] {
  const totals = new Map<string, { total: number; priced: number }>();
  for (const b of books) {
    if (b.wishPrice === undefined) continue;
    const t = totals.get(b.currency) ?? { total: 0, priced: 0 };
    t.total += b.wishPrice;
    t.priced += 1;
    totals.set(b.currency, t);
  }
  return [...totals].map(([currency, t]) => ({ currency, ...t }));
}

/** What the status buttons offer: "Wishlist" plus the reading statuses. */
export type StatusChoice = BookStatus | "wishlist";
export const STATUS_CHOICES: readonly StatusChoice[] = ["wishlist", ...BOOK_STATUSES];

/** The status button that should look selected: a wishlist book shows "Wishlist". */
export function statusChoice(book: Pick<Book, "wanted" | "status">): StatusChoice {
  return book.wanted ? "wishlist" : book.status;
}

/** How far ahead (and back) a wishlist book's release date shows up as a reminder. */
export const RELEASE_WINDOW_DAYS = 30;

export interface ReleaseReminder {
  book: Book;
  date: string;
  /** Days until it comes out (0 = today, negative = out that many days ago). */
  days: number;
}

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Days from today until a release date (negative once it's out). */
export const daysUntil = (date: string, today: string) => dayNumber(date) - dayNumber(today);

/**
 * Wishlist books to start looking for: coming out within the next month (soonest first), and the
 * ones that came out during the last month (newest first).
 */
export function releaseReminders(books: Book[], today: string, window = RELEASE_WINDOW_DAYS): { soon: ReleaseReminder[]; out: ReleaseReminder[] } {
  const all = books
    .filter((b) => b.wanted && b.releaseDate)
    .map((book) => ({ book, date: book.releaseDate!, days: daysUntil(book.releaseDate!, today) }))
    .filter((r) => Math.abs(r.days) <= window);
  return {
    soon: all.filter((r) => r.days > 0).sort((a, b) => a.days - b.days),
    out: all.filter((r) => r.days <= 0).sort((a, b) => b.days - a.days),
  };
}

/** "Out today", "Out tomorrow", "Out in 12 days", "Out since 3 Oct" — for a wishlist card. */
export function releaseLabel(date: string, today: string, format: (iso: string) => string): string {
  const d = daysUntil(date, today);
  if (d === 0) return "Out today";
  if (d === 1) return "Out tomorrow";
  if (d > 1 && d <= RELEASE_WINDOW_DAYS) return `Out in ${d} days`;
  if (d > 0) return `Out ${format(date)}`;
  return `Out since ${format(date)}`;
}
