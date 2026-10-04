import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, complete, toolUses } from "../model";

const REPLY: Anthropic.Tool = {
  name: "reply",
  description: "Answer in character. Offer a deal only if the numbers could be real.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string" },
      chip: { type: "string", description: "Optional action id if the player is trying to act." },
      deal: {
        type: "object",
        properties: {
          gold: { type: "integer" },
          upfrontGold: { type: "integer" },
          bread: { type: "integer" },
          note: { type: "string" },
          questId: { type: "string" },
          kind: { type: "string" },
        },
      },
    },
    required: ["text"],
  },
};

const JUDGE: Anthropic.Tool = {
  name: "judge",
  description: "Judge the fight. Sides are A and B. Do not favour either.",
  input_schema: {
    type: "object",
    properties: {
      winner: { type: "string", enum: ["a", "b", "none"] },
      units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            killed: { type: "integer" },
            wounded: { type: "integer" },
            moraleDelta: { type: "integer" },
            conditionDelta: { type: "integer" },
          },
          required: ["id", "killed", "wounded", "moraleDelta", "conditionDelta"],
        },
      },
      highlights: { type: "array", items: { type: "string" } },
      narrative: { type: "string" },
    },
    required: ["winner", "units", "highlights", "narrative"],
  },
};

const NAME: Anthropic.Tool = {
  name: "name",
  description: "A name and the reason it was given.",
  input_schema: {
    type: "object",
    properties: { name: { type: "string" }, meaning: { type: "string" } },
    required: ["name", "meaning"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json()) as { agent?: string; prompt?: string };
  const agent = body.agent ?? "talk";
  const tool = agent === "adjudicator" ? JUDGE : agent === "namer" ? NAME : REPLY;
  const tier = agent === "adjudicator" || agent === "major" ? "strong" : "small";
  const response = await complete(client, tier, {
    max_tokens: agent === "adjudicator" ? 900 : 500,
    system: systemFor(agent),
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: body.prompt ?? "" }],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
  const call = toolUses(response).find((item) => item.name === tool.name);
  if (!call) return NextResponse.json({ error: "No tool result." }, { status: 502 });
  return NextResponse.json(call.input);
}

function systemFor(agent: string): string {
  if (agent === "adjudicator") {
    return "You are a neutral referee. Judge only from the written plans and the numbers. Neither side is the player. Narrative of at most 6 sentences. Killed cannot exceed headcount.";
  }
  if (agent === "quartermaster") {
    return "You are the company quartermaster. Explain the rules in two or three sentences. You may suggest one action. You do not decide for them.";
  }
  if (agent === "namer") return "Name a mercenary company, person, or unit. Give the reason the name was chosen, in one line.";
  if (agent === "group") return "You speak for a group of ordinary people. Be brief. If they might volunteer, say how many and whether it is permanent.";
  return "You are one person in Hollowmere. Speak in your own voice. You may offer a deal the engine can check. You do not change numbers yourself. Hidden hooks may be hinted, not announced.";
}
