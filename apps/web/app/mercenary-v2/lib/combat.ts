import { CONFIG } from "./config";
import { rollD100, rollInt } from "./rng";
import type { BattleResult, GameState, Stance, Unit } from "./types";

export type Stack = {
  id: string;
  name: string;
  type: string;
  headcount: number;
  morale: number;
  condition: number;
  stance: Stance;
  traits: string[];
  side: "a" | "b";
};

const ORDER: Stance[] = ["aggressive", "holding", "skirmish", "unready"];

export function shiftStance(stance: Stance, towardUnready: number): Stance {
  const index = Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(stance) + towardUnready));
  return ORDER[index] ?? stance;
}

function power(stack: Stack, terrain: string): number {
  let mod = 1;
  if (stack.stance === "unready") mod *= 0.55;
  if (stack.stance === "aggressive") mod *= 1.12;
  if (stack.stance === "skirmish") mod *= 0.92;
  if (stack.type === "cavalry" && (terrain === "forest" || terrain === "fen")) mod *= 0.45;
  if (stack.type === "spearmen") mod *= 1.08;
  if (stack.type === "archers" || stack.type === "crossbowmen") mod *= 1.05;
  if (stack.traits.includes("untrained")) mod *= 0.85;
  if (stack.traits.includes("shield wall")) mod *= 1.1;
  if (stack.traits.some((trait) => /track/i.test(trait))) mod *= 1.05;
  return stack.headcount * (stack.morale / 100) * (stack.condition / 100) * mod;
}

export function fightStacks(args: {
  id: string;
  week: number;
  locationId: string;
  terrain: string;
  a: Stack[];
  b: Stack[];
  surprise: "none" | "ambush";
  rng: number;
  narrative?: string;
}): { result: BattleResult; rng: number } {
  const a = args.a.map((stack) => ({ ...stack }));
  const b = args.b.map((stack) => ({
    ...stack,
    stance: args.surprise === "ambush" ? ("unready" as Stance) : stack.stance,
  }));
  const aPower = a.reduce((sum, stack) => sum + power(stack, args.terrain), 0);
  const bPower = b.reduce((sum, stack) => sum + power(stack, args.terrain), 0);
  const winner: BattleResult["winner"] = aPower === bPower ? "none" : aPower > bPower ? "a" : "b";
  const units = [...a, ...b].map((stack) => {
    const own = stack.side === "a" ? aPower : bPower;
    const other = stack.side === "a" ? bPower : aPower;
    const frac = other / (own + other + 0.01);
    const killed = Math.min(stack.headcount, Math.max(0, Math.round(stack.headcount * frac * (winner === stack.side ? CONFIG.winnerKill : CONFIG.loserKill))));
    const wounded = Math.min(stack.headcount - killed, Math.max(0, Math.round((stack.headcount - killed) * frac * 0.35)));
    const won = winner === stack.side;
    return {
      id: stack.id,
      killed,
      wounded,
      moraleDelta: won ? 6 : -10,
      conditionDelta: -8 - killed,
    };
  });
  const drawn = rollInt(args.rng, 0, 2);
  const highlights = [
    winner === "none" ? "Neither side held the ground" : `${winner === "a" ? "The first side" : "The second side"} held`,
    `${units.reduce((sum, unit) => sum + unit.killed, 0)} fell`,
  ];
  if (args.surprise === "ambush") highlights.push("The blow came before they were set");
  const narrative =
    args.narrative ??
    `${highlights[0]}. ${units.reduce((sum, unit) => sum + unit.killed, 0)} were killed and the rest fell back bloodied. The ground decided it, not a favour.`;
  return {
    rng: drawn.next,
    result: {
      id: args.id,
      week: args.week,
      locationId: args.locationId,
      winner,
      sideA: "a",
      sideB: "b",
      surprise: args.surprise,
      units,
      breadTaken: 0,
      goldTaken: 0,
      civiliansKilled: 0,
      loot: [],
      highlights: highlights.slice(0, 3),
      narrative: narrative.split(/(?<=[.!?])\s+/).slice(0, 6).join(" "),
    },
  };
}

export function companyStacks(state: GameState): Stack[] {
  return state.company.units
    .filter((unit) => unit.headcount > 0)
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      headcount: unit.headcount,
      morale: unit.morale,
      condition: unit.condition,
      stance: unit.stance,
      traits: unit.traits,
      side: "a" as const,
    }));
}

