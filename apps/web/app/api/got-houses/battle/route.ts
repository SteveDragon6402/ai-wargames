import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { BattleContext, BattleReport, Casualty, FallenFigure, Hold, ArmyConditionUpdate, DefeatType } from "@/app/got-houses/types";
import { FACTION_HOMELAND } from "@/app/got-houses/data/homeland";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a military analyst adjudicating a medieval wargame battle. Your job is to determine what actually happened when these specific forces met on this specific ground.

Write a tactical engagement report — not a story. Structure it as a sequence of labelled phases (INITIAL DEPLOYMENT, PHASE 1, PHASE 2, etc.). Each phase states who acted, what maneuver they executed, and the immediate result. Use commander names and unit types. Describe real tactical actions: flanking, advancing in column, volley fire, screening, holding the line, charging, withdrawing in order, routing.

HARD CONSTRAINTS — never violate these:
- Do not comment on who controls territory not explicitly stated in the battle data
- Do not state or imply where retreating armies will go — that is the player's decision
- Do not comment on strategic or political implications beyond this single engagement
- Do not reference armies, forces, or reinforcements not present in this battle
- Treat the battle location as contested unless the data explicitly shows a defending garrison
- Every claim must follow directly from the forces given: their numbers, unit composition, morale, tiredness, commander characters, orders, hold ground, approach routes, homeland climate fit, and NPC commander takes/moods
- Player faction lords (Robb, Tywin) do NOT submit AI takes — they are represented only by army orders and condition

GROUND, APPROACH, HOMELAND, AND COMMANDER TAKES — these are soft mechanics and MUST shape the fight:
- NPC commander takes (take / outlook / approach + mood) shape INITIAL DEPLOYMENT and early phases: eager commanders press; reluctant ones hesitate; discord between coalition takes hurts coordination
- Hold ground: defensibility, footing, climate, and rest quality of the battle seat — use it in INITIAL DEPLOYMENT and throughout
- Approach route: armies that marched in arrive shaped by that road (disordered from swamp/pass/desert, or still formed from easy road). Defenders already present hold the local ground
- Homeland vs climate: Northmen thrive in cold and suffer in Dornish heat; Westermen know hills and mild west-coast country and struggle in deep desert or endless fen. Climate mismatch is a real combat factor — not flavour text

Keep ASOIAF proper nouns (names, places). Drop all ASOIAF narrative flavour — no ravens, no maesters, no "the gods decided", no purple prose.

Always respond with valid JSON only — no prose, no markdown fences, no commentary outside the JSON object.`;

// ─── Message builder ──────────────────────────────────────────────────────────

function buildBattleMessage(battle: BattleContext, holdsMap: Map<string, Hold>, maxTokens: number): string {
  const hold = holdsMap.get(battle.holdId);
  const locationName = hold?.name ?? battle.holdId;
  const locationLine = hold
    ? `${hold.name} (${hold.region} — seat of House ${hold.house}, held by ${hold.lord})`
    : `Hold ${battle.holdId}`;
  const groundLine = hold?.ground
    ? `Hold ground: ${hold.ground}`
    : "Hold ground: unknown";

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

    const approach = battle.armyApproaches?.[army.id];
    const approachLine = approach
      ? `Approach: marched from ${approach.fromHoldName} — ${approach.route}`
      : "Approach: already present at this hold (defending / held position)";

    return `  ▸ ${army.name} [id: "${army.id}"]
    Commanders: ${commanders}
    Notables:
${notablesText}
    Strength:
