"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { EllipsisVertical, GripVertical, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { markBought, moveWishlistBook, removeFromWishlist } from "@/app/actions/wishlist";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/books/labels";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WISH_GROUPS, wishGroup, wishlistCost, type WishGroup } from "@/lib/wishlist";

/** Drop where the pointer is; fall back to overlap for keyboard dragging (no pointer). */
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/**
 * The Wishlist page: a "Just added" row on top and two boxes below. Drag a book by its grip
 * (mouse, touch with a short press, or keyboard) into a box, or use its "Move to" menu.
 */
export function WishlistBoard({ books }: { books: Book[] }) {
  // The group each book is in, updated immediately when you drop it (saved in the background).
  const [groups, setGroups] = useState<Record<string, WishGroup>>(() => Object.fromEntries(books.map((b) => [b.id, wishGroup(b)])));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDragged = useRef(false);
  const [, startTransition] = useTransition();
  const byId = new Map(books.map((b) => [b.id, b]));
  const visible = books.filter((b) => !hidden.has(b.id));
  const inGroup = (g: WishGroup) => visible.filter((b) => groups[b.id] === g).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const move = (bookId: string, to: WishGroup) => {
    const from = groups[bookId];
    if (!from || from === to) return;
    setGroups((g) => ({ ...g, [bookId]: to }));
    startTransition(async () => {
      const r = await moveWishlistBook(bookId, to);
      if (!r.ok) {
        setGroups((g) => ({ ...g, [bookId]: from }));
        toast.error(r.error);
      }
    });
  };

  /** Hide a card right away (bought or removed); put it back if saving fails. */
  const takeOut = (bookId: string, action: () => Promise<{ ok: boolean; error?: string }>, message: string) => {
    setHidden((h) => new Set(h).add(bookId));
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setHidden((h) => {
          const next = new Set(h);
          next.delete(bookId);
          return next;
        });
        toast.error(r.error ?? "Couldn't save.");
      } else toast.success(message);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (over) move(String(active.id), over.id as WishGroup);
  };

  const groupTitle = (g: unknown) => WISH_GROUPS.find((x) => x.id === g)?.title ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${byId.get(String(active.id))?.title}.`,
    onDragOver: ({ active, over }) => (over ? `${byId.get(String(active.id))?.title} is over ${groupTitle(over.id)}.` : ""),
    onDragEnd: ({ active, over }) => (over ? `${byId.get(String(active.id))?.title} moved to ${groupTitle(over.id)}.` : "Cancelled."),
    onDragCancel: () => "Cancelled.",
  };

  const cardProps = (b: Book) => ({
    book: b,
    group: groups[b.id],
    onMove: (to: WishGroup) => move(b.id, to),
    onBought: () => takeOut(b.id, () => markBought(b.id, todayLocal()), `“${b.title}” is on your shelves now`),
    onRemove: () => takeOut(b.id, () => removeFromWishlist(b.id), "Removed from the wishlist"),
  });

  const inbox = inGroup("inbox");
  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      // A fixed id keeps dnd-kit's accessibility ids the same on the server and in the browser.
      id="wishlist-board"
      sensors={sensors}
      collisionDetection={pointerFirst}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={(e) => {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 150);
        onDragEnd(e);
      }}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements }}
    >
      <div
        className="flex flex-col gap-8"
        // Don't open the book when a drag ends over its link.
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <WishlistTotal books={visible} />
        <DropZone group="inbox" count={inbox.length} cost={wishlistCost(inbox)} className="bg-accent/70 dark:bg-accent/60">
          {inbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing new. Add books from their page, or with “Add to wishlist” above.</p>
          ) : (
            <ul className="-mx-5 flex gap-5 overflow-x-auto px-5 pb-2 md:-mx-6 md:px-6">
              {inbox.map((b) => (
                <li key={b.id} className="w-36 shrink-0">
                  <WishCard {...cardProps(b)} />
                </li>
              ))}
            </ul>
          )}
        </DropZone>

        <div className="grid gap-6 lg:grid-cols-2">
          {(["most", "maybe"] as const).map((g) => {
            const list = inGroup(g);
            return (
              <DropZone key={g} group={g} count={list.length} cost={wishlistCost(list)} className="bg-card ring-1 ring-border/60">
                {list.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Drag books here</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
                    {list.map((b) => (
                      <li key={b.id}>
                        <WishCard {...cardProps(b)} />
                      </li>
                    ))}
                  </ul>
                )}
              </DropZone>
            );
          })}
        </div>
      </div>

      {/* The card that follows the pointer, so it can leave the scrolling row without being clipped. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-36 rotate-2 opacity-95">
            <BookCover title={active.title} authors={active.authors} src={active.coverSrc} sizes="144px" className="shadow-book-hover" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DropZone({
  group,
  count,
  cost,
  className,
  children,
}: {
  group: WishGroup;
  count: number;
  cost: ReturnType<typeof wishlistCost>;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group });
  const info = WISH_GROUPS.find((g) => g.id === group)!;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`wish-${group}`}
      className={cn("flex flex-col gap-5 rounded-3xl px-5 py-6 transition-shadow md:px-6", className, isOver && "ring-3 ring-highlight")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <h2 id={`wish-${group}`} className="flex items-baseline gap-2 font-heading text-xl font-semibold text-heading md:text-2xl">
            {info.title}
            <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{info.hint}</p>
        </div>
        {cost.length > 0 && (
          <p className="text-sm text-muted-foreground">
            About <span className="font-semibold text-foreground">{cost.map((c) => formatMoney(c.total, c.currency)).join(" + ")}</span>
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function WishCard({
  book,
  group,
  onMove,
  onBought,
  onRemove,
}: {
  book: Book;
  group: WishGroup;
  onMove: (to: WishGroup) => void;
  onBought: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: book.id });
  // The whole card starts a drag with the mouse or a press on touch; the grip is the keyboard handle.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};
  return (
    <div
      ref={setNodeRef}
      {...pointerListeners}
      // Stop the browser's own image dragging, which would hide the app's drag.
      onDragStart={(e) => e.preventDefault()}
      className={cn("flex cursor-grab flex-col gap-2 select-none active:cursor-grabbing [&_img]:pointer-events-none", isDragging && "opacity-30")}
    >
      <div className="relative">
        <Link href={`/books/${book.id}`} className="block rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none">
          <BookCover title={book.title} authors={book.authors} src={book.coverSrc} lang={book.language} sizes="144px" />
        </Link>
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined}
          aria-label={`Drag ${book.title} to another list`}
          className="absolute top-2 right-2 grid size-8 cursor-grab place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <Link href={`/books/${book.id}`} lang={book.language} className="line-clamp-2 font-heading text-sm leading-snug font-semibold text-heading hover:underline">
          {book.title}
        </Link>
        {book.authors.length > 0 && <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>}
        {book.wishPrice !== undefined && <p className="text-xs font-semibold">{formatMoney(book.wishPrice, book.currency)}</p>}
        {book.whereToBuy && (
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Store className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{book.whereToBuy}</span>
          </p>
        )}
        {book.wishlistReason && <p className="line-clamp-2 text-xs italic">“{book.wishlistReason}”</p>}
      </div>
      <div className="flex items-center gap-1 px-0.5">
        <Button size="xs" className="rounded-full" onClick={onBought}>
          <ShoppingBag aria-hidden />
          Bought it!
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={`More for ${book.title}`} />}>
            <EllipsisVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {WISH_GROUPS.filter((g) => g.id !== group).map((g) => (
                <DropdownMenuItem key={g.id} onClick={() => onMove(g.id)}>
                  {g.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove}>Remove from wishlist</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** One total across every wishlist book; moving books between boxes never changes it. */
function WishlistTotal({ books }: { books: Book[] }) {
  if (books.length === 0) return null;
  const cost = wishlistCost(books);
  const priced = cost.reduce((n, c) => n + c.priced, 0);
  return (
    <p className="-mb-2 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{books.length} {books.length === 1 ? "book" : "books"}</span> on your wishlist
      {cost.length > 0 && (
        <>
          {" · about "}
          <span className="font-semibold text-foreground">{cost.map((c) => formatMoney(c.total, c.currency)).join(" + ")}</span>
          {priced < books.length && ` (${priced} of ${books.length} have a price)`}
        </>
      )}
    </p>
  );
}
