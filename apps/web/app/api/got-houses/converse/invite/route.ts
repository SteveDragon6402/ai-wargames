import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  ConversationThread,
  InviteMemory,
  NpcAgentState,
} from "@/app/got-houses/types";
import { getSystemPrompt } from "@/app/got-houses/data/characters";
import {
  runCharacterToolLoop,
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
    const prompt = getSystemPrompt(target.id);
    if (!prompt) {
      return NextResponse.json({ error: "No system prompt" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallbackInvite(target, from?.name ?? "Someone", body.turn));
    }

    const history = (target as NpcAgentState).inviteHistory
      .map((h) => `- turn ${h.turn}: ${h.outcome} — ${h.reason}`)
      .join("\n");

    const system = `${prompt}

You have been invited to a private conversation.
Decide: ACCEPT or DECLINE.
Use tools if you need notepad, background, or battlefield context.
Respond with JSON only at the end:
{"accept": true or false, "reason": "punchy reason under 25 words", "mood": "optional new mood line"}`;

    const ctx: CharacterToolContext = {
      actingCharacterId: target.id,
      characters: body.characters,
      armies: body.armies,
      battleReports: body.battleReports,
      conversations: body.conversations,
    };

    const client = new Anthropic({ apiKey });
    const result = await runCharacterToolLoop({
      client,
      system,
      userMessage: `Invitation from ${from?.name ?? body.fromCharacterId}.
Your mood: ${(target as NpcAgentState).mood}
Prior invite history:
${history || "(none)"}

Accept or decline this invitation.`,
      ctx,
      maxRounds: 3,
      maxTokens: 300,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    let accept = true;
    let reason = result.text.slice(0, 120) || "Very well.";
    let mood = (target as NpcAgentState).mood;

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          accept?: boolean;
          reason?: string;
          mood?: string;
        };
        accept = !!parsed.accept;
        reason = (parsed.reason ?? reason).slice(0, 160);
        if (parsed.mood) mood = parsed.mood.slice(0, 160);
      } catch {
        /* keep defaults */
      }
    }

    const inviteEntry: InviteMemory = {
      fromCharacterId: body.fromCharacterId,
      turn: body.turn,
      outcome: accept ? "accepted" : "declined",
      reason,
    };

    const patches = [
      ...result.patches,
      {
        id: target.id,
        mood,
        inviteHistory: [...(target as NpcAgentState).inviteHistory, inviteEntry].slice(-12),
      },
    ];

    return NextResponse.json({ accept, reason, patches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/invite]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function fallbackInvite(target: CharacterState, fromName: string, turn: number) {
  const npc = target as NpcAgentState;
  const accept = !/reluctant|angry|furious/i.test(npc.mood);
  const reason = accept
    ? `I will hear ${fromName}.`
    : `Not now.`;
  const inviteEntry: InviteMemory = {
    fromCharacterId: "unknown",
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
