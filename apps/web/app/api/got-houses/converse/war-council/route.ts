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
  NpcRuntimePatch,
} from "@/app/got-houses/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  sanitizeInCharacterReply,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";

interface WarCouncilBody {
  thread: ConversationThread;
  responderIds: CharacterId[];
  playerMessage: string;
  playerName: string;
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
    const adviceRecords: AdviceRecord[] = [];

    const recent = body.thread.messages
      .slice(-10)
      .filter((m) => m.kind !== "turn_break")
      .map((m) => `${m.speakerName}: ${m.text}`)
      .join("\n");

    let rolling = recent;

    for (const id of body.responderIds) {
      const npc = body.characters[id];
      if (!npc || npc.kind !== "npc" || !npc.alive) continue;
      if (body.thread.leftParticipantIds.includes(id)) continue;

      const system = buildEmbodiedSystemPrompt(
        id,
        "War council with your lord and fellow commanders. When you speak, only the words you say at the table."
      );
      if (!system) continue;

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

      const ctx: CharacterToolContext = {
        actingCharacterId: id,
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
        userMessage: `Private state (never speak aloud):
mood: ${(npc as NpcAgentState).mood}

Council so far:
${rolling || "(opening)"}

${body.playerName} says:
${body.playerMessage}

If you give counsel, record_advice. Search faction events freely if needed.
Then speak ONLY your words at the table — one short reply.`,
        ctx,
        maxRounds: 5,
        maxTokens: 380,
      });

      const text =
        sanitizeInCharacterReply(result.text) ||
        (result.leftConversation ? "I am done here." : "…");
      replies.push({
        characterId: id,
        name: npc.name,
        text,
        left: result.leftConversation,
        leaveReason: result.leaveReason,
      });
      patches.push(...result.patches);
      if (result.adviceRecords?.length) {
        adviceRecords.push(...result.adviceRecords);
      }
      rolling += `\n${npc.name}: ${text}`;
    }

    return NextResponse.json({ replies, patches, adviceRecords });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/war-council]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
