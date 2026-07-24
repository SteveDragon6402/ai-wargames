import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  NpcAgentState,
  NpcRuntimePatch,
} from "@/app/got-houses/types";
import { getSystemPrompt, NPC_CHAT_MAX_WORDS } from "@/app/got-houses/data/characters";
import {
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";

interface WarCouncilBody {
  thread: ConversationThread;
  /** NPC ids that should respond (never player lords) */
  responderIds: CharacterId[];
  playerMessage: string;
  playerName: string;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WarCouncilBody;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const replies: {
      characterId: CharacterId;
      name: string;
      text: string;
      left: boolean;
      leaveReason?: string;
    }[] = [];
    const patches: NpcRuntimePatch[] = [];

    const recent = body.thread.messages
      .slice(-10)
      .map((m) => `${m.speakerName}: ${m.text}`)
      .join("\n");

    // Sequential so later members "hear" earlier replies in the user message snapshot
    let rolling = recent;

    for (const id of body.responderIds) {
      const npc = body.characters[id];
      if (!npc || npc.kind !== "npc" || !npc.alive) continue;
      if (body.thread.leftParticipantIds.includes(id)) continue;

      const prompt = getSystemPrompt(id);
      if (!prompt) continue;

      if (!apiKey) {
        replies.push({
          characterId: id,
          name: npc.name,
          text: "I hear you, my lord.",
          left: false,
        });
        rolling += `\n${npc.name}: I hear you, my lord.`;
        continue;
      }

      const system = `${prompt}

You are in a WAR COUNCIL with your lord and fellow commanders.
Hard limit: under ${NPC_CHAT_MAX_WORDS} words. Punchy. Address the matter; do not speechify.
You may use tools. Use leave_conversation only if truly done with this council.
Speak as yourself — one reply.`;

      const ctx: CharacterToolContext = {
        actingCharacterId: id,
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

Council so far:
${rolling || "(opening)"}

${body.playerName} says:
${body.playerMessage}

Your turn to speak.`,
        ctx,
        maxRounds: 3,
        maxTokens: 300,
      });

      const text = (result.text.trim() || "…").slice(0, 500);
      replies.push({
        characterId: id,
        name: npc.name,
        text,
        left: result.leftConversation,
        leaveReason: result.leaveReason,
      });
      patches.push(...result.patches);
      rolling += `\n${npc.name}: ${text}`;
    }

    return NextResponse.json({ replies, patches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/war-council]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
