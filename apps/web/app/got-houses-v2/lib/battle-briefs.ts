import type {
  Army,
  BattleContext,
  CharacterId,
  CharacterState,
  CommanderBrief,
  Faction,
} from "../types";
import { factionLordId } from "../data/characters";
import { armyStrength } from "./battle-forces";

export type EnemyBand = "none" | "small" | "medium" | "large" | "overwhelming";

export function clipWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, max).join(" ");
}

/** How the other host looks to this army — no exact headcount. */
export function enemyBand(ownMen: number, enemyMen: number): EnemyBand {
  if (enemyMen <= 0) return "none";
  if (ownMen <= 0) return "overwhelming";
  const r = enemyMen / ownMen;
  if (r < 0.5) return "small";
  if (r < 1) return "medium";
  if (r < 2) return "large";
  return "overwhelming";
}

export function primaryHouse(army: Army): string {
  const counts = new Map<string, number>();
  for (const u of army.units) {
    counts.set(u.house, (counts.get(u.house) ?? 0) + u.count);
  }
  let best = army.units[0]?.house ?? army.name;
  let n = 0;
  for (const [house, c] of counts) {
    if (c > n) {
      best = house;
      n = c;
    }
  }
  return best;
}

/** Every living NPC riding with a host in this fight — not the player lords. */
export function collectBattleCharacterIds(
  battle: BattleContext,
  characters: Record<CharacterId, CharacterState>
): CharacterId[] {
  const armyIds = new Set(
    [...battle.northArmies, ...battle.westArmies, ...(battle.rogueArmies ?? [])].map(
      (a) => a.id
    )
  );
  const lords = new Set<CharacterId>([
    factionLordId("north"),
    factionLordId("westerlands"),
  ]);
  return Object.values(characters)
    .filter(
      (c) =>
        c.kind === "npc" &&
        c.alive &&
        c.armyId &&
        armyIds.has(c.armyId) &&
        !lords.has(c.id)
    )
    .map((c) => c.id);
}

export function defaultBrief(
  id: CharacterId,
  name: string,
  armyId: string,
  role: "commander" | "notable",
  mood: string,
  house?: string
): CommanderBrief {
  return {
    characterId: id,
    name,
    armyId,
    mood,
    take: "The field looks hard.",
    outlook: "We fight.",
    approach: "I hold my line.",
    commitment: "commit",
    betrayal: "loyal",
    instructions: "Hold the line and follow the host.",
    role,
    house,
  };
}

export interface BriefApplication {
  battle: BattleContext;
  flips: { armyId: string; faction: Faction }[];
  turnedHouses: string[];
}

/**
 * Apply commander (not notable) judgments to the fight: hold back, ride over
 * to the enemy, or peel off as a third force.
 */
export function applyBriefsToBattle(
  battle: BattleContext,
  briefs: CommanderBrief[]
): BriefApplication {
  const hosts = [
    ...battle.northArmies,
    ...battle.westArmies,
    ...(battle.rogueArmies ?? []),
  ];
  const byArmy = new Map<string, CommanderBrief>();
  for (const b of briefs) {
    if (b.role !== "commander") continue;
    const existing = byArmy.get(b.armyId);
    if (!existing) {
      byArmy.set(b.armyId, b);
      continue;
    }
    const host = hosts.find((a) => a.id === b.armyId);
    const lead = new Set((host?.leaders ?? []).map((l) => l.name));
    if (lead.has(b.name) && !lead.has(existing.name)) {
      byArmy.set(b.armyId, b);
    }
  }

  const commitments: Record<string, "commit" | "hold_back"> = {
    ...(battle.armyCommitments ?? {}),
  };
  const flips: { armyId: string; faction: Faction }[] = [];
  const turnedHouses: string[] = [];

  let north = battle.northArmies.map((a) => ({ ...a, units: a.units.map((u) => ({ ...u })) }));
  let west = battle.westArmies.map((a) => ({ ...a, units: a.units.map((u) => ({ ...u })) }));
  const rogue: Army[] = [...(battle.rogueArmies ?? [])];

  const take = (id: string): { army: Army; from: Faction } | null => {
    const ni = north.findIndex((a) => a.id === id);
    if (ni >= 0) {
      const [army] = north.splice(ni, 1);
      return { army, from: "north" };
    }
    const wi = west.findIndex((a) => a.id === id);
    if (wi >= 0) {
      const [army] = west.splice(wi, 1);
      return { army, from: "westerlands" };
    }
    return null;
  };

  for (const [armyId, brief] of byArmy) {
    if (brief.commitment === "hold_back") commitments[armyId] = "hold_back";
    else commitments[armyId] = commitments[armyId] ?? "commit";

    if (brief.betrayal === "loyal") continue;

    const pulled = take(armyId);
    if (!pulled) continue;
    const house = brief.house ?? primaryHouse(pulled.army);

    if (brief.betrayal === "turn_join_enemy") {
      const to: Faction = pulled.from === "north" ? "westerlands" : "north";
      const flipped = { ...pulled.army, faction: to };
      if (to === "north") north.push(flipped);
      else west.push(flipped);
      flips.push({ armyId, faction: to });
      if (pulled.from === "north") turnedHouses.push(house);
    } else {
      rogue.push(pulled.army);
    }
  }

  return {
    battle: {
      ...battle,
      northArmies: north,
      westArmies: west,
      rogueArmies: rogue,
      armyCommitments: commitments,
      commanderBriefs: briefs,
    },
    flips,
    turnedHouses: [...new Set(turnedHouses)],
  };
}

export function fogForCharacter(
  army: Army | undefined,
  battle: BattleContext
): { ownSide: string; enemyBand: EnemyBand } {
  if (!army) {
    return { ownSide: "You have no host in this fight.", enemyBand: "none" };
  }
  const rogue = battle.rogueArmies ?? [];
  const isRogue = rogue.some((a) => a.id === army.id);
  const ownSide = isRogue
    ? [army]
    : army.faction === "north"
      ? battle.northArmies
      : battle.westArmies;
  const enemy = isRogue
    ? [...battle.northArmies, ...battle.westArmies].filter((a) => a.id !== army.id)
    : army.faction === "north"
      ? battle.westArmies
      : battle.northArmies;
  const ownMen = armyStrength(army);
  const enemyMen = enemy.reduce((s, a) => s + armyStrength(a), 0);
  const friends = ownSide
    .map((a) => `${a.name} (${armyStrength(a).toLocaleString()} men)`)
    .join("; ");
  return {
    ownSide: `Your coalition: ${friends || "you alone"}.`,
    enemyBand: enemyBand(ownMen, enemyMen),
  };
}
