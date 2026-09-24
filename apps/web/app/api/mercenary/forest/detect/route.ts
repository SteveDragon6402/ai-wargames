import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../model";

const TOOL: Anthropic.Tool = {
  name: "report_found",
  description: "Say whether the bandits find the company.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      reason: { type: "string" },
    },
    required: ["found", "reason"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { bandits?: string; company?: string } | null;
  if (!body?.bandits || !body.company) return NextResponse.json({ error: "The forest is missing its two sides." }, { status: 400 });

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `The company is trying to sneak through Blackwood.
The bandits are somewhat experienced in this forest.

Bandits:
${body.bandits}

Company:
${body.company}

Call report_found once.`,
    },
  ];

  for (let round = 0; round < 2; round++) {
    const response = await createMessage(client, {
      max_tokens: 400,
      system:
        "You judge whether forest bandits notice a company trying to sneak past. One tool call, report_found. Weigh the bandits' experience in these trees against the company's size, drill, and quiet. Do not start a battle yourself.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_found" },
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const call = toolUses(response).find((item) => item.name === "report_found");
    const found = (call?.input as { found?: unknown } | undefined)?.found;
    const reason = (call?.input as { reason?: unknown } | undefined)?.reason;
    if (typeof found === "boolean" && typeof reason === "string" && reason.trim()) {
      return NextResponse.json({ found, reason: reason.trim() });
    }
  }

  return NextResponse.json({ error: "Could not tell whether the bandits found them." }, { status: 500 });
}