${unitLines}
    Morale: ${army.morale}
    Condition: ${army.tiredness}
    Stance: ${army.stance}
    Homeland: ${FACTION_HOMELAND[army.faction]}
    ${approachLine}
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

  const engagement = battle.engagement ?? "field";
  const engagementNote =
    engagement === "storm"
      ? `\n\nENGAGEMENT TYPE: STORM THE GATES — field armies assault the walls against a defending GARRISON (army id starts with "garrison:"). The garrison fights from fortifications — treat walls, towers, and gates as decisive soft advantages for the defenders unless numbers or leadership overwhelm them. If the attackers win, the garrison is broken and the seat falls open.`
      : engagement === "sally"
        ? `\n\nENGAGEMENT TYPE: SALLY OUT — the defending GARRISON (and any relieving field armies on their side) sortie against the besiegers. This may be a two-front fight if relief has marched onto the invested hold. If the sally succeeds, the siege is broken and besiegers must retreat. If it fails, the garrison may be depleted or destroyed.`
        : "";

  const briefs = battle.commanderBriefs ?? [];
  const briefsBlock =
    briefs.length > 0
      ? `\nCOMMANDER TAKES (NPC only — soft mechanics; player lords have no takes):\n${briefs
          .map(
            (b) =>
              `- ${b.name} [${b.armyId}] mood="${b.mood}"\n  take: ${b.take}\n  outlook: ${b.outlook}\n  approach: ${b.approach}`
          )
          .join("\n")}`
      : "\nCOMMANDER TAKES: none available";

  return `BATTLE LOCATION: ${locationLine}
${groundLine}
${briefsBlock}
${lastStandNote}
${engagementNote}

═══════════════════════════════════════════════════════════════
FORCES ENGAGED AT ${locationName.toUpperCase()}
═══════════════════════════════════════════════════════════════

${northBlock}

${westBlock}

═══════════════════════════════════════════════════════════════
TASK: Adjudicate this coalition battle at ${locationName}.
═══════════════════════════════════════════════════════════════

ENGAGEMENT REPORT FORMAT — write 3 to 5 labelled tactical phases:

  INITIAL DEPLOYMENT: Where each force positions. Who holds what ground. Opening dispositions of each commander. Factor hold ground and each army's approach (or defensive presence).
  PHASE 1 — [brief label]: First maneuver. Who moved, what action, immediate result.
  PHASE 2 — [brief label]: Response or escalation. What changed, who pressed or gave ground.
  PHASE N — [brief label]: Continue until the decisive moment is reached.
  RESOLUTION: The final state of the field. Which side holds, which withdraws, what condition they are in.

Rules for each phase:
- 1 to 3 sentences maximum
- Name the commander making the decision
- Name the unit type executing it
- State the immediate tactical result — do not editorialize, do not project future consequences
- Do not state where a retreating army will go
- Do not comment on what the result means politically or strategically
- Do not assume any army controls territory it was not already occupying per the battle data
- If an army had order EXPLICITLY RESTING: treat it as surprised and unprepared — that affects the early phases
- Arrival path shapes early phases; hold ground shapes fighting throughout; homeland–climate mismatch is a real combat factor

Each side is a coalition: when multiple armies fight together, note if they coordinated or acted independently.

${buildCasualtyGuidance(battle.lastStand ?? false)}

Commander and notable death guidance: proportionate to the scale of defeat. A decisive rout risks losing commanders. A shattering can kill prominent figures. Do NOT artificially protect named characters — they die when the situation warrants it. Do NOT invent deaths in minor skirmishes or small engagements.

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
  "narrative": "Labelled tactical phases separated by \\n\\n. Format each phase as 'LABEL: sentence(s)'. Example: 'INITIAL DEPLOYMENT: Robb Stark deployed his cavalry on the ridge north of ${locationName} while Tywin Lannister advanced his main body up the Kingsroad in column.\\n\\nPHASE 1 — OPENING PROBE: Tywin detached the Clegane vanguard to test the eastern ford under crossbow cover. The Stark cavalry screened but took fire and pulled back to the bank.\\n\\nRESOLUTION: The Northern line collapsed on the left. Robb ordered a fighting withdrawal before the flank was turned.' Scale phases to the engagement — a skirmish needs 3, a major battle warrants 5.",
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
- Did fortifications, hold ground, approach routes, or homeland–climate mismatch shield the defenders or expose the attackers?

Let the numbers emerge from your assessment of the battle and the armies involved. Do not anchor on percentages. A massive army routing a small one costs almost nothing. A small force defending a chokepoint can bleed an army twice its size.

ABANDONMENT: In a rout or shattering, men who survive the fighting but scatter, desert, or fade away are as lost to the army as those who died. Include them in the casualty count and mention them in the narrative.

List all casualties by unit type and house separately.`;
}

// ─── Deterministic fallback ───────────────────────────────────────────────────

