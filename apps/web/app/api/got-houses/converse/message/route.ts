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
      "Private conversation. Someone is speaking to you. Answer only with the words you say aloud."
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
      return NextResponse.json({
        reply: "Aye. Speak plain.",
        patches: [],
        left: false,
      });
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

If you give clear counsel, record_advice privately. Search faction events / advice freely when useful.
Then answer with ONLY the words you speak aloud.`,
      ctx,
      maxRounds: 6,
      maxTokens: 400,
    });

    const reply =
      sanitizeInCharacterReply(result.text) ||
      result.leaveReason ||
      "…";

    return NextResponse.json({
      reply,
      patches: result.patches,
      left: result.leftConversation,
      leaveReason: result.leaveReason,
      adviceRecords: result.adviceRecords ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/message]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
