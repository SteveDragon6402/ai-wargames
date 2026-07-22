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
3. Describe the decisive moment: what broke, who held, what changed. The outcome must be driven primarily by the forces themselves — their strength, morale, commanders, terrain, and orders. War has friction; if there is a natural place for an element of chance or fog-of-war, include it as texture. Do not use weather or luck as the deciding factor.
4. END with the field result and survivor condition.

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
    return `DEFEAT TYPE FOR THIS BATTLE: LAST STAND (forced by encirclement)

The trapped force is surrounded with nowhere to retreat. Cornered men fight with desperation — but they cannot escape. Adjudicate casualties honestly based on the trapped side's strength, morale, and the attacker's willingness to close. Total destruction is possible but not automatic: a resolute force behind prepared ground costs the attacker dearly even as it dies.

The attacker bleeds too — even a victorious assault on cornered men is not cheap.

List casualties by unit type and house separately.`;
  }

  return `DEFEAT TYPE — choose ONE that best describes how this battle ends. Your choice shapes how you think about casualties.

STRUCTURED WITHDRAWAL
The losing side retreats in good order. Rear-guards hold. Discipline is maintained. The loser preserves most of their strength — the pursuit is limited and the army lives to fight another day. Both sides emerged from the engagement with most of their men intact. Think: a narrow defeat against a competent adversary, a deliberate fallback to prepared positions, or a successful fighting withdrawal.

ROUT
The formation breaks. Men scatter in terror and flee. Cavalry pursues and the killing happens in the rout, not the battle itself. Beyond the battlefield dead, significant numbers of men scatter, desert, and never return — count these abandonment losses as casualties too. The narrative must describe men casting down weapons, scattering into fields, or peeling away over the following day. Think: a flank that collapsed, a commander killed at the critical moment, morale already brittle before the fight began.

SHATTERING
The army ceases to exist as a fighting force. Encirclement, complete collapse, or a rout so total that pursuit and desertion reduce the force to almost nothing. Unit types may be annihilated entirely. "Half the army melted away into the countryside" is not hyperbole here. Think: a force caught in the open with no escape, outmanoeuvred on all sides, or already so broken in morale that the battle was over before it started.

PYRRHIC WIN
The winner claims the field but at terrible cost — often bleeding more than the loser. The losing side fought stubbornly and made the winner pay. Think: the winner assaulted a fortified or elevated position; fought uphill across difficult ground; commanders were reckless; the defence ground down the attacker before finally giving way. The winner cannot pursue aggressively.

CASUALTY PRINCIPLE — do not use percentages or target numbers:
Think about what this specific battle would actually cost. Consider:
- How many men reached fighting range before one side broke?
- How long did the engagement last?
- Was there a pursuit, and how far did it go?
- Did men scatter, desert, or simply stop following orders?
- Were any units already exhausted, low on morale, or poorly led?
- Did fortifications or terrain shield the defenders or expose the attackers?

Let the numbers emerge from your assessment of the battle and the armies involved. Do not anchor on percentages. A massive army routing a small one costs almost nothing. A small force defending a chokepoint can bleed an army twice its size.

ABANDONMENT: In a rout or shattering, men who survive the fighting but scatter, desert, or fade away are as lost to the army as those who died. Include them in the casualty count and mention them in the narrative.

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
      // Pass 1: escape raw control characters that appear inside JSON strings
      let inString = false;
      let escaped = false;
      let out = "";
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (escaped) { escaped = false; out += ch; continue; }
        if (ch === "\\" && inString) { escaped = true; out += ch; continue; }
        if (ch === '"') { inString = !inString; out += ch; continue; }
        if (inString) {
          if (ch === "\n") { out += "\\n"; continue; }
          if (ch === "\r") { out += "\\r"; continue; }
          if (ch === "\t") { out += "\\t"; continue; }
        }
        out += ch;
      }
      // Pass 2: remove trailing commas before ] or } (LLMs commonly emit these)
      // Safe to do globally — a literal ",]" or ",}" inside a string value
      // would have been escaped by now if it contained raw newlines, and
      // the pattern itself is syntactically invalid in JSON everywhere else.
      return out.replace(/,(\s*[}\]])/g, "$1");
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
    const sanitised = sanitiseJson(jsonMatch[0]);
    try {
      parsed = JSON.parse(sanitised);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      // Extract position from message like "at position 1933" and log a window around it
      const posMatch = msg.match(/position (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        console.error("[got-houses/battle] JSON parse error:", msg,
          "\n→ context around position", pos, ":",
          JSON.stringify(sanitised.slice(Math.max(0, pos - 60), pos + 60)));
      } else {
        console.error("[got-houses/battle] JSON parse error:", msg);
      }
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
