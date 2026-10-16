import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Book } from "@/lib/types";
import { resolveAnswer, shelfCandidates, SIMILAR_SYSTEM, similarAnswerSchema, similarPrompt, type SimilarBooks } from "./similar";

/** Haiku: a request costs well under a cent. Switch to "claude-sonnet-5-5" if picks feel off. */
export const SIMILAR_MODEL = "claude-haiku-5-5";

/** Asks Claude for books like `book`. Returns null when it declines or the answer doesn't parse. Throws Anthropic.APIError. */
export async function askForSimilar(book: Book, all: Book[]): Promise<SimilarBooks | null> {
  const candidates = shelfCandidates(book, all);
  const response = await new Anthropic().messages.parse({
    model: SIMILAR_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(similarAnswerSchema) },
    system: SIMILAR_SYSTEM,
    messages: [{ role: "user", content: similarPrompt(book, candidates, all) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return resolveAnswer(response.parsed_output, candidates, all);
}
