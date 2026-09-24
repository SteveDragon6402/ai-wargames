import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../model";

const TOOL: Anthropic.Tool = {
  name: "report_forage",
  description: "Say what the foraging party brings back.",
  input_schema: {
    type: "object",
    properties: {
      meals: {
        type: "integer",
        minimum: 0,
        description: "Rations carried back. At most one per person who went out.",
      },
      account: { type: "string", description: "One or two sentences of what happened in the trees." },
      spotted: { type: "boolean", description: "True only when a band that knows this wood finds the foragers." },
    },
    required: ["meals", "account", "spotted"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    men?: number;
    place?: string;
    ground?: string;
    bandits?: number;
  } | null;
  const men = body?.men;
  if (!body?.place || !body.ground || typeof men !== "number" || men < 1) {
    return NextResponse.json({ error: "The forage is missing its forest." }, { status: 400 });
  }

  const watched = (body.bandits ?? 0) > 0 ? `About ${body.bandits} bandits know these trees and may be watching.` : "No band is known to be watching.";
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `${men} people are foraging in ${body.place}. ${body.ground} ${watched} What happens? Call report_forage once. meals is from 0 to ${men}.`,
    },
  ];

  for (let round = 0; round < 2; round++) {
    const response = await createMessage(client, {
      max_tokens: 400,
      system:
        "You judge one foraging party in a forest. One tool call, report_forage. A thick wood can feed some of them and not all of them. Bad luck, watchers, or a picked-over wood can bring back nothing. If a band is watching, spotted may be true and the account says they were found. If no band is watching, spotted is false.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_forage" },
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const call = toolUses(response).find((item) => item.name === "report_forage");
    const input = call?.input as { meals?: unknown; account?: unknown; spotted?: unknown } | undefined;
    const meals = typeof input?.meals === "number" ? Math.max(0, Math.min(men, Math.round(input.meals))) : null;
    const account = typeof input?.account === "string" ? input.account.trim() : "";
    const spotted = input?.spotted === true && (body.bandits ?? 0) > 0;
    if (meals !== null && account) return NextResponse.json({ meals, account, spotted });
  }

  return NextResponse.json({ error: "The forage came back with no account." }, { status: 500 });
}