function fallbackReport(
  battle: BattleContext,
  holdsMap?: Map<string, Hold>
): Omit<BattleReport, "id" | "turn" | "holdId"> {
  const hold = holdsMap?.get(battle.holdId);
  const groundNote = hold?.ground
    ? ` Fighting turned on the local ground — ${hold.ground.split(";")[0].trim()}.`
    : "";
  const westRetreating = battle.westArmies.map((a) => a.id);
  return {
    defeatType: "structured_withdrawal",
    narrative:
      `INITIAL DEPLOYMENT: The hosts met at ${hold?.name ?? "the contested hold"}.${groundNote}\n\n` +
      "PHASE 1 — CLASH: The Northmen pressed their advantage and the Western host gave ground before the day was out.\n\n" +
      "RESOLUTION: The Westerlands withdrew in order. Few reliable witnesses remain of the details.",
    shortSummary: "",
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

async function summarizeBattleWithHaiku(
  client: Anthropic,
  opts: {
    narrative: string;
    holdResult: BattleReport["holdResult"];
    defeatType?: DefeatType;
    holdName: string;
  }
): Promise<{ shortSummary: string; summaryError?: string }> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system:
      "You write vivid three-line battle summaries for a medieval wargame. Output exactly three lines of prose. No title, no bullets, no numbering, no blank lines.",
    messages: [
      {
        role: "user",
        content: `Write an interesting 3-line summary of this battle at ${opts.holdName}.

holdResult: ${opts.holdResult}
defeatType: ${opts.defeatType ?? "unclear"}

Full chronicle:
${opts.narrative}

Reply with exactly three lines.`,
      },
    ],
  });
  const raw = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((t) => t.text)
    .join("\n")
    .trim();
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean);
  const shortSummary = lines.slice(0, 3).join("\n");
  if (lines.length < 3) {
    return {
      shortSummary,
      summaryError: `Haiku summary returned ${lines.length} line(s); expected 3`,
    };
  }
  return { shortSummary };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let battle: BattleContext | null = null;
  let holdsMap = new Map<string, Hold>();
  try {
    const body = await req.json() as { battle: BattleContext; holds: Hold[] };
    battle = body.battle;
    const { holds } = body;
    holdsMap = new Map(holds.map((h) => [h.id, h]));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[got-houses/battle] ANTHROPIC_API_KEY not set — using fallback");
      return NextResponse.json({ ...fallbackReport(battle, holdsMap), _debug: "no_api_key" });
    }

    const MAX_TOKENS = 6000;
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
      return NextResponse.json({ ...fallbackReport(battle, holdsMap), _debug: "api_error", _error: lastError });
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
      return NextResponse.json({ ...fallbackReport(battle, holdsMap), _debug: "no_json", _raw: rawText });
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
      return NextResponse.json({ ...fallbackReport(battle, holdsMap), _debug: "json_parse_error", _error: msg });
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

    const holdResult = (["north", "westerlands", "abandoned"].includes(parsed.holdResult)
      ? parsed.holdResult
      : "abandoned") as BattleReport["holdResult"];
    const narrative = parsed.narrative ?? "";
    const holdName = holdsMap.get(battle.holdId)?.name ?? battle.holdId;

    let shortSummary = "";
    let summaryError: string | undefined;
    try {
      const summarized = await summarizeBattleWithHaiku(client, {
        narrative,
        holdResult,
        defeatType,
        holdName,
      });
      shortSummary = summarized.shortSummary;
      summaryError = summarized.summaryError;
      if (summaryError) {
        console.warn("[got-houses/battle] Incomplete Haiku summary:", summaryError);
      }
    } catch (sumErr) {
      const msg = sumErr instanceof Error ? sumErr.message : String(sumErr);
      console.error("[got-houses/battle] Haiku summary failed:", msg);
      shortSummary = "";
      summaryError = `Battle summary failed: ${msg}`;
    }

    return NextResponse.json({
      defeatType,
      narrative,
      shortSummary,
      summaryError,
      holdResult,
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
      return NextResponse.json({ ...fallbackReport(battle, holdsMap), _debug: "unexpected_error", _error: msg });
    }
    return NextResponse.json({ error: "Adjudication failed", _debug: "unexpected_error", _error: msg }, { status: 500 });
  }
}
