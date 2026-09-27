import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { forceComparison } from "@/app/mercenary/lib/engine";
import { anthropicClient, createMessage, toolUses } from "../../model";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_history_with_company",
    description: "Read this leader's history with this mercenary company.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_general_history",
    description: "Read this leader's own history.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "decide_attack",
    description: "Decide whether to attack.",
    input_schema: {
      type: "object",
      properties: {
        attack: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["attack", "reason"],
    },
  },
];

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    playerMen?: number;
    banditMen?: number;
    company?: string;
    bandits?: string;
    generalHistory?: string;
    withCompany?: string[];
    persona?: string;
    stores?: string;
  } | null;

  if (!body || typeof body.playerMen !== "number" || typeof body.banditMen !== "number" || !body.company || !body.bandits) {
    return NextResponse.json({ error: "The leader has nothing to judge." }, { status: 400 });
  }

  const comparison = forceComparison(body.playerMen, body.banditMen);
  const withCompany = body.withCompany ?? [];
  const general = body.generalHistory ?? "";
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `You found armed men moving through your ground.
Their men: ${body.playerMen}
Your men: ${body.banditMen}

Them:
${body.company}

Your band:
${body.bandits}

Your stores:
${body.stores || "You have been taking from the road."}

Call your history tools if you need them, then decide_attack.`,
    },
  ];

  for (let round = 0; round < 5; round++) {
    const response = await createMessage(client, {
      max_tokens: 600,
      system: body.persona?.trim() || "You lead this band. You have men, coin, grain, and what you have taken. Decide for yourself.",
      tools: TOOLS,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    if (!calls.length) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: "Call decide_attack." });
      continue;
    }

    let decision: { attack: boolean; reason: string } | null = null;
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as { attack?: unknown; reason?: unknown };
      if (call.name === "decide_attack" && typeof input.attack === "boolean" && typeof input.reason === "string") {
        decision = { attack: input.attack, reason: input.reason.trim() };
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Noted." });
      } else if (call.name === "read_history_with_company") {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: withCompany.join("\n") || "You have no history with this company.",
        });
      } else if (call.name === "read_general_history") {
        results.push({ type: "tool_result", tool_use_id: call.id, content: general || "You have led this band for years." });
      } else {
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Nothing." });
      }
    }
    if (decision) {
      return NextResponse.json({ attack: decision.attack, reason: decision.reason, comparison });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The bandit leader did not decide." }, { status: 500 });
}
