"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultFilter } from "cmdk";
import { BarChart3, BookIcon, PartyPopper, Plus, Search, Sparkles, Sprout, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { normalizeIsbn } from "@/lib/isbn";
import { NAV_ITEMS } from "./nav-items";

export interface CommandBook {
  id: string;
  title: string;
  authors: string[];
  /** Typing the digits finds the book. */
  isbn?: string;
  /** On the wishlist (not on your shelves). */
  wanted?: boolean;
  /** Sold (not in the library anymore). */
  soldAt?: string;
}

/**
 * A whole ISBN (with or without dashes, ISBN-10 or -13) finds exactly the book that has it;
 * anything else is cmdk's usual fuzzy match on titles, authors and pages.
 */
function matchItem(value: string, search: string, keywords?: string[]): number {
  const isbn = normalizeIsbn(search);
  if (isbn) return keywords?.includes(isbn) ? 1 : 0;
  return defaultFilter(value, search, keywords);
}

/** Ctrl/Cmd+K: jump to any page or book. */
export function CommandMenu({ books }: { books: CommandBook[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="size-9 justify-center rounded-full bg-muted px-0 text-muted-foreground hover:bg-secondary md:w-56 md:justify-start md:gap-2 md:px-3.5"
        aria-label="Search books and pages"
      >
        <Search aria-hidden />
        <span className="hidden truncate md:inline">Jump to a book…</span>
        <kbd className="ml-auto hidden rounded-full bg-background px-1.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a book or a page">
        <Command filter={matchItem}>
          <CommandInput placeholder="Book title, author, ISBN or page…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem value="add a new book" onSelect={() => go("/books/new")}>
                <Plus aria-hidden />
                Add a book
              </CommandItem>
              <CommandItem value="surprise me pick my next book random" onSelect={() => go("/surprise")}>
                <Sparkles aria-hidden />
                Surprise me
              </CommandItem>
              <CommandItem value="year in books annual report" onSelect={() => go("/year-in-books")}>
                <PartyPopper aria-hidden />
                Year in Books
              </CommandItem>
              <CommandItem value="page stats statistics numbers" onSelect={() => go("/stats")}>
                <BarChart3 aria-hidden />
                Stats
              </CommandItem>
              <CommandItem value="book battle tournament best worst of the year" onSelect={() => go("/battle")}>
                <Swords aria-hidden />
                Book Battle
              </CommandItem>
              <CommandItem value="reading habits streak badges" onSelect={() => go("/habits")}>
                <Sprout aria-hidden />
                Reading habits
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Pages">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`page ${label}`} onSelect={() => go(href)}>
                  <Icon aria-hidden />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Books">
              {books.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`${b.title} ${b.authors.join(" ")} ${b.id}`}
                  keywords={b.isbn ? [b.isbn] : undefined}
                  onSelect={() => go(`/books/${b.id}`)}
                >
                  <BookIcon aria-hidden />
                  <span className="truncate">
                    {b.title}
                    {b.authors.length > 0 && <span className="text-muted-foreground"> · {b.authors.join(", ")}</span>}
                    {b.wanted && <span className="text-muted-foreground"> · wishlist</span>}
                    {b.soldAt && <span className="text-muted-foreground"> · sold</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
