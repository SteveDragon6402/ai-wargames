import { HARVEST_WEEK } from "../data/constants";
import { dismissTemporary } from "./settlement";
import type { BanditForce, GameState, Villager } from "./types";

export const HARVEST_GRAIN = 2;
export const STORE_CAP = 15;

export function laborOf(week: number): string {
  if (week <= 8) return "The village is tilling.";
  if (week <= 16) return "The village is planting.";
  if (week < HARVEST_WEEK) return "The village is tending the fields.";
  if (week <= 42) return "The village is harvesting and storing.";
  return "The village is storing what the harvest brought in.";
}

function copyPeople(people: Villager[]): Villager[] {
  return people.map((person) => ({
    ...person,
    possessions: [...person.possessions],
    relations: person.relations.map((bond) => ({ ...bond })),
  }));
}

export function tickWorld(state: GameState): GameState {
  return markRaid(tickBand(tickVillage(state)));
}

function tickVillage(state: GameState): GameState {
  const place = state.settlements.millcross;
  if (!place?.people?.length) return state;
  const people = copyPeople(place.people);
  let granary = place.granary;
  const away = state.units.filter((unit) => unit.home === "millcross").reduce((sum, unit) => sum + unit.count, 0);
  const out = new Set<string>();
  for (const person of people) {
    if (out.size >= away) break;
    if (!person.alive || person.id === "alden" || person.id === "tobin") continue;
    out.add(person.id);
  }
  for (const person of people) {
    if (!person.alive) continue;
    const home = !out.has(person.id);
    if (home && state.week >= 9 && state.week <= 16 && !person.planted && person.grain >= 3) {
      person.grain -= 1;
      person.planted = true;
    }
    if (home && state.week >= HARVEST_WEEK && state.week <= 42 && person.planted) {
      person.grain += HARVEST_GRAIN;
      if (person.grain > STORE_CAP) {
        granary += person.grain - STORE_CAP;
        person.grain = STORE_CAP;
      }
    }
    if (!home) continue;
    if (person.grain > 0) person.grain -= 1;
    else if (granary > 0) granary -= 1;
  }
  const mouths = people.filter((person) => person.alive).length;
  return {
    ...state,
    settlements: {
      ...state.settlements,
      millcross: { ...place, people, granary, mouths, labor: laborOf(state.week + 1) },
    },
  };
}

function tickBand(state: GameState): GameState {
  const band = state.bandits;
  if (!band || band.count <= 0) return state;
  const loot = [...(band.loot ?? [])];
  if (state.week % 4 === 0) loot.push(`Week ${state.week}: they took from the road.`);
  return {
    ...state,
    bandits: {
      ...band,
      coins: (band.coins ?? 0) + 3,
      grain: (band.grain ?? 0) + 2,
      equipment: band.equipment ?? [],
      loot,
    },
  };
}

function markRaid(state: GameState): GameState {
  if (state.week !== 12 || !state.bandits || state.raidDone || state.contract || state.payAt !== "millcross") return state;
  if (state.location === state.bandAt) return { ...state, raidDone: true };
  return { ...state, pendingRaid: true };
}

export interface FightResult {
  holds: "a" | "b";
  dead: { id: string; count: number }[];
  grainToB: number;
  coinsToB: number;
  morale: string;
  stance: string;
  condition: string;
  lines: { id: string; lines: string[] }[];
}

export function parseFight(raw: unknown, groups: { id: string; count: number }[]): FightResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const holds = body.holds === "b" ? "b" : body.holds === "a" ? "a" : null;
  if (!holds) return null;
  const caps = new Map(groups.map((group) => [group.id, group.count]));
  const dead: { id: string; count: number }[] = [];
  if (Array.isArray(body.dead)) {
    for (const row of body.dead) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const cap = caps.get(id);
      const count = typeof record.count === "number" ? Math.floor(record.count) : 0;
      if (cap === undefined || count <= 0) continue;
      dead.push({ id, count: Math.min(cap, count) });
    }
  }
  const lines: FightResult["lines"] = [];
  if (Array.isArray(body.lines)) {
    for (const row of body.lines) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      if (!caps.has(id) || !Array.isArray(record.lines)) continue;
      const text = record.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0);
      if (text.length) lines.push({ id, lines: text.slice(0, 10) });
    }
  }
  const sentence = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value.trim() : fallback);
  const whole = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0);
  return {
    holds,
    dead,
    grainToB: whole(body.grainToB),
    coinsToB: whole(body.coinsToB),
    morale: sentence(body.morale, "They are shaken."),
    stance: sentence(body.stance, "They keep what ground they still have."),
    condition: sentence(body.condition, "The fight has marked them."),
    lines,
  };
}

