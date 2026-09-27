import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { BATTLER_SYSTEM, SUMMARIZER_SYSTEM, TRANSLATOR_SYSTEM, battlerPrompt, fightSides, translatorPrompt } from "@/app/mercenary/lib/battle";
import { validateOutcome } from "@/app/mercenary/lib/engine";
import type { GameState } from "@/app/mercenary/lib/types";
import { parseFight, type FightResult } from "@/app/mercenary/lib/world";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

const WRITE_ACCOUNT: Anthropic.Tool = {
  name: "write_account",
  description: "Write what would happen in the fight. One finished account. No one is being advised.",
  input_schema: {
    type: "object",
    properties: { account: { type: "string" } },
    required: ["account"],
  },
};

const RECORD_FIGHT: Anthropic.Tool = {
  name: "record_fight",
  description: "Record what the account did to each group. Whole numbers only.",
  input_schema: {
    type: "object",
    properties: {
      holds: { type: "string", enum: ["a", "b"] },
      dead: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, count: { type: "integer" } },
          required: ["id", "count"],
        },
      },
      grainToB: { type: "integer" },
      coinsToB: { type: "integer" },
      morale: { type: "string" },
      stance: { type: "string" },
      condition: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, lines: { type: "array", items: { type: "string" } } },
          required: ["id", "lines"],
        },
      },
    },
    required: ["holds", "dead", "grainToB", "coinsToB", "morale", "stance", "condition"],
  },
};

const SUMMARISE: Anthropic.Tool = {
  name: "summarise",
  description: "One finished paragraph of what happened, for someone who was not there.",
  input_schema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
};

function firstParagraph(account: string): string {
  const para = account.split(/\n\s*\n/)[0]?.trim() || account.trim();
  return para;
}

async function forceTool(
  client: Anthropic,
  system: string,
  tool: Anthropic.Tool,
  user: string,
  max: number
): Promise<{ input: unknown } | { error: string }> {
  let extra = "";
  for (let round = 0; round < 2; round++) {
    const response = await createMessage(client, {
      max_tokens: max,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: extra ? `${user}\n\n${extra}` : user }],
    });
    if ("error" in response) return { error: response.error };
    const call = toolUses(response).find((item) => item.name === tool.name);
    if (call) return { input: call.input };
    const text = textOf(response);
    extra = text ? `Use the tool. You wrote: ${text}` : "Call the tool.";
  }
  return { error: "The call did not use its tool." };
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  let state: GameState;
  let raid = false;
  try {
    const body = (await req.json()) as { state?: GameState; raid?: boolean };
    raid = body.raid === true;
    if (!body.state?.bandits || (!raid && !body.state.pendingBattle)) {
      return NextResponse.json({ error: "There is no fight to judge." }, { status: 400 });
    }
    state = body.state;
  } catch {
    return NextResponse.json({ error: "The battle request was unreadable." }, { status: 400 });
  }

  const sides = fightSides(state, raid);
  const groups = [...sides.a.groups, ...sides.b.groups];
  const asked = await forceTool(client, BATTLER_SYSTEM, WRITE_ACCOUNT, battlerPrompt(sides.ground, sides.a, sides.b), 2500);
  if ("error" in asked) return NextResponse.json({ error: asked.error }, { status: 500 });
  const account = typeof (asked.input as { account?: unknown })?.account === "string" ? (asked.input as { account: string }).account.trim() : "";
  if (account.length < 40) return NextResponse.json({ error: "The fight was not told." }, { status: 500 });

  const recorded = await forceTool(client, TRANSLATOR_SYSTEM, RECORD_FIGHT, translatorPrompt(account, groups), 1500);
  if ("error" in recorded) return NextResponse.json({ error: recorded.error }, { status: 500 });
  let fight = parseFight(recorded.input, groups);
  if (!fight) {
    const again = await forceTool(
      client,
      TRANSLATOR_SYSTEM,
      RECORD_FIGHT,
      `${translatorPrompt(account, groups)}\n\nThe last record could not be used. holds must be "a" or "b". dead ids must be the group ids above.`,
      1500
    );
    if ("error" in again) return NextResponse.json({ error: again.error }, { status: 500 });
    fight = parseFight(again.input, groups);
  }
  if (!fight) return NextResponse.json({ error: "The fight could not be recorded." }, { status: 422 });

  const told = await forceTool(
    client,
    SUMMARIZER_SYSTEM,
    SUMMARISE,
    `Account:\n${account}\n\nRecorded: force ${fight.holds.toUpperCase()} holds the ground. Dead: ${fight.dead.map((row) => `${row.id} ${row.count}`).join(", ") || "none"}.`,
    800
  );
  const summary =
    "error" in told
      ? firstParagraph(account)
      : typeof (told.input as { summary?: unknown })?.summary === "string" && (told.input as { summary: string }).summary.trim().length >= 20
        ? (told.input as { summary: string }).summary.trim()
        : firstParagraph(account);

  if (raid) return NextResponse.json({ brief: summary, chronicle: account, outcome: fight satisfies FightResult });

  const validated = validateOutcome(state, {
    playerHoldsField: fight.holds === "a",
    banditDeaths: fight.dead.find((row) => row.id === "band")?.count ?? 0,
    deaths: fight.dead.filter((row) => row.id !== "band" && row.id !== "village").map((row) => ({ unitId: row.id, count: row.count })),
    morale: fight.morale,
    stance: fight.stance,
    condition: fight.condition,
    lines: fight.lines.filter((row) => row.id !== "band" && row.id !== "village").map((row) => ({ unitId: row.id, lines: row.lines })),
  });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 422 });
  return NextResponse.json({ brief: summary, chronicle: account, outcome: validated.value });
}
