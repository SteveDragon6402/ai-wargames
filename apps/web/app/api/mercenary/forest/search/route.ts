import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { rollD100 } from "@/app/mercenary/lib/dice";
import { SEARCH_SYSTEM, resolveSearchRoll, type SearchFound } from "@/app/mercenary/lib/search";
import { anthropicClient, createMessage, toolUses } from "../../model";

const GIVE: Anthropic.Tool = {
  name: "give_chances",
  description: "Give the chance of finding the band, and the chance of finding the camp. Whole numbers from 0 to 100.",
  input_schema: {
    type: "object",
    properties: {
      findBandits: { type: "integer", minimum: 0, maximum: 100 },
      findCamp: { type: "integer", minimum: 0, maximum: 100 },
      reason: { type: "string", description: "Why the chances are what they are. One sentence." },
    },
    required: ["findBandits", "findCamp", "reason"],
  },
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    company?: string;
    morale?: string;
    stance?: string;
    condition?: string;
    place?: string;
    ground?: string;
    band?: string;
    bandAlive?: boolean;
  } | null;
  if (!body?.company?.trim() || !body.place?.trim() || !body.ground?.trim() || !body.band?.trim()) {
    return NextResponse.json({ error: "The search is missing its ground." }, { status: 400 });
  }

  const bandAlive = !!body.bandAlive;
  let findBandits = bandAlive ? 40 : 0;
  let findCamp = 20;
  const client = anthropicClient();
  if (!("error" in client)) {
    const response = await createMessage(client, {
      max_tokens: 300,
      system: SEARCH_SYSTEM,
      tools: [GIVE],
      tool_choice: { type: "tool", name: "give_chances" },
      messages: [
        {
          role: "user",
          content: `${body.company.trim()}
Morale: ${body.morale?.trim() || "Unstated."}
Stance: ${body.stance?.trim() || "Unstated."}
Condition: ${body.condition?.trim() || "Unstated."}
Ground: ${body.place.trim()}, ${body.ground.trim()}.
${body.band.trim()}
What is the chance they find the band, and the chance they find the camp?`,
        },
      ],
    });
    if (!("error" in response)) {
      const call = toolUses(response).find((item) => item.name === "give_chances");
      const input = (call?.input ?? {}) as { findBandits?: number; findCamp?: number };
      if (typeof input.findBandits === "number") findBandits = input.findBandits;
      if (typeof input.findCamp === "number") findCamp = input.findCamp;
    }
  }
  if (!bandAlive) findBandits = 0;

  let roll = 100;
  try {
    roll = rollD100();
  } catch (err) {
    const message = err instanceof Error ? err.message : "The dice could not be rolled.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const found: SearchFound = resolveSearchRoll(roll, findBandits, findCamp, bandAlive);
  return NextResponse.json({ found, roll, findBandits, findCamp });
}
