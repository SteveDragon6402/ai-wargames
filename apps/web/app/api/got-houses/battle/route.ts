import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BattleContext, BattleReport, Casualty, FallenFigure, Hold, ArmyConditionUpdate, DefeatType } from "@/app/got-houses/types";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are adjudicating a multi-army coalition battle in a Game of Thrones strategy game set during the War of the Five Kings. You have deep knowledge of every commander's character, tactical style, and historical record from ASOIAF.

Write a crisp after-action report — not a chronicle, not a saga. State what each side decided collectively, what the decisive commanders chose, and what happened as a result. Cause and effect. Name commanders and their choices explicitly. Keep ASOIAF flavour only in proper nouns and tone, not in prose style.

Each side is a coalition of armies fighting together. Treat them as a unified force with internal dynamics (rivalries, different orders, different conditions), not as isolated individuals.

Always respond with valid JSON only — no prose, no markdown fences, no commentary outside the JSON object.`;

// ─── Message builder ──────────────────────────────────────────────────────────

function buildBattleMessage(battle: BattleContext, holdsMap: Map<string, Hold>, maxTokens: number): string {
  const hold = holdsMap.get(battle.holdId);
  const locationName = hold?.name ?? battle.holdId;
  const locationLine = hold
    ? `${hold.name} (${hold.region} — seat of House ${hold.house}, held by ${hold.lord})`
    : `Hold ${battle.holdId}`;

  // Build a detailed block for one army within a side
  function armyBlock(army: (typeof battle.northArmies)[number]): string {
    const order = battle.armyOrders?.[army.id] ?? "march";
    const statusLine =
      order === "rest"
        ? "Order: EXPLICITLY RESTING — encamped, off-guard, not expecting to fight"
        : order === "fortify"
          ? "Order: FORTIFYING — digging in, constructing field defences"
          : "Order: MARCHING / ENGAGING";

    const commanders = army.leaders
      .map((l) => `${l.name}${l.title ? ` (${l.title})` : ""}`)
      .join(", ");
    const notablesText = army.notables?.length
      ? army.notables.map((n) => `  • ${n.name} — ${n.description}`).join("\n")
      : "  • None";

    const unitLines = army.units
      .map((u) => `  • ${u.count.toLocaleString()} ${u.house} ${u.type}`)
      .join("\n");

    const act = army.activity;
    const activityParts = [
      act.turnsResting > 0 ? `resting ${act.turnsResting} turn(s)` : null,
      act.turnsFortiying > 0 ? `fortifying ${act.turnsFortiying} turn(s)` : null,
      act.turnsMarching > 0 ? `marching ${act.turnsMarching} turn(s)` : null,
      act.turnsSinceMerge === 0 ? `MERGED THIS TURN — formations disorganised` : null,
      act.turnsSinceSplit === 0 ? `SPLIT THIS TURN — chain of command uncertain` : null,
    ].filter(Boolean).join("; ") || "no notable recent history";

    return `  ▸ ${army.name} [id: "${army.id}"]
    Commanders: ${commanders}
    Notables:
${notablesText}
    Strength:
${unitLines}
    Morale: ${army.morale}
    Condition: ${army.tiredness}
    Stance: ${army.stance}
    Activity: ${activityParts}
    ${statusLine}`;
  }

  // Build a side block: faction header + all armies + troop total
  function sideBlock(armies: typeof battle.northArmies, sideLabel: string): string {
    if (armies.length === 0) return "";
    const totalTroops = armies.reduce(
      (sum, a) => sum + a.units.reduce((s, u) => s + u.count, 0),
      0
    );
    const armyCount = armies.length;
    const separator = "─".repeat(60);
    return `${separator}
SIDE: ${sideLabel.toUpperCase()}  |  ${armyCount} arm${armyCount !== 1 ? "ies" : "y"}  |  ~${totalTroops.toLocaleString()} troops combined
All armies below fight as ONE coalition. Treat them as a unified force.
${separator}
${armies.map(armyBlock).join("\n\n")}`;
  }

  const northBlock = sideBlock(battle.northArmies, "The North");
  const westBlock  = sideBlock(battle.westArmies,  "The Westerlands");

  const allArmyIds = [
    ...battle.northArmies.map((a) => `"${a.id}" (${a.name})`),
    ...battle.westArmies.map((a)  => `"${a.id}" (${a.name})`),
  ].join(", ");

  const lastStandNote = battle.lastStand
    ? `\n\n⚠ LAST STAND: The retreating side has no valid retreat routes. They are surrounded or cut off — cornered men fighting for their lives. Apply LAST STAND defeat type (see casualty rules). Total destruction of the trapped force is adjudicated honestly.`
    : "";

  return `BATTLE LOCATION: ${locationLine}
${lastStandNote}

═══════════════════════════════════════════════════════════════
FORCES ENGAGED AT ${locationName.toUpperCase()}
═══════════════════════════════════════════════════════════════

${northBlock}

${westBlock}

═══════════════════════════════════════════════════════════════
TASK: Adjudicate this coalition battle at ${locationName}.
═══════════════════════════════════════════════════════════════

