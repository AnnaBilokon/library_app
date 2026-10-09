"use client";

import { Check } from "lucide-react";
import { PALETTES } from "@/lib/palettes";
import { cn } from "@/lib/utils";
import { usePalette } from "./use-palette";

/** Palette cards for the Settings page; the change applies instantly across the app. */
export function PalettePicker() {
  const [palette, setPalette] = usePalette();

  return (
    <div role="radiogroup" aria-label="Colour palette" className="grid gap-3 sm:grid-cols-2">
      {PALETTES.map((p) => {
        const selected = palette === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPalette(p.id)}
            className={cn(
              "flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-left ring-1 ring-transparent transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected && "bg-card ring-2 ring-primary",
            )}
          >
            <span className="flex h-12 overflow-hidden rounded-lg">
              {p.swatches.map((c) => (
                <span key={c} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="flex items-center justify-between gap-2 text-sm font-medium">
              {p.name}
              {selected && <Check className="size-4 text-primary" aria-hidden />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
