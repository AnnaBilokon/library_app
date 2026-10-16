"use client";

import { useState } from "react";
import { BookForm, type BookFormSuggestions, type NewBookPreset } from "@/components/books/book-form";
import type { Edition } from "@/lib/catalog/editions";

/**
 * The "Add a book" form. Next keeps a page's state when you come back to it, so without this the
 * form would still hold the last book you added (or the last author a link filled in). It starts
 * blank again after each save, and whenever it's opened with different prefilled fields.
 */
export function NewBookForm({
  suggestions,
  forWishlist,
  preset,
  edition,
}: {
  suggestions: BookFormSuggestions;
  forWishlist: boolean;
  preset: NewBookPreset;
  /** Opened with ?edition=…: start from that catalog edition. */
  edition?: Edition;
}) {
  const [saved, setSaved] = useState(0);
  const key = `${forWishlist}|${preset.authors?.join(",") ?? ""}|${preset.series ?? ""}|${preset.seriesIndex ?? ""}|${edition?.id ?? ""}|${saved}`;
  // After the first save, the next book starts blank (not from the same edition again).
  return (
    <BookForm
      key={key}
      suggestions={suggestions}
      forWishlist={forWishlist}
      preset={preset}
      edition={saved === 0 ? edition : undefined}
      onCreated={() => setSaved((n) => n + 1)}
    />
  );
}