NARRATIVE REQUIREMENTS:
1. One sentence on terrain/fortifications at ${locationName} and how they shaped the fight.
2. For each side: describe the coalition's overall tactical approach, noting where the armies coordinated well or poorly. Name specific commanders and their individual choices. Tywin Lannister fights differently from Robb Stark. Jaime charges. Roose Bolton waits. When multiple friendly armies are present, note if they acted in concert or independently.
3. Include one randomising factor (weather, fog, courier failure, unexpected flank, a horse stumbling, a ford harder than expected). War is not a chess match.
4. Describe the decisive moment: what broke, who held, what changed.
5. END with the field result and survivor condition.

If any army had order EXPLICITLY RESTING, treat them as surprised and disorganised — disadvantaged.

${buildCasualtyGuidance(battle.lastStand ?? false)}

Commander and notable death guidance: proportionate to the scale of defeat. A decisive rout should cost losing commanders. A shattering can kill prominent figures. An annihilated army loses all commanders. Do NOT artificially protect named characters. Do NOT invent deaths in minor skirmishes.

Army destruction: you MAY reduce any unit type to 0. An army at 0 total surviving units is destroyed — all its commanders go in "fallen". Do not hesitate with broken armies.

HOLD RESULT RULES:
- "north"        → The North holds the field. ALL Westerlands army IDs go in retreatingArmyIds.
- "westerlands"  → The Westerlands hold. ALL North army IDs go in retreatingArmyIds.
- "abandoned"    → BOTH coalitions shatter. ALL army IDs from BOTH sides in retreatingArmyIds. Use only if genuinely both collapse.
- Do NOT leave both sides sharing the same hold. Someone must yield.

Army IDs for this battle: ${allArmyIds}

IMPORTANT: Your entire response must fit within ${maxTokens} tokens. Do not truncate the JSON — it must be complete and valid.

Respond with this exact JSON — no other text, no markdown fences:
{
  "defeatType": "structured_withdrawal OR rout OR shattering OR pyrrhic_win OR last_stand",
  "narrative": "2–3 short paragraphs. Use \\n\\n to separate. Direct and factual. Coalitions make decisions. Chance intervenes. The field is decided. Name the location (${locationName}) in the opening sentence.",
  "holdResult": "north OR westerlands OR abandoned",
  "casualties": [
    {"faction": "north OR westerlands", "armyId": "exact-id", "unitType": "cavalry OR infantry OR archers", "house": "exact house name from above", "count": NUMBER}
  ],
  "fallen": [
    {"armyId": "exact-id", "name": "exact name as listed above", "isLeader": true or false}
  ],
  "retreatingArmyIds": ["exact-id", ...],
  "conditionUpdates": [
    {"armyId": "exact-id", "morale": "one vivid sentence — specific to this army's outcome", "tiredness": "one vivid sentence — physical state after the battle", "stance": "one vivid sentence — tactical posture going forward: victors bold/aggressive, routed armies shattered/desperate, orderly retreaters bruised but intact"}
  ]
}

conditionUpdates must include one entry for EVERY army involved. Stance after defeat: a routed army is shattered and desperate; an orderly retreat leaves the army bruised but not broken; a pyrrhic winner is bloodied and wary.`;
}

// ─── Casualty guidance (pulled out for clarity) ───────────────────────────────

function buildCasualtyGuidance(lastStand: boolean): string {
  if (lastStand) {
    return `DEFEAT TYPE FOR THIS BATTLE: LAST STAND (forced by encirclement — use last stand casualty rules below)

CASUALTY RULES — LAST STAND:
  Trapped side: 50–85% total casualties. Total destruction is adjudicated honestly. No mercy from the numbers.
  Attacking side: 10–22% casualties — even the winner bleeds against cornered men.
  No abandonment modifier needed — there is nowhere to run.
  List casualties by unit type and house separately.`;
  }

  return `DEFEAT TYPE — choose ONE that best fits how this battle ends. Your choice determines casualty scale.

┌─────────────────────────────────────────────────────────────────────────────┐
│ STRUCTURED WITHDRAWAL                                                       │
│ The losing side retreats in good order. Rear-guard holds. Discipline        │
│ maintained. No pursuit rout.                                                │
│   Loser:  8–18% casualties. No abandonment.                                 │
│   Winner: 6–14% casualties (sometimes higher if they attacked a prepared    │
│           line — a successful defence can cost the attacker more).          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROUT                                                                        │
│ The losing formation breaks. Men scatter and flee. Cavalry pursues.         │
│ Casualties come as much from pursuit as from the fighting itself.           │
│   Loser:  20–38% direct battle casualties                                   │
│           + 8–20% ABANDONMENT: men who scatter during/after and never       │
│             return to the army — deserters, stragglers, broken men.         │
│             Include abandonment in the casualty count.                      │
│             Narrative must mention men casting down weapons, scattering     │
│             into fields, or peeling away from the column over the next day. │
│   Winner: 5–12% casualties.                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ SHATTERING                                                                  │
│ The army is effectively destroyed — pursuit, encirclement, or complete      │
│ collapse. A combination of battlefield deaths and mass desertion.           │
│   Loser:  40–70% combined (fighting deaths + abandonment). Unit types       │
│           may drop to 0. "Half an army melted away into the countryside."   │
│   Winner: 8–18% casualties.                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ PYRRHIC WIN                                                                 │
│ The winner triumphs but at terrible cost. Reckless assault, stubborn        │
│ defence, grinding attrition, or tactical misjudgement by the winner.        │
│ Sometimes the loser inflicts more casualties than the winner.               │
│   Winner: 18–32% casualties.                                                │
│   Loser:  10–22% casualties (fought well before giving ground).             │
│   Use this when: the loser held a fortified or elevated position; the        │
│   winner assaulted across a river or through a choke; OR attacker's         │
│   commanders were reckless (Jaime charging unsupported, etc.).              │
└─────────────────────────────────────────────────────────────────────────────┘

