"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { keepBook, markSold, putUpForSale, undoSale } from "@/app/actions/selling";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney } from "@/lib/books/labels";
import { todayLocal } from "@/lib/dates";
import { canSell } from "@/lib/selling";
import type { Book } from "@/lib/types";

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

/** "Sold": asks only for the price you got (optional); the date is today. */
export function SoldDialog({ book, open, onOpenChange }: { book: Book; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [price, setPrice] = useState("");
  const { pending, run } = useSellAction();
  const priceId = useId();
  const value = price.trim() === "" ? null : Number(price.replace(",", "."));
  const invalid = value !== null && (!Number.isFinite(value) || value < 0);

  const save = () => {
    if (invalid) return;
    run(() => markSold(book.id, value, todayLocal()), `Sold “${book.title}”`, () => onOpenChange(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sold “{book.title}”</DialogTitle>
          <DialogDescription>It leaves your library and moves to the Sold list.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label htmlFor={priceId} className="text-sm font-medium">
            Sold for ({book.currency})
          </label>
          <Input
            id={priceId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 150"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={invalid || undefined}
            className="h-10"
            autoFocus
          />
          {invalid && (
            <p role="alert" className="text-sm text-destructive">
              Enter a price like 150 or 99.50.
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || invalid}>
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
    return (
      <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-muted px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          Sold {formatDate(book.soldAt)}
          {book.salePrice !== undefined && ` for ${formatMoney(book.salePrice, book.currency)}`}. Not in your library anymore.
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
