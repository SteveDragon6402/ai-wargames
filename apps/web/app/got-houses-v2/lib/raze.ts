import type {
  Army,
  Faction,
  ForageState,
  HoldRuntime,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { getCastleSeed, type CastleSeed } from "../data/castles";

/**
 * Putting a seat to the torch.
 *
 * Razing costs a host its whole turn — an army with a raze order cannot march —
 * and what it leaves behind is permanent. The walls come down, the household
 * never comes back, the country around it is stripped, and the seat counts for
 * nobody's victory. Burning King's Landing denies the prize to both sides,
 * which is the point: it is a way to deny, not a way to win.
 */

/** What is left of a razed seat's walls, as a share of the original. */
export const RAZED_CAPACITY_SHARE = 0.5;

/** Days of food a burned-out shell can keep a garrison on. */
export const RAZED_FOOD_DAYS = 15;

/**
 * The seed a hold actually behaves by.
 *
 * Callers that ask "how many men can these walls hold, how many does the
 * household maintain, how long can they eat" must go through here rather than
 * `getCastleSeed`, or a razed castle keeps quietly working like a castle.
 */
export function effectiveCastleSeed(
  holdId: string,
  hs: HoldRuntime | undefined
): CastleSeed {
  const seed = getCastleSeed(holdId);
  if (!hs?.razed) return seed;
  return {
    ...seed,
    siteKind: "ruin",
    // Nobody is born into a burned seat's service.
    defaultGarrison: 0,
    capacity: Math.floor(seed.capacity * RAZED_CAPACITY_SHARE),
    defaultFoodDays: RAZED_FOOD_DAYS,
  };
}

export function isRazed(hs: HoldRuntime | undefined): boolean {
  return !!hs?.razed;
}

/** A razed seat never regrows its household, however long it sits quiet. */
export function canRegrowHousehold(hs: HoldRuntime | undefined): boolean {
  return !hs?.razed;
}

export function razeScar(holdName: string): string {
  return `${holdName} was put to the torch — broken walls, burned halls, and no household left to keep them.`;
}

/**
 * Tear the place down.
 *
 * The garrison is turned out, the stores are gone, and the scar is permanent.
 * Whoever ordered it keeps the ground — a field host can still camp the ruin,
 * but there are no walls left to garrison, and it counts for nobody's prize.
 */
export function applyRaze(
  holdId: string,
  hs: HoldRuntime,
  byFaction: Faction
): HoldRuntime {
  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  return {
    ...hs,
    razed: true,
    razeInProgress: null,
    controller: byFaction,
    garrison: {
      faction: null,
      units: [],
      leaders: [],
      notables: [],
      morale: "Nothing left to hold.",
      tiredness: "—",
      stance: "The seat is a ruin.",
    },
    supplies: "Burned out. Nothing stored here now.",
    foodDaysRemaining: null,
    siege: null,
    postSiegeTurnsLeft: 0,
    scar: razeScar(holdName),
    skipUpdates: true,
    // The household is gone, so there is nobody to keep the keys.
    castellanId: null,
  };
}

/** Begin a raze: the host is committed for the turn. */
export function beginRaze(
  hs: HoldRuntime,
  faction: Faction,
  turn: number
): HoldRuntime {
  return { ...hs, razeInProgress: { faction, startedTurn: turn } };
}

export function isRazing(hs: HoldRuntime | undefined): boolean {
  return !!hs?.razeInProgress;
}

/** Hosts pinned in place by a raze order, and so unable to march. */
export function armiesCommittedToRazing(
  razeOrders: { armyId: string; holdId: string }[] | undefined
): Set<string> {
  return new Set((razeOrders ?? []).map((o) => o.armyId));
}

/**
 * Can this host burn this seat?
 *
 * Your own seats included — you may deny the enemy a prize by burning it
 * yourself. Open ground has nothing to burn, and a ruin is already burned.
 */
export function canRaze(
  army: Army | undefined,
  holdId: string,
  hs: HoldRuntime | undefined
): { ok: boolean; reason?: string } {
  if (!army) return { ok: false, reason: "No host here." };
  if (!hs) return { ok: false, reason: "Nothing here to burn." };
  if (army.holdId !== holdId) {
    return { ok: false, reason: "The host is not at this seat." };
  }
  if (hs.razed) return { ok: false, reason: "Already a ruin." };
  if (hs.siege) {
    return { ok: false, reason: "The walls still stand against you." };
  }
  if (hs.controller !== army.faction) {
    return { ok: false, reason: "You do not hold this seat." };
  }
  const seed = getCastleSeed(holdId);
  if (seed.siteKind === "open") {
    return { ok: false, reason: "Open ground — there is nothing to raze." };
  }
  return { ok: true };
}

/**
 * Strip the country around a burned seat.
 *
 * An army that razes a place eats and burns everything for miles, so the
 * forage goes to its last step and the line says why.
 */
export function stripForageAtHold(
  forage: ForageState | undefined,
  holdId: string
): ForageState | undefined {
  if (!forage?.holds?.[holdId]) return forage;
  const spot = forage.holds[holdId];
  return {
    ...forage,
    holds: {
      ...forage.holds,
      [holdId]: {
        ...spot,
        step: 4,
        line: "Burned over. Nothing grows here and nothing is left to take.",
      },
    },
  };
}

/** Seats that count for nobody, having been burned. */
export function razedHoldIds(
  holdStates: Record<string, HoldRuntime>
): string[] {
  return Object.entries(holdStates ?? {})
    .filter(([, hs]) => hs.razed)
    .map(([id]) => id);
}
