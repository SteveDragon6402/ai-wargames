import Anthropic from "@anthropic-ai/sdk";
import type {
  NodeBattleContext,
  NodeBattleResult,
  NodeAdjudicatorFn,
  UnitBattleOutcome,
  BattleUnitContext,
} from "@wargame/engine";
import { getAdjudicatorModel, getAnthropicApiKey } from "./env.js";

// ─── Wiki types ────────────────────────────────────────────────────────────

export interface UnitWikiEntry {
  name: string;
  faction: string;
  type: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  morale_notes: string;
  historical_context: string;
}

export interface TerrainWikiEntry {
  name?: string;
  description: string;
  tactical_notes: string;
}

export interface OrderWikiEntry {
  description: string;
  tactical_notes: string;
  game_effect?: string;
}

export interface ScenarioWiki {
  units: Record<string, UnitWikiEntry>;
  terrain: Record<string, TerrainWikiEntry>;
  orders: Record<string, OrderWikiEntry>;
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a military simulation adjudicator for a wargame set in Lord of the Rings — the War of the Ring in Rohan and around Isengard. You are an expert military historian and a master of Tolkien's lore.. 

Your role is to adjudicate a FULL NODE BATTLE: all units from two factions fighting at a single location in one turn. Be as realistic to medieval and Tolkien warfare as possible. 

## What you adjudicate
Each battle presents all units of two factions at one location. You must:
1. Assess the overall balance (numbers, quality, fatigue, terrain, flanking, orders)
2. Return a realistic outcome for EVERY unit in the battle
3. Decide which units (if any) are expelled — physically driven off the node - Either forced or via retreats.
4. Decide which units with "breakthrough" orders actually break through
5. If all units are disengaged, the battle does not happen. 

## Game scales (important for calibrating your numbers)
- **strength**: 0.0 to 1.0 (1.0 = full, 0.0 = destroyed).
- **morale**: 0 to 100 (100 = unbreakable, 0 = routing). Typical starting morale 70–90. Rout threshold ≈25.
- **dugIn**: 0.0–1.0 (cover bonus). **tiredness**: 0.0–1.0 (fatigue penalty).
- **turnsInContact**: how many turns already engaged. 

Calibrate to these numbers as you see appropriate. You may decide that for a particular terrain, a cover bonus is near impenetrable. Or you may decide it is worthless. 

## Calibrating outcomes (strengthLossPct = % of CURRENT strength)
- Any people who are dead or too badly injured from the fight and subsequent morale impacts. 

## Expelled vs. staying in
Expelled (expelled: true) means a unit is physically driven off the node:
- Only valid when the winning side used an ASSAULT order
- On a decisive assault win, ALL losing units on the node should be expelled
- On a minor win without assault, defeated units are bloodied but hold their ground

## Breakthrough
If a unit has "breakthrough" intention and the battle goes decisively in their favour, mark breaksThrough: true for that unit. The unit will advance to the next node.

## Flanking
If flankedFaction is set, that faction is being outflanked — entering from the same direction as the enemy cuts retreat and creates panic. Apply:
- Relevant morale penalties to the flanked faction. 
- Relevant reduction in defensive effectiveness
- Relevant bonus to flanking attacker for morale and combat effectiveness. 
Use wiki_lookup on "flanked" for additional guidance.

## Order types
- **assault**: All-out push — if winning, use expelled: true for losing units
- **attack**: Coordinated offensive
- **breakthrough**: Punch through to advance — use breaksThrough: true on success
- **defend / hold**: Pure defense
- **deny**: Fortify to block movement

## Unit types and terrain
Always factor the terrain:
- **heavy/medium cavalry**: devastating on plains/open ground; nearly useless at river crossings, rugged, or cramped islands — riders must dismount and fight at a disadvantage
- **light cavalry** (warg-riders): more flexible in broken terrain; still penalised in close quarters
- **shock infantry**: built for hard assault in cramped positions; weaker in open field
- **heavy infantry**: strongest in fortified/stronghold positions; mediocre in open field without terrain anchor
- **light infantry**: adaptable; no special bonus but dies quickly in direct melee

## Your responsibilities
1. Use wiki_lookup to research units and terrain — **call multiple wiki_lookup tools in a single response** to look up several entries at once rather than one per round. This is important: you have a limited number of rounds so batch your lookups.
2. Provide realistic outcomes for EVERY unit — do not omit any unit
3. Decide the overall winner
4. Write a vivid 2–3 sentence narrative in Tolkien's style
5. Be militarily accurate but evocative
6. Aim to complete all wiki lookups in 1–2 rounds, then call adjudicate_node_battle`;

// ─── Tool definitions ──────────────────────────────────────────────────────

const WIKI_LOOKUP_TOOL: Anthropic.Tool = {
  name: "wiki_lookup",
  description:
    "Look up qualitative descriptions of units, terrain types, or order types to inform your adjudication. Use this before deciding the battle outcome.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["unit", "terrain", "order"],
        description: "What kind of entry to look up",
      },
      key: {
        type: "string",
        description:
          "For units: the unit template ID (e.g. 'theodred_eorod'). For terrain: a terrain tag (e.g. 'river_crossing', 'plains'). For orders: the order intention (e.g. 'assault', 'breakthrough', 'flanked').",
      },
    },
    required: ["type", "key"],
  },
};

const ADJUDICATE_NODE_BATTLE_TOOL: Anthropic.Tool = {
  name: "adjudicate_node_battle",
  description:
    "Submit the final adjudication for the complete node battle. You MUST include an outcome entry for EVERY unit listed in the battle — do not omit any.",
  input_schema: {
    type: "object" as const,
    properties: {
      overallWinner: {
        type: "string",
        enum: ["side1", "side2", "draw"],
        description: "Which side won — side1 and side2 correspond to the Side labels in the battle description.",
      },
      narrative: {
        type: "string",
        description: "2–3 vivid sentences describing the entire battle in Tolkien's style.",
      },
      reasoning: {
        type: "string",
        description: "Brief tactical reasoning for the overall outcome (1–2 sentences).",
      },
      unitOutcomes: {
        type: "array",
        description: "An outcome entry for EVERY unit in the battle (both sides).",
        items: {
          type: "object",
          properties: {
            unitId: {
              type: "string",
              description: "The exact unit ID as shown in the battle description.",
            },
            strengthLossPct: {
              type: "number",
              description: "Percentage of CURRENT strength lost (0–80). E.g. 20 means 20% strength loss.",
            },
            moraleDelta: {
              type: "number",
              description: "Change in morale (−50 to +20). Positive = boost, negative = drop.",
            },
            expelled: {
              type: "boolean",
              description: "True if this unit is driven off the node. Only valid for losing units when the winner used an assault order.",
            },
            breaksThrough: {
              type: "boolean",
              description: "True if this unit successfully executes a breakthrough and advances to the next node.",
            },
          },
          required: ["unitId", "strengthLossPct", "moraleDelta", "expelled"],
        },
      },
    },
    required: ["overallWinner", "narrative", "reasoning", "unitOutcomes"],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function unitTypeLabel(unitType: string | undefined): string {
  if (!unitType) return "unknown";
  return unitType.replace(/_/g, " ");
}

function buildNodeBattleMessage(ctx: NodeBattleContext): string {
  const { sides, location, turnNumber, flankedFaction } = ctx;
  const [side1, side2] = sides;

  const flankingSection = flankedFaction
    ? `\n⚠️ **FLANKING**: **${flankedFaction}** is being outflanked — enemy entered from the same direction, cutting retreat and causing panic. Use wiki_lookup on "flanked" for guidance.\n`
    : "";

  const formatUnit = (u: BattleUnitContext): string => {
    const flankedFlag = u.isFlanked ? " ⚠️ FLANKED" : u.isFlankingAttacker ? " ⚡ FLANKING" : "";
    return [
      `  - **${u.name}** (id: \`${u.id}\`)${flankedFlag}`,
      `    Type: ${unitTypeLabel(u.unitType)} | Str: ${u.strengthLabel} (${(u.strengthFraction * 100).toFixed(0)}%) | Morale: ${u.morale}/100 (${u.moraleLabel})`,
      `    Fatigue: ${u.fatigueLabel} | Cover: ${u.dugInLabel} | Turns in contact: ${u.turnsInContact}${u.arrivedThisTurn ? " | **JUST ARRIVED**" : ""}`,
      `    Stance: ${u.stance} | Order: **${u.intentionDescription}**`,
    ].join("\n");
  };

  const allUnits = [...side1.units, ...side2.units];
  const hasAssault = allUnits.some((u) => u.isAssault);
  const hasBreakthrough = allUnits.some((u) => u.intention === "breakthrough");

  const assaultNote = hasAssault
    ? "\n⚔️ **ASSAULT in play**: If the assaulting side wins decisively, mark expelled: true for losing units.\n"
    : "";
  const breakthroughNote = hasBreakthrough
    ? "\n🏇 **BREAKTHROUGH in play**: If the breakthrough succeeds, mark breaksThrough: true for that unit.\n"
    : "";

  return `## Node Battle — Turn ${turnNumber}

**Location:** ${location.name} (${location.nodeId})
Terrain: ${location.tags.join(", ")}
${flankingSection}${assaultNote}${breakthroughNote}
---

### Side 1 — ${side1.factionId.toUpperCase()}
${side1.units.map(formatUnit).join("\n")}

### Side 2 — ${side2.factionId.toUpperCase()}
${side2.units.map(formatUnit).join("\n")}

---

You must return an outcome for every unit above (${allUnits.length} total).

**Efficiency tip**: Call wiki_lookup multiple times in a single response (batch your lookups) to stay within the tool-call budget. Then call adjudicate_node_battle with your final decision.`;
}

