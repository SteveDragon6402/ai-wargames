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
  NpcAgentState,
} from "@/app/got-houses/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  sanitizeInCharacterReply,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";

interface MessageBody {
  thread: ConversationThread;
  npcCharacterId: CharacterId;
  playerMessage: string;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  turn?: number;
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
  holdStates?: Record<string, HoldRuntime>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MessageBody;
    const npc = body.characters[body.npcCharacterId];
    if (!npc || npc.kind !== "npc") {
      return NextResponse.json({ error: "NPC required" }, { status: 400 });
    }

    const system = buildEmbodiedSystemPrompt(
      npc.id,
      npc.role === "castellan"
        ? "Parley. Stay at the walls and answer only with the words you say aloud. You may negotiate. You cannot leave or end the talk."
        : "Private conversation. Someone is speaking to you. Stay and answer only with the words you say aloud. You cannot leave or end the talk.",
      body.characters
    );
    if (!system) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const recent = body.thread.messages
      .filter((m) => m.kind !== "turn_break")
      .slice(-8)
      .map((m) => `${m.speakerName}: ${m.text}`)
      .join("\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 500 }
      );
    }

    const ctx: CharacterToolContext = {
      actingCharacterId: npc.id,
      characters: body.characters,
      armies: body.armies,
      battleReports: body.battleReports,
      conversations: body.conversations,
      threadId: body.thread.id,
      turn: body.turn,
      inviteFromId: body.thread.inviteFrom,
      factionEvents: body.factionEvents,
      adviceLog: body.adviceLog,
      holdStates: body.holdStates,
    };

    const client = new Anthropic({ apiKey });
    const result = await runCharacterToolLoop({
      client,
      system,
      userMessage: `Private state (never speak this aloud):
mood: ${(npc as NpcAgentState).mood}

What has been said:
${recent || "(just begun)"}

They say to you:
${body.playerMessage}

If you give clear counsel, record_advice privately. Before answering questions about relief, stores, the war, or the map, use tools (inspect_my_castle, survey_map, find_forces, search_faction_events, get_battle_logs). Form your own judgment from tool results — do not invent board state.

End with:
SPEAK: <only the words you say aloud>`,
      ctx,
      maxRounds: 6,
      maxTokens: 160,
    });

    const reply = sanitizeInCharacterReply(result.text, npc.name);
    if (!reply) {
      return NextResponse.json(
        {
          error: `No spoken reply from ${npc.name} — SPEAK line missing or invalid after retries`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply,
      patches: result.patches,
      adviceRecords: result.adviceRecords ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/message]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
