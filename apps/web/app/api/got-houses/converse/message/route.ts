import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  NpcAgentState,
} from "@/app/got-houses/types";
import { getSystemPrompt, NPC_CHAT_MAX_WORDS } from "@/app/got-houses/data/characters";
import {
  runCharacterToolLoop,
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
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MessageBody;
    const npc = body.characters[body.npcCharacterId];
    if (!npc || npc.kind !== "npc") {
      return NextResponse.json({ error: "NPC required" }, { status: 400 });
    }

    const prompt = getSystemPrompt(npc.id);
    if (!prompt) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const recent = body.thread.messages
      .slice(-8)
      .map((m) => `${m.speakerName}: ${m.text}`)
      .join("\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "Aye. Speak plain — I am listening.",
        patches: [],
        left: false,
      });
    }

    const system = `${prompt}

You are in a private conversation. Stay in character.
Hard limit: under ${NPC_CHAT_MAX_WORDS} words per reply. Punchy.
You may use tools (notepad, battlefield, history). Use leave_conversation if insulted, bored, or done.
Do not narrate stage directions. Speak as yourself.`;

    const ctx: CharacterToolContext = {
      actingCharacterId: npc.id,
      characters: body.characters,
      armies: body.armies,
      battleReports: body.battleReports,
      conversations: body.conversations,
      threadId: body.thread.id,
    };

    const client = new Anthropic({ apiKey });
    const result = await runCharacterToolLoop({
      client,
      system,
      userMessage: `Your mood: ${(npc as NpcAgentState).mood}

Recent thread:
${recent || "(just started)"}

Latest message to you:
${body.playerMessage}

Reply in character.`,
      ctx,
      maxRounds: 4,
      maxTokens: 350,
    });

    let reply = result.text.trim();
    // Strip accidental JSON wrappers
    if (reply.startsWith("{")) {
      try {
        const p = JSON.parse(reply) as { reply?: string; text?: string };
        reply = p.reply ?? p.text ?? reply;
      } catch {
        /* keep */
      }
    }
    if (!reply) reply = result.leaveReason ?? "…";

    return NextResponse.json({
      reply: reply.slice(0, 500),
      patches: result.patches,
      left: result.leftConversation,
      leaveReason: result.leaveReason,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/message]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
