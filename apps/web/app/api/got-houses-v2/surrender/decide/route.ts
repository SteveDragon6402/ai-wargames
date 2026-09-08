import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  FactionEvent,
  HoldRuntime,
} from "@/app/got-houses-v2/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  type CharacterToolContext,
  type SurrenderDecision,
} from "@/app/got-houses-v2/lib/character-tools";
import {
  describeTerms,
  openTermsAt,
  surrenderPressure,
} from "@/app/got-houses-v2/lib/surrender";
import { HOLDS_MAP } from "@/app/got-houses-v2/data/holds";

interface DecideBody {
  /** Seats to poll. Each must be under siege with a living garrison. */
  holdIds: string[];
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  holdStates: Record<string, HoldRuntime>;
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
  turn: number;
}

export interface SurrenderDecisionResult {
  holdId: string;
  /** Castellan or garrison commander who answered. */
  characterId: CharacterId;
  name: string;
  decision: SurrenderDecision;
  /** What they said aloud, for the log. */
  spoken: string;
}

/**
 * Ask the men on the walls whether they will keep holding.
 *
 * Called during resolution for seats whose position is bad enough to be worth
 * asking about — starvation, hopeless odds, no relief. The castellan answers
 * with a tool call or not at all; silence means they hold. Each seat is polled
 * independently so one failure never blocks the others.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DecideBody;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 500 }
      );
    }
    const client = new Anthropic({ apiKey });

    const settled = await Promise.allSettled(
      body.holdIds.map((holdId) => decideForHold(client, body, holdId))
    );

    const decisions: SurrenderDecisionResult[] = [];
    const failures: string[] = [];
    for (const [i, r] of settled.entries()) {
      if (r.status === "fulfilled") {
        if (r.value) decisions.push(r.value);
      } else {
        const name = HOLDS_MAP.get(body.holdIds[i])?.name ?? body.holdIds[i];
        failures.push(
          `${name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
        );
      }
    }

    return NextResponse.json({ decisions, failures });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[surrender/decide]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function decideForHold(
  client: Anthropic,
  body: DecideBody,
  holdId: string
): Promise<SurrenderDecisionResult | null> {
  const hs = body.holdStates[holdId];
  if (!hs?.siege) return null;

  const negotiatorId = hs.castellanId;
  const npc = negotiatorId ? body.characters[negotiatorId] : undefined;
  if (!npc || npc.kind !== "npc" || !npc.alive) return null;

  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const pressure = surrenderPressure(holdId, hs, body.armies);
  const open = openTermsAt(hs);

  const system = buildEmbodiedSystemPrompt(
    npc.id,
    `You are on the walls of ${holdName}, under siege, and you must decide whether to keep holding. No one is speaking to you — this is your own judgment. Use read_terms and inspect_my_castle first. Then either commit with propose_terms (sue for terms), accept_terms (only if terms are already on the table and you mean to open the gates), or reject_terms / say nothing at all, which means you hold. Holding is honourable and often right; do not yield while there is food, hope of relief, or a fight worth making.`,
    body.characters
  );
  if (!system) return null;

  const surrender = {
    holdId,
    termsText: open
      ? `Terms on the table, offered by ${open.offeredBy}: "${open.note}" — under them ${describeTerms(open)}.`
      : null,
    pressure: pressure?.summary ?? "Position unclear.",
    decision: null as SurrenderDecision | null,
  };

  const ctx: CharacterToolContext = {
    actingCharacterId: npc.id,
    characters: body.characters,
    armies: body.armies,
    battleReports: body.battleReports,
    conversations: body.conversations,
    turn: body.turn,
    factionEvents: body.factionEvents,
    adviceLog: body.adviceLog,
    holdStates: body.holdStates,
    surrender,
  };

  const result = await runCharacterToolLoop({
    client,
    system,
    userMessage: `Private state (never speak this aloud):
mood: ${npc.mood}
notes: ${npc.notepad || "(none)"}

Your walls: ${surrender.pressure}
${surrender.termsText ?? "No terms have been put to you."}

Decide. If you will sue for terms or answer terms already offered, make the tool call first. Then say the one line you would say to your own men or to the herald outside.`,
    ctx,
    maxRounds: 5,
    maxTokens: 400,
  });

  if (!surrender.decision) return null;

  return {
    holdId,
    characterId: npc.id,
    name: npc.name,
    decision: surrender.decision,
    spoken: result.text,
  };
}
