import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BattleContext, BattleReport, Casualty, FallenFigure, Hold } from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You are a deep scholar of George R.R. Martin's A Song of Ice and Fire, a medievalist, and a master adjudicator of fictional battles. You have encyclopaedic knowledge of every house, commander, character, and creature in Westeros. You reason about battles using realistic medieval military doctrine — terrain, troop types, morale, fatigue, numerical disparity, leadership quality, and tactical disposition. You understand how GRRM's characters think and fight: Robb's instinctive brilliance, Tywin's cold precision, Jaime's reckless aggression, Roose's patient ruthlessness. You write in the voice of a Westerosi maester chronicling events for the Citadel — vivid, specific, unflinching. Character deaths should be rare and meaningful. Always respond with valid JSON only — no prose, no markdown, no commentary outside the JSON object.`;

function buildBattleMessage(battle: BattleContext, holdsMap: Map<string, Hold>): string {
  const hold = holdsMap.get(battle.holdId);
  const locationLine = hold
    ? `${hold.name}, ${hold.region} (seat of ${hold.house} — ${hold.lord})`
    : `Hold ${battle.holdId}`;

  function armyBlock(armies: typeof battle.northArmies, fromHoldId: string | undefined, label: string): string {
    if (armies.length === 0) return "";
    const status = fromHoldId
      ? `ATTACKING — marched from ${holdsMap.get(fromHoldId)?.name ?? fromHoldId}`
      : "DEFENDING — holding the ground";

    return armies.map((army) => {
      const commanders = army.leaders.map((l) => `${l.name}${l.title ? ` (${l.title})` : ""}`).join(", ");
      const notables = army.notables?.map((n) => `${n.name} — ${n.description}`).join("\n    ") ?? "None";
      const strength = army.units.map((u) => `${u.count.toLocaleString()} ${u.house} ${u.type}`).join(", ");
      return `${label} — ${status}
  Army: ${army.name}
  Commanders: ${commanders}
  Notable figures:
    ${notables}
  Strength: ${strength}
  Morale: ${army.morale}
  Condition: ${army.tiredness}`;
    }).join("\n\n");
  }

  const northBlock = armyBlock(battle.northArmies, battle.northFromHoldId, "THE NORTH");
  const westBlock = armyBlock(battle.westArmies, battle.westFromHoldId, "THE WESTERLANDS");

  // Build army ID reference list for the response
  const allArmyIds = [
    ...battle.northArmies.map((a) => `"${a.id}" (${a.name}, North)`),
    ...battle.westArmies.map((a) => `"${a.id}" (${a.name}, Westerlands)`),
  ].join(", ");

  return `BATTLE LOCATION: ${locationLine}

FORCES ENGAGED:

${northBlock}

${westBlock}

TASK: Adjudicate this battle. Make reasonable assumptions about each commander's battle plan given their character, force composition, and tactical position. Be specific about the terrain and how it affected the fighting. Casualties should be proportional to army size — major engagements might see 10–30% losses, skirmishes less. Commander and notable deaths are possible but should be rare and earned.

Army IDs for the response: ${allArmyIds}

Respond with this exact JSON object (no other text):
{
  "narrative": "2–3 vivid paragraphs describing the battle in ASOIAF maester-chronicle style. Name commanders and notables. Be specific about tactics and turning points.",
  "holdResult": "north OR westerlands OR contested OR abandoned",
  "casualties": [
    {"faction": "north OR westerlands", "armyId": "army-id-here", "unitType": "cavalry OR infantry OR archers", "house": "house name", "count": NUMBER}
  ],
  "fallen": [
    {"armyId": "army-id-here", "name": "exact name as given above", "isLeader": true or false}
  ],
  "retreatingArmyIds": ["army-id-here"]
}

Rules:
- holdResult "north"/"westerlands" = that faction holds the ground; the other retreats
- holdResult "contested" = both hold ground but at great cost (no retreat needed)
- holdResult "abandoned" = both sides fall back (rare; only if both shattered)
- retreatingArmyIds must match holdResult (losing faction's armies retreat)
- casualties: list each house+type combination separately for each army
- fallen: only include figures who die in this battle; keep it rare`;
}

function fallbackReport(battle: BattleContext): Omit<BattleReport, "id" | "turn" | "holdId"> {
  return {
    narrative:
      "The forces clashed in a brief and bloody engagement. Neither side gained a decisive advantage, and both withdrew to tend their wounds.",
    holdResult: "contested",
    casualties: [
      ...battle.northArmies.flatMap((a) =>
        a.units.slice(0, 1).map((u) => ({
          faction: "north" as const,
          armyId: a.id,
          unitType: u.type,
          house: u.house,
          count: Math.floor(u.count * 0.05),
        }))
      ),
      ...battle.westArmies.flatMap((a) =>
        a.units.slice(0, 1).map((u) => ({
          faction: "westerlands" as const,
          armyId: a.id,
          unitType: u.type,
          house: u.house,
          count: Math.floor(u.count * 0.05),
        }))
      ),
    ],
    fallen: [],
    retreatingArmyIds: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { battle: BattleContext; holds: Hold[] };
    const { battle, holds } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("ANTHROPIC_API_KEY not set — returning fallback battle result");
      return NextResponse.json(fallbackReport(battle));
    }

    const holdsMap = new Map(holds.map((h) => [h.id, h]));
    const userMessage = buildBattleMessage(battle, holdsMap);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract JSON — Claude may wrap it in ```json ... ```
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", rawText);
      return NextResponse.json(fallbackReport(battle));
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      narrative: string;
      holdResult: BattleReport["holdResult"];
      casualties: Casualty[];
      fallen: FallenFigure[];
      retreatingArmyIds: string[];
    };

    return NextResponse.json({
      narrative: parsed.narrative ?? "",
      holdResult: parsed.holdResult ?? "contested",
      casualties: Array.isArray(parsed.casualties) ? parsed.casualties : [],
      fallen: Array.isArray(parsed.fallen) ? parsed.fallen : [],
      retreatingArmyIds: Array.isArray(parsed.retreatingArmyIds) ? parsed.retreatingArmyIds : [],
    });
  } catch (err) {
    console.error("Battle adjudication error:", err);
    return NextResponse.json({ error: "Adjudication failed" }, { status: 500 });
  }
}
