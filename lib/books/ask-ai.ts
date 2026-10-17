import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ASK_SYSTEM, askAnswerSchema, askPrompt, resolveAsk, type AskOptions, type AskResult } from "./ask";

/** Haiku: a question costs a fraction of a cent and takes a second or two. */
export const ASK_MODEL = "claude-haiku-5-5";

/** The question as Library filters. Null when Claude declines or the answer doesn't parse. Throws Anthropic.APIError. */
export async function askForFilters(question: string, options: AskOptions, today: string): Promise<AskResult | null> {
  const response = await new Anthropic().messages.parse({
    model: ASK_MODEL,
    max_tokens: 4000,
    // Mapping words to filters needs little thinking; low effort keeps it quick.
    output_config: { effort: "low", format: zodOutputFormat(askAnswerSchema) },
    system: ASK_SYSTEM,
    messages: [{ role: "user", content: askPrompt(question, options, today) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return resolveAsk(response.parsed_output, options);
}
