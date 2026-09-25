import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { NODES } from "@/app/mercenary/data/map";
import { WIKI, resolveWikiId, wikiText, type WikiId } from "@/app/mercenary/data/wiki";
import { banditDescription, companyDescription, parseReport, validateOutcome } from "@/app/mercenary/lib/engine";
import type { GameState } from "@/app/mercenary/lib/types";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

const WIKI_IDS = Object.keys(WIKI) as WikiId[];

const READ_ENTRY: Anthropic.Tool = {
  name: "read_entry",
  description: "Read one game-bible entry before you write, if you need it. Ids: swordsmen, spearmen, archers, light_cavalry, heavy_cavalry, berserkers, bandit, ogres.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string", description: "A wiki id, or a close name such as bandits or light cavalry." } },
    required: ["id"],
  },
};

const SUBMIT_REPORT: Anthropic.Tool = {
  name: "submit_report",
  description: "Hand in the finished battle report. Call this once, after any bible lookups.",
  input_schema: {
    type: "object",
    properties: {
      brief: {
        type: "string",
        description: "One paragraph of about forty words. This is the only result the player reads first. No heading and no BRIEF: label.",
      },
      chronicle: {
        type: "string",
        description: "The fight in short phases: Opening, Clash, End. A few sentences each. Who acted, what they did, what it cost.",
      },
    },
    required: ["brief", "chronicle"],
  },
};

const RECORD: Anthropic.Tool = {
  name: "record_outcome",
  description: "Record the mechanical result. Use the unit ids you were given. Whole numbers only.",
  input_schema: {
    type: "object",
    properties: {
      playerHoldsField: { type: "boolean", description: "True if the company still holds the ground when the noise stops." },
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
            lines: {
              type: "array",
              items: { type: "string" },
              description: "What the unit seems like after the fight. One to ten lines. Change a line only when the chronicle shows that change. Do not give them a trick that is not already in their lines.",
            },
          },
          required: ["unitId", "lines"],
        },
      },
    },
    required: ["playerHoldsField", "banditDeaths", "deaths", "morale", "stance", "condition", "lines"],
  },
};

