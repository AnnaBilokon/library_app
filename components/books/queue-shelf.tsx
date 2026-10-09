"use client";

import { useRef, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { changeQueue, reorderQueue } from "@/app/actions/queue";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookCard } from "./book-grid";

/**
 * The "Up next" queue as a row of covers you can reorder by dragging the grip
 * (mouse, touch with a short press, or keyboard: Space to pick up, arrows to move, Space to drop).
 * The first book is the pinned next read.
 */
export function QueueShelf({ queue }: { queue: Book[] }) {
  const [order, setOrder] = useState(() => queue.map((b) => b.id));
  const [, startTransition] = useTransition();
  const justDragged = useRef(false);
  const byId = new Map(queue.map((b) => [b.id, b]));
  const books = order.map((id) => byId.get(id)).filter((b): b is Book => Boolean(b));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press before dragging, so swiping still scrolls the row on a phone.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const save = (next: string[], previous: string[], message?: string) =>
    startTransition(async () => {
      const r = await reorderQueue(next);
      if (!r.ok) {
        setOrder(previous);
        toast.error(r.error);
      } else if (message) toast.success(message);
    });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 150);
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    save(next, previous, next[0] !== previous[0] ? `“${byId.get(next[0])?.title}” is your next read` : undefined);
  };

  const pin = (id: string) => {
    const previous = order;
    const next = [id, ...order.filter((x) => x !== id)];
    setOrder(next);
    save(next, previous, `“${byId.get(id)?.title}” is your next read`);
  };

  const remove = (id: string) => {
    const previous = order;
    setOrder(order.filter((x) => x !== id));
    startTransition(async () => {
      const r = await changeQueue(id, "remove");
      if (!r.ok) {
        setOrder(previous);
        toast.error(r.error);
      }
    });
  };

  const title = (id: string | number) => byId.get(String(id))?.title ?? "Book";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} moved to position ${order.indexOf(String(over.id)) + 1}.` : ""),
    onDragEnd: ({ active, over }) => (over ? `${title(active.id)} dropped at position ${order.indexOf(String(over.id)) + 1}.` : "Cancelled."),
    onDragCancel: ({ active }) => `Cancelled. ${title(active.id)} stays where it was.`,
  };

  if (books.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your queue is empty. Open a book you want to read soon and choose <span className="font-medium">Add to Up next</span>.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <ol
          className="-mx-5 flex gap-5 overflow-x-auto px-5 pt-1 pb-2 md:-mx-8 md:px-8"
          // Don't open a book when a drag ends over its link.
          onClickCapture={(e) => {
            if (justDragged.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {books.map((book, i) => (
            <SortableBook key={book.id} book={book} index={i} onPin={() => pin(book.id)} onRemove={() => remove(book.id)} />
          ))}
        </ol>
      </SortableContext>
      <p className="mt-3 text-xs text-muted-foreground">Drag the grip to reorder. The first book is your next read.</p>
    </DndContext>
  );
}

function SortableBook({ book, index, onPin, onRemove }: { book: Book; index: number; onPin: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: book.id });
  const next = index === 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative w-32 shrink-0 sm:w-36", isDragging && "z-10 opacity-90 [&_a]:pointer-events-none")}
    >
      <div className={cn("transition-transform", isDragging && "scale-105 rotate-1")}>
        <BookCard book={book} sizes="144px" priority={index < 4} hideRibbon={next} />
      </div>
      {next && (
        <span className="pointer-events-none absolute top-3 left-0 inline-flex items-center gap-1 rounded-r-full bg-primary py-0.5 pr-2.5 pl-2 text-[10px] font-semibold tracking-wider text-primary-foreground uppercase shadow-sm">
          <Pin className="size-3" aria-hidden />
          Next read
        </span>
      )}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${book.title} (position ${index + 1})`}
        className="absolute top-2 right-2 grid size-8 cursor-grab touch-none place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="mt-1 flex gap-1 px-0.5">
        {!next && (
          <button
            type="button"
            onClick={onPin}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground ring-1 ring-border hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Pin className="size-3" aria-hidden />
            Read next
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${book.title} from Up next`}
          className="grid size-7 place-items-center rounded-full text-muted-foreground ring-1 ring-border hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}
