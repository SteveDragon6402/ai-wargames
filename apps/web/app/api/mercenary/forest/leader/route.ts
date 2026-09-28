import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { forceComparison } from "@/app/mercenary/lib/engine";
import { anthropicClient, createMessage, toolUses } from "../../model";

const HISTORY: Anthropic.Tool[] = [
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
];

const DECIDE_ATTACK: Anthropic.Tool = {
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
};

const DECIDE_STAY: Anthropic.Tool = {
  name: "decide_stay",
  description: "Decide whether the band keeps together. stay is false if you break it up.",
  input_schema: {
    type: "object",
    properties: {
      stay: { type: "boolean" },
      reason: { type: "string" },
    },
    required: ["stay", "reason"],
  },
};

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
    ask?: "attack" | "stay";
    occasion?: string;
    fight?: string;
  } | null;

  if (!body || typeof body.playerMen !== "number" || typeof body.banditMen !== "number" || !body.company || !body.bandits) {
    return NextResponse.json({ error: "The leader has nothing to judge." }, { status: 400 });
  }

  const staying = body.ask === "stay";
  const comparison = forceComparison(body.playerMen, body.banditMen);
  const withCompany = body.withCompany ?? [];
  const general = body.generalHistory ?? "";
  const stores = body.stores || "You have been taking from the road.";
  const situation = staying
    ? `The fight is over.
What happened:
${body.fight?.trim() || "The fight ended."}

Their men still standing: ${body.playerMen}
Your men still with you: ${body.banditMen}`
    : body.occasion?.trim()
      ? `Armed men are in your forest. They are not looking for you.
${body.occasion.trim()}

Their men: ${body.playerMen}
Your men: ${body.banditMen}`
      : `You found armed men moving through your ground.
Their men: ${body.playerMen}
Your men: ${body.banditMen}`;
  const verb = staying ? "decide_stay" : "decide_attack";
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `${situation}

Them:
${body.company}

Your band:
${body.bandits}

Your stores:
${stores}

Call your history tools if you need them, then ${verb}.`,
    },
  ];

  for (let round = 0; round < 5; round++) {
    const response = await createMessage(client, {
      max_tokens: 600,
      system: body.persona?.trim() || "You lead this band. You have men, coin, grain, and what you have taken. Decide for yourself.",
      tools: [...HISTORY, staying ? DECIDE_STAY : DECIDE_ATTACK],
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    if (!calls.length) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: `Call ${verb}.` });
      continue;
    }

    let attack: boolean | null = null;
    let stay: boolean | null = null;
    let reason = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as { attack?: unknown; stay?: unknown; reason?: unknown };
      if (call.name === "decide_attack" && typeof input.attack === "boolean" && typeof input.reason === "string") {
        attack = input.attack;
        reason = input.reason.trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Noted." });
      } else if (call.name === "decide_stay" && typeof input.stay === "boolean" && typeof input.reason === "string") {
        stay = input.stay;
        reason = input.reason.trim();
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
    if (stay !== null) return NextResponse.json({ stay, reason, comparison });
    if (attack !== null) return NextResponse.json({ attack, reason, comparison });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The bandit leader did not decide." }, { status: 500 });
}
