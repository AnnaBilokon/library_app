"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookIcon, Search } from "lucide-react";
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
import { NAV_ITEMS } from "./nav-items";

export interface CommandBook {
  id: string;
  title: string;
  authors: string[];
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
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full max-w-64 justify-start gap-2 text-muted-foreground sm:w-64"
        aria-label="Search books and pages"
      >
        <Search aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a book or a page">
        <Command>
          <CommandInput placeholder="Book title, author or page…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
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
                <CommandItem key={b.id} value={`${b.title} ${b.authors.join(" ")} ${b.id}`} onSelect={() => go(`/books/${b.id}`)}>
                  <BookIcon aria-hidden />
                  <span className="truncate">
                    {b.title}
                    {b.authors.length > 0 && <span className="text-muted-foreground"> · {b.authors.join(", ")}</span>}
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
