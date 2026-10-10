"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Globe, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { setAuthorCountries } from "@/app/actions/author-countries";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRY_CODES, countryName, MAX_AUTHOR_COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";

/** Ukrainian names too, so typing "Укр" finds Ukraine. Built once, in the browser only. */
let ukNames: Map<string, string> | null = null;
function ukName(code: string): string {
  if (!ukNames) {
    ukNames = new Map();
    try {
      const uk = new Intl.DisplayNames(["uk"], { type: "region" });
      for (const c of COUNTRY_CODES) ukNames.set(c, uk.of(c) ?? "");
    } catch {
      // Without Intl region names, English search still works.
    }
  }
  return ukNames.get(code) ?? "";
}

/**
 * Where an author is from: their flags (or "Add country"), opening a searchable list where you
 * pick one or two countries. Saves straight away.
 */
export function CountryPicker({ author, countries, compact }: { author: string; countries: string[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(countries);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }));
    const hits = q ? all.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || ukName(c.code).toLowerCase().includes(q)) : all;
    // Chosen countries first, so they're easy to remove.
    return [...hits.filter((c) => selected.includes(c.code)), ...hits.filter((c) => !selected.includes(c.code))];
  }, [query, selected]);

  const save = (next: string[]) => {
    setSelected(next);
    startTransition(async () => {
      const r = await setAuthorCountries(author, next);
      if (!r.ok) {
        toast.error(r.error);
        setSelected(countries);
      }
    });
  };
  const toggle = (code: string) => {
    if (selected.includes(code)) save(selected.filter((c) => c !== code));
    else if (selected.length < MAX_AUTHOR_COUNTRIES) save([...selected, code]);
    else save([selected[1], code]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={selected.length ? `${author}: ${selected.map(countryName).join(" and ")}. Change country` : `Add a country for ${author}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full align-middle text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected.length ? "px-1.5 py-1" : "border border-dashed px-2 py-0.5",
            )}
          />
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : selected.length ? (
          selected.map((c) => <Flag key={c} code={c} decorative />)
        ) : (
          <>
            <Globe className="size-3.5" aria-hidden />
            {!compact && "Add country"}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex flex-col">
          <div className="border-b p-3">
            <p className="mb-2 text-sm font-medium">Where is {author} from?</p>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" className="h-9 pl-8" aria-label="Search countries" autoFocus />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Up to two, for example the country of birth and the one they write in.</p>
          </div>
          <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Countries" aria-multiselectable>
            {results.map(({ code, name }) => {
              const on = selected.includes(code);
              return (
                <li key={code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(code)}
                    className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none", on && "font-semibold")}
                  >
                    <Flag code={code} decorative />
                    <span className="flex-1 truncate">{name}</span>
                    {on && <Check className="size-4 text-primary" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No country matches “{query}”.</li>}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
