import Anthropic from "@anthropic-ai/sdk";

export const COUNSEL_MODEL = "claude-haiku-4-5";
export const NO_THINKING = { thinking: { type: "disabled" as const } };

export const PROPOSE_TOOL: Anthropic.Messages.Tool = {
  name: "propose_audience",
  description:
    "Name who approaches the lord, about what, and why this turn. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      speakerId: {
        type: "string",
        description: "Exact character id of a living same-faction NPC.",
      },
      addresseeId: {
        type: "string",
        description: "The player lord's character id.",
      },
      kind: {
        type: "string",
        description: "A catalog id, or other.",
      },
      situation: {
        type: "string",
        description: "One or two sentences of what is actually wrong, naming real holds and people.",
      },
      whyNow: {
        type: "string",
        description: "Why this is worth a word now, without depending on today's unresolved marches.",
      },
    },
    required: ["speakerId", "addresseeId", "kind", "situation", "whyNow"],
  },
};

export const OUTCOME_TOOL: Anthropic.Messages.Tool = {
  name: "record_audience_outcome",
  description:
    "Record the small consequences of the lord's answer. Call exactly once. Do not move armies or take seats.",
  input_schema: {
    type: "object",
    properties: {
      narration: {
        type: "string",
        description: "One short paragraph of what followed, for the lord to read.",
      },
      armyUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            armyId: { type: "string" },
            morale: { type: "string" },
            tiredness: { type: "string" },
            stance: { type: "string" },
          },
          required: ["armyId"],
        },
      },
      garrisonUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            holdId: { type: "string" },
            morale: { type: "string" },
            tiredness: { type: "string" },
            stance: { type: "string" },
          },
          required: ["holdId"],
        },
      },
      prisonerActs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            groupId: { type: "string" },
            action: { type: "string", enum: ["release", "execute"] },
          },
          required: ["groupId", "action"],
        },
      },
      forageHolds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            holdId: { type: "string" },
            steps: { type: "integer", minimum: 0, maximum: 2 },
          },
          required: ["holdId", "steps"],
        },
      },
      deedSummary: { type: "string" },
      deedDetail: { type: "string" },
    },
    required: ["narration"],
  },
};

export async function forceToolCall(
  client: Anthropic,
  tool: Anthropic.Messages.Tool,
  system: string,
  userMessage: string,
  maxTokens = 1200
): Promise<Record<string, unknown> | null> {
  const response = await client.messages.create({
    model: COUNSEL_MODEL,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userMessage }],
    ...NO_THINKING,
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);
  const block = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === tool.name
  );
  if (!block) return null;
  return (block.input ?? {}) as Record<string, unknown>;
}
