import { BookCheck, BookMarked, BookOpen, BookX, PauseCircle } from "lucide-react";
import { STATUS_LABEL } from "@/lib/books/labels";
import type { BookStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_ICON = {
  "to-read": BookMarked,
  reading: BookOpen,
  paused: PauseCircle,
  finished: BookCheck,
  abandoned: BookX,
} as const;

const STATUS_STYLE: Record<BookStatus, string> = {
  "to-read": "bg-muted text-muted-foreground",
  reading: "bg-highlight text-highlight-foreground",
  paused: "bg-secondary text-secondary-foreground",
  finished: "bg-primary text-primary-foreground",
  abandoned: "bg-muted text-muted-foreground line-through decoration-1",
};

export function StatusBadge({ status, className }: { status: BookStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLE[status],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
