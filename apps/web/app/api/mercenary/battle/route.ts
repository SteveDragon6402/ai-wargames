import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { NODES } from "@/app/mercenary/data/map";
import { WIKI, wikiText, type WikiId } from "@/app/mercenary/data/wiki";
import { banditDescription, companyDescription, validateOutcome, wordCount } from "@/app/mercenary/lib/engine";
import type { GameState } from "@/app/mercenary/lib/types";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

const WIKI_IDS = Object.keys(WIKI) as WikiId[];

const READ_ENTRY: Anthropic.Tool = {
  name: "read_entry",
  description: "Read one game-bible entry. Call this for every troop type in the fight before you write.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string", enum: WIKI_IDS } },
    required: ["id"],
  },
};

const RECORD: Anthropic.Tool = {
  name: "record_outcome",
  description: "Record the mechanical result of the fight. Do not write prose outside this tool.",
  input_schema: {
    type: "object",
    properties: {
      playerHoldsField: { type: "boolean" },
      banditDeaths: { type: "integer", minimum: 0 },
      deaths: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unitId: { type: "string" },
            count: { type: "integer", minimum: 0 },
          },
          required: ["unitId", "count"],
        },
      },
      morale: { type: "string" },
      stance: { type: "string" },
      condition: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unitId: { type: "string" },
            line2: { type: "string" },
            line3: { type: "string" },
            line4: { type: "string" },
          },
          required: ["unitId", "line2", "line3", "line4"],
        },
      },
    },
    required: ["playerHoldsField", "banditDeaths", "deaths", "morale", "stance", "condition", "lines"],
  },
};

function battlePrompt(state: GameState): string {
  const pending = state.pendingBattle;
  const place = NODES.blackwood;
  const how =
    pending?.reason === "retreat"
      ? "The company was trying to retreat when the band found them."
      : pending?.reason === "leader"
        ? "The company was trying to sneak. The bandits found them, and the leader chose to attack."
        : "The company chose to fight.";
  const units = state.units
    .map(
      (unit) =>
        `  ${unit.name} [${unit.id}] ${unit.count} ${WIKI[unit.type].title} (entry id: ${unit.type})
    Origin, fixed: ${unit.origin}
    Living lines: ${unit.lines.join(" / ")}
    Battles: ${unit.battles.length ? unit.battles.map((battle) => `week ${battle.week} at ${battle.place}, lost ${battle.deaths}: ${battle.result}`).join("; ") : "none"}`
    )
    .join("\n");
  return `Place: ${place.name}. ${place.ground}
Week ${state.week}.
${how}
${pending?.sneakNote ? `Sneak: ${pending.sneakNote}` : ""}
Approach, in the company's words: ${pending?.approach || "(none)"}
Supply spent on this fight: ${pending?.supplySpent ?? 0}. That is oil, hurdles, extra arrows, and the like. It has already been spent.
Company morale: ${state.morale}
Company stance: ${state.stance}
Company condition: ${state.condition}

The company
${units}

The band
${banditDescription(state)}
Leader: ${state.leader.name}
His history with this company:
${state.leader.withCompany.join("\n") || "None."}

${companyDescription(state)}`;
}

function takeBrief(text: string): { brief: string; chronicle: string } | null {
  const match = text.match(/^BRIEF:\s*(.+)$/im);
  if (!match?.[1]) return null;
  const brief = match[1].trim();
  const words = wordCount(brief);
  if (words < 12 || words > 80) return null;
  const chronicle = text.replace(match[0], "").trim();
  if (!chronicle) return null;
  return { brief, chronicle };
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  let state: GameState;
  try {
    const body = (await req.json()) as { state?: GameState };
    if (!body.state?.pendingBattle || !body.state.bandits) {
      return NextResponse.json({ error: "There is no fight to judge." }, { status: 400 });
    }
    state = body.state;
  } catch {
    return NextResponse.json({ error: "The battle request was unreadable." }, { status: 400 });
  }

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: battlePrompt(state) }];
  let consulted = false;
  let nudged = false;
  let brief = "";
  let chronicle = "";

  for (let round = 0; round < 8; round++) {
    const response = await createMessage(client, {
      max_tokens: 4000,
      system: `You adjudicate one fight in a mercenary company's year. Write prose only, after you have looked up the bible.
Call read_entry for every troop type present, including bandit, before the report. Do not invent troop types. Do not take prisoners. Men die or they don't. Do not say where anyone marches after the fight.
The report is labelled phases, a few sentences each: who acted, what they did, what it cost. Then a line, exactly:
BRIEF: <a 40 to 50 word result, one paragraph, no label after it>
The BRIEF line is the only thing the player sees first. The phases are the chronicle.`,
      tools: [READ_ENTRY],
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    if (calls.length) {
      const results: Anthropic.Messages.ToolResultBlockParam[] = calls.map((call) => {
        const id = String((call.input as { id?: unknown }).id ?? "");
        if (call.name === "read_entry" && (WIKI_IDS as string[]).includes(id)) {
          consulted = true;
          return { type: "tool_result" as const, tool_use_id: call.id, content: wikiText(id as WikiId) };
        }
        return { type: "tool_result" as const, tool_use_id: call.id, content: "No such entry." };
      });
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = textOf(response);
    if (!consulted) {
      if (nudged) return NextResponse.json({ error: "The chronicler did not consult the bible." }, { status: 500 });
      nudged = true;
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: "Call read_entry for each troop type in this fight, including bandit, then write the report with its BRIEF line.",
      });
      continue;
    }
    const split = takeBrief(text);
    if (!split) return NextResponse.json({ error: "The chronicler did not return a BRIEF and a report." }, { status: 500 });
    brief = split.brief;
    chronicle = split.chronicle;
    break;
  }

  if (!brief) return NextResponse.json({ error: "The chronicler did not finish." }, { status: 500 });

  const executor = await createMessage(client, {
    max_tokens: 2000,
    system: `You turn a finished battle report into mechanics. Call record_outcome once.
Deaths cannot exceed the men in a unit or the bandits on the field. Do not capture anyone. Do not change a unit's origin. Rewrite only the three living lines of units that still have men. playerHoldsField is true if this company still owns the ground when the noise stops.
Morale, stance, and condition are each one sentence.`,
    tools: [RECORD],
    tool_choice: { type: "tool", name: "record_outcome" },
    messages: [
      {
        role: "user",
        content: `${battlePrompt(state)}\n\nREPORT:\n${chronicle}\n\nBRIEF:\n${brief}`,
      },
    ],
  });
  if ("error" in executor) return NextResponse.json({ error: executor.error }, { status: 500 });
  const recorded = toolUses(executor).find((call) => call.name === "record_outcome");
  if (!recorded) return NextResponse.json({ error: "The executor did not record an outcome." }, { status: 500 });

  const validated = validateOutcome(state, recorded.input);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 422 });

  return NextResponse.json({ brief, chronicle, outcome: validated.value });
}
