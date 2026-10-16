"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import type { SimilarBooks } from "@/lib/books/similar";
import { askForSimilar } from "@/lib/books/similar-ai";
import { getBooks } from "@/lib/data/books";

/**
 * Books like this one: unread ones from your shelves and new ones for the wishlist, picked by
 * Claude from your own library. Needs ANTHROPIC_API_KEY on the server; nothing is saved.
 */
export async function suggestSimilar(bookId: string): Promise<ActionResult<SimilarBooks>> {
  await requireUser();
  if (!z.uuid().safeParse(bookId).success) return { ok: false, error: "Unknown book." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Suggestions aren't set up: ANTHROPIC_API_KEY is missing." };

  const all = await getBooks();
  const book = all.find((b) => b.id === bookId);
  if (!book) return { ok: false, error: "Unknown book." };

  try {
    const data = await askForSimilar(book, all);
    if (!data) return { ok: false, error: "Couldn't come up with suggestions for this book. Try again?" };
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "Suggestions aren't set up: the ANTHROPIC_API_KEY isn't valid." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Too many requests just now. Try again in a minute." };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Couldn't get suggestions (${e.status ?? "network error"}). Try again?` };
    throw e;
  }
}
