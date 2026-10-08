"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const PLACEHOLDER_COLOURS = [
  "bg-[#513b3c] text-[#f3efea]",
  "bg-[#28231c] text-[#f3efea]",
  "bg-[#655356] text-[#f3efea]",
  "bg-[#c1eeff] text-[#070707]",
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
}

/** A 2:3 book cover. Falls back to a coloured card with the title when there's no image or it fails to load. */
export function BookCover({ title, authors = [], src, sizes, priority, className, lang }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-black/5 dark:ring-white/10", className)}>
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
        <div
          lang={lang}
          role="img"
          aria-label={`${title} (no cover)`}
          className={cn(
            "flex size-full flex-col justify-between p-[8%] font-heading",
            PLACEHOLDER_COLOURS[hash(title) % PLACEHOLDER_COLOURS.length],
          )}
        >
          <span className="line-clamp-5 text-[clamp(0.7rem,1.1vw+0.4rem,1.05rem)] leading-tight font-semibold">{title}</span>
          {authors.length > 0 && <span className="line-clamp-2 text-[0.7rem] opacity-80">{authors.join(", ")}</span>}
        </div>
      )}
    </div>
  );
}
