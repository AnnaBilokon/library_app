import { countryName, flagSrc } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * A country flag as an image (emoji flags show as letters on Windows). `decorative` hides it from
 * screen readers when the country name is written next to it.
 */
export function Flag({ code, className, decorative }: { code: string; className?: string; decorative?: boolean }) {
  return (
    // Tiny static SVGs from /public/flags; next/image would add nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc(code)}
      alt={decorative ? "" : countryName(code)}
      title={decorative ? undefined : countryName(code)}
      width={18}
      height={12}
      loading="lazy"
      className={cn("inline-block h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10", className)}
    />
  );
}

/** Several flags side by side (co-authors from different countries, or an author with two). */
export function Flags({ codes, className }: { codes: string[]; className?: string }) {
  if (codes.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 align-middle", className)}>
      {codes.map((c) => (
        <Flag key={c} code={c} />
      ))}
    </span>
  );
}
