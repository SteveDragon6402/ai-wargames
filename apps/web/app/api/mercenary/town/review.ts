import type Anthropic from "@anthropic-ai/sdk";
import { createMessage, toolUses } from "../model";
import type { TownTrigger } from "@/app/mercenary/lib/types";

const CONFIRM: Anthropic.Tool = {
  name: "confirm_trigger",
  description: "Say which real event this promise waits on. The only event is bandits-defeated. If the reason is anything else, including a harvest or a shipment, choose none.",
  input_schema: {
    type: "object",
    properties: { trigger: { type: "string", enum: ["bandits-defeated", "none"] } },
    required: ["trigger"],
  },
};

export async function reviewTownTrigger(client: Anthropic, why: string): Promise<{ trigger: TownTrigger | null } | { error: string }> {
  const response = await createMessage(client, {
    max_tokens: 200,
    system:
      "You connect a spoken promise to a real event. The only event is bandits-defeated: the Blackwood band has been beaten. A harvest, a shipment, a later week, or a vague later is none. Call confirm_trigger once.",
    tools: [CONFIRM],
    tool_choice: { type: "tool", name: "confirm_trigger" },
    messages: [{ role: "user", content: why.trim() || "No reason was given." }],
  });
  if ("error" in response) return { error: response.error };
  const call = toolUses(response).find((item) => item.name === "confirm_trigger");
  const trigger = (call?.input as { trigger?: unknown } | undefined)?.trigger;
  if (trigger === "bandits-defeated") return { trigger: "bandits-defeated" };
  return { trigger: null };
}
