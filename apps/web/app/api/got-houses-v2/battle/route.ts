import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleContext,
  BattleFactors,
  BattleReport,
  DefeatType,
  ForceSummary,
  Hold,
} from "@/app/got-houses-v2/types";
import { FACTION_HOMELAND } from "@/app/got-houses-v2/data/homeland";
import { regionSoftFor, regionTrait } from "@/app/got-houses-v2/data/regions";
import {
  buildForceSummary,
  describeForceRatio,
} from "@/app/got-houses-v2/lib/battle-forces";
import { buildFallbackReport } from "@/app/got-houses-v2/lib/battle-fallback";
import {
  DEFEAT_TYPES,
  validateBattleOutcome,
  type ExecutorOutput,
} from "@/app/got-houses-v2/lib/battle-validate";
import {
  emptyChronicleReason,
  textOfContent,
} from "@/app/got-houses-v2/lib/battle-model";

/**
 * Battle resolution in three stages.
 *
 *   Stage 1 — Chronicler: gets every hard number and every soft input, and
 *             writes prose only. No JSON, no schema, nothing to truncate.
 *   Stage 2 — Executor: gets the same hard state plus the chronicle, and returns
 *             only the mechanical consequences, through a tool schema so the
 *             shape is enforced by the API rather than by a regex over prose.
 *   Stage 3 — Validator: pure TypeScript. Rejects the impossible (see
 *             lib/battle-validate.ts) and records what it corrected.
 *
 * Splitting narration from bookkeeping is what stops the chronicle and the
 * casualty list from disagreeing, which was the main reason resolutions felt
 * arbitrary.
 */

const LOG = "[got-houses-v2/battle]";

const CHRONICLER_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];
const EXECUTOR_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];
const CHRONICLER_MAX_TOKENS = 4000;
const EXECUTOR_MAX_TOKENS = 4000;

/**
 * Sonnet 5 thinks by default. Those tokens count against max_tokens and are
 * omitted from the response, so a 3k budget is often spent entirely on hidden
 * reasoning — the call "succeeds" with no text block, and we fall back.
 * The chronicle is the product; thinking is not needed for it.
 */
const NO_THINKING = { thinking: { type: "disabled" as const } };

/** Closing verdict vocabulary. Stage 1 must end on exactly one of these. */
const OUTCOME_VOCABULARY: Record<DefeatType, string> = {
  structured_withdrawal:
    "STRUCTURED WITHDRAWAL — the loser retreats in good order, rear-guards holding, most of the army intact",
  rout: "ROUT — the formation breaks, men scatter and flee, the killing happens in the pursuit",
  shattering:
    "SHATTERING — the loser ceases to exist as a fighting force through collapse, encirclement and desertion",
  pyrrhic_win:
    "PYRRHIC WIN — the winner takes the field but pays more dearly than the loser and cannot pursue",
  last_stand:
    "LAST STAND — the trapped side had nowhere to go and fought to the end",
};

// ─── Stage 1: Chronicler ──────────────────────────────────────────────────────

