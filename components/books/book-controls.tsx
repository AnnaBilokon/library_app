"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Heart, ListOrdered, ListPlus, Pencil, Pin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteBook, restoreBook, setBookStatus, setFavorite, setRating } from "@/app/actions/books";
import { changeQueue } from "@/app/actions/queue";
import { addToWishlist } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STATUS_LABEL } from "@/lib/books/labels";
import { STATUS_CHOICES, statusChoice, type StatusChoice } from "@/lib/wishlist";
import type { QueueChange } from "@/lib/books/queue";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookForm, type BookFormSuggestions } from "./book-form";
import { RatingStars } from "./rating-stars";
import { DnfDialog, FinishDialog } from "./reading-tools";
import { STATUS_ICON } from "./status-badge";

/**
 * Status, rating and favourite on the book page. useOptimistic shows the new value immediately;
 * if the Server Action fails, React drops the optimistic value and the real one comes back.
 */
export function BookQuickControls({ book }: { book: Book }) {
  const [, startTransition] = useTransition();
  // "Wishlist" shows as a status too (it's the book's wishlist flag underneath).
  const [status, setOptimisticStatus] = useOptimistic<StatusChoice>(statusChoice(book));
  const [rating, setOptimisticRating] = useOptimistic(book.rating ?? null);
  const [favorite, setOptimisticFavorite] = useOptimistic(book.favorite);
  const [dnfOpen, setDnfOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const changeStatus = (next: StatusChoice) =>
    startTransition(async () => {
      setOptimisticStatus(next);
      const r = await setBookStatus(book.id, next, todayLocal());
      if (!r.ok) toast.error(r.error);
      else if (next === "wishlist") toast.success("Moved to your wishlist");
      else if (book.wanted) toast.success("Moved from the wishlist to your library");
      else if (next === "reading" && book.status !== "paused") toast.success("Started today. You can change the date below.");
    });

  const changeRating = (next: number | null) =>
    startTransition(async () => {
      setOptimisticRating(next);
      const r = await setRating(book.id, next);
      if (!r.ok) toast.error(r.error);
    });

  const toggleFavorite = () =>
    startTransition(async () => {
      setOptimisticFavorite(!favorite);
      const r = await setFavorite(book.id, !favorite);
      if (!r.ok) toast.error(r.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Reading status" className="flex flex-wrap gap-1.5">
        {STATUS_CHOICES.map((s) => {
          const Icon = s === "wishlist" ? Gift : STATUS_ICON[s];
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              // "Finished" asks for the dates and a rating; "Did not finish" asks where you stopped and why.
              onClick={() => !active && (s === "abandoned" ? setDnfOpen(true) : s === "finished" ? setFinishOpen(true) : changeStatus(s))}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {s === "wishlist" ? "Wishlist" : STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <RatingStars value={rating} onChange={changeRating} size="lg" />
        <button
          type="button"
          aria-pressed={favorite}
          onClick={toggleFavorite}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            favorite && "text-red-700 ring-red-500 dark:text-red-400 dark:ring-red-400",
          )}
        >
          <Heart className={cn("size-4", favorite && "fill-current")} aria-hidden />
          {favorite ? "Favourite" : "Add to favourites"}
        </button>
      </div>
      <DnfDialog book={book} open={dnfOpen} onOpenChange={setDnfOpen} />
      <FinishDialog book={book} open={finishOpen} onOpenChange={setFinishOpen} />
    </div>
  );
}

export function BookEditButton({ book, suggestions }: { book: Book; suggestions: BookFormSuggestions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="h-9 rounded-full px-4" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
          <SheetHeader className="border-b">
            <SheetTitle className="font-heading text-xl">Edit book</SheetTitle>
            <SheetDescription className="sr-only">Change any detail of this book.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pt-6 md:px-6">
            <BookForm book={book} suggestions={suggestions} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} inSheet />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function BookDeleteButton({ book }: { book: Book }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const r = await deleteBook(book.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast(`Removed “${book.title}”`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await restoreBook(book.id);
            if (undo.ok) {
              toast.success("Restored");
              router.push(`/books/${book.id}`);
            } else toast.error(undo.error);
          },
        },
      });
      router.push("/library");
    });

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" className="h-9 rounded-full px-4 text-destructive hover:bg-destructive/10 hover:text-destructive" />}
      >
        <Trash2 aria-hidden />
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this book?</DialogTitle>
          <DialogDescription>
            “{book.title}” moves to the trash. You can undo right away, or restore it later from Settings → Trash.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={remove} disabled={pending}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add the book to the "Up next" queue, pin it as the next read, or take it out. */
export function BookQueueButton({ book }: { book: Book }) {
  const [pending, startTransition] = useTransition();
  const position = book.queuePosition;
  if (book.status === "reading") return null;

  const run = (change: QueueChange, message: string) =>
    startTransition(async () => {
      const r = await changeQueue(book.id, change);
      if (r.ok) toast.success(message);
      else toast.error(r.error);
    });

  if (position === undefined) {
    return (
      <div className="flex">
        <Button variant="outline" className="h-9 rounded-l-full rounded-r-none px-4" disabled={pending} onClick={() => run("append", "Added to Up next")}>
          <ListPlus aria-hidden />
          Add to Up next
        </Button>
        <Button
          variant="outline"
          className="h-9 rounded-l-none rounded-r-full border-l-0 px-3"
          disabled={pending}
          onClick={() => run("pin", "Pinned as your next read")}
          aria-label="Pin as my next read"
          title="Pin as my next read"
        >
          <Pin aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-9 rounded-full px-4" disabled={pending} />}>
        {position === 1 ? <Pin aria-hidden /> : <ListOrdered aria-hidden />}
        {position === 1 ? "Next read" : `Up next · #${position}`}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {position !== 1 && (
          <DropdownMenuItem onClick={() => run("pin", "Pinned as your next read")}>
            <Pin aria-hidden />
            Pin as next read
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/library" />}>
          <ListOrdered aria-hidden />
          Reorder the queue
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("remove", "Removed from Up next")}>
          <X aria-hidden />
          Remove from Up next
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Move a book you don't own to the wishlist. (Books you own aren't wishlist material, and a
 * wishlist book's page has its own banner with Bought it! / Remove.)
 */
export function BookWishlistButton({ book }: { book: Book }) {
  const [pending, startTransition] = useTransition();
  if (book.owned || book.wanted) return null;
  const add = () =>
    startTransition(async () => {
      const r = await addToWishlist(book.id);
      if (r.ok) toast.success("Moved to your wishlist");
      else toast.error(r.error);
    });
  return (
    <Button variant="outline" className="h-9 rounded-full px-4" disabled={pending} onClick={add}>
      <Gift aria-hidden />
      Add to wishlist
    </Button>
  );
}
