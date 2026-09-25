import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../model";

const TOOL: Anthropic.Tool = {
  name: "set_company",
  description: "Rewrite morale, condition, and stance after a unit is renamed.",
  input_schema: {
    type: "object",
    properties: {
      morale: { type: "string", description: "One sentence. Spirit and will." },
      condition: { type: "string", description: "One sentence. How the bodies are." },
      stance: { type: "string", description: "One sentence. How ready they are to fight." },
    },
    required: ["morale", "condition", "stance"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    oldName?: string;
    newName?: string;
    trade?: string;
    count?: number;
    morale?: string;
    condition?: string;
    stance?: string;
  } | null;
  if (!body?.oldName?.trim() || !body.newName?.trim() || !body.morale || !body.condition || !body.stance) {
    return NextResponse.json({ error: "The new name is missing." }, { status: 400 });
  }

  const response = await createMessage(client, {
    max_tokens: 400,
    system: `A mercenary company has just renamed one unit. Rewrite morale, condition, and stance. Each is one sentence.
The new name is what those men are now called, and the company hears it.
A proud name, or a name that claims they are the best, lifts morale. A shameful name, or a name that calls them the worst, sours morale and softens how ready they are.
A plain name changes little. Do not invent a battle, a death, a march, or a change in how tired their bodies are unless the name itself would sting.
Call set_company once.`,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "set_company" },
    messages: [
      {
        role: "user",
        content: `They were ${body.oldName.trim()}. They are now ${body.newName.trim()}. ${body.count ?? "Some"} ${body.trade || "men"}.
Current morale: ${body.morale}
Current condition: ${body.condition}
Current stance: ${body.stance}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
  const call = toolUses(response).find((item) => item.name === "set_company");
  const input = call?.input as { morale?: unknown; condition?: unknown; stance?: unknown } | undefined;
  const morale = typeof input?.morale === "string" ? input.morale.trim() : "";
  const condition = typeof input?.condition === "string" ? input.condition.trim() : "";
  const stance = typeof input?.stance === "string" ? input.stance.trim() : "";
  if (!morale || !condition || !stance) return NextResponse.json({ error: "The company lines came back empty." }, { status: 500 });
  return NextResponse.json({ morale, condition, stance });
}
