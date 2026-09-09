import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AdviceRecord,
  Army,
  BattleContext,
  BattleReport,
  CharacterId,
  CharacterState,
  CommanderBrief,
  ConversationThread,
  FactionEvent,
  HoldRuntime,
  NpcAgentState,
  NpcRuntimePatch,
} from "@/app/got-houses-v2/types";
import { HOLDS_MAP } from "@/app/got-houses-v2/data/holds";
import {
  clipWords,
  defaultBrief,
  fogForCharacter,
  primaryHouse,
} from "@/app/got-houses-v2/lib/battle-briefs";
import {
  buildEmbodiedSystemPrompt,
  runCharacterToolLoop,
  type CharacterToolContext,
} from "@/app/got-houses-v2/lib/character-tools";

interface BriefBody {
  battle: BattleContext;
  characters: Record<CharacterId, CharacterState>;
  armies: Army[];
  battleReports: BattleReport[];
  conversations: ConversationThread[];
  commanderIds: CharacterId[];
  holdStates?: Record<string, HoldRuntime>;
  factionEvents?: FactionEvent[];
  adviceLog?: AdviceRecord[];
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
      const army = [
        ...body.battle.northArmies,
        ...body.battle.westArmies,
        ...(body.battle.rogueArmies ?? []),
      ].find((a) => a.id === armyId);
      if (!army) return;

      const house = primaryHouse(army);
      const role = c.role === "commander" ? "commander" : "notable";
      const beast = c.species === "beast";
      const fog = fogForCharacter(army, body.battle);

      if (!apiKey) {
        briefs.push(defaultBrief(id, c.name, armyId, role, c.mood, house));
        return;
      }

      const embodied = buildEmbodiedSystemPrompt(
        id,
        "Battle is imminent. Form your private judgment. This is NOT spoken to a player — use tools if you need memory, then call record_battle_judgment."
      );
      if (!embodied) return;

      const liege =
        army.faction === "north" ? "Robb Stark, your liege" : "Tywin Lannister, your liege";

      const system = `${embodied}

You may look up past conversations (list_past_threads, get_thread_history, get_recent_messages) and your notepad. You do not get exact enemy numbers.

Then call record_battle_judgment once.
${beast ? "You are not a man of politics: betrayal must be loyal. You may still hold back or throw yourself in." : `You may remain loyal to ${liege}, turn on them without joining the other side, or ride over to the enemy.`}
${role === "notable" ? "You do not command this host. Your judgment is counsel and your own body — you cannot take the army with you." : "You command this host. If you hold back, your men take fewer losses. If you turn, the host goes with you."}`;

      const ctx: CharacterToolContext = {
        actingCharacterId: id,
        characters: body.characters,
        armies: body.armies,
        battleReports: body.battleReports,
        conversations: body.conversations,
        holdStates: body.holdStates,
        factionEvents: body.factionEvents,
        adviceLog: body.adviceLog,
        battleJudgment: null,
      };

      const client = new Anthropic({ apiKey });
      const result = await runCharacterToolLoop({
        client,
        system,
        userMessage: `Battle at ${hold?.name ?? body.battle.holdId}.
Ground: ${hold?.ground ?? "unknown"}
Private mood: ${(c as NpcAgentState).mood}
You ride with: ${army.name} [id ${armyId}], House ${house}.
${fog.ownSide}
The enemy host looks ${fog.enemyBand} compared to YOUR army. You do not know their exact strength.

Inquire with tools if you need memory, then record_battle_judgment.`,
        ctx,
        maxRounds: 5,
        maxTokens: 700,
        outputMode: "raw",
        allowedTools: [
          "read_notepad",
          "write_notepad",
          "append_notepad",
          "update_mood",
          "who_is",
          "get_battle_logs",
          "search_faction_events",
          "get_recent_messages",
          "get_thread_history",
          "list_past_threads",
          "turns_to",
          "record_battle_judgment",
        ],
      });

      patches.push(...result.patches);

      const judged = ctx.battleJudgment;
      let take = judged?.take || "The field looks hard.";
      let outlook = judged?.outlook || "We fight.";
      let approach = judged?.approach || "I hold my line.";
      let instructions = judged?.instructions || "Hold the line and follow the host.";
      let commitment: CommanderBrief["commitment"] = judged?.commitment ?? "commit";
      let betrayal: CommanderBrief["betrayal"] = judged?.betrayal ?? "loyal";
      let mood = judged?.mood?.trim() || c.mood;

      if (!judged) {
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const p = JSON.parse(match[0]) as Partial<CommanderBrief>;
            if (p.take) take = p.take;
            if (p.outlook) outlook = p.outlook;
            if (p.approach) approach = p.approach;
            if (p.instructions) instructions = p.instructions;
            if (p.commitment === "hold_back") commitment = "hold_back";
            if (p.betrayal === "turn_join_enemy" || p.betrayal === "turn_independent") {
              betrayal = p.betrayal;
            }
            if (p.mood) mood = p.mood;
          } catch {
            /* defaults */
          }
        }
      }

      if (beast) betrayal = "loyal";
      if (role === "notable" && betrayal !== "loyal") {
        // Counsel can turn in spirit; they cannot take the host.
        betrayal = "loyal";
      }

      if (mood !== c.mood) {
        patches.push({ id, mood: mood.slice(0, 160) });
      }

      briefs.push({
        characterId: id,
        name: c.name,
        armyId,
        mood: mood.slice(0, 160),
        take: clipWords(take, 20),
        outlook: clipWords(outlook, 20),
        approach: clipWords(approach, 20),
        commitment,
        betrayal,
        instructions: clipWords(instructions, 50),
        role,
        house,
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
