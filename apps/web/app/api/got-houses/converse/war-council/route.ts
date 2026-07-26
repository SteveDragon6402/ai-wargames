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
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 500 }
      );
    }

    const replies: {
      characterId: CharacterId;
      name: string;
      text: string;
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

      const system = buildEmbodiedSystemPrompt(
        id,
        "War council with your lord and fellow commanders. You remain at the table and speak counsel. When you speak, only the words you say at the table.",
        body.characters
      );
      if (!system) continue;

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

Tools are optional. If you give counsel, record_advice.

OUTPUT: one short spoken line at the table — first-person dialogue only.
Never narrate ("The Kingslayer feels…"). Never describe thoughts. Words from your mouth only.`,
        ctx,
        maxRounds: 4,
        maxTokens: 320,
      });

      const text = sanitizeInCharacterReply(result.text, npc.name);
      if (!text) {
        console.warn(`[war-council] empty reply from ${id}, skipping message`);
        patches.push(...result.patches);
        if (result.adviceRecords?.length) {
          adviceRecords.push(...result.adviceRecords);
        }
        continue;
      }

      replies.push({
        characterId: id,
        name: npc.name,
        text,
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
