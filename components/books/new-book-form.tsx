"use client";

import { useState } from "react";
import { BookForm, type BookFormSuggestions, type NewBookPreset } from "@/components/books/book-form";

/**
 * The "Add a book" form. Next keeps a page's state when you come back to it, so without this the
 * form would still hold the last book you added (or the last author a link filled in). It starts
 * blank again after each save, and whenever it's opened with different prefilled fields.
 */
export function NewBookForm({ suggestions, forWishlist, preset }: { suggestions: BookFormSuggestions; forWishlist: boolean; preset: NewBookPreset }) {
  const [saved, setSaved] = useState(0);
  const key = `${forWishlist}|${preset.authors?.join(",") ?? ""}|${preset.series ?? ""}|${preset.seriesIndex ?? ""}|${saved}`;
  return <BookForm key={key} suggestions={suggestions} forWishlist={forWishlist} preset={preset} onCreated={() => setSaved((n) => n + 1)} />;
}