ABANDONMENT NOTE: Routs and shatterings ALWAYS include post-battle abandonment in the casualty totals. These are men who survive the battle but scatter, desert, or fade away — they are gone from the army regardless. Count them as casualties. Mention them in the narrative.

List all casualties by unit type and house separately.`;
}

// ─── Deterministic fallback ───────────────────────────────────────────────────

function fallbackReport(battle: BattleContext): Omit<BattleReport, "id" | "turn" | "holdId"> {
  const westRetreating = battle.westArmies.map((a) => a.id);
  return {
    defeatType: "structured_withdrawal",
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
          count: Math.max(1, Math.floor(u.count * 0.08)),
        }))
      ),
      ...battle.westArmies.flatMap((a) =>
        a.units.slice(0, 1).map((u) => ({
          faction: "westerlands" as const,
          armyId: a.id,
          unitType: u.type,
          house: u.house,
          count: Math.max(1, Math.floor(u.count * 0.15)),
        }))
      ),
    ],
    fallen: [],
    retreatingArmyIds: westRetreating,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

    console.log("[got-houses/battle] Calling claude-sonnet-5 for hold:", battle.holdId,
      "| North armies:", battle.northArmies.length,
      "| West armies:", battle.westArmies.length);

    const client = new Anthropic({ apiKey });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;

    // Try Sonnet 5 up to twice (backoff on 529 overload), then fall back to Haiku
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

    const rawText = (response.content as Array<Record<string, unknown>>)
      .map((b) => {
        if (typeof b.text === "string") return b.text;
        if (typeof b.thinking === "string") return b.thinking;
        return Object.values(b).filter((v) => typeof v === "string").join("");
      })
      .join("");

    console.log("[got-houses/battle] rawText length:", rawText.length, "stop_reason:", response.stop_reason);

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[got-houses/battle] No JSON found. Raw (first 800 chars):", rawText.slice(0, 800));
      return NextResponse.json({ ...fallbackReport(battle), _debug: "no_json", _raw: rawText });
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
      defeatType?: string;
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
      return NextResponse.json({ ...fallbackReport(battle), _debug: "json_parse_error", _error: msg });
    }

    // Validate and normalise retreating army IDs
    const northIds = battle.northArmies.map((a) => a.id);
    const westIds  = battle.westArmies.map((a) => a.id);
    let retreatingArmyIds = Array.isArray(parsed.retreatingArmyIds) ? parsed.retreatingArmyIds : [];

    if (parsed.holdResult === "north") {
      for (const id of westIds) { if (!retreatingArmyIds.includes(id)) retreatingArmyIds.push(id); }
      retreatingArmyIds = retreatingArmyIds.filter((id) => !northIds.includes(id));
    } else if (parsed.holdResult === "westerlands") {
      for (const id of northIds) { if (!retreatingArmyIds.includes(id)) retreatingArmyIds.push(id); }
      retreatingArmyIds = retreatingArmyIds.filter((id) => !westIds.includes(id));
    } else {
      retreatingArmyIds = [...northIds, ...westIds];
    }

    // Validate defeatType
    const validDefeatTypes: DefeatType[] = ["structured_withdrawal", "rout", "shattering", "pyrrhic_win", "last_stand"];
    const defeatType: DefeatType | undefined = validDefeatTypes.includes(parsed.defeatType as DefeatType)
      ? (parsed.defeatType as DefeatType)
      : undefined;

    console.log("[got-houses/battle] Success — holdResult:", parsed.holdResult, "defeatType:", defeatType, "retreating:", retreatingArmyIds);

    return NextResponse.json({
      defeatType,
      narrative: parsed.narrative ?? "",
      holdResult: (["north", "westerlands", "abandoned"].includes(parsed.holdResult)
        ? parsed.holdResult
        : "abandoned") as BattleReport["holdResult"],
      casualties: Array.isArray(parsed.casualties) ? parsed.casualties : [],
      fallen: Array.isArray(parsed.fallen) ? parsed.fallen : [],
      retreatingArmyIds,
      conditionUpdates: Array.isArray(parsed.conditionUpdates) ? parsed.conditionUpdates : [],
      _rawFull: rawText,
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