function battlePrompt(state: GameState): string {
  const pending = state.pendingBattle;
  const place = NODES[state.location];
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
    What they can do: ${unit.lines.join(" / ")}
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

function executorPrompt(state: GameState, chronicle: string, brief: string): string {
  const roster = state.units
    .map((unit) => `- unitId "${unit.id}" is ${unit.name}, ${unit.count} men. Current lines: ${unit.lines.join(" / ")}`)
    .join("\n");
  const bandits = state.bandits?.count ?? 0;
  return `${battlePrompt(state)}

REPORT:
${chronicle}

BRIEF:
${brief}

Call record_outcome once. Use only these unit ids:
${roster}
Bandits alive at the start: ${bandits}. banditDeaths is an integer from 0 to ${bandits}.
Each deaths count is an integer from 0 to that unit's men. A real clash often costs someone, on the company, the band, or both, in proportion to how the fight went. A careful or one-sided brush can kill no one. Record 0 when the chronicle kills no one. Do not invent a death the chronicle does not describe.
playerHoldsField is true or false.
morale, stance, and condition are one sentence each.
lines: for every unit that still has men, what they seem like now, from 1 to 10 lines. Their current lines are what they can do. If the approach asks for a trick that is not in those lines, the chronicle says they fail at it. Rewrite, drop, or add a line only when the chronicle shows that change, and put the new sentence in the chronicle so it can be kept.
Do not name a unit that is not listed.`;
}

function readBrief(input: unknown): { brief: string; chronicle: string } | null {
  if (!input || typeof input !== "object") return null;
  const body = input as { brief?: unknown; chronicle?: unknown };
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  const chronicle = typeof body.chronicle === "string" ? body.chronicle.trim() : "";
  const combined = [brief, chronicle].filter(Boolean).join("\n\n");
  return parseReport(combined);
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
  let brief = "";
  let chronicle = "";
  let prose = "";

  for (let round = 0; round < 6; round++) {
    const response = await createMessage(client, {
      max_tokens: 4000,
      system: `You adjudicate one fight. A real clash often costs someone: the company, the band, or both, in proportion to how it went. A careful or one-sided brush can still kill no one. Do not take prisoners. Do not invent troop types. Do not say where anyone marches after the fight.

Answer in this order:
1. Optional. Call read_entry if you need a bible entry. Valid ids: ${WIKI_IDS.join(", ")}.
2. Required. Call submit_report exactly once.
   brief: one paragraph, about forty words, the result the player reads first. No heading.
   chronicle: Opening, Clash, and End. A few sentences each. Who acted, what they did, what it cost.

If you write prose instead of the tool, still include the result in the first paragraph and the phases after it.`,
      tools: [READ_ENTRY, SUBMIT_REPORT],
      tool_choice: round >= 2 ? { type: "tool", name: "submit_report" } : { type: "auto" },
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    const submitted = calls.find((call) => call.name === "submit_report");
    if (submitted) {
      const split = readBrief(submitted.input);
      if (split) {
        brief = split.brief;
        chronicle = split.chronicle;
        break;
      }
    }

    if (calls.length) {
      const results: Anthropic.Messages.ToolResultBlockParam[] = calls.map((call) => {
        if (call.name === "read_entry") {
          const raw = String((call.input as { id?: unknown }).id ?? "");
          const id = resolveWikiId(raw);
          return {
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: id ? wikiText(id) : `No entry for "${raw}". Use one of: ${WIKI_IDS.join(", ")}.`,
          };
        }
        if (call.name === "submit_report") {
          return {
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: "That report was too short to use. Call submit_report again with a brief of about forty words and a chronicle of Opening, Clash, and End.",
          };
        }
        return { type: "tool_result" as const, tool_use_id: call.id, content: "Unknown tool." };
      });
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: results });
      continue;
    }

    const text = textOf(response);
    if (text) prose = `${prose}\n${text}`.trim();
    const split = parseReport(text);
    if (split) {
      brief = split.brief;
      chronicle = split.chronicle;
      break;
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: "Call submit_report now. brief is about forty words. chronicle is the Opening, Clash, and End.",
    });
  }

  if (!brief) {
    const split = parseReport(prose);
    if (split) {
      brief = split.brief;
      chronicle = split.chronicle;
    }
  }
  if (!brief) return NextResponse.json({ error: "The chronicler did not finish a report." }, { status: 500 });

  const askExecutor = async (extra: string) =>
    createMessage(client, {
      max_tokens: 2000,
      system: `You turn a finished battle report into mechanics. Call record_outcome once. Deaths cannot exceed the men present. Do not capture anyone. Do not change a unit's origin.`,
      tools: [RECORD],
      tool_choice: { type: "tool", name: "record_outcome" },
      messages: [{ role: "user", content: extra ? `${executorPrompt(state, chronicle, brief)}\n\n${extra}` : executorPrompt(state, chronicle, brief) }],
    });

  const first = await askExecutor("");
  if ("error" in first) return NextResponse.json({ error: first.error }, { status: 500 });
  const firstRecord = toolUses(first).find((call) => call.name === "record_outcome");
  if (!firstRecord) return NextResponse.json({ error: "The executor did not record an outcome." }, { status: 500 });

  let validated = validateOutcome(state, firstRecord.input);
  if (!validated.ok) {
    const second = await askExecutor(
      `Your last record_outcome was unusable: ${validated.error}\nPayload: ${JSON.stringify(firstRecord.input)}\nCall record_outcome again with the unit ids listed above.`
    );
    if ("error" in second) return NextResponse.json({ error: second.error }, { status: 500 });
    const secondRecord = toolUses(second).find((call) => call.name === "record_outcome");
    if (!secondRecord) return NextResponse.json({ error: "The executor did not record an outcome." }, { status: 500 });
    validated = validateOutcome(state, secondRecord.input);
  }
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 422 });

  return NextResponse.json({ brief, chronicle, outcome: validated.value });
}