export function groupStack(state: GameState, groupId: string, side: "a" | "b"): Stack | null {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return null;
  const headcount = state.people.filter((person) => person.alive && person.groupId === groupId && !person.inForceId).length;
  if (headcount <= 0) return null;
  return {
    id: group.id,
    name: group.name,
    type: group.kind === "guards" ? "spearmen" : group.kind === "bandits" ? "swordsmen" : "peasants",
    headcount,
    morale: group.morale,
    condition: group.condition,
    stance: "holding",
    traits: group.quality === "trained" ? ["shield wall"] : group.quality === "raw" ? ["untrained"] : [],
    side,
  };
}

export function forceStack(state: GameState, forceId: string, side: "a" | "b"): Stack | null {
  const force = state.forces.find((item) => item.id === forceId);
  if (!force || !force.alive) return null;
  if (force.kind === "beast") {
    return {
      id: force.id,
      name: force.name,
      type: "beast",
      headcount: force.strength,
      morale: force.morale,
      condition: force.condition,
      stance: force.stance,
      traits: [],
      side,
    };
  }
  const people = state.people.filter((person) => person.alive && (force.personIds.includes(person.id) || person.inForceId === force.id));
  const headcount = people.length || force.strength;
  if (headcount <= 0) return null;
  return {
    id: force.id,
    name: force.name,
    type: force.kind === "camp" ? "swordsmen" : "spearmen",
    headcount,
    morale: force.morale,
    condition: force.condition,
    stance: argsStance(force.stance, side, state),
    traits: [],
    side,
  };
}

function argsStance(stance: Stance, _side: "a" | "b", _state: GameState): Stance {
  return stance;
}

export function applyUnitHarm(unit: Unit, harmed: { killed: number; wounded: number; moraleDelta: number; conditionDelta: number }, state: GameState) {
  const killed = Math.min(unit.headcount, Math.max(0, harmed.killed));
  unit.headcount -= killed;
  unit.wounded = Math.min(unit.headcount, unit.wounded + harmed.wounded);
  unit.morale = clamp(unit.morale + harmed.moraleDelta);
  unit.condition = clamp(unit.condition + harmed.conditionDelta);
  for (let index = 0; index < killed; index += 1) {
    const memberId = unit.memberIds.pop();
    if (!memberId) continue;
    const person = state.people.find((item) => item.id === memberId);
    if (person) person.alive = false;
  }
  if (unit.headcount <= 0) {
    unit.headcount = 0;
    unit.wounded = 0;
    unit.name = "";
    unit.type = "";
    unit.memberIds = [];
    unit.traits = [];
  }
}

export function killInGroup(state: GameState, groupId: string, count: number, onlyFree = true): number {
  const targets = state.people.filter((person) => person.alive && person.groupId === groupId && (!onlyFree || !person.inForceId));
  let killed = 0;
  for (const person of targets) {
    if (killed >= count) break;
    person.alive = false;
    killed += 1;
  }
  return killed;
}

export function killForcePeople(state: GameState, forceId: string, count: number): number {
  const force = state.forces.find((item) => item.id === forceId);
  if (!force) return 0;
  if (force.kind === "beast") {
    const killed = Math.min(force.strength, count);
    force.strength -= killed;
    if (force.strength <= 0) {
      force.strength = 0;
      force.alive = false;
    }
    return killed;
  }
  const targets = state.people.filter((person) => person.alive && (person.inForceId === force.id || force.personIds.includes(person.id)));
  let killed = 0;
  for (const person of targets) {
    if (killed >= count) break;
    person.alive = false;
    person.inForceId = undefined;
    killed += 1;
  }
  force.personIds = force.personIds.filter((id) => state.people.some((person) => person.id === id && person.alive));
  force.strength = Math.max(
    force.personIds.length,
    state.people.filter((person) => person.alive && person.inForceId === force.id).length,
  );
  if (force.strength <= 0) force.alive = false;
  return killed;
}

export function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function terrainOf(state: GameState, locationId: string): string {
  const location = state.locations.find((item) => item.id === locationId);
  if (location?.id === "thornwood") return "forest";
  if (location?.id === "drowned") return "fen";
  if (location?.kind === "capital") return "street";
  return "field";
}

export function rollFind(state: GameState, chance: number): { found: boolean; state: GameState } {
  const next = { ...state, rng: state.rng };
  const drawn = rollD100(next.rng);
  next.rng = drawn.next;
  return { found: drawn.roll <= Math.max(5, Math.min(95, chance)), state: next };
}