const CHRONICLER_SYSTEM = `You are a military analyst adjudicating a medieval wargame battle. Your job is to determine what actually happened when these specific forces met on this specific ground, and to write it up as a tactical engagement report.

Write PROSE ONLY. Do not output JSON. Do not output tables, bullet lists or key-value pairs. A separate process will convert your report into game mechanics, so your only job is to decide and describe what happened.

Structure the report as labelled phases (INITIAL DEPLOYMENT, PHASE 1 — LABEL, PHASE 2 — LABEL, ..., RESOLUTION). Each phase is 1 to 3 sentences that state who acted, what manoeuvre they executed, and the immediate result. Name the commander deciding and the unit type executing. Describe real tactical actions: flanking, advancing in column, volley fire, screening, holding the line, charging, withdrawing in order, routing.

HARD CONSTRAINTS — never violate these:
- Do not comment on who controls territory not explicitly stated in the battle data
- Do not state or imply where retreating armies will go — that is the player's decision
- Do not comment on strategic or political implications beyond this single engagement
- Do not reference armies, forces or reinforcements not present in this battle
- Do not invent troops, units or named characters that are not listed
- Every claim must follow from the data given: numbers, composition, morale, tiredness, stance, commander characters, orders, hold ground, region, approach routes, homeland fit, and NPC commander takes
- Player faction lords (Robb, Tywin) do NOT submit AI takes — they are represented only by their army's orders and condition

SOFT MECHANICS — these are mechanical inputs, not decoration, and MUST shape the fight:
- NPC commander takes (take / outlook / approach + mood) shape the deployment and the early phases: eager commanders press, reluctant ones hesitate, and discord between coalition takes hurts coordination
- Hold ground: the defensibility, footing and climate of this specific seat
- Region character: the four regions fight very differently — read the region lines and let them matter
- Approach route: an army that marched in arrives shaped by that road (disordered from bog or pass, still formed from an easy road). An army already present holds the local ground
- Homeland fit: men fighting in country they are not bred for are at a real disadvantage
- Orders: an EXPLICITLY RESTING army is caught unprepared; a FORTIFYING army is dug in

You may cite numbers from the data or not, as you prefer — the force totals have already been computed for you, so never do arithmetic of your own.

Keep proper nouns. Drop narrative flavour — no ravens, no maesters, no prophecy, no purple prose.

End your report with a final line in exactly this form and nothing after it:
VERDICT: <winner> — <outcome label>
where <winner> is "The North", "The Westerlands", or "Neither (both broken)", and <outcome label> is one of: STRUCTURED WITHDRAWAL, ROUT, SHATTERING, PYRRHIC WIN, LAST STAND.`;