export function applyVillageRaid(state: GameState, result: FightResult, brief: string, chronicle = ""): GameState {
  const place = state.settlements.millcross;
  const people = copyPeople(place.people ?? []);
  const villageDead = result.dead.find((row) => row.id === "village")?.count ?? 0;
  let killed = 0;
  const spare = new Set(["alden", "tobin"]);
  const killOne = (person: Villager) => {
    if (killed >= villageDead || !person.alive || spare.has(person.id)) return;
    person.alive = false;
    killed += 1;
  };
  people.forEach(killOne);
  if (killed < villageDead) {
    spare.clear();
    people.forEach(killOne);
  }
  const deathOf = new Map(result.dead.filter((row) => row.id !== "village" && row.id !== "band").map((row) => [row.id, row.count]));
  const lineOf = new Map(result.lines.map((row) => [row.id, row.lines]));
  const companyHere = state.location === "millcross";
  const units = companyHere
    ? state.units
        .map((unit) => {
          const deaths = Math.min(unit.count, deathOf.get(unit.id) ?? 0);
          const rewritten = lineOf.get(unit.id);
          return { ...unit, count: unit.count - deaths, lines: rewritten?.length ? rewritten : unit.lines };
        })
        .filter((unit) => unit.count > 0)
    : state.units;
  const bandDead = result.dead.find((row) => row.id === "band")?.count ?? 0;
  const grainTaken = Math.min(place.granary, result.grainToB);
  const coinsTaken = Math.min(Math.max(0, place.elder.coins), result.coinsToB);
  let bandits: BanditForce | null = state.bandits
    ? {
        ...state.bandits,
        count: Math.max(0, state.bandits.count - bandDead),
        grain: (state.bandits.grain ?? 0) + grainTaken,
        coins: (state.bandits.coins ?? 0) + coinsTaken,
        loot: [...(state.bandits.loot ?? []), `Week ${Math.max(1, state.week - 1)}: they raided Millcross.`],
      }
    : null;
  if (bandits && bandits.count <= 0) bandits = null;
  const told = brief.trim() || "The band came into Millcross. The lane was fought over, and then it was quiet.";
  let next: GameState = {
    ...state,
    units,
    bandits,
    pendingRaid: false,
    raidDone: true,
    banditSurvivors: bandits ? bandits.count : 0,
    lastBrief: told,
    lastChronicle: chronicle || told,
    weekScene: told,
    notices: [...state.notices, told],
    settlements: {
      ...state.settlements,
      millcross: {
        ...place,
        people,
        mouths: people.filter((person) => person.alive).length,
        able: Math.max(0, place.able - killed),
        granary: place.granary - grainTaken,
        elder: { ...place.elder, coins: place.elder.coins - coinsTaken },
      },
    },
  };
  if (!bandits && !next.contract && next.payAt === "millcross") next = dismissTemporary(next, "millcross");
  const men = next.units.reduce((sum, unit) => sum + unit.count, 0);
  if (companyHere && men <= 0) return { ...next, phase: "wiped" };
  if (companyHere) {
    next = { ...next, morale: result.morale, stance: result.stance, condition: result.condition, moraleFromBattle: true };
  }
  return next;
}

export function fallbackRaid(state: GameState): GameState {
  const band = state.bandits?.count ?? 0;
  return applyVillageRaid(
    state,
    {
      holds: "b",
      dead: [
        { id: "village", count: 2 },
        { id: "band", count: Math.min(1, band) },
      ],
      grainToB: 15,
      coinsToB: 8,
      morale: "They took what they came for.",
      stance: "They leave the lane.",
      condition: "They are not hurt much.",
      lines: [],
    },
    "The band came into Millcross, took grain and coin, and left men on the lane."
  );
}
