import type { Army, ForageSpot, ForageState, ForageStep } from "../types";
import { HOLDS } from "../data/holds";
import { PATHWAYS, pathwayKey } from "../data/pathways";
import { holdForageSeed, pathForageSeed } from "../data/forage-seeds";

const STEPS: ForageStep[] = [0, 1, 2, 3, 4];

function asStep(n: number): ForageStep {
  const clamped = Math.max(0, Math.min(4, Math.round(n)));
  return STEPS[clamped] ?? 0;
}

/** 0 = the seed line only. Each march step appends a thinner ending. */
export function renderForageLine(base: string, step: ForageStep): string {
  const stem = base.replace(/[.\s]+$/, "");
  switch (step) {
    case 1:
      return `${stem} — the easy pickings are gone.`;
    case 2:
      return `${stem} — the country is picked over.`;
    case 3:
      return `${stem} — little left but gleanings.`;
    case 4:
      return `${stem} — stripped bare; nothing left to draw on.`;
    default:
      return stem;
  }
}

export function makeSpot(base: string, step: ForageStep = 0): ForageSpot {
  return {
    base,
    step,
    line: renderForageLine(base, step),
  };
}

export function buildInitialForage(): ForageState {
  const holds: Record<string, ForageSpot> = {};
  for (const h of HOLDS) {
    holds[h.id] = makeSpot(holdForageSeed(h.id), 0);
  }
  const paths: Record<string, ForageSpot> = {};
  for (const p of PATHWAYS) {
    paths[pathwayKey(p.a, p.b)] = makeSpot(pathForageSeed(p.a, p.b), 0);
  }
  return { holds, paths };
}

function readStep(spot: { step?: number; level?: number }): ForageStep {
  if (typeof spot.step === "number") return asStep(spot.step);
  // Old saves used level 4 = full and level 0 = stripped.
  if (typeof spot.level === "number") return asStep(4 - spot.level);
  return 0;
}

export function normalizeForage(raw?: ForageState | null): ForageState {
  const fresh = buildInitialForage();
  if (!raw) return fresh;
  const holds = { ...fresh.holds };
  for (const [id, spot] of Object.entries(raw.holds ?? {})) {
    if (!holds[id] || !spot) continue;
    holds[id] = makeSpot(spot.base || holds[id].base, readStep(spot));
  }
  const paths = { ...fresh.paths };
  for (const [id, spot] of Object.entries(raw.paths ?? {})) {
    if (!paths[id] || !spot) continue;
    paths[id] = makeSpot(spot.base || paths[id].base, readStep(spot));
  }
  return { holds, paths };
}

export function forageAtHold(forage: ForageState | undefined, holdId: string): string {
  const state = normalizeForage(forage);
  return state.holds[holdId]?.line ?? holdForageSeed(holdId);
}

export function forageStepAtHold(
  forage: ForageState | undefined,
  holdId: string
): ForageStep {
  return normalizeForage(forage).holds[holdId]?.step ?? 0;
}

export function forageOnPath(
  forage: ForageState | undefined,
  a: string,
  b: string
): string {
  const state = normalizeForage(forage);
  return state.paths[pathwayKey(a, b)]?.line ?? pathForageSeed(a, b);
}

export function forageStepOnPath(
  forage: ForageState | undefined,
  a: string,
  b: string
): ForageStep {
  return normalizeForage(forage).paths[pathwayKey(a, b)]?.step ?? 0;
}

/** How hard a passing host bites the country. */
export function grazeSteps(men: number): number {
  if (men >= 5000) return 3;
  if (men >= 2000) return 2;
  if (men >= 200) return 1;
  return 0;
}

function grazeSpot(spot: ForageSpot, steps: number): ForageSpot {
  if (steps <= 0) return spot;
  const step = asStep(spot.step + steps);
  if (step === spot.step) return spot;
  return makeSpot(spot.base, step);
}

function recoverSpot(spot: ForageSpot): ForageSpot {
  if (spot.step <= 0) return spot;
  return makeSpot(spot.base, asStep(spot.step - 1));
}

export function armyMen(army: { units: { count: number }[] }): number {
  return army.units.reduce((s, u) => s + u.count, 0);
}

/**
 * Hosts that march eat the road and the seat they arrive at.
 * Hosts that stay eat the country they camp on.
 * Unused country creeps back one step every other turn, back to the seed line.
 */
export function applyArmyForage(
  forage: ForageState | undefined,
  moves: { fromHoldId: string; toHoldId: string; men: number }[],
  camped: { holdId: string; men: number }[],
  turn: number,
  opts?: { recover?: boolean }
): ForageState {
  const next = normalizeForage(forage);
  const touchedHolds = new Set<string>();
  const touchedPaths = new Set<string>();

  for (const move of moves) {
    const steps = grazeSteps(move.men);
    if (steps <= 0) continue;
    const key = pathwayKey(move.fromHoldId, move.toHoldId);
    if (next.paths[key]) {
      next.paths[key] = grazeSpot(next.paths[key], steps);
      touchedPaths.add(key);
    }
    if (next.holds[move.toHoldId]) {
      next.holds[move.toHoldId] = grazeSpot(next.holds[move.toHoldId], steps);
      touchedHolds.add(move.toHoldId);
    }
  }

  for (const camp of camped) {
    const steps = grazeSteps(camp.men);
    if (steps <= 0) continue;
    if (!next.holds[camp.holdId]) continue;
    next.holds[camp.holdId] = grazeSpot(next.holds[camp.holdId], steps);
    touchedHolds.add(camp.holdId);
  }

  if (opts?.recover !== false && turn > 0 && turn % 2 === 0) {
    for (const id of Object.keys(next.holds)) {
      if (!touchedHolds.has(id)) next.holds[id] = recoverSpot(next.holds[id]);
    }
    for (const id of Object.keys(next.paths)) {
      if (!touchedPaths.has(id)) next.paths[id] = recoverSpot(next.paths[id]);
    }
  }

  return next;
}

export function forageMovesFromOrders(
  orders: { armyId: string; fromHoldId: string; toHoldId: string }[],
  armies: Army[]
): { fromHoldId: string; toHoldId: string; men: number }[] {
  return orders
    .map((o) => {
      const army = armies.find((a) => a.id === o.armyId);
      if (!army) return null;
      return {
        fromHoldId: o.fromHoldId,
        toHoldId: o.toHoldId,
        men: armyMen(army),
      };
    })
    .filter((m): m is { fromHoldId: string; toHoldId: string; men: number } => m !== null);
}

export function forageCampsFromArmies(
  armies: Army[],
  marchedIds: Set<string>
): { holdId: string; men: number }[] {
  return armies
    .filter((a) => !marchedIds.has(a.id))
    .map((a) => ({ holdId: a.holdId, men: armyMen(a) }));
}
