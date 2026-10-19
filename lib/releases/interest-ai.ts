import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Edition } from "@/lib/catalog/editions";
import { PICKS_SYSTEM, picksAnswerSchema, picksPrompt, resolvePicks, type ReaderProfile } from "./interest";

/** Haiku: a day's picks cost a fraction of a cent. */
export const PICKS_MODEL = "claude-haiku-5-5";

/** Claude's picks from the shortlist, each with a reason. Null when it declines. Throws Anthropic.APIError. */
export async function choosePicks(profile: ReaderProfile, candidates: Edition[]): Promise<{ editionId: string; reason: string }[] | null> {
  if (candidates.length === 0) return [];
  const response = await new Anthropic().messages.parse({
    model: PICKS_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(picksAnswerSchema) },
    system: PICKS_SYSTEM,
    messages: [{ role: "user", content: picksPrompt(profile, candidates) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return resolvePicks(response.parsed_output, candidates);
}