function armyBlock(
  battle: BattleContext,
  army: Army,
  hold: Hold | undefined
): string {
  const order = battle.armyOrders?.[army.id] ?? "march";
  const statusLine =
    order === "rest"
      ? "Order: EXPLICITLY RESTING — encamped, off-guard, not expecting to fight"
      : order === "fortify"
        ? "Order: FORTIFYING — digging in, constructing field defences"
        : "Order: MARCHING / ENGAGING";

  const commanders =
    army.leaders.map((l) => `${l.name}${l.title ? ` (${l.title})` : ""}`).join(", ") ||
    "none (host has no named commander)";
  const notablesText = army.notables?.length
    ? army.notables.map((n) => `      • ${n.name} — ${n.description}`).join("\n")
    : "      • None";

  const unitLines = army.units
    .map((u) => `      • ${u.count.toLocaleString()} ${u.house} ${u.type}`)
    .join("\n");

  const act = army.activity;
  const activityParts =
    [
      act.turnsResting > 0 ? `resting ${act.turnsResting} turn(s)` : null,
      act.turnsFortiying > 0 ? `fortifying ${act.turnsFortiying} turn(s)` : null,
      act.turnsMarching > 0 ? `marching ${act.turnsMarching} turn(s)` : null,
      act.turnsSinceMerge === 0 ? "MERGED THIS TURN — formations disorganised" : null,
      act.turnsSinceSplit === 0 ? "SPLIT THIS TURN — chain of command uncertain" : null,
    ]
      .filter(Boolean)
      .join("; ") || "no notable recent history";

  const approach = battle.armyApproaches?.[army.id];
  const approachLine = approach
    ? `Approach: marched from ${approach.fromHoldName} — ${approach.route}`
    : "Approach: already present at this hold (defending / held position)";

  const regionFit = hold ? regionSoftFor(hold.region, army.faction) : "Unknown country";

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
    Region fit: ${regionFit}
    ${approachLine}
    Activity: ${activityParts}
    ${statusLine}`;
}

function sideBlock(
  battle: BattleContext,
  armies: Army[],
  sideLabel: string,
  force: ForceSummary["north"],
  hold: Hold | undefined
): string {
  if (armies.length === 0) return "";
  const separator = "─".repeat(60);
  const composition = `${force.byType.cavalry.toLocaleString()} cavalry / ${force.byType.infantry.toLocaleString()} infantry / ${force.byType.archers.toLocaleString()} archers`;
  return `${separator}
SIDE: ${sideLabel.toUpperCase()}  |  ${force.armyCount} arm${force.armyCount !== 1 ? "ies" : "y"}  |  ${force.total.toLocaleString()} troops combined
Composition: ${composition}
All armies below fight as ONE coalition. Treat them as a unified force.
${separator}
${armies.map((a) => armyBlock(battle, a, hold)).join("\n\n")}`;
}

function buildChroniclerMessage(
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary
): string {
  const hold = holdsMap.get(battle.holdId);
  const locationName = hold?.name ?? battle.holdId;
  const locationLine = hold
    ? `${hold.name} (${hold.region} — seat of House ${hold.house}, held by ${hold.lord})`
    : `Hold ${battle.holdId}`;
  const trait = hold ? regionTrait(hold.region) : null;

  const lastStandNote = battle.lastStand
    ? `\n⚠ LAST STAND: the retreating side has no valid retreat route — surrounded or cut off, cornered men fighting for their lives. Total destruction of the trapped force is possible but not automatic; a resolute force behind prepared ground costs the attacker dearly even as it dies.`
    : "";

  const engagement = battle.engagement ?? "field";
  const engagementNote =
    engagement === "storm"
      ? `\nENGAGEMENT TYPE: STORM THE GATES — field armies assault the walls against a defending GARRISON (its army id starts with "garrison:"). The garrison fights from fortifications; treat walls, towers and gates as decisive advantages for the defenders unless numbers or leadership overwhelm them.`
      : engagement === "sally"
        ? `\nENGAGEMENT TYPE: SALLY OUT — the defending GARRISON (plus any relieving field armies on their side) sorties against the besiegers. This may be a two-front fight if relief has marched onto the invested hold.`
        : "";

  const briefs = battle.commanderBriefs ?? [];
  const briefsBlock =
    briefs.length > 0
      ? `COMMANDER TAKES (NPC only — player lords have no takes). Commitment and betrayal are mechanical:\n${briefs
          .map((b) => {
            const commit =
              b.commitment === "hold_back"
                ? "HOLDS BACK — fewer losses, less weight in the fight"
                : "COMMITS";
            const turn =
              b.betrayal === "turn_join_enemy"
                ? "TURNED — rides with the enemy"
                : b.betrayal === "turn_independent"
                  ? "TURNED — fights neither liege nor as the enemy's man"
                  : "loyal";
            return `- ${b.name} [${b.armyId}] (${b.role}, House ${b.house ?? "?"}) mood="${b.mood}" ${commit}; ${turn}\n  take: ${b.take}\n  outlook: ${b.outlook}\n  approach: ${b.approach}\n  orders: ${b.instructions}`;
          })
          .join("\n")}`
      : "COMMANDER TAKES: none available";

  const rogue = battle.rogueArmies ?? [];
  const rogueNote =
    rogue.length > 0
      ? `\nA THIRD FORCE is on the field (turned on their liege, not joined to the other side). They are not part of either coalition.\n${rogue.map((a) => armyBlock(battle, a, hold)).join("\n\n")}`
      : "";

  return `BATTLE LOCATION: ${locationLine}
Hold ground: ${hold?.ground ?? "unknown"}
${trait ? `Region — ${trait.name}: ${trait.fightSoft}` : ""}

FORCE SUMMARY (computed exactly — do not recalculate):
${describeForceRatio(summary)}
${briefsBlock}
${lastStandNote}${engagementNote}

═══════════════════════════════════════════════════════════════
FORCES ENGAGED AT ${locationName.toUpperCase()}
═══════════════════════════════════════════════════════════════

${sideBlock(battle, battle.northArmies, "The North", summary.north, hold)}

${sideBlock(battle, battle.westArmies, "The Westerlands", summary.west, hold)}
${rogueNote}

═══════════════════════════════════════════════════════════════
TASK: adjudicate this engagement at ${locationName} and write the report.
═══════════════════════════════════════════════════════════════

Write 3 to 5 labelled phases, then RESOLUTION, then the VERDICT line. Scale the
number of phases to the engagement — a skirmish needs three, a major battle warrants five.

Think about what this specific battle would actually cost before you describe it:
how many men reached fighting range before one side broke, how long it lasted,
whether there was a pursuit and how far it went, whether men scattered or deserted,
whether any unit was already exhausted or badly led, and whether fortifications,
ground, approach or homeland mismatch shielded one side. Do not anchor on
percentages. A large army routing a small one costs almost nothing; a small force
holding a chokepoint can bleed an army twice its size.

In a rout or shattering, men who survive the fighting but scatter or desert are as
lost to the army as the dead — say so in the report.

Deaths of named commanders and notables should be proportionate: a decisive rout
risks commanders, a shattering can kill prominent figures. Do not artificially
protect named characters, and do not invent deaths in minor skirmishes.

The available outcome labels are:
${DEFEAT_TYPES.map((d) => `- ${OUTCOME_VOCABULARY[d]}`).join("\n")}

Someone must yield this hold — do not leave both sides sharing it unless both
genuinely collapsed.`;
}

// ─── Stage 2: Executor ───────────────────────────────────────────────────────

const EXECUTOR_SYSTEM = `You convert an already-written battle report into game mechanics. You do not re-adjudicate the battle and you do not change who won — the report is the authoritative account of what happened, and your only job is to express its consequences as structured data.

Rules:
- Read the report's phases and its closing VERDICT line, and make the numbers match what it describes. If the report says a flank was annihilated, that unit type takes heavy losses. If it says a rear-guard withdrew in order, losses are light.
- Use only the army ids, house names and unit types given in the force data. Never invent an id, a house or a character.
- Casualty counts must be whole numbers greater than zero, and can never exceed the men that army actually has.
- An army marked HOLDS BACK must take substantially lighter losses than a committed host on the same side.
- Only report a named figure as fallen if the report says or clearly implies they fell.
- retreatingArmyIds must be exactly the losing side's army ids (all of them), or both sides' ids if the verdict was "Neither".
- conditionUpdates must contain one entry for every army in the battle, describing its state after the fight in one vivid sentence each. A routed army is shattered and desperate; an orderly retreat leaves it bruised but not broken; a pyrrhic winner is bloodied and wary.

Call the record_outcome tool exactly once. Do not write any prose.`;

const OUTCOME_TOOL: Anthropic.Messages.Tool = {
  name: "record_outcome",
  description:
    "Record the mechanical consequences of the battle report. Must be called exactly once.",
  input_schema: {
    type: "object",
    properties: {
      defeatType: {
        type: "string",
        enum: DEFEAT_TYPES,
        description: "How the losing side left the field, matching the report's VERDICT label.",
      },
      holdResult: {
        type: "string",
        enum: ["north", "westerlands", "abandoned"],
        description:
          "Who holds the field. 'abandoned' only when both coalitions genuinely broke.",
      },
      casualties: {
        type: "array",
        description:
          "One row per army/house/unit-type that lost men. Omit units that took no losses.",
        items: {
          type: "object",
          properties: {
            armyId: { type: "string", description: "Exact army id from the force data." },
            unitType: { type: "string", enum: ["cavalry", "infantry", "archers"] },
            house: { type: "string", description: "Exact house name as listed for that unit." },
            count: { type: "integer", minimum: 1, description: "Men lost, dead or scattered." },
          },
          required: ["armyId", "unitType", "house", "count"],
        },
      },
      fallen: {
        type: "array",
        description: "Named commanders and notables killed in this battle.",
        items: {
          type: "object",
          properties: {
            armyId: { type: "string" },
            name: { type: "string", description: "Exact name as listed in the force data." },
            isLeader: { type: "boolean", description: "true for a commander, false for a notable." },
          },
          required: ["armyId", "name", "isLeader"],
        },
      },
      retreatingArmyIds: {
        type: "array",
        items: { type: "string" },
        description: "Every army id forced to leave the field.",
      },
      conditionUpdates: {
        type: "array",
        description: "One entry for EVERY army in the battle, winners included.",
        items: {
          type: "object",
          properties: {
            armyId: { type: "string" },
            morale: { type: "string", description: "One vivid sentence." },
            tiredness: { type: "string", description: "One vivid sentence on physical state." },
            stance: { type: "string", description: "One vivid sentence on posture going forward." },
          },
          required: ["armyId", "morale", "tiredness", "stance"],
        },
      },
    },
    required: [
      "defeatType",
      "holdResult",
      "casualties",
      "fallen",
      "retreatingArmyIds",
      "conditionUpdates",
    ],
  },
};

function buildExecutorMessage(
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary,
  chronicle: string
): string {
  const hold = holdsMap.get(battle.holdId);
  const roster = (armies: Army[], label: string) =>
    armies.length === 0
      ? ""
      : `${label}:\n${armies
          .map((a) => {
            const units = a.units
              .map((u) => `${u.count.toLocaleString()} ${u.house} ${u.type}`)
              .join("; ");
            const people = [
              ...a.leaders.map((l) => `${l.name} (commander)`),
              ...(a.notables ?? []).map((n) => `${n.name} (notable)`),
            ].join(", ");
            return `  - id "${a.id}" — ${a.name}\n    units: ${units}\n    named figures: ${people || "none"}`;
          })
          .join("\n")}`;

  const commitments = battle.armyCommitments ?? {};
  const commitNote = Object.keys(commitments).length
    ? `\nCOMMITMENT:\n${Object.entries(commitments)
        .map(([id, c]) => `  - ${id}: ${c === "hold_back" ? "HOLDS BACK (lighter losses)" : "commits"}`)
        .join("\n")}`
    : "";
  const briefs = (battle.commanderBriefs ?? [])
    .map(
      (b) =>
        `  - ${b.name} [${b.armyId}]: ${b.commitment}; ${b.betrayal}; orders: ${b.instructions}`
    )
    .join("\n");

  return `BATTLE AT: ${hold?.name ?? battle.holdId}
${describeForceRatio(summary)}
Engagement type: ${battle.engagement ?? "field"}${battle.lastStand ? " (LAST STAND — the trapped side had no retreat)" : ""}

FORCES AND EXACT IDENTIFIERS
${roster(battle.northArmies, "THE NORTH")}
${roster(battle.westArmies, "THE WESTERLANDS")}
${roster(battle.rogueArmies ?? [], "THIRD FORCE (turned on their liege, not joined to the enemy)")}
${commitNote}
${briefs ? `\nCOMMANDER ORDERS:\n${briefs}` : ""}

THE BATTLE REPORT (authoritative — do not contradict it)
─────────────────────────────────────────────────────────
${chronicle}
─────────────────────────────────────────────────────────

Call record_outcome once with the mechanical consequences of that report.`;
}

// ─── Player-facing "what mattered" strip ─────────────────────────────────────

function describePosture(battle: BattleContext, armies: Army[]): string {
  if (armies.length === 0) return "not present";
  const parts = armies.map((a) => {
    const order = battle.armyOrders?.[a.id] ?? "march";
    const arrived = battle.armyApproaches?.[a.id] ? "marched in" : "already here";
    return `${a.name}: ${order}, ${arrived}`;
  });
  return parts.join(" · ");
}

function buildFactors(
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary
): BattleFactors {
  const hold = holdsMap.get(battle.holdId);
  const trait = hold ? regionTrait(hold.region) : null;
  const condition = (armies: Army[]) =>
    armies.length === 0
      ? "not present"
      : armies.map((a) => `${a.name} — ${a.morale}; ${a.tiredness}`).join(" · ");

  return {
    forceRatio: describeForceRatio(summary),
    northPosture: describePosture(battle, battle.northArmies),
    westPosture: describePosture(battle, battle.westArmies),
    ground: hold?.ground ?? "unknown ground",
    region: trait ? `${trait.name} — ${trait.blurb}` : "unknown country",
    northCondition: condition(battle.northArmies),
    westCondition: condition(battle.westArmies),
    commanderMoods: (battle.commanderBriefs ?? []).map(
      (b) => `${b.name}: ${b.mood} — "${b.take}"`
    ),
  };
}

// ─── Model plumbing ──────────────────────────────────────────────────────────

function isOverloaded(message: string): boolean {
  return (
    message.includes("529") ||
    message.includes("503") ||
    message.toLowerCase().includes("overload") ||
    message.toLowerCase().includes("rate limit")
  );
}


/** Try each model in turn, backing off on overload or an empty usable body. */
async function callWithFallback(
  client: Anthropic,
  models: string[],
  build: (model: string) => Anthropic.Messages.MessageCreateParamsNonStreaming,
  usable?: (response: Anthropic.Messages.Message) => string | null
): Promise<{ response: Anthropic.Messages.Message; model: string } | { error: string }> {
  let lastError = "";
  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1200));
    try {
      const response = await client.messages.create(build(model));
      const reject = usable?.(response);
      if (reject) {
        lastError = `${model}: ${reject}`;
        console.warn(`${LOG} ${lastError}`);
        continue;
      }
      return { response, model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG} ${model} attempt ${attempt + 1} failed:`, lastError);
      // Keep going — Haiku does not think by default, so an empty Sonnet 5
      // reply or a thinking-config 400 is not the end of adjudication.
      if (!isOverloaded(lastError) && /authentication|api.?key|401|403/i.test(lastError)) {
        break;
      }
    }
  }
  return { error: lastError || "no model responded" };
}

