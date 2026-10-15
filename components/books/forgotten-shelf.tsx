"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { setForgotten } from "@/app/actions/books";
import { BookCover } from "@/components/books/book-cover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Book } from "@/lib/types";
import { BookCard } from "./book-grid";

/** The Forgotten box tab on the Library shelf: books you'd like to be reminded of ("Surprise me" can pick from them). */
export function ForgottenShelf({ box, books }: { box: Book[]; books: Book[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (book: Book, on: boolean) =>
    startTransition(async () => {
      const r = await setForgotten(book.id, on);
      if (!r.ok) toast.error(r.error);
      else toast.success(on ? `“${book.title}” is in the Forgotten box` : `Took “${book.title}” out of the box`);
    });

  return (
    <div className="flex flex-col gap-3">
      {box.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Empty for now. Add books you keep meaning to get to, or ones you&apos;d love to reread.
        </p>
      ) : (
        <ul className="-mx-5 flex snap-x scroll-px-5 gap-5 overflow-x-auto px-5 pt-1 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
          {box.map((book) => (
            <li key={book.id} className="w-32 shrink-0 snap-start sm:w-36">
              <BookCard book={book} sizes="144px" />
              <div className="mt-1 flex px-0.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(book, false)}
                  aria-label={`Take ${book.title} out of the Forgotten box`}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground ring-1 ring-border hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add books
        </Button>
        <p className="text-xs text-muted-foreground">
          <Link href="/surprise" className="underline underline-offset-4 hover:text-foreground">
            Surprise me
          </Link>{" "}
          can pick from these.
        </p>
      </div>
      {adding && <AddToBox books={books} onClose={() => setAdding(false)} onToggle={toggle} pending={pending} />}
    </div>
  );
}

function AddToBox({ books, onClose, onToggle, pending }: { books: Book[]; onClose: () => void; onToggle: (b: Book, on: boolean) => void; pending: boolean }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => b.status !== "reading" && (!q || b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q))))
      .slice(0, 60);
  }, [books, query]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to the Forgotten box</DialogTitle>
          <DialogDescription>Search your library and add the books you&apos;d like to be reminded of.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or author" aria-label="Search your library" className="h-10 pl-8" autoFocus />
        </div>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {results.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <BookCover title={b.title} src={b.coverSrc} sizes="32px" className="w-8 shrink-0" compact />
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={b.language} className="truncate text-sm font-medium">
                  {b.title}
                </span>
                {b.authors.length > 0 && <span className="truncate text-xs text-muted-foreground">{b.authors.join(", ")}</span>}
              </span>
              <Button size="sm" variant={b.forgotten ? "secondary" : "outline"} className="rounded-full" disabled={pending} onClick={() => onToggle(b, !b.forgotten)}>
                {b.forgotten ? "In the box" : "Add"}
              </Button>
            </li>
          ))}
          {results.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No book matches “{query}”.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
