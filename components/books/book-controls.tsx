"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBook, restoreBook, setBookStatus, setFavorite, setRating } from "@/app/actions/books";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STATUS_LABEL } from "@/lib/books/labels";
import { todayLocal } from "@/lib/dates";
import { BOOK_STATUSES, type Book, type BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookForm, type BookFormSuggestions } from "./book-form";
import { RatingStars } from "./rating-stars";
import { STATUS_ICON } from "./status-badge";

/**
 * Status, rating and favourite on the book page. useOptimistic shows the new value immediately;
 * if the Server Action fails, React drops the optimistic value and the real one comes back.
 */
export function BookQuickControls({ book }: { book: Book }) {
  const [, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(book.status);
  const [rating, setOptimisticRating] = useOptimistic(book.rating ?? null);
  const [favorite, setOptimisticFavorite] = useOptimistic(book.favorite);

  const changeStatus = (next: BookStatus) =>
    startTransition(async () => {
      setOptimisticStatus(next);
      const r = await setBookStatus(book.id, next, todayLocal());
      if (!r.ok) toast.error(r.error);
      else if (next === "reading" && book.status !== "paused") toast.success("Started today. You can change the date below.");
      else if (next === "finished") toast.success("Finished today. You can change the date below.");
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
        {BOOK_STATUSES.map((s) => {
          const Icon = STATUS_ICON[s];
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => !active && changeStatus(s)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-primary text-primary-foreground ring-primary hover:bg-primary",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {STATUS_LABEL[s]}
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
            favorite && "text-primary ring-primary dark:text-highlight dark:ring-highlight",
          )}
        >
          <Heart className={cn("size-4", favorite && "fill-current")} aria-hidden />
          {favorite ? "Favourite" : "Add to favourites"}
        </button>
      </div>
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
