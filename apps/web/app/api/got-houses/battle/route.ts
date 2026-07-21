import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BattleContext, BattleReport, Casualty, FallenFigure, Hold, ArmyConditionUpdate } from "@/app/got-houses/types";

const SYSTEM_PROMPT = `You are adjudicating a battle in a Game of Thrones strategy game set during the War of the Five Kings. You have deep knowledge of every commander's character, tactical style, and historical record from ASOIAF.

Write a crisp after-action report — not a chronicle, not a saga. State what each commander decided, why, and what happened as a result. Cause and effect. Name commanders and their choices explicitly. Keep ASOIAF flavour only in proper nouns and tone, not in prose style.

Always respond with valid JSON only — no prose, no markdown fences, no commentary outside the JSON object.`;

function buildBattleMessage(battle: BattleContext, holdsMap: Map<string, Hold>, maxTokens: number): string {
  const hold = holdsMap.get(battle.holdId);
  const locationLine = hold
    ? `${hold.name} (${hold.region} — seat of House ${hold.house}, held by ${hold.lord})`
    : `Hold ${battle.holdId}`;

  function armyBlock(armies: typeof battle.northArmies, factionLabel: string): string {
    if (armies.length === 0) return "";

    return armies.map((army) => {
      const order = battle.armyOrders?.[army.id] ?? "march";
      const statusLine = order === "rest"
        ? "Order this turn: EXPLICITLY RESTING — not expecting to fight, encamped and off-guard"
        : order === "fortify"
          ? "Order this turn: FORTIFYING — digging in and constructing defences"
          : "Order this turn: MARCHING / ENGAGING";

      const commanders = army.leaders
        .map((l) => `${l.name}${l.title ? ` (${l.title})` : ""}`)
        .join(", ");
      const notablesText = army.notables?.length
        ? army.notables.map((n) => `${n.name} — ${n.description}`).join("\n    ")
        : "None";
      const strength = army.units
        .map((u) => `${u.count.toLocaleString()} ${u.house} ${u.type}`)
        .join(", ");

      const act = army.activity;
      const activityLines = [
        act.turnsResting > 0 ? `Has been resting for ${act.turnsResting} consecutive turn(s)` : null,
        act.turnsFortiying > 0 ? `Has been fortifying for ${act.turnsFortiying} consecutive turn(s)` : null,
        act.turnsMarching > 0 ? `Has been marching for ${act.turnsMarching} consecutive turn(s)` : null,
        act.turnsSinceMerge === 0 ? `Merged with another army THIS TURN — formations disorganised` : null,
        act.turnsSinceSplit === 0 ? `Split from another army THIS TURN — chain of command uncertain` : null,
      ].filter(Boolean).join("; ") || "No notable activity history";

      return `${factionLabel} — ${army.name} [id: "${army.id}"]
  Commanders: ${commanders}
  Notable figures:
    ${notablesText}
  Strength: ${strength}
  Morale: ${army.morale}
  Condition: ${army.tiredness}
  Stance: ${army.stance}
  Activity: ${activityLines}
  ${statusLine}`;
    }).join("\n\n");
  }

  const northBlock = armyBlock(battle.northArmies, "THE NORTH");
  const westBlock = armyBlock(battle.westArmies, "THE WESTERLANDS");

  const allArmyIds = [
    ...battle.northArmies.map((a) => `"${a.id}" (${a.name})`),
    ...battle.westArmies.map((a) => `"${a.id}" (${a.name})`),
  ].join(", ");

  const lastStandNote = battle.lastStand
    ? `\n⚠ LAST STAND: The retreating side has no valid retreat routes. They are surrounded or cut off and fighting for survival. Expect very heavy casualties on the trapped side. Total army destruction is possible and should be adjudicated honestly.`
    : "";

  return `BATTLE LOCATION: ${locationLine}
This battle takes place at ${hold?.name ?? battle.holdId}. Use this exact location name throughout. Do not substitute another location.${lastStandNote}

FORCES ENGAGED:

${northBlock}

${westBlock}

TASK: Adjudicate this battle at ${hold?.name ?? battle.holdId}.

Your after-action report MUST:
1. Note the terrain and fortifications of ${hold?.name ?? battle.holdId} and how they shaped the fight (briefly — one sentence max).
2. For each named commander present, state explicitly what tactical choice they made and why — based on their known character and the forces at their disposal. Tywin Lannister fights differently from Robb Stark. Jaime charges. Roose Bolton waits. Make commanders matter.
3. Include at least one randomising factor that affected the outcome — weather, fog, a messenger failure, an unexpected flank, a horse stumbling at the wrong moment. War is not a chess match.
4. Describe the decisive moment clearly: what broke, who held, what changed.
5. State who holds the field and in what condition the survivors are.

If any army had order "EXPLICITLY RESTING", they were not prepared for battle — treat them as surprised, slower to form up, and disadvantaged accordingly.

Casualty guidance — scale losses to the engagement's intensity:
- Brief skirmish: 3–8% per side
- Contested battle: 10–20%
- Devastating rout: 20–35% for the loser, 8–15% for the winner
- Last stand / encirclement: 30–60% for the trapped side; total destruction is allowed
List casualties by unit type and house separately.

Commander and notable death guidance: deaths must be proportionate to the scale of defeat. A decisive rout should cost the losing side commanders. A shattering defeat can kill even prominent figures. An army that is completely destroyed may lose all its commanders. Do not artificially protect named characters — if the battle warrants it, kill them. Equally, do not invent deaths in a minor skirmish.

Army destruction: you MAY reduce a unit type to 0 if casualties warrant it. An army with 0 total surviving units after casualties is destroyed entirely — include all its commanders in "fallen". Do not hesitate to destroy broken armies that are outmatched.

hold_result rules:
- "north" → The North holds the field. All Westerlands army IDs go in retreatingArmyIds.
- "westerlands" → The Westerlands hold. All North army IDs go in retreatingArmyIds.
- "abandoned" → BOTH sides shattered. ALL army IDs from BOTH factions in retreatingArmyIds. Use only if genuinely both forces collapse.
- Do NOT leave enemies sharing the same location. Someone must yield.

Army IDs for the response: ${allArmyIds}

IMPORTANT: Your entire response must fit within ${maxTokens} tokens. Do not truncate the JSON — it must be complete and valid.

Respond with this exact JSON object — no other text, no markdown fences:
{
  "narrative": "2–3 short paragraphs. Use \\n\\n to separate. Direct and factual. Commanders make choices. Chance intervenes. The field is decided. Name the location (${hold?.name ?? battle.holdId}) in the opening sentence.",
  "holdResult": "north OR westerlands OR abandoned",
  "casualties": [
    {"faction": "north OR westerlands", "armyId": "exact-id", "unitType": "cavalry OR infantry OR archers", "house": "exact house name from above", "count": NUMBER}
  ],
  "fallen": [
    {"armyId": "exact-id", "name": "exact name as listed above", "isLeader": true or false}
  ],
  "retreatingArmyIds": ["exact-id", ...],
  "conditionUpdates": [
    {"armyId": "exact-id", "morale": "one vivid sentence — specific to outcome", "tiredness": "one vivid sentence — physical state after battle", "stance": "one vivid sentence — tactical posture after battle: victors become bold/aggressive, defeated become shaken/defensive"}
  ]
}

conditionUpdates must include one entry for every army involved. Stance: winners should feel emboldened and aggressive; losers should feel shaken, defensive, or broken. An army that fought from rest will have a different stance than one that fought on the march.`;
}

