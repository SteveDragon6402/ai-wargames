import type {
  Army,
  ArmyUnit,
  Faction,
  HoldRuntime,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { freeCapacity, garrisonHeadcount } from "./hold-runtime";
import { adjacentHoldIds } from "./travel";

/**
 * A garrison let go scatters.
 *
 * Men released on terms do not march anywhere as a body — they go looking for
 * the nearest friendly banner, and most of them go home to their villages
 * instead. What arrives is a trickle spread across several places, which is the
 * point: letting a garrison walk is a gesture, not a reinforcement scheme.
 *
 * Everything here is deterministic. Both browsers in a two-player game run this
 * same function over the same board, so a coin toss would desync them; the
 * split uses inverse-distance weights and largest-remainder rounding instead.
 */

/** How far released men will look for a friendly banner. */
export const DISPERSE_RADIUS = 3;

/** The rest go home to their villages rather than to the war. */
export const DISPERSE_ARRIVAL_RATE = 0.5;

/** Weight by distance in spaces — near is much better than far. */
const DISTANCE_WEIGHT: Record<number, number> = { 1: 4, 2: 2, 3: 1 };

export type DisperseTargetKind = "army" | "hold";

export interface DisperseTarget {
  kind: DisperseTargetKind;
  /** Army id or hold id. */
  id: string;
  holdId: string;
  distance: number;
  /** Men already there — a big host absorbs more stragglers than a small one. */
  size: number;
  /** Room left behind the walls; null for a field host, which has no cap. */
  capacity: number | null;
}

export interface DisperseAllocation extends DisperseTarget {
  men: number;
}

export interface DisperseResult {
  /** Where the men actually went. */
  allocations: DisperseAllocation[];
  /** Men who arrived somewhere. */
  arrived: number;
  /** Men who went home instead. */
  meltedAway: number;
  /** Arrivals that nowhere had room for. */
  unplaced: number;
}

function unitsMen(units: ArmyUnit[]): number {
  return units.reduce((sum, u) => sum + u.count, 0);
}

/**
 * Places within reach that would take these men in.
 *
 * Own field hosts and own-controlled seats with room, excluding the seat they
 * are walking out of and anywhere the enemy is standing. Sorted for stable
 * output so both clients allocate identically.
 */
export function disperseTargets(
  fromHoldId: string,
  faction: Faction,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  radius: number = DISPERSE_RADIUS
): DisperseTarget[] {
  // Breadth-first out to the radius, so each hold gets its true distance.
  const distance = new Map<string, number>([[fromHoldId, 0]]);
  let frontier = [fromHoldId];
  for (let d = 1; d <= radius; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const n of adjacentHoldIds(cur)) {
        if (distance.has(n)) continue;
        distance.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }

  const enemyOn = (holdId: string) =>
    armies.some((a) => a.holdId === holdId && a.faction !== faction);

  const targets: DisperseTarget[] = [];
  for (const [holdId, d] of distance) {
    if (d === 0 || d > radius) continue;
    if (enemyOn(holdId)) continue;

    for (const a of armies) {
      if (a.holdId !== holdId || a.faction !== faction) continue;
      targets.push({
        kind: "army",
        id: a.id,
        holdId,
        distance: d,
        size: unitsMen(a.units),
        capacity: null,
      });
    }

    const hs = holdStates[holdId];
    if (hs && hs.controller === faction && !hs.razed) {
      const room = freeCapacity(holdId, hs);
      if (room > 0) {
        targets.push({
          kind: "hold",
          id: holdId,
          holdId,
          distance: d,
          size: garrisonHeadcount(hs.garrison),
          capacity: room,
        });
      }
    }
  }

  return targets.sort(
    (a, b) =>
      a.distance - b.distance ||
      b.size - a.size ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id)
  );
}

/**
 * Split `men` across targets by weight, with largest-remainder rounding.
 *
 * Largest remainder rather than rounding each share independently, so the
 * parts always add back up to the whole and every client agrees on which
 * target gets the odd man.
 */
