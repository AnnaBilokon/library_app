import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GENRES_SYSTEM, genresAnswerSchema, genresPrompt, resolveGenres, type GenreBook } from "./genres";

/** Haiku: sorting a check's worth of new books costs a cent or two. */
export const GENRE_MODEL = "claude-haiku-5-5";

/** Genres for a few books (GENRE_BATCH at most), only from `genres`. Null when Claude declines. Throws Anthropic.APIError. */
export async function sortIntoGenres(books: GenreBook[], genres: string[]): Promise<{ id: string; genres: string[] }[] | null> {
  const response = await new Anthropic().messages.parse({
    model: GENRE_MODEL,
    max_tokens: 8000,
    // Choosing from a short fixed list is simple work.
    output_config: { effort: "low", format: zodOutputFormat(genresAnswerSchema) },
    system: GENRES_SYSTEM,
    messages: [{ role: "user", content: genresPrompt(books, genres) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return resolveGenres(response.parsed_output, books, genres);
}
