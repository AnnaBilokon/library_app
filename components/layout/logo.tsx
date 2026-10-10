import { cn } from "@/lib/utils";

/**
 * The app icon: an open book with a dot on top, on a rounded tile. Colours come from the --logo-*
 * tokens in globals.css, so it follows the palette and light/dark mode.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--logo-tile)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* The two pages, curving down to the spine. */}
        <path d="M16 10.4c-2.9-1.5-6.6-1.8-9.6-.9v12.8c3-.8 6.7-.5 9.6 1.1" stroke="var(--logo-book)" strokeWidth="1.9" />
        <path d="M16 10.4c2.9-1.5 6.6-1.8 9.6-.9v12.8c-3-.8-6.7-.5-9.6 1.1" stroke="var(--logo-book)" strokeWidth="1.9" />
        <path d="M16 11.2v12" stroke="var(--logo-spine)" strokeWidth="1.5" />
      </g>
      {/* The punkt. */}
      <circle cx="16" cy="9.6" r="2.4" fill="var(--logo-book)" />
    </svg>
  );
}

/** "P·unkt": an italic P, the dot, then "unkt", in the serif. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading leading-none font-bold tracking-tight", className)} aria-label="Punkt">
      <span aria-hidden className="italic" style={{ color: "var(--logo-p)" }}>
        P
      </span>
      <span aria-hidden style={{ color: "var(--logo-dot)" }}>
        ·
      </span>
      <span aria-hidden style={{ color: "var(--logo-rest)" }}>
        unkt
      </span>
    </span>
  );
}

/** Icon and wordmark together, as in the top bar. */
export function Logo({ className, markClassName, wordClassName }: { className?: string; markClassName?: string; wordClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <Wordmark className={cn("text-2xl", wordClassName)} />
    </span>
  );
}
