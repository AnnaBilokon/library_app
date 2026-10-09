"use client";

import { useTransition } from "react";
import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { purgeBook, restoreBook } from "@/app/actions/books";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/books/labels";
import type { Book } from "@/lib/types";
import { BookCover } from "./book-cover";

export function TrashList({ books }: { books: (Book & { deletedAt: string })[] }) {
  const [pending, startTransition] = useTransition();

  if (books.length === 0) return <p className="text-sm text-muted-foreground">The trash is empty.</p>;

  const restore = (b: Book) =>
    startTransition(async () => {
      const r = await restoreBook(b.id);
      if (r.ok) toast.success(`Restored “${b.title}”`);
      else toast.error(r.error);
    });

  const purge = (b: Book) => {
    if (!window.confirm(`Delete “${b.title}” forever? This can't be undone.`)) return;
    startTransition(async () => {
      const r = await purgeBook(b.id);
      if (r.ok) toast.success("Deleted forever");
      else toast.error(r.error);
    });
  };

  return (
    <ul className="flex flex-col divide-y divide-border/70">
      {books.map((b) => (
        <li key={b.id} className="flex items-center gap-3 py-3">
          <BookCover title={b.title} src={b.coverSrc} sizes="40px" className="w-10 shrink-0" compact />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{b.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {b.authors.join(", ")}
              {b.authors.length > 0 && " · "}removed {formatDate(b.deletedAt)}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => restore(b)} disabled={pending}>
            <RotateCcw aria-hidden />
            Restore
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${b.title} forever`}
            onClick={() => purge(b)}
            disabled={pending}
          >
            <Trash2 aria-hidden />
          </Button>
        </li>
      ))}
      <li className="pt-3 text-xs text-muted-foreground">
        Restored books go back to the <Link href="/library" className="underline">library</Link> with their readings.
      </li>
    </ul>
  );
}
