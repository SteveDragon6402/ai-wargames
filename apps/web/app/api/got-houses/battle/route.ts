import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BattleContext, BattleReport, Casualty, FallenFigure, Hold, ArmyConditionUpdate } from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You are a deep scholar of George R.R. Martin's A Song of Ice and Fire and an expert in medieval military history. You have encyclopaedic knowledge of every house, lord, commander, character, and creature in Westeros — their psychology, their fighting style, and their history. You reason about battles using authentic medieval military doctrine: terrain advantage, troop-type matchups (cavalry shock, archer range, infantry mass), supply lines, morale cascades, leadership quality, and the fog of war. You understand how GRRM's characters think and fight: Robb's wolf-pack instinct and speed, Tywin's cold, patient precision and use of reserves, Jaime's reckless brilliance and personal courage, Roose's icy patience and calculated treachery. You write in the voice of a Westerosi maester chronicling events for the Citadel — vivid, measured, specific, and unflinching. Always respond with valid JSON only — no prose, no markdown fences, no commentary outside the JSON object.`;

function buildBattleMessage(battle: BattleContext, holdsMap: Map<string, Hold>, maxTokens: number): string {
  const hold = holdsMap.get(battle.holdId);
  const locationLine = hold
    ? `${hold.name} (${hold.region} — seat of House ${hold.house}, held by ${hold.lord})`
    : `Hold ${battle.holdId}`;

  function armyBlock(armies: typeof battle.northArmies, fromHoldId: string | undefined, factionLabel: string): string {
    if (armies.length === 0) return "";

    const statusVerb = fromHoldId ? "ATTACKING" : "DEFENDING";
    const marchLine = fromHoldId
      ? `Marched from: ${holdsMap.get(fromHoldId)?.name ?? fromHoldId}`
      : "Status: Holding the ground";

    return armies.map((army) => {
      const commanders = army.leaders
        .map((l) => `${l.name}${l.title ? ` (${l.title})` : ""}`)
        .join(", ");
      const notablesText = army.notables?.length
        ? army.notables.map((n) => `${n.name} — ${n.description}`).join("\n    ")
        : "None";
      const strength = army.units
        .map((u) => `${u.count.toLocaleString()} ${u.house} ${u.type}`)
        .join(", ");

      return `${factionLabel} — ${statusVerb}
  Army: ${army.name} [id: "${army.id}"]
  Commanders: ${commanders}
  Notable figures:
    ${notablesText}
  Strength: ${strength}
  Morale: ${army.morale}
  Condition: ${army.tiredness}
  ${marchLine}`;
    }).join("\n\n");
  }

  const northBlock = armyBlock(battle.northArmies, battle.northFromHoldId, "THE NORTH");
  const westBlock = armyBlock(battle.westArmies, battle.westFromHoldId, "THE WESTERLANDS");

  const allArmyIds = [
    ...battle.northArmies.map((a) => `"${a.id}" (${a.name})`),
    ...battle.westArmies.map((a) => `"${a.id}" (${a.name})`),
  ].join(", ");

  return `BATTLE LOCATION: ${locationLine}

FORCES ENGAGED:

${northBlock}

${westBlock}

TASK: Adjudicate this battle. Write a detailed chronicle of the engagement for the Citadel's records.

Your chronicle MUST:
1. Open by describing the terrain of ${hold?.name ?? "this location"} and how it shaped the tactical situation.
2. Explain each commander's battle plan given their character and force composition — what did they attempt? Where did they deploy cavalry, archers, infantry?
3. Describe the sequence of the battle in detail: the opening moves, a decisive turning point, and the final outcome. Name commanders and notable figures where relevant — their actions should matter.
4. Describe the human cost: which units bore the brunt, where the line broke (if it did), and the emotional weight of the losses.
5. End with the state of the field — who holds it, who is withdrawing, and in what condition the survivors are.

