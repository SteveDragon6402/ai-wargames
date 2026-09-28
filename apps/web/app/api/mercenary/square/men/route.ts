import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../model";

const DESCRIBE: Anthropic.Tool = {
  name: "describe_men",
  description: "Write what these villagers seem like, the ones who answered the call. Four short lines.",
  input_schema: {
    type: "object",
    properties: {
      lines: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    },
    required: ["lines"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    call?: string;
    place?: string;
    count?: number;
    name?: string;
  } | null;
  if (!body?.call?.trim() || !body.place?.trim()) {
    return NextResponse.json({ error: "The call is missing." }, { status: 400 });
  }

  const response = await createMessage(client, {
    max_tokens: 400,
    system: `You are writing what a group of villagers seem like. They stepped forward in the square because of a call. Use that call. They are not trained soldiers, and they are not armed unless the call says someone handed them a weapon. If they were called as trackers, hunters, or the like, say what of that a village can actually offer. Four short lines. Do not mention a player. Call describe_men.`,
    tools: [DESCRIBE],
    tool_choice: { type: "tool", name: "describe_men" },
    messages: [
      {
        role: "user",
        content: `${body.count ?? "Some"} people in ${body.place.trim()} answered this call and joined ${body.name?.trim() || "a new unit"}.
The call: ${body.call.trim()}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const call = toolUses(response).find((item) => item.name === "describe_men");
  const lines = ((call?.input ?? {}) as { lines?: unknown }).lines;
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === "string" && line.trim())) {
    return NextResponse.json({ error: "The new men were not described." }, { status: 500 });
  }
  return NextResponse.json({ lines: lines.map((line) => line.trim()).slice(0, 4) });
}
