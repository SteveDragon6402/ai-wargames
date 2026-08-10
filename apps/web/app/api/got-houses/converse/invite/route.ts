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
  InviteMemory,
  NpcAgentState,
} from "@/app/got-houses/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  sanitizeInCharacterReply,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";

interface InviteBody {
  fromCharacterId: CharacterId;
  toCharacterId: CharacterId;
  turn: number;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
  holdStates?: Record<string, HoldRuntime>;
}

/**
 * Player-initiated talk always opens. NPCs cannot decline — they greet in character.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InviteBody;
    const target = body.characters[body.toCharacterId];
    if (!target || target.kind !== "npc") {
      return NextResponse.json(
        { error: "Can only AI-invite NPC agents" },
        { status: 400 }
      );
    }

    const from = body.characters[body.fromCharacterId];
    const situation =
      target.role === "castellan"
        ? "Parley at the walls. You speak for the garrison. Greet them and engage — you may negotiate. You cannot decline or walk away."
        : "Your lord (or peer) has called you to speak. The conversation is happening — greet them and engage. You cannot decline or walk away.";
    const system = buildEmbodiedSystemPrompt(
      target.id,
      situation,
      body.characters
    );
    if (!system) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
    }

    const history = (target as NpcAgentState).inviteHistory
      .map((h) => `- turn ${h.turn}: ${h.outcome} — ${h.reason}`)
      .join("\n");

    const ctx: CharacterToolContext = {
      actingCharacterId: target.id,
      characters: body.characters,
      armies: body.armies,
      battleReports: body.battleReports,
      conversations: body.conversations,
      turn: body.turn,
      inviteFromId: body.fromCharacterId,
      factionEvents: body.factionEvents,
      adviceLog: body.adviceLog,
      holdStates: body.holdStates,
    };

    const client = new Anthropic({ apiKey });
    const result = await runCharacterToolLoop({
      client,
      system,
      userMessage: `Private state (never speak aloud):
mood: ${(target as NpcAgentState).mood}
prior talks:
${history || "(none)"}

${from?.name ?? body.fromCharacterId} has called you to speak.

Use tools first if you need hold/map/army/event facts (inspect_my_castle, survey_map, find_forces, search_faction_events, get_battle_logs). Then end with:
SPEAK: <your opening words only>`,
      ctx,
      maxRounds: 4,
      maxTokens: 160,
    });

    const speech = sanitizeInCharacterReply(result.text, target.name);
    if (!speech) {
      return NextResponse.json(
        {
          error: `No spoken reply from ${target.name} — SPEAK line missing or invalid after retries`,
        },
        { status: 500 }
      );
    }

    const inviteEntry: InviteMemory = {
      fromCharacterId: body.fromCharacterId,
      turn: body.turn,
      outcome: "accepted",
      reason: speech.slice(0, 120),
    };
    const npc = target as NpcAgentState;
    const patches = [
      ...result.patches,
      {
        id: target.id,
        inviteHistory: [...npc.inviteHistory, inviteEntry].slice(-12),
      },
    ];

    return NextResponse.json({
      accept: true,
      reason: speech,
      patches,
      adviceRecords: result.adviceRecords ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/invite]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
