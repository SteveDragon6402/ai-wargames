import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Audience, GameState, NpcRuntimePatch } from "@/app/got-houses-v2/types";
import { validateAudienceOutcome } from "@/app/got-houses-v2/lib/audience";
import { forceToolCall, OUTCOME_TOOL } from "@/app/got-houses-v2/lib/audience-model";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  situationLines,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";
import { HOLDS_MAP } from "@/app/got-houses-v2/data/holds";

interface Body {
  audience: Audience;
  state: GameState;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { audience, state } = body;
    if (!audience?.answer || !state?.characters) {
      return NextResponse.json({ error: "missing answer" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "no key" }, { status: 503 });
    }

    const speaker = state.characters[audience.speakerId];
    const lord = state.characters[audience.addresseeId];
    const chosen = audience.answer.freeText
      ? `The lord answered in his own words: "${audience.answer.freeText}"`
      : `The lord chose: ${audience.options.find((o) => o.id === audience.answer?.optionId)?.label ?? audience.answer.optionId}`;

    const armyLines = state.armies
      .filter((a) => a.faction === audience.faction)
      .map(
        (a) =>
          `- ${a.id} ${a.name} at ${HOLDS_MAP.get(a.holdId)?.name ?? a.holdId} (morale: ${a.morale}; ${a.tiredness})`
      )
      .join("\n");
    const prisonerLines = (state.prisoners ?? [])
      .filter((p) => p.captorFaction === audience.faction)
      .map((p) => `- ${p.id} (${p.units.reduce((s, u) => s + u.count, 0)} men)`)
      .join("\n");

    const client = new Anthropic({ apiKey });
    const raw = await forceToolCall(
      client,
      OUTCOME_TOOL,
      `You are a lightweight war-game master applying the CONSEQUENCE of a lord's counsel answer.

Allowed: morale/tiredness/stance sentences on named same-faction armies or garrisons; release/execute an existing prisoner group this faction already holds; graze forage 1–2 steps at a hold this faction occupies; a public deed summary.

Forbidden: moving hosts, taking or razing seats, creating armies, killing player lords, inventing captives, rewriting orders.

Keep effects small and named. Narrate one short paragraph.`,
      `Faction: ${audience.faction}
Speaker: ${speaker?.name} (${audience.speakerId})
Lord: ${lord?.name} (${audience.addresseeId})
Kind: ${audience.kind}
Situation: ${audience.situation}

Plea:
${audience.text}

Options:
${audience.options.map((o) => `- ${o.id}: ${o.label}`).join("\n")}

${chosen}

Same-faction hosts:
${armyLines || "- none"}

Prisoner groups this faction holds:
${prisonerLines || "- none"}`
    );
    if (!raw) {
      return NextResponse.json({ error: "no outcome" }, { status: 502 });
    }

    const validated = validateAudienceOutcome(raw, state, audience);

    let patches: NpcRuntimePatch[] = [];
    if (speaker?.kind === "npc") {
      const extras = situationLines({
        prisoners: state.prisoners,
        deeds: state.deeds,
        characters: state.characters,
        armies: state.armies,
        faction: speaker.faction,
      });
      const system = buildEmbodiedSystemPrompt(
        speaker.id,
        `${lord?.name} has answered you. Write it in your private notes. Tools only — do not speak.`,
        state.characters,
        extras
      );
      if (system) {
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
        };
        const diary = await runCharacterToolLoop({
          client,
          system: `${system}

DIARY: append_notepad (short) and update_mood if it shifted. search_audiences if you need the record. Do not speak.`,
          userMessage: `You put this to ${lord?.name}:
${audience.text}

${chosen}

What followed:
${validated.narration}

Write it down.`,
          ctx,
          outputMode: "raw",
          allowedTools: [
            "read_notepad",
            "append_notepad",
            "write_notepad",
            "update_mood",
            "search_audiences",
          ],
          maxRounds: 4,
          maxTokens: 500,
        });
        patches = diary.patches;
      }
    }

    return NextResponse.json({
      narration: validated.narration,
      effects: validated.effects,
      notes: validated.notes,
      patches,
    });
  } catch (e) {
    console.error("[got-houses-v2/counsel/outcome]", e);
    return NextResponse.json({ error: "outcome failed" }, { status: 500 });
  }
}
