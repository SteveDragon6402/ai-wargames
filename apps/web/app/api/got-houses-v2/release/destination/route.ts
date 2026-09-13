import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleReport,
  CharacterId,
  CharacterState,
  Deed,
  HoldRuntime,
  PrisonerGroup,
  Traveller,
} from "@/app/got-houses-v2/types";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  situationLines,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";
import { refugeOptions, startTravel } from "@/app/got-houses-v2/lib/release";
import { HOLDS_MAP } from "@/app/got-houses-v2/data/holds";

interface DestinationBody {
  travellers: Traveller[];
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  holdStates: Record<string, HoldRuntime>;
  prisoners?: PrisonerGroup[];
  deeds?: Deed[];
  turn: number;
}

/**
 * Ask a newly freed man where he will walk.
 *
 * Silence or a failed call leaves the default refuge already on the traveller.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DestinationBody;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ choices: [] });
    }
    const client = new Anthropic({ apiKey });

    const settled = await Promise.allSettled(
      body.travellers.map((t) => chooseFor(client, body, t))
    );

    const choices: {
      characterId: CharacterId;
      destHoldId: string;
      arrivesTurn: number;
    }[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) choices.push(r.value);
    }
    return NextResponse.json({ choices });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[release/destination]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function chooseFor(
  client: Anthropic,
  body: DestinationBody,
  traveller: Traveller
): Promise<{
  characterId: CharacterId;
  destHoldId: string;
  arrivesTurn: number;
} | null> {
  const npc = body.characters[traveller.characterId];
  if (!npc || npc.kind !== "npc" || !npc.alive) return null;

  const options = refugeOptions(
    traveller.fromHoldId,
    npc.faction,
    body.holdStates,
    body.armies
  );
  if (options.length === 0) return null;

  const extras = situationLines({
    prisoners: body.prisoners,
    deeds: body.deeds,
    characters: body.characters,
    armies: body.armies,
    faction: npc.faction,
  });

  const system = buildEmbodiedSystemPrompt(
    npc.id,
    "You have been set free and must choose where to walk. Use choose_refuge. This is not spoken aloud.",
    body.characters,
    extras
  );
  if (!system) return null;

  const refugeChoice = {
    destHoldId: null as string | null,
    fromHoldId: traveller.fromHoldId,
  };

  const ctx: CharacterToolContext = {
    actingCharacterId: npc.id,
    characters: body.characters,
    armies: body.armies,
    battleReports: body.battleReports,
    conversations: [],
    holdStates: body.holdStates,
    prisoners: body.prisoners,
    deeds: body.deeds,
    turn: body.turn,
    refugeChoice,
  };

  const list = options
    .map(
      (o) =>
        `- ${o.holdName} (${o.kind}, ${o.distance} march${o.distance === 1 ? "" : "es"})${o.note ? ` — ${o.note}` : ""}`
    )
    .join("\n");

  await runCharacterToolLoop({
    client,
    system,
    userMessage: `You were freed at ${HOLDS_MAP.get(traveller.fromHoldId)?.name ?? traveller.fromHoldId}. Seats in reach:\n${list}\n\nCall choose_refuge with the seat you will walk to.`,
    ctx,
    maxRounds: 4,
    maxTokens: 300,
  });

  if (!refugeChoice.destHoldId) return null;
  const next = startTravel(
    traveller.characterId,
    traveller.fromHoldId,
    refugeChoice.destHoldId,
    body.turn
  );
  return {
    characterId: traveller.characterId,
    destHoldId: next.destHoldId,
    arrivesTurn: next.arrivesTurn,
  };
}
