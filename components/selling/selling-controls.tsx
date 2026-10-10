"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getExchangeRate, type ExchangeRate } from "@/app/actions/rates";
import { keepBook, markSold, putUpForSale, undoSale } from "@/app/actions/selling";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/books/labels";
import { convert, formatRate, SALE_CURRENCIES } from "@/lib/currency";
import { todayLocal } from "@/lib/dates";
import { canSell, salePriceLabel } from "@/lib/selling";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string };

/** Runs a selling action with a toast; shared by the board, the banner and the book page button. */
export function useSellAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Result>, message: string, then?: () => void) =>
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        toast.error(r.error ?? "Couldn't save.");
        return;
      }
      toast.success(message);
      then?.();
    });
  return { pending, run };
}

const CURRENCY_KEY = "sale-currency";

/** The currency you sold in last time (you sell in Sweden, so SEK until you pick another). */
function rememberedCurrency(options: readonly string[]): string {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (saved && options.includes(saved)) return saved;
  } catch {
    // Private windows can refuse storage; the default is fine.
  }
  return "SEK";
}

function rememberCurrency(currency: string) {
  try {
    localStorage.setItem(CURRENCY_KEY, currency);
  } catch {
    // Not important enough to bother you about.
  }
}

/**
 * "Sold": the price you got, in the currency you sold in. When that isn't the book's currency, it's
 * converted at today's National Bank of Ukraine rate (or an amount you type, if the rate can't be
 * fetched). Both are kept: what you got, and the converted value for totals. The date is today.
 */
export function SoldDialog({ book, open, onOpenChange }: { book: Book; open: boolean; onOpenChange: (o: boolean) => void }) {
  const options = [...new Set([...SALE_CURRENCIES, book.currency])];
  const [currency, setCurrency] = useState(() => rememberedCurrency(options));
  const [price, setPrice] = useState("");
  const [manual, setManual] = useState("");
  const [rate, setRate] = useState<{ currency: string; value: ExchangeRate | null; error?: string } | null>(null);
  const { pending, run } = useSellAction();
  const priceId = useId();
  const manualId = useId();

  const foreign = currency !== book.currency;
  // Fetch the rate whenever the currency changes (the result is tagged with its currency, so a
  // slow answer for a currency you've since switched away from is ignored).
  useEffect(() => {
    if (!open || currency === book.currency) return;
    let live = true;
    void getExchangeRate(currency, book.currency).then((r) => {
      if (live) setRate(r.ok ? { currency, value: r.data } : { currency, value: null, error: r.error });
    });
    return () => {
      live = false;
    };
  }, [open, currency, book.currency]);
  const current = rate?.currency === currency ? rate : null;

  const parse = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const value = parse(price);
  const manualValue = parse(manual);
  const invalid = (value !== null && (!Number.isFinite(value) || value < 0)) || (manualValue !== null && (!Number.isFinite(manualValue) || manualValue < 0));
  const converted = !foreign || value === null ? value : manualValue ?? (current?.value ? convert(value, current.value.rate) : null);
  // Sold in another currency without a rate: you need to type the converted amount yourself.
  const needsManual = foreign && value !== null && converted === null;

  const save = () => {
    if (invalid || needsManual) return;
    rememberCurrency(currency);
    const sold = foreign && value !== null ? { price: value, currency } : null;
    run(() => markSold(book.id, converted, todayLocal(), sold), `Sold “${book.title}”`, () => onOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sold “{book.title}”</DialogTitle>
          <DialogDescription>It leaves your library and moves to the Sold list.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={priceId} className="text-sm font-medium">
              Sold for
            </label>
            <div className="flex gap-2">
              <Input
                id={priceId}
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={invalid || undefined}
                className="h-10 flex-1"
                autoFocus
              />
              <div className="flex rounded-full bg-muted p-1" role="radiogroup" aria-label="Currency">
                {options.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={currency === c}
                    onClick={() => {
                      setCurrency(c);
                      setManual("");
                    }}
                    className={cn(
                      "inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      currency === c && "bg-background text-foreground shadow-sm",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {foreign && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {current?.value ? (
                <>
                  {value !== null && converted !== null ? (
                    <>
                      ≈ <span className="font-semibold text-foreground">{formatMoney(converted, book.currency)}</span> ·{" "}
                    </>
                  ) : null}
                  1 {currency} = {formatRate(current.value.rate)} {book.currency} (National Bank of Ukraine{current.value.date ? `, ${current.value.date}` : ""})
                </>
              ) : current?.error ? (
                current.error
              ) : (
                "Getting today's rate…"
              )}
            </p>
          )}

          {foreign && (current?.error || manual) && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={manualId} className="text-sm font-medium">
                In {book.currency}
              </label>
              <Input id={manualId} inputMode="decimal" autoComplete="off" value={manual} onChange={(e) => setManual(e.target.value)} className="h-10" />
            </div>
          )}

          {invalid && (
            <p role="alert" className="text-sm text-destructive">
              Enter a price like 50 or 99.50.
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || invalid || needsManual}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Mark as sold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/** Book page: put a paper book you own on the sell shelf. */
export function SellButton({ book }: { book: Book }) {
  const { pending, run } = useSellAction();
  if (!canSell(book)) return null;
  return (
    <Button variant="outline" className="h-9 rounded-full px-4" disabled={pending} onClick={() => run(() => putUpForSale(book.id), "On your sell shelf")}>
      <HandCoins aria-hidden />
      Sell
    </Button>
  );
}

/** Top of the book page for a book on the sell shelf, or one that's already sold. */
export function SellBanner({ book }: { book: Book }) {
  const [soldOpen, setSoldOpen] = useState(false);
  const { pending, run } = useSellAction();

  if (book.soldAt) {
    const sold = salePriceLabel(book);
    return (
      <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-muted px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          Sold {formatDate(book.soldAt)}
          {sold && ` for ${sold.main}${sold.converted ? ` (≈ ${sold.converted})` : ""}`}. Not in your library anymore.
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button size="sm" variant="ghost" className="rounded-full hover:bg-black/10" disabled={pending} onClick={() => run(() => undoSale(book.id), "Back on your shelves")}>
            Undo sale
          </Button>
          <Link href="/sell" className="text-sm font-medium underline underline-offset-4">
            Open Sell
          </Link>
        </div>
      </div>
    );
  }

  if (!book.forSale) return null;
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-highlight px-4 py-3 text-highlight-foreground">
      <p className="flex items-center gap-2 text-sm font-medium">
        <HandCoins className="size-4 shrink-0" aria-hidden />
        On your sell shelf.
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <Button size="sm" className="rounded-full" disabled={pending} onClick={() => setSoldOpen(true)}>
          <BadgeCheck aria-hidden />
          Sold
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full hover:bg-black/10" disabled={pending} onClick={() => run(() => keepBook(book.id), "Keeping it")}>
          Keep it
        </Button>
        <Link href="/sell" className="text-sm font-medium underline underline-offset-4">
          Open Sell
        </Link>
      </div>
      <SoldDialog key={String(soldOpen)} book={book} open={soldOpen} onOpenChange={setSoldOpen} />
    </div>
  );
}