function allocateByWeight(
  men: number,
  targets: DisperseTarget[]
): DisperseAllocation[] {
  const weights = targets.map((t) => {
    const byDistance = DISTANCE_WEIGHT[t.distance] ?? 1;
    // A larger body of men draws more stragglers, but only mildly.
    const bySize = 1 + Math.min(t.size, 4000) / 4000;
    return byDistance * bySize;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return [];

  const exact = weights.map((w) => (men * w) / totalWeight);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = men - floors.reduce((s, v) => s + v, 0);

  // Hand the leftovers to the biggest fractional parts, breaking ties by order.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = floors.slice();
  for (const { i } of order) {
    if (remaining <= 0) break;
    out[i] += 1;
    remaining -= 1;
  }

  return targets.map((t, i) => ({ ...t, men: out[i] }));
}

/**
 * Clamp arrivals to what the walls can actually hold, passing the overflow on
 * to whoever still has room.
 */
function clampToCapacity(
  allocations: DisperseAllocation[]
): { allocations: DisperseAllocation[]; unplaced: number } {
  const out = allocations.map((a) => ({ ...a }));
  let overflow = 0;

  for (const a of out) {
    if (a.capacity == null) continue;
    if (a.men > a.capacity) {
      overflow += a.men - a.capacity;
      a.men = a.capacity;
    }
  }

  // Field hosts first — they have no cap — then walls with room left.
  while (overflow > 0) {
    const takers = out.filter(
      (a) => a.capacity == null || a.men < a.capacity
    );
    if (takers.length === 0) break;
    const before = overflow;
    for (const a of takers) {
      if (overflow <= 0) break;
      const room = a.capacity == null ? overflow : a.capacity - a.men;
      const take = Math.min(room, Math.max(1, Math.ceil(overflow / takers.length)));
      a.men += take;
      overflow -= take;
    }
    if (overflow === before) break;
  }

  return {
    allocations: out.filter((a) => a.men > 0),
    unplaced: Math.max(0, overflow),
  };
}

/**
 * Scatter a released garrison.
 *
 * Half the men go home; the remainder spread across friendly hosts and seats
 * within three spaces. With nowhere in range to go, the garrison simply
 * evaporates — the men take off their helmets and walk away.
 */
export function disperseGarrison(
  units: ArmyUnit[],
  fromHoldId: string,
  faction: Faction,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  options: { radius?: number; arrivalRate?: number } = {}
): DisperseResult {
  const total = unitsMen(units);
  if (total <= 0) {
    return { allocations: [], arrived: 0, meltedAway: 0, unplaced: 0 };
  }

  const arrivalRate = options.arrivalRate ?? DISPERSE_ARRIVAL_RATE;
  const walking = Math.floor(total * arrivalRate);
  const meltedAway = total - walking;

  const targets = disperseTargets(
    fromHoldId,
    faction,
    armies,
    holdStates,
    options.radius ?? DISPERSE_RADIUS
  );

  // Nobody within reach to walk toward: the garrison is simply gone.
  if (targets.length === 0 || walking <= 0) {
    return {
      allocations: [],
      arrived: 0,
      meltedAway: total,
      unplaced: 0,
    };
  }

  const clamped = clampToCapacity(allocateByWeight(walking, targets));
  const arrived = clamped.allocations.reduce((s, a) => s + a.men, 0);

  return {
    allocations: clamped.allocations,
    arrived,
    meltedAway: meltedAway + clamped.unplaced,
    unplaced: clamped.unplaced,
  };
}

/**
 * Turn an allocation back into units, keeping the released garrison's own
 * house and unit mix so the men who arrive are recognisably the same men.
 */
export function allocationUnits(
  sourceUnits: ArmyUnit[],
  men: number
): ArmyUnit[] {
  const total = unitsMen(sourceUnits);
  if (total <= 0 || men <= 0) return [];

  const exact = sourceUnits.map((u) => (men * u.count) / total);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = men - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }

  return sourceUnits
    .map((u, i) => ({ house: u.house, type: u.type, count: floors[i] }))
    .filter((u) => u.count > 0);
}

/** One line for the log — deliberately unimpressive numbers. */
export function describeDispersal(
  result: DisperseResult,
  holdStates: Record<string, HoldRuntime>,
  armies: Army[]
): string {
  if (result.allocations.length === 0) {
    return `The garrison laid down its arms and scattered; ${result.meltedAway.toLocaleString()} men went home.`;
  }
  const where = result.allocations
    .map((a) => {
      const label =
        a.kind === "army"
          ? armies.find((x) => x.id === a.id)?.name ?? a.id
          : HOLDS_MAP.get(a.holdId)?.name ?? a.holdId;
      return `${a.men.toLocaleString()} to ${label}`;
    })
    .join(", ");
  return `The garrison scattered: ${where}. ${result.meltedAway.toLocaleString()} went home to their villages.`;
}
