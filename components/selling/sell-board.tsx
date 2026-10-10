"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, EllipsisVertical } from "lucide-react";
import { keepBook, undoSale } from "@/app/actions/selling";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate, formatMoney } from "@/lib/books/labels";
import { receivedTotal, salePriceLabel, soldTotal } from "@/lib/selling";
import type { Book } from "@/lib/types";
import { SoldDialog, useSellAction } from "./selling-controls";

/** The Sell page: books to sell as covers, and every sold book as a compact list with its price. */
export function SellBoard({ toSell, sold }: { toSell: Book[]; sold: Book[] }) {
  const earned = soldTotal(sold);
  const received = receivedTotal(sold);
  // Worth saying what you actually got only when some books sold in another currency.
  const showReceived = received.some((r) => !earned.some((e) => e.currency === r.currency));
  return (
    <div className="flex flex-col gap-8">
      <p className="-mb-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{toSell.length}</span> to sell ·{" "}
        <span className="font-semibold text-foreground">{sold.length}</span> sold
        {earned.length > 0 && (
          <>
            {" · earned "}
            <span className="font-semibold text-foreground">{earned.map((c) => formatMoney(c.total, c.currency)).join(" + ")}</span>
            {showReceived && <> (you got {received.map((c) => formatMoney(c.total, c.currency)).join(" + ")})</>}
          </>
        )}
      </p>

      <section aria-labelledby="sell-to-sell" className="flex flex-col gap-5 rounded-3xl bg-accent/60 px-5 py-6 md:px-6">
        <div className="flex flex-col gap-0.5">
          <h2 id="sell-to-sell" className="flex items-baseline gap-2 font-heading text-xl font-semibold text-heading md:text-2xl">
            To sell
            <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{toSell.length}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Still on your shelves until they&apos;re sold.</p>
        </div>
        {toSell.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to sell. Open a paper book you own and choose “Sell”.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
            {toSell.map((b) => (
              <li key={b.id}>
                <SellCard book={b} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sell-sold" className="flex flex-col gap-4 rounded-3xl bg-card px-5 py-6 ring-1 ring-border/60 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-0.5">
            <h2 id="sell-sold" className="flex items-baseline gap-2 font-heading text-xl font-semibold text-heading md:text-2xl">
              Sold
              <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{sold.length}</span>
            </h2>
            <p className="text-sm text-muted-foreground">Not in your library anymore, kept here so you know.</p>
          </div>
        </div>
        {sold.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sold books yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sold.map((b) => (
              <li key={b.id}>
                <SoldRow book={b} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SellCard({ book }: { book: Book }) {
  const [soldOpen, setSoldOpen] = useState(false);
  const { pending, run } = useSellAction();
  return (
    <div className="flex flex-col gap-2">
      <Link href={`/books/${book.id}`} className="block rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none">
        <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="144px" />
      </Link>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <Link href={`/books/${book.id}`} lang={book.language} className="line-clamp-2 font-heading text-sm leading-snug font-semibold text-heading hover:underline">
          {book.title}
        </Link>
        {book.authors.length > 0 && <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>}
      </div>
      <div className="flex items-center gap-1 px-0.5">
        <Button size="xs" className="rounded-full" disabled={pending} onClick={() => setSoldOpen(true)}>
          <BadgeCheck aria-hidden />
          Sold
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={`More for ${book.title}`} />}>
            <EllipsisVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => run(() => keepBook(book.id), `Keeping “${book.title}”`)}>Keep it</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SoldDialog key={String(soldOpen)} book={book} open={soldOpen} onOpenChange={setSoldOpen} />
    </div>
  );
}

function SoldRow({ book }: { book: Book }) {
  const { pending, run } = useSellAction();
  const [editOpen, setEditOpen] = useState(false);
  const price = salePriceLabel(book);
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/books/${book.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
        <BookCover title={book.title} src={book.coverSrc} sizes="32px" className="w-8 shrink-0" compact />
        <span className="flex min-w-0 flex-1 flex-col">
          <span lang={book.language} className="truncate font-heading text-sm font-semibold text-heading">
            {book.title}
          </span>
          {book.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>}
        </span>
      </Link>
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
        {price ? (
          <span className="flex flex-col items-end leading-tight">
            {price.main}
            {price.converted && <span className="text-[11px] font-normal text-muted-foreground">≈ {price.converted}</span>}
          </span>
        ) : (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </span>
      <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">{formatDate(book.soldAt!)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={`More for ${book.title}`} disabled={pending} />}>
          <EllipsisVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit sale</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => undoSale(book.id), `“${book.title}” is back on your shelves`)}>Undo sale</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editOpen && <SoldDialog book={book} open onOpenChange={setEditOpen} editing />}
    </div>
  );
}