function textOf(response: Anthropic.Messages.Message): string {
  return textOfContent(response.content);
}

async function runChronicler(
  client: Anthropic,
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary
): Promise<{ chronicle: string } | { error: string }> {
  const message = buildChroniclerMessage(battle, holdsMap, summary);
  const result = await callWithFallback(
    client,
    CHRONICLER_MODELS,
    (model) =>
      ({
        model,
        max_tokens: CHRONICLER_MAX_TOKENS,
        system: CHRONICLER_SYSTEM,
        messages: [{ role: "user", content: message }],
        ...NO_THINKING,
      }) as Anthropic.Messages.MessageCreateParamsNonStreaming,
    (response) => emptyChronicleReason(response)
  );
  if ("error" in result) return result;

  const chronicle = textOf(result.response);
  if (!chronicle) return { error: "chronicler returned no text" };

  // A truncated chronicle is still usable — the executor reads what happened up
  // to the cut — but note it so the missing VERDICT line is not a surprise.
  if (result.response.stop_reason === "max_tokens") {
    console.warn(`${LOG} chronicle hit max_tokens; verdict line may be missing`);
  }
  console.log(`${LOG} chronicle from ${result.model}, ${chronicle.length} chars`);
  return { chronicle };
}

async function runExecutor(
  client: Anthropic,
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary,
  chronicle: string
): Promise<{ output: ExecutorOutput } | { error: string }> {
  const message = buildExecutorMessage(battle, holdsMap, summary, chronicle);

  for (let round = 0; round < 2; round++) {
    const result = await callWithFallback(client, EXECUTOR_MODELS, (model) =>
      ({
        model,
        max_tokens: EXECUTOR_MAX_TOKENS,
        system: EXECUTOR_SYSTEM,
        tools: [OUTCOME_TOOL],
        tool_choice: { type: "tool", name: OUTCOME_TOOL.name },
        messages: [{ role: "user", content: message }],
        ...NO_THINKING,
      }) as Anthropic.Messages.MessageCreateParamsNonStreaming
    );
    if ("error" in result) return result;

    // A tool call cut off mid-arguments yields unusable partial JSON, so retry
    // rather than trying to salvage it.
    if (result.response.stop_reason === "max_tokens") {
      console.warn(`${LOG} executor hit max_tokens on round ${round + 1}; retrying`);
      continue;
    }

    const toolUse = result.response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === OUTCOME_TOOL.name
    );
    if (toolUse) {
      console.log(`${LOG} outcome from ${result.model}`);
      return { output: toolUse.input as ExecutorOutput };
    }
    console.warn(`${LOG} executor produced no tool call on round ${round + 1}`);
  }

  return { error: "executor never produced a usable record_outcome call" };
}

