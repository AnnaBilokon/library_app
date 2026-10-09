"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number | null | undefined;
  /** Without onChange the stars are display-only. */
  onChange?: (value: number | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

const SIZE = { sm: "size-4", md: "size-5", lg: "size-7" };

/**
 * Five stars. Click a star to rate; click the current rating again to clear it.
 * Arrow keys work too (it's a radio group for screen readers and keyboards).
 */
export function RatingStars({ value, onChange, size = "md", className, disabled }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const icon = SIZE[size];

  if (!onChange) {
    return (
      <span role="img" aria-label={value ? `Rated ${value} out of 5` : "Not rated"} className={cn("inline-flex gap-0.5", className)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon key={n} fill={Math.max(0, Math.min(1, shown - (n - 1)))} className={icon} />
        ))}
      </span>
    );
  }

  return (
    <span
      role="radiogroup"
      aria-label="Rating"
      className={cn("inline-flex gap-0.5", disabled && "pointer-events-none opacity-60", className)}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const checked = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${n} star${n > 1 ? "s" : ""}${checked ? " (click to clear)" : ""}`}
            tabIndex={checked || (!value && n === 1) ? 0 : -1}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(checked ? null : n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(Math.min(5, (value ?? 0) + 1));
              } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(Math.max(1, (value ?? 2) - 1));
              }
            }}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <StarIcon fill={shown >= n ? 1 : 0} className={icon} />
          </button>
        );
      })}
    </span>
  );
}

function StarIcon({ fill, className }: { fill: number; className: string }) {
  return (
    <span className={cn("relative inline-block", className)} aria-hidden>
      <Star className={cn("absolute inset-0 text-muted-foreground/40", className)} />
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <Star className={cn("fill-primary text-primary dark:fill-highlight dark:text-highlight", className)} />
      </span>
    </span>
  );
}