function fallbackReport(battle: BattleContext): Omit<BattleReport, "id" | "turn" | "holdId"> {
  const westRetreating = battle.westArmies.map((a) => a.id);
  return {
    narrative:
      "The forces clashed in the grey half-light of dawn. The Northmen pressed their advantage on familiar ground and the Western host withdrew before the day was out.\n\nThe maesters record no further details — the chaos of the engagement left few reliable witnesses.",
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

    const MAX_TOKENS = 6000;
    const holdsMap = new Map(holds.map((h) => [h.id, h]));
    const userMessage = buildBattleMessage(battle, holdsMap, MAX_TOKENS);

    console.log("[got-houses/battle] Calling claude-sonnet-5 for hold:", battle.holdId);

    const client = new Anthropic({ apiKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;

    // Try Sonnet 5 up to 3 times (with backoff), then fall back to Haiku
    const MODELS = ["claude-sonnet-5", "claude-sonnet-5", "claude-haiku-4-5"];
    let lastError = "";
    let succeeded = false;
    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      const model = MODELS[attempt];
      if (attempt > 0) {
        const delay = attempt * 1500;
        console.log(`[got-houses/battle] Retrying with ${model} in ${delay}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        response = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          thinking: { type: "disabled" } as any,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        });
        console.log(`[got-houses/battle] Success with ${model} on attempt ${attempt + 1}`);
        succeeded = true;
        break;
      } catch (apiErr) {
        lastError = apiErr instanceof Error ? apiErr.message : String(apiErr);
        const isOverloaded = lastError.includes("529") || lastError.toLowerCase().includes("overload");
        console.warn(`[got-houses/battle] ${model} attempt ${attempt + 1} failed (overloaded=${isOverloaded}):`, lastError);
        if (!isOverloaded) break;
      }
    }
    if (!succeeded) {
      console.error("[got-houses/battle] All attempts failed:", lastError);
      return NextResponse.json({ ...fallbackReport(battle), _debug: "api_error", _error: lastError });
    }

    const _responseDebug = JSON.stringify(response);
    console.log("[got-houses/battle] full response:", _responseDebug);

    const rawText = (response.content as Array<Record<string, unknown>>)
      .map((b) => {
        if (typeof b.text === "string") return b.text;
        if (typeof b.thinking === "string") return b.thinking;
        return Object.values(b).filter((v) => typeof v === "string").join("");
      })
      .join("");

    console.log("[got-houses/battle] rawText length:", rawText.length, "stop_reason:", response.stop_reason);
    const _rawFull = rawText;

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[got-houses/battle] No JSON found. Raw (first 800 chars):", rawText.slice(0, 800));
      return NextResponse.json({ ...fallbackReport(battle), _debug: "no_json", _raw: rawText, _responseDebug });
    }

    function sanitiseJson(str: string): string {
      let inString = false;
      let escaped = false;
      let out = "";
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (escaped) { escaped = false; out += ch; continue; }
        if (ch === "\\" && inString) { escaped = true; out += ch; continue; }
        if (ch === '"') { inString = !inString; out += ch; continue; }
        if (inString && ch === "\n") { out += "\\n"; continue; }
        if (inString && ch === "\r") { out += "\\r"; continue; }
        out += ch;
      }
      return out;
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
      parsed = JSON.parse(sanitiseJson(jsonMatch[0]));
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[got-houses/battle] JSON parse error:", msg);
      return NextResponse.json({ ...fallbackReport(battle), _debug: "json_parse_error", _error: msg, _raw: rawText, _responseDebug });
    }

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
