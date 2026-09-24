import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../model";

const TOOL: Anthropic.Tool = {
  name: "set_company",
  description: "Rewrite the company's morale, condition, and stance after the week.",
  input_schema: {
    type: "object",
    properties: {
      morale: { type: "string", description: "One sentence. Spirit and will." },
      condition: { type: "string", description: "One sentence. How tired or rested the bodies are." },
      stance: { type: "string", description: "One sentence. How ready they are to fight." },
    },
    required: ["morale", "condition", "stance"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    movement?: string;
    deed?: string;
    doubleRest?: boolean;
    place?: string;
    ground?: string;
    kind?: string;
    hungerNote?: string;
    hungry?: boolean;
    weeksSinceRest?: number;
    weeksDoubleRest?: number;
    morale?: string;
    condition?: string;
    stance?: string;
    fought?: boolean;
  } | null;
  if (!body?.place || !body.morale || !body.condition || !body.stance) {
    return NextResponse.json({ error: "The company lines are missing." }, { status: 400 });
  }

  const response = await createMessage(client, {
    max_tokens: 400,
    system: `You rewrite three lines for one mercenary company after a week, the way a host's morale, condition, and stance are rewritten after a march or a rest.
Each line is one sentence.
A double rest in a village or capital recovers condition and lifts morale a little. A second double rest in a row softens stance: comfortable, less ready.
A double rest in the wild recovers less. If the note says the ground is watched, it does not feel safe.
A march tires them. Another march without a rest tires them more, and stance stays alert.
A drill is work, not a holiday. Condition does not recover as it would from a double rest. Stance sharpens toward the drill.
Hunger is a fact. If they went unfed, condition and morale say so, and rest does not undo it.
If they fought, start from the lines the fight left and only adjust them. Do not replace a battle with a note about dinner.
Call set_company once.`,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "set_company" },
    messages: [
      {
        role: "user",
        content: `Place: ${body.place}. ${body.ground || ""} Kind: ${body.kind || "wild"}.
Movement: ${body.movement || "rest"}. Action: ${body.deed || "rest"}. Double rest: ${body.doubleRest ? "yes" : "no"}.
Marches since a rest: ${body.weeksSinceRest ?? 0}. Double rests in a row, including this week if it was one: ${body.weeksDoubleRest ?? 0}.
Food: ${body.hungerNote || "They ate."} Unfed: ${body.hungry ? "yes" : "no"}. Fought this week: ${body.fought ? "yes" : "no"}.
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
