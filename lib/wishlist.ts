import type { Book, WishPriority } from "@/lib/types";

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

/** Books you want but don't have yet: they live on the Wishlist page, not in the Library. */
export const isWishlistOnly = (b: Pick<Book, "wanted" | "owned">) => b.wanted && !b.owned;

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
