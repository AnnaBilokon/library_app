"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/books";
import { requireUser } from "@/lib/auth";
import type { AskResult } from "@/lib/books/ask";
import { askForFilters } from "@/lib/books/ask-ai";
import { facets } from "@/lib/books/filters";
import { getAuthorCountries } from "@/lib/data/author-countries";
import { getBooks } from "@/lib/data/books";
import { getSettings } from "@/lib/data/settings";

/**
 * "Ask your library": turns a question in your own words ("short cozy books I haven't read",
 * "what did I read last summer?") into Library filters. Nothing is saved.
 */
export async function askLibrary(question: string, today: string): Promise<ActionResult<AskResult>> {
  await requireUser();
  const q = z.string().trim().min(2).max(500).safeParse(question);
  if (!q.success) return { ok: false, error: "Type a question first." };
  if (!z.iso.date().safeParse(today).success) return { ok: false, error: "Invalid date." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Asking isn't set up: ANTHROPIC_API_KEY is missing." };

  const [books, authorCountries, { tagList }] = await Promise.all([getBooks(), getAuthorCountries(), getSettings()]);
  const f = facets(books);
  const options = {
    genres: f.genre,
    tags: [...new Set([...tagList, ...f.tag.map((t) => t.value)])],
    authors: f.author,
    publishers: f.publisher,
    languages: f.language,
    series: f.series,
    countries: [...new Set(Object.values(authorCountries).flat())].sort(),
  };

  try {
    const result = await askForFilters(q.data, options, today);
    return result ? { ok: true, data: result } : { ok: false, error: "Couldn't turn that into filters. Try asking another way?" };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "Asking isn't set up: the ANTHROPIC_API_KEY isn't valid." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Too many requests just now. Try again in a minute." };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Couldn't ask (${e.status ?? "network error"}). Try again?` };
    throw e;
  }
}
