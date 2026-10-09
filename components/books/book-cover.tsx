"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Jacket colours for books without a cover image, all from the palette. */
const JACKETS = [
  { bg: "bg-[#513b3c]", fg: "text-[#f3efea]", line: "border-[#c1eeff]/40" },
  { bg: "bg-[#28231c]", fg: "text-[#f3efea]", line: "border-[#c1eeff]/30" },
  { bg: "bg-[#655356]", fg: "text-[#f7f3ee]", line: "border-[#f7f3ee]/35" },
  { bg: "bg-[#c1eeff]", fg: "text-[#28231c]", line: "border-[#513b3c]/35" },
  { bg: "bg-[#ebe3dc]", fg: "text-[#513b3c]", line: "border-[#513b3c]/30" },
];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Our own Storage copies can go through Next's image optimiser; other hosts are shown as-is. */
const isOptimizable = (src: string) => /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src);

interface BookCoverProps {
  title: string;
  authors?: string[];
  src?: string;
  /** Passed to next/image so it picks a suitable size, e.g. "(min-width: 768px) 200px, 45vw". */
  sizes: string;
  priority?: boolean;
  className?: string;
  lang?: string;
  /** Small covers (table rows) skip the jacket text. */
  compact?: boolean;
}

/**
 * A 2:3 book: slightly rounded on the open side, a shaded spine on the left and a soft shadow.
 * Falls back to a designed jacket with the title when there's no image or it fails to load.
 */
export function BookCover({ title, authors = [], src, sizes, priority, className, lang, compact }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const jacket = JACKETS[hash(title) % JACKETS.length];

  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-[2px_5px_5px_2px] bg-muted shadow-book",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt={`Cover of ${title}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!isOptimizable(src)}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div lang={lang} role="img" aria-label={`${title} (no cover)`} className={cn("size-full p-[7%]", jacket.bg, jacket.fg)}>
          {!compact && (
            <div className={cn("flex size-full flex-col items-center justify-between border px-[8%] py-[12%] text-center", jacket.line)}>
              <span className="line-clamp-5 font-heading text-[clamp(0.8rem,1.2vw+0.45rem,1.15rem)] leading-tight font-semibold text-balance">
                {title}
              </span>
              <span aria-hidden className="text-[0.6rem] tracking-[0.3em] opacity-60">
                ◆
              </span>
              {authors.length > 0 ? (
                <span className="line-clamp-2 text-[0.6rem] font-medium tracking-[0.12em] uppercase opacity-80">
                  {authors.join(", ")}
                </span>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}
      {/* Spine shading and a faint page-edge highlight, on top of image or jacket. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/30 via-white/15 to-transparent"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/10 ring-inset dark:ring-white/10" />
    </div>
  );
}
