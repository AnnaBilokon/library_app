"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { libraryUrl } from "@/lib/books/library-url";
import { cn } from "@/lib/utils";
import { CountryPicker } from "./country-picker";

interface Row {
  author: string;
  books: number;
  countries: string[];
}

/** Every author in your library with their country; those without one first, ready to fill in. */
export function AuthorCountryList({ authors }: { authors: Row[] }) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const missing = authors.filter((a) => a.countries.length === 0).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return authors.filter((a) => (!onlyMissing || a.countries.length === 0 || q) && (!q || a.author.toLowerCase().includes(q)));
  }, [authors, query, onlyMissing]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{authors.length - missing}</span> of {authors.length} authors have a country.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search authors" aria-label="Search authors" className="h-9 pl-8" />
        </div>
        <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Show">
          {[true, false].map((only) => (
            <button
              key={String(only)}
              type="button"
              aria-pressed={onlyMissing === only}
              onClick={() => setOnlyMissing(only)}
              className={cn(
                "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                onlyMissing === only && "bg-background text-foreground shadow-sm",
              )}
            >
              {only ? `Without a country (${missing})` : "All"}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{query ? `No author matches “${query}”.` : "Every author has a country."}</p>
      ) : (
        <ul className="flex max-h-[28rem] flex-col divide-y divide-border/60 overflow-y-auto pr-1">
          {rows.map((a) => (
            <li key={a.author} className="flex items-center gap-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <Link href={libraryUrl({ author: a.author })} className="truncate text-sm font-medium hover:underline">
                  {a.author}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {a.books} {a.books === 1 ? "book" : "books"}
                </span>
              </span>
              {/* key: start fresh when the saved countries change */}
              <CountryPicker key={a.countries.join()} author={a.author} countries={a.countries} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
