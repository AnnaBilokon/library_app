"use client";

import { useState, useTransition } from "react";
import { BookOpen, CircleCheck, EllipsisVertical, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { setBookStatus } from "@/app/actions/books";
import { changeQueue } from "@/app/actions/queue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { todayLocal } from "@/lib/dates";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DnfDialog, FinishDialog } from "./reading-tools";
import { STATUS_ICON } from "./status-badge";

interface Action {
  key: string;
  label: string;
  icon: typeof ListPlus;
  run: () => void;
}

/**
 * Up next / Reading now / Finished on a Library cover: buttons that appear on hover (or keyboard
 * focus) with a mouse, and a ⋮ menu on touch screens, which have no hover.
 */
export function BookQuickActions({ book }: { book: Book }) {
  const [pending, startTransition] = useTransition();
  const [finishOpen, setFinishOpen] = useState(false);
  const [dnfOpen, setDnfOpen] = useState(false);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    startTransition(async () => {
      const r = await action();
      if (r.ok) toast.success(message);
      else toast.error(r.error ?? "Couldn't save.");
    });

  const actions: Action[] = [];
  if (book.queuePosition === undefined && book.status !== "reading") {
    actions.push({ key: "queue", label: "Up next", icon: ListPlus, run: () => run(() => changeQueue(book.id, "append"), `“${book.title}” is in Up next`) });
  }
  if (book.status !== "reading") {
    const label = book.status === "finished" ? "Read again" : book.status === "paused" ? "Continue" : book.status === "abandoned" ? "Try again" : "Reading now";
    actions.push({
      key: "reading",
      label,
      icon: BookOpen,
      run: () => run(() => setBookStatus(book.id, "reading", todayLocal()), book.status === "paused" ? "Back to reading" : `Reading “${book.title}” from today`),
    });
  }
  if (book.status !== "finished") {
    actions.push({ key: "finished", label: "Finished", icon: CircleCheck, run: () => setFinishOpen(true) });
  }
  // Only for a book you're in the middle of: asks where you stopped and why.
  if (book.status === "reading" || book.status === "paused") {
    actions.push({ key: "dnf", label: "Didn't finish", icon: STATUS_ICON.abandoned, run: () => setDnfOpen(true) });
  }
  if (actions.length === 0) return null;

  return (
    <>
      {/* Mouse: shown on hover or when a button has keyboard focus. */}
      <div
        className={cn(
          "absolute inset-x-2 bottom-2 hidden flex-col gap-1.5 opacity-0 transition-opacity duration-200 pointer-fine:flex group-hover:opacity-100 focus-within:opacity-100",
          pending && "opacity-100",
        )}
      >
        {actions.map(({ key, label, icon: Icon, run: onClick }) => (
          <button
            key={key}
            type="button"
            disabled={pending}
            onClick={onClick}
            aria-label={`${label}: ${book.title}`}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-background/95 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none disabled:opacity-60"
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Touch: a small menu button that's always there. */}
      <div className="absolute right-2 bottom-2 pointer-fine:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            aria-label={`Quick actions for ${book.title}`}
            className="grid size-9 place-items-center rounded-full bg-background/95 text-foreground shadow-sm backdrop-blur focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <EllipsisVertical className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {actions.map(({ key, label, icon: Icon, run: onClick }) => (
              <DropdownMenuItem key={key} onClick={onClick}>
                <Icon aria-hidden />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Only mounted when opened, so a big library doesn't render hundreds of dialogs. */}
      {finishOpen && <FinishDialog book={book} open onOpenChange={setFinishOpen} />}
      {dnfOpen && <DnfDialog book={book} open onOpenChange={setDnfOpen} />}
    </>
  );
}
