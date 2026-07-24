import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  CharacterId,
  CharacterState,
  Faction,
  FactionEvent,
  NpcAgentState,
  NpcRuntimePatch,
} from "@/app/got-houses/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";
import {
  adviceVsActionHints,
  searchFactionEvents,
} from "@/app/got-houses/lib/faction-events";
import { factionLordId } from "@/app/got-houses/data/characters";

interface DigestBody {
  resolvedTurn: number;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  factionEvents: FactionEvent[];
  adviceLog: AdviceRecord[];
  /** Optional: limit which factions digest (default both) */
  factions?: Faction[];
}

/**
 * After a turn resolves: NPCs review their faction's deeds + their advice,
 * then update notepad/mood. Search tools are generous; generated notes stay short.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DigestBody;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const turn = body.resolvedTurn;
    const factions = body.factions ?? (["north", "westerlands"] as Faction[]);

    const patches: NpcRuntimePatch[] = [];
    const digested: CharacterId[] = [];

    if (!apiKey) {
      return NextResponse.json({ patches: [], digested, skipped: "no_api_key" });
    }

    const client = new Anthropic({ apiKey });

    for (const faction of factions) {
      const lordId = factionLordId(faction);
      const turnEvents = searchFactionEvents(body.factionEvents, {
        faction,
        turn,
        limit: 60,
      });
      const eventDigest =
        turnEvents
          .map((e) => `[${e.kind}] ${e.summary}`)
          .join("\n") || "(no faction actions logged this turn)";

      const hints = adviceVsActionHints(
        faction,
        turn,
        body.factionEvents,
        body.adviceLog,
        lordId
      );

      const npcs = Object.values(body.characters).filter(
        (c): c is NpcAgentState =>
          c.kind === "npc" && c.alive && c.faction === faction
      );

      for (const npc of npcs) {
        const system = buildEmbodiedSystemPrompt(
          npc.id,
          "Turn just ended. Private reflection only — update notepad/mood via tools. Do not speak aloud to anyone."
        );
        if (!system) continue;

        const myArmy = npc.armyId
          ? body.armies.find((a) => a.id === npc.armyId)
          : undefined;
        const armyLine = myArmy
          ? `Your host: ${myArmy.name} — morale ${myArmy.morale}; ${myArmy.tiredness}; stance ${myArmy.stance}.`
          : "You are not currently attached to a host.";

        const ctx: CharacterToolContext = {
          actingCharacterId: npc.id,
          characters: body.characters,
          armies: body.armies,
          battleReports: [],
          conversations: [],
          turn,
          factionEvents: body.factionEvents,
          adviceLog: body.adviceLog,
        };

        const result = await runCharacterToolLoop({
          client,
          system: `${system}

DIGEST MODE: You are not speaking. Use tools only.
1) search_faction_events / search_advice if you need detail (generous).
2) append_notepad with a SHORT private note (≤40 words) about what matters — especially whether your lord heeded your counsel, battle deeds of your side, and how you feel.
3) update_mood if it shifted.
Do not invent enemy secrets. Only your faction's log is trustworthy.`,
          userMessage: `Turn ${turn} has resolved.

${armyLine}

Your faction's deeds this turn:
${eventDigest}

${hints.length ? `Possible counsel vs action tensions:\n${hints.join("\n")}` : "No clear advice/action tension flagged."}

Current notepad:
${npc.notepad || "(empty)"}

Current mood: ${npc.mood}

Update your private notes. No spoken reply needed — tools only, then a brief private confirmation.`,
          ctx,
          maxRounds: 5,
          maxTokens: 280,
          outputMode: "raw",
        });

        if (result.patches.length) {
          patches.push(...result.patches);
        }
        digested.push(npc.id);
      }
    }

    return NextResponse.json({ patches, digested });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/digest]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
