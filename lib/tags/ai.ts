import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  cleanTagList,
  resolveTagSuggestions,
  TAG_BOOKS_SYSTEM,
  TAG_LIST_SYSTEM,
  tagBooksAnswerSchema,
  tagBooksPrompt,
  tagListAnswerSchema,
  tagListPrompt,
  type TaggableBook,
  type TagSuggestion,
} from "./tags";

/** Haiku: tagging the whole library costs a few cents. */
export const TAG_MODEL = "claude-haiku-5-5";

/** A starting tag list for the library (your tags kept). Null when Claude declines or the answer doesn't parse. */
export async function proposeTagList(books: TaggableBook[], genres: string[]): Promise<string[] | null> {
  const response = await new Anthropic().messages.parse({
    model: TAG_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(tagListAnswerSchema) },
    system: TAG_LIST_SYSTEM,
    messages: [{ role: "user", content: tagListPrompt(books, genres) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return cleanTagList(response.parsed_output.tags);
}

/** Tag suggestions for a few books (TAG_BATCH at most), only from `tagList`. Throws Anthropic.APIError. */
export async function suggestTags(books: TaggableBook[], tagList: string[]): Promise<TagSuggestion[] | null> {
  const response = await new Anthropic().messages.parse({
    model: TAG_MODEL,
    max_tokens: 8000,
    // Choosing from a fixed list is simple work: low effort keeps it quick and cheap.
    output_config: { effort: "low", format: zodOutputFormat(tagBooksAnswerSchema) },
    system: TAG_BOOKS_SYSTEM,
    messages: [{ role: "user", content: tagBooksPrompt(books, tagList) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return resolveTagSuggestions(response.parsed_output, books, tagList);
}
