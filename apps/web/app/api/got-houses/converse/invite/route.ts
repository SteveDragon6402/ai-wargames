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
}

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
    const system = buildEmbodiedSystemPrompt(
      target.id,
      "Someone seeks a private word with you. Decide with accept_invitation or decline_invitation, then speak ONLY your spoken reply aloud."
    );
    if (!system) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        fallbackInvite(target, from?.name ?? "Someone", body.turn, body.fromCharacterId)
      );
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
    };

    const client = new Anthropic({ apiKey });
    const result = await runCharacterToolLoop({
      client,
      system,
      userMessage: `Private state (never speak aloud):
mood: ${(target as NpcAgentState).mood}
prior invites:
${history || "(none)"}

${from?.name ?? body.fromCharacterId} asks for a private word with you.

1) Call accept_invitation OR decline_invitation (required).
2) Then speak ONLY the words you say to them — acceptance or refusal in your own voice. No JSON.`,
      ctx,
      maxRounds: 4,
      maxTokens: 350,
    });

    const speech =
      sanitizeInCharacterReply(result.text) ||
      (result.inviteDecision?.accept
        ? "Very well. Speak."
        : "Not now.");

    const accept = result.inviteDecision?.accept ?? !/not now|no\.|refuse|decline/i.test(speech);

    // Ensure invite history exists even if tools were skipped
    const inviteEntry: InviteMemory = {
      fromCharacterId: body.fromCharacterId,
      turn: body.turn,
      outcome: accept ? "accepted" : "declined",
      reason: result.inviteDecision?.reason || speech.slice(0, 120),
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
      accept,
      reason: speech, // spoken line shown in chat — not meta
      patches,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/invite]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function fallbackInvite(
  target: CharacterState,
  fromName: string,
  turn: number,
  fromId: CharacterId
) {
  const npc = target as NpcAgentState;
  const accept = !/reluctant|angry|furious/i.test(npc.mood);
  const reason = accept ? `I will hear you, ${fromName}.` : `Not now.`;
  const inviteEntry: InviteMemory = {
    fromCharacterId: fromId,
    turn,
    outcome: accept ? "accepted" : "declined",
    reason,
  };
  return {
    accept,
    reason,
    patches: [
      {
        id: npc.id,
        inviteHistory: [...npc.inviteHistory, inviteEntry].slice(-12),
      },
    ],
  };
}
