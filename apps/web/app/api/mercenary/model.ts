import Anthropic from "@anthropic-ai/sdk";

const MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];
const NO_THINKING = { thinking: { type: "disabled" as const } };

export function anthropicClient(): Anthropic | { error: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { error: "ANTHROPIC_API_KEY is not set." };
  return new Anthropic({ apiKey });
}

export async function createMessage(
  client: Anthropic,
  body: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, "model">
): Promise<Anthropic.Messages.Message | { error: string }> {
  let last = "No model responded.";
  for (const model of MODELS) {
    try {
      const response = await client.messages.create({
        ...body,
        model,
        ...NO_THINKING,
      } as Anthropic.Messages.MessageCreateParamsNonStreaming);
      return response;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (/authentication|api.?key|401|403/i.test(last)) break;
    }
  }
  return { error: last };
}

export function textOf(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function toolUses(response: Anthropic.Messages.Message): Anthropic.Messages.ToolUseBlock[] {
  return response.content.filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use");
}