function handleWikiLookup(
  wiki: ScenarioWiki,
  input: { type: string; key: string }
): string {
  const { type, key } = input;

  if (type === "unit") {
    const entry = wiki.units[key];
    if (!entry) {
      return `No wiki entry found for unit "${key}". Available units: ${Object.keys(wiki.units).join(", ")}`;
    }
    return JSON.stringify(entry, null, 2);
  }

  if (type === "terrain") {
    const entry = wiki.terrain[key];
    if (!entry) {
      return `No wiki entry found for terrain "${key}". Available terrain: ${Object.keys(wiki.terrain).join(", ")}`;
    }
    return JSON.stringify(entry, null, 2);
  }

  if (type === "order") {
    const entry = wiki.orders[key];
    if (!entry) {
      return `No wiki entry found for order "${key}". Available orders: ${Object.keys(wiki.orders).join(", ")}`;
    }
    return JSON.stringify(entry, null, 2);
  }

  return `Unknown lookup type "${type}". Use "unit", "terrain", or "order".`;
}

function clampNumber(val: unknown, min: number, max: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return (min + max) / 2;
  return Math.max(min, Math.min(max, n));
}

function parseNodeBattleResult(
  input: Record<string, unknown>,
  side1FactionId: string,
  side2FactionId: string
): NodeBattleResult | null {
  let overallWinner = (input["overallWinner"] as string | undefined)?.toLowerCase() ?? "";

  // Normalise — AI sometimes returns faction names instead of "side1"/"side2"
  if (overallWinner === side1FactionId.toLowerCase()) overallWinner = "side1";
  else if (overallWinner === side2FactionId.toLowerCase()) overallWinner = "side2";
  else if (overallWinner === "tied" || overallWinner === "stalemate") overallWinner = "draw";

  if (overallWinner !== "side1" && overallWinner !== "side2" && overallWinner !== "draw") {
    console.warn(`[adjudicator] Unrecognised overallWinner: "${input["overallWinner"]}" — falling back`);
    return null;
  }

  const narrative = typeof input["narrative"] === "string" ? input["narrative"] : "";
  const reasoning = typeof input["reasoning"] === "string" ? input["reasoning"] : "";

  const rawOutcomes = input["unitOutcomes"];
  if (!Array.isArray(rawOutcomes)) return null;

  const unitOutcomes: UnitBattleOutcome[] = rawOutcomes
    .map((o: unknown) => {
      const obj = o as Record<string, unknown>;
      return {
        unitId: String(obj["unitId"] ?? ""),
        strengthLossPct: clampNumber(obj["strengthLossPct"], 0, 80),
        moraleDelta: clampNumber(obj["moraleDelta"], -50, 20),
        expelled: Boolean(obj["expelled"]),
        breaksThrough: Boolean(obj["breaksThrough"]),
      };
    })
    .filter((o) => o.unitId);

  return { narrative, reasoning, overallWinner, unitOutcomes };
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAIAdjudicator(wiki: ScenarioWiki): NodeAdjudicatorFn {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    console.warn(
      "[adjudicator] ANTHROPIC_API_KEY not set — AI adjudication disabled, using deterministic fallback"
    );
    return async () => null;
  }

  const client = new Anthropic({ apiKey });
  const model = getAdjudicatorModel();

  return async (context: NodeBattleContext): Promise<NodeBattleResult | null> => {
    const totalUnits = context.sides[0].units.length + context.sides[1].units.length;
    const userMessage = buildNodeBattleMessage(context);

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Allow up to 15 rounds: wiki lookups (batched) + final adjudication
    for (let round = 0; round < 15; round++) {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model,
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          tools: [WIKI_LOOKUP_TOOL, ADJUDICATE_NODE_BATTLE_TOOL],
          tool_choice: { type: "any" },
          messages,
        });
      } catch (err) {
        console.error("[adjudicator] Anthropic API error:", err);
        return null;
      }

      messages.push({ role: "assistant", content: response.content });

      const adjudicateCall = response.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === "tool_use" && b.name === "adjudicate_node_battle"
      );

      if (adjudicateCall) {
        const result = parseNodeBattleResult(
          adjudicateCall.input as Record<string, unknown>,
          context.sides[0].factionId,
          context.sides[1].factionId
        );
        if (result) {
          console.info(
            `[adjudicator] Turn ${context.turnNumber} @ ${context.location.name}: ${result.overallWinner}, ${result.unitOutcomes.length}/${totalUnits} units\n  ${result.narrative}`
          );
          return result;
        }
        console.warn("[adjudicator] adjudicate_node_battle returned invalid structure, falling back");
        return null;
      }

      const toolCalls = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolCalls.length === 0) {
        if (response.stop_reason === "end_turn") {
          console.warn("[adjudicator] Model ended without calling adjudicate_node_battle, falling back");
          return null;
        }
        continue;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = toolCalls.map((call) => ({
        type: "tool_result" as const,
        tool_use_id: call.id,
        content:
          call.name === "wiki_lookup"
            ? handleWikiLookup(wiki, call.input as { type: string; key: string })
            : "Use adjudicate_node_battle to submit your final decision.",
      }));

      messages.push({ role: "user", content: toolResults });
    }

    console.warn("[adjudicator] Exceeded max tool rounds, falling back to deterministic");
    return null;
  };
}