async function summarizeBattle(
  client: Anthropic,
  opts: { chronicle: string; holdName: string }
): Promise<{ shortSummary: string; summaryError?: string }> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system:
      "You write vivid three-line battle summaries for a medieval wargame. Output exactly three lines of prose. No title, no bullets, no numbering, no blank lines.",
    messages: [
      {
        role: "user",
        content: `Write an interesting 3-line summary of this battle at ${opts.holdName}.\n\n${opts.chronicle}\n\nReply with exactly three lines.`,
      },
    ],
  });
  const lines = textOf(response)
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean);
  const shortSummary = lines.slice(0, 3).join("\n");
  return lines.length < 3
    ? { shortSummary, summaryError: `summary returned ${lines.length} line(s); expected 3` }
    : { shortSummary };
}

/** Drop the VERDICT line from the displayed chronicle — it is machine plumbing. */
function presentableChronicle(chronicle: string): string {
  return chronicle.replace(/\n*^VERDICT:.*$/im, "").trim();
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let battle: BattleContext | null = null;
  let holdsMap = new Map<string, Hold>();
  let summary: ForceSummary | null = null;

  try {
    const body = (await req.json()) as { battle: BattleContext; holds: Hold[] };
    battle = body.battle;
    holdsMap = new Map((body.holds ?? []).map((h) => [h.id, h]));
    summary = buildForceSummary(battle);
    const factors = buildFactors(battle, holdsMap, summary);
    const holdName = holdsMap.get(battle.holdId)?.name ?? battle.holdId;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn(`${LOG} ANTHROPIC_API_KEY not set — using deterministic fallback`);
      return NextResponse.json({
        ...buildFallbackReport(battle, holdsMap, summary, "No ANTHROPIC_API_KEY configured"),
        factors,
      });
    }

    const client = new Anthropic({ apiKey });
    console.log(
      `${LOG} resolving ${battle.holdId} — north ${battle.northArmies.length} armies, west ${battle.westArmies.length} armies`
    );

    // Stage 1
    const stage1 = await runChronicler(client, battle, holdsMap, summary);
    if ("error" in stage1) {
      return NextResponse.json({
        ...buildFallbackReport(battle, holdsMap, summary, `Chronicler failed: ${stage1.error}`),
        factors,
      });
    }

    // Stage 2
    const stage2 = await runExecutor(client, battle, holdsMap, summary, stage1.chronicle);
    if ("error" in stage2) {
      // The chronicle is good even though the bookkeeping failed, so keep the
      // prose and settle the mechanics deterministically.
      const fb = buildFallbackReport(
        battle,
        holdsMap,
        summary,
        `Executor failed: ${stage2.error}`
      );
      return NextResponse.json({
        ...fb,
        narrative: presentableChronicle(stage1.chronicle),
        factors,
      });
    }

    // Stage 3
    const validated = validateBattleOutcome(battle, stage2.output);
    if (validated.notes.length > 0) {
      console.log(`${LOG} validator applied ${validated.notes.length} correction(s)`);
      for (const n of validated.notes) console.log(`${LOG}   ${n.kind}: ${n.detail}`);
    }

    let shortSummary = "";
    let summaryError: string | undefined;
    try {
      const summarized = await summarizeBattle(client, {
        chronicle: stage1.chronicle,
        holdName,
      });
      shortSummary = summarized.shortSummary;
      summaryError = summarized.summaryError;
    } catch (err) {
      summaryError = `Battle summary failed: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(`${LOG} ${summaryError}`);
    }

    const report: Omit<BattleReport, "id" | "turn" | "holdId"> = {
      defeatType: validated.defeatType,
      narrative: presentableChronicle(stage1.chronicle),
      shortSummary,
      ...(summaryError ? { summaryError } : {}),
      holdResult: validated.holdResult,
      casualties: validated.casualties,
      fallen: validated.fallen,
      retreatingArmyIds: validated.retreatingArmyIds,
      conditionUpdates: validated.conditionUpdates,
      factors,
      ...(validated.notes.length > 0 ? { validation: validated.notes } : {}),
    };

    console.log(
      `${LOG} resolved ${battle.holdId} — ${validated.holdResult}, ${validated.defeatType ?? "unspecified"}, ${validated.casualties.length} casualty rows`
    );
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG} unexpected error:`, msg);
    if (battle && summary) {
      return NextResponse.json({
        ...buildFallbackReport(battle, holdsMap, summary, `Unexpected error: ${msg}`),
        factors: buildFactors(battle, holdsMap, summary),
      });
    }
    return NextResponse.json({ error: "Adjudication failed" }, { status: 500 });
  }
}