The narrative should be 4–6 dense paragraphs in ASOIAF maester-chronicle prose style. Be specific and vivid. Do not summarise blandly.

Casualty guidance: scale losses to the engagement's intensity. A brief skirmish: 3–8% losses per side. A contested battle: 10–20%. A devastating rout: 20–35% for the losing side, 8–15% for the winner. List casualties by unit type and house separately.

Commander/notable death guidance: deaths should be rare, meaningful, and narratively justified. Do not kill characters without clear cause. A figure might die in a desperate last stand, a cavalry charge gone wrong, or an assassination — not arbitrarily.

hold_result rules:
- "north" → The North holds the field. Westerlands armies MUST retreat. Their armyIds go in retreatingArmyIds.
- "westerlands" → The Westerlands hold the field. North armies MUST retreat. Their armyIds go in retreatingArmyIds.
- "abandoned" → BOTH sides are shattered and fall back. ALL army IDs from BOTH factions go in retreatingArmyIds. Use sparingly — only if both forces are genuinely broken.
- Do NOT leave enemy armies sharing the same location. Someone must yield or both must abandon the field.

Army IDs for the response: ${allArmyIds}

IMPORTANT: Your entire response must fit within ${maxTokens} tokens. Keep the narrative to 3–4 paragraphs and be concise in casualties/conditionUpdates. Do not truncate the JSON — it must be complete and valid.

Respond with this exact JSON object — no other text, no markdown fences:
{
  "narrative": "4–6 paragraphs. Use \\n\\n to separate paragraphs.",
  "holdResult": "north OR westerlands OR abandoned",
  "casualties": [
    {"faction": "north OR westerlands", "armyId": "exact-id", "unitType": "cavalry OR infantry OR archers", "house": "exact house name from above", "count": NUMBER}
  ],
  "fallen": [
    {"armyId": "exact-id", "name": "exact name as listed above", "isLeader": true or false}
  ],
  "retreatingArmyIds": ["exact-id", ...],
  "conditionUpdates": [
    {"armyId": "exact-id", "morale": "one vivid sentence describing morale after this battle", "tiredness": "one vivid sentence describing physical condition after this battle"}
  ]
}

