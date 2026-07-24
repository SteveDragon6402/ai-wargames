import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Army,
  BattleContext,
  BattleReport,
  CharacterId,
  CharacterState,
  CommanderBrief,
  ConversationThread,
  NpcAgentState,
  NpcRuntimePatch,
} from "@/app/got-houses/types";
import { HOLDS_MAP } from "@/app/got-houses/data/holds";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses/lib/character-tools";

interface BriefBody {
  battle: BattleContext;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  /** NPC commander ids to brief — never player lords */
  commanderIds: CharacterId[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BriefBody;
    const hold = HOLDS_MAP.get(body.battle.holdId);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const briefs: CommanderBrief[] = [];
    const patches: NpcRuntimePatch[] = [];

    const tasks = body.commanderIds.map(async (id) => {
      const c = body.characters[id];
      if (!c || c.kind !== "npc" || !c.alive) return;

      const armyId = c.armyId;
      if (!armyId) return;
      const inBattle = [...body.battle.northArmies, ...body.battle.westArmies].some(
        (a) => a.id === armyId
      );
      if (!inBattle) return;

      const embodied = buildEmbodiedSystemPrompt(
        id,
        "Battle is imminent. Form your private judgment of the fight. This is NOT spoken dialogue to a player — output the JSON judgment only after any tool use."
      );
      if (!embodied) return;

      if (!apiKey) {
        briefs.push({
          characterId: id,
          name: c.name,
          armyId,
          mood: c.mood,
          take: "Hard ground, uncertain odds.",
          outlook: "We hold if discipline holds.",
          approach: "I keep my men tight.",
        });
        return;
      }

      const system = `${embodied}

EXCEPTION for this task only: after tools, reply with JSON only (not spoken dialogue):
{"take":"≤15 words","outlook":"≤15 words","approach":"≤15 words","mood":"optional"}
Use survey_map / inspect_hold / find_forces if you need the field.`;

      const ctx: CharacterToolContext = {
        actingCharacterId: id,
        characters: body.characters,
        armies: body.armies,
        battleReports: body.battleReports,
        conversations: body.conversations,
      };

      const client = new Anthropic({ apiKey });
      const result = await runCharacterToolLoop({
        client,
        system,
        userMessage: `Battle at ${hold?.name ?? body.battle.holdId}.
Ground: ${hold?.ground ?? "unknown"}
Private mood: ${(c as NpcAgentState).mood}
Your host army id: ${armyId}

        Inquire with tools if needed, then JSON only.`,
        ctx,
        maxRounds: 4,
        maxTokens: 300,
        outputMode: "raw",
      });

      patches.push(...result.patches);

      let take = "The field looks hard.";
      let outlook = "We fight.";
      let approach = "I hold my line.";
      let mood = c.mood;

      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const p = JSON.parse(match[0]) as {
            take?: string;
            outlook?: string;
            approach?: string;
            mood?: string;
          };
          if (p.take) take = p.take;
          if (p.outlook) outlook = p.outlook;
          if (p.approach) approach = p.approach;
          if (p.mood) mood = p.mood;
        } catch {
          /* keep defaults */
        }
      }

      if (mood !== c.mood) {
        patches.push({ id, mood: mood.slice(0, 160) });
      }

      briefs.push({
        characterId: id,
        name: c.name,
        armyId,
        mood: mood.slice(0, 160),
        take: take.slice(0, 120),
        outlook: outlook.slice(0, 120),
        approach: approach.slice(0, 120),
      });
    });

    await Promise.all(tasks);
    return NextResponse.json({ briefs, patches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[converse/battle-brief]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
