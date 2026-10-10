import { formatMoney } from "@/lib/books/labels";
import type { Book } from "@/lib/types";

/** Sold books have left your shelves; they're only on the Sell page now. */
export const isSold = (b: Pick<Book, "soldAt">) => b.soldAt !== undefined;

/** What the Library shows: not a wishlist book and not sold. */
export const inLibrary = (b: Pick<Book, "wanted" | "soldAt">) => !b.wanted && !isSold(b);

/** Ebooks and audiobooks can't be sold on. */
export const canSell = (b: Pick<Book, "owned" | "wanted" | "soldAt" | "forSale" | "format">) =>
  b.owned && !b.wanted && !isSold(b) && !b.forSale && b.format !== "ebook" && b.format !== "audio";

/** On the sell shelf, newest first, and sold books, most recently sold first. */
export function splitSelling(books: Book[]): { toSell: Book[]; sold: Book[] } {
  const toSell = books.filter((b) => b.forSale && !isSold(b)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sold = books.filter(isSold).sort((a, b) => b.soldAt!.localeCompare(a.soldAt!) || a.title.localeCompare(b.title, "uk"));
  return { toSell, sold };
}

/** Money made from sold books, per currency (books sold without a price are skipped). */
export function soldTotal(books: Book[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const b of books) {
    if (!isSold(b) || b.salePrice === undefined) continue;
    totals.set(b.currency, (totals.get(b.currency) ?? 0) + b.salePrice);
  }
  return [...totals].map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }));
}

/** "SEK 50 (≈ UAH 225)" when sold in another currency, "UAH 180" otherwise, or null without a price. */
export function salePriceLabel(b: Pick<Book, "salePrice" | "currency" | "saleOriginalPrice" | "saleOriginalCurrency">): { main: string; converted?: string } | null {
  if (b.saleOriginalPrice !== undefined && b.saleOriginalCurrency) {
    return { main: formatMoney(b.saleOriginalPrice, b.saleOriginalCurrency), converted: b.salePrice !== undefined ? formatMoney(b.salePrice, b.currency) : undefined };
  }
  return b.salePrice !== undefined ? { main: formatMoney(b.salePrice, b.currency) } : null;
}

/** What you actually got, per currency (the original amount when sold in another currency). */
export function receivedTotal(books: Book[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const b of books) {
    if (!isSold(b)) continue;
    const [amount, currency] = b.saleOriginalPrice !== undefined && b.saleOriginalCurrency ? [b.saleOriginalPrice, b.saleOriginalCurrency] : [b.salePrice, b.currency];
    if (amount === undefined) continue;
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return [...totals].map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }));
}
