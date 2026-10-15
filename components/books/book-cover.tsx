"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Jacket colours for books without a cover image; each palette defines them in globals.css. */
const JACKETS = [
  { bg: "bg-(--jacket-1-bg)", fg: "text-(--jacket-1-fg)", line: "border-(--jacket-1-line)" },
  { bg: "bg-(--jacket-2-bg)", fg: "text-(--jacket-2-fg)", line: "border-(--jacket-2-line)" },
  { bg: "bg-(--jacket-3-bg)", fg: "text-(--jacket-3-fg)", line: "border-(--jacket-3-line)" },
  { bg: "bg-(--jacket-4-bg)", fg: "text-(--jacket-4-fg)", line: "border-(--jacket-4-line)" },
  { bg: "bg-(--jacket-5-bg)", fg: "text-(--jacket-5-fg)", line: "border-(--jacket-5-line)" },
];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

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
 * Falls back to a designed jacket with the title when there's no image or it fails to load
 * (after one retry, so a brief network hiccup doesn't leave the jacket up for the whole visit).
 */
export function BookCover({ title, authors = [], src, sizes, priority, className, lang, compact }: BookCoverProps) {
  // ok → (error) → retrying: the jacket shows for a moment, then the image gets a fresh try → (error) → failed.
  const [load, setLoad] = useState<"ok" | "retrying" | "retried" | "failed">("ok");
  const showImage = src && (load === "ok" || load === "retried");
  const onError = () => {
    if (load === "retried") return setLoad("failed");
    setLoad("retrying");
    setTimeout(() => setLoad("retried"), 1500);
  };
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
          key={load}
          src={src}
          alt={`Cover of ${title}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={onError}
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
