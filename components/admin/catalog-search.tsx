"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * The catalog search box: the list updates as you type (a moment after you stop), and the query
 * stays in the URL, so a search survives a refresh and the Back button. Without JavaScript it's a
 * plain form.
 */
export function CatalogSearch({ q, filter }: { q: string; filter: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const timer = setTimeout(() => {
      const sp = new URLSearchParams();
      if (text.trim()) sp.set("q", text.trim());
      if (filter !== "all") sp.set("filter", filter);
      const qs = sp.toString();
      // A new search starts again at page 1; replace, so Back doesn't step through every keystroke.
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [text, filter, pathname, router]);

  return (
    <form action={pathname} role="search" className="relative" onSubmit={(e) => e.preventDefault()}>
      {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        name="q"
        type="search"
        value={text}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
        }}
        placeholder="Title, author, publisher or ISBN"
        aria-label="Search the catalog"
        autoComplete="off"
        className="h-11 rounded-full pr-10 pl-10 text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
      />
      <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
        ) : text ? (
          <button
            type="button"
            onClick={() => {
              typed.current = true;
              setText("");
            }}
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear the search"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </form>
  );
}
