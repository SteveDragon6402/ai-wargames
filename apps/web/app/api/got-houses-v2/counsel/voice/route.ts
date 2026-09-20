import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Audience, GameState } from "@/app/got-houses-v2/types";
import { validateVoice } from "@/app/got-houses-v2/lib/audience";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  situationLines,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";

const VOICE_TOOLS = [
  "survey_map",
  "inspect_hold",
  "inspect_my_castle",
  "find_forces",
  "who_is",
  "prisoners_held",
  "search_deeds",
  "search_audiences",
  "search_faction_events",
  "march_history",
  "get_battle_logs",
  "read_notepad",
  "write_notepad",
  "append_notepad",
  "update_mood",
  "present_dilemma",
];

interface Body {
  audience: Audience;
  state: GameState;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { audience, state } = body;
    if (!audience?.speakerId || !state?.characters) {
      return NextResponse.json({ error: "missing audience" }, { status: 400 });
    }
    const speaker = state.characters[audience.speakerId];
    const lord = state.characters[audience.addresseeId];
    if (!speaker || speaker.kind !== "npc" || !lord) {
      return NextResponse.json({ error: "bad speaker" }, { status: 422 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "no key" }, { status: 503 });
    }

    const extras = situationLines({
      prisoners: state.prisoners,
      deeds: state.deeds,
      characters: state.characters,
      armies: state.armies,
      faction: speaker.faction,
    });
    const system = buildEmbodiedSystemPrompt(
      speaker.id,
      `You are going before ${lord.name} after this last march. Query what you need. Then present the dilemma with present_dilemma — a plea in your voice, and exactly three options you can live with.`,
      state.characters,
      extras
    );
    if (!system) {
      return NextResponse.json({ error: "no prompt" }, { status: 422 });
    }

    const client = new Anthropic({ apiKey });
    const ctx: CharacterToolContext = {
      actingCharacterId: speaker.id,
      characters: state.characters,
      armies: state.armies,
      battleReports: state.battleReports,
      conversations: state.conversations,
      turn: state.turn,
      factionEvents: state.factionEvents,
      adviceLog: state.adviceLog,
      holdStates: state.holdStates,
      forage: state.forage,
      prisoners: state.prisoners,
      deeds: state.deeds,
      turnHistory: state.turnHistory,
      audiences: state.audiences,
      audiencePresentation: null,
    };

    const result = await runCharacterToolLoop({
      client,
      system: `${system}

COUNSEL MODE: You are not in idle talk. Use tools for facts, then call present_dilemma exactly once. Do not call speak.`,
      userMessage: `The war-master has judged that you should approach ${lord.name} about this:

Kind: ${audience.kind}
Situation: ${audience.situation}
Why now: ${audience.whyNow}

Query the board if you must. Then present the dilemma.`,
      ctx,
      outputMode: "raw",
      allowedTools: VOICE_TOOLS,
      maxRounds: 6,
      maxTokens: 800,
    });

    const presented = ctx.audiencePresentation;
    const checked = presented
      ? validateVoice(presented)
      : { ok: false as const, reason: "no present_dilemma" };
    if (!checked.ok) {
      return NextResponse.json({ error: checked.reason }, { status: 422 });
    }

    return NextResponse.json({
      text: checked.text,
      options: checked.options,
      patches: result.patches,
    });
  } catch (e) {
    console.error("[got-houses-v2/counsel/voice]", e);
    return NextResponse.json({ error: "voice failed" }, { status: 500 });
  }
}
