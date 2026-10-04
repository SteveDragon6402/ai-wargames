import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, textOf, toolUses } from "../mercenary/model";

const SMALL = ["claude-haiku-4-5", "claude-sonnet-5"];
const STRONG = ["claude-sonnet-5", "claude-haiku-4-5"];

export { anthropicClient, textOf, toolUses };

export async function complete(
  client: Anthropic,
  tier: "small" | "strong",
  body: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Messages.Message | { error: string }> {
  const models = tier === "strong" ? STRONG : SMALL;
  let last = "No model responded.";
  for (const model of models) {
    try {
      return await client.messages.create({
        ...body,
        model,
        thinking: { type: "disabled" },
      } as Anthropic.Messages.MessageCreateParamsNonStreaming);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (/authentication|api.?key|401|403/i.test(last)) break;
    }
  }
  return { error: last };
}