conditionUpdates must include one entry for every army involved. Morale and tiredness should be qualitative, vivid, and specific to the outcome — winners feel pride or grim satisfaction, losers feel broken or shamed. Tired men who fought all day should feel it. Fresh troops who routed an enemy feel elated. Never use numbers.`;
}

function fallbackReport(battle: BattleContext): Omit<BattleReport, "id" | "turn" | "holdId"> {
  // On error, north holds (arbitrary) with light losses on both sides; west retreats
  const westRetreating = battle.westArmies.map((a) => a.id);
  return {
    narrative:
      "The forces clashed in the grey half-light of dawn. The exchange was brief and brutal, but the men of the North pressed the advantage on familiar ground. When the sun rose, the Western host had withdrawn, leaving the field to their foes.\n\nThe maesters record no further details — the chaos of the engagement left few reliable witnesses.",
    holdResult: "north",
    casualties: [
      ...battle.northArmies.flatMap((a) =>
        a.units.slice(0, 1).map((u) => ({
          faction: "north" as const,
          armyId: a.id,
          unitType: u.type,
          house: u.house,
          count: Math.max(1, Math.floor(u.count * 0.06)),
        }))
      ),
      ...battle.westArmies.flatMap((a) =>
        a.units.slice(0, 1).map((u) => ({
          faction: "westerlands" as const,
          armyId: a.id,
          unitType: u.type,
          house: u.house,
          count: Math.max(1, Math.floor(u.count * 0.12)),
        }))
      ),
    ],
    fallen: [],
    retreatingArmyIds: westRetreating,
  };
}

export async function POST(req: NextRequest) {
  let battle: BattleContext | null = null;
  try {
    const body = await req.json() as { battle: BattleContext; holds: Hold[] };
    battle = body.battle;
    const { holds } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[got-houses/battle] ANTHROPIC_API_KEY not set — using fallback");
      return NextResponse.json({ ...fallbackReport(battle), _debug: "no_api_key" });
    }

    const MAX_TOKENS = 4000;
    const holdsMap = new Map(holds.map((h) => [h.id, h]));
    const userMessage = buildBattleMessage(battle, holdsMap, MAX_TOKENS);

    console.log("[got-houses/battle] Calling claude-sonnet-5 for hold:", battle.holdId);

    const client = new Anthropic({ apiKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error("[got-houses/battle] Anthropic API error:", msg);
      return NextResponse.json({ ...fallbackReport(battle), _debug: "api_error", _error: msg });
    }

    // Log the full content array so we can see every block type Sonnet 5 returns
    console.log("[got-houses/battle] stop_reason:", response.stop_reason, "content blocks:", JSON.stringify(response.content));

    // Extract text from ALL block types (text + thinking + any other)
    const rawText = (response.content as Array<Record<string, unknown>>)
      .map((b) => {
        if (typeof b.text === "string") return b.text;
        if (typeof b.thinking === "string") return b.thinking;
        return "";
      })
      .join("");

    console.log("[got-houses/battle] rawText length:", rawText.length);
    const _rawFull = rawText;

    // Strip any markdown fences Claude might still add
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[got-houses/battle] No JSON found. Raw (first 800 chars):", rawText.slice(0, 800));
      return NextResponse.json({ ...fallbackReport(battle), _debug: "no_json", _raw: rawText });
    }

    let parsed: {
      narrative: string;
      holdResult: BattleReport["holdResult"];
      casualties: Casualty[];
      fallen: FallenFigure[];
      retreatingArmyIds: string[];
      conditionUpdates?: ArmyConditionUpdate[];
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[got-houses/battle] JSON parse error:", msg);
      return NextResponse.json({ ...fallbackReport(battle), _debug: "json_parse_error", _error: msg, _raw: rawText });
    }

    // Enforce retreat logic: make sure the right armies are in retreatingArmyIds
    const northIds = battle.northArmies.map((a) => a.id);
    const westIds = battle.westArmies.map((a) => a.id);
    let retreatingArmyIds = Array.isArray(parsed.retreatingArmyIds) ? parsed.retreatingArmyIds : [];

    if (parsed.holdResult === "north") {
      for (const id of westIds) {
        if (!retreatingArmyIds.includes(id)) retreatingArmyIds.push(id);
      }
      retreatingArmyIds = retreatingArmyIds.filter((id) => !northIds.includes(id));
    } else if (parsed.holdResult === "westerlands") {
      for (const id of northIds) {
        if (!retreatingArmyIds.includes(id)) retreatingArmyIds.push(id);
      }
      retreatingArmyIds = retreatingArmyIds.filter((id) => !westIds.includes(id));
    } else {
      retreatingArmyIds = [...northIds, ...westIds];
    }

    console.log("[got-houses/battle] Success — holdResult:", parsed.holdResult, "retreating:", retreatingArmyIds);

    return NextResponse.json({
      narrative: parsed.narrative ?? "",
      holdResult: (["north", "westerlands", "abandoned"].includes(parsed.holdResult)
        ? parsed.holdResult
        : "abandoned") as BattleReport["holdResult"],
      casualties: Array.isArray(parsed.casualties) ? parsed.casualties : [],
      fallen: Array.isArray(parsed.fallen) ? parsed.fallen : [],
      retreatingArmyIds,
      conditionUpdates: Array.isArray(parsed.conditionUpdates) ? parsed.conditionUpdates : [],
      _rawFull,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[got-houses/battle] Unexpected error:", msg);
    if (battle) {
      return NextResponse.json({ ...fallbackReport(battle), _debug: "unexpected_error", _error: msg });
    }
    return NextResponse.json({ error: "Adjudication failed", _debug: "unexpected_error", _error: msg }, { status: 500 });
  }
}
