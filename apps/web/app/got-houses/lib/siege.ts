import type {
  Army,
  ArmyActivity,
  BattleContext,
  Faction,
  FactionEvent,
  GarrisonConditionContext,
  GarrisonConditionPhase,
  HoldGarrison,
  HoldRuntime,
} from "../types";
import { getCastleSeed } from "../data/castles";
import { HOLDS_MAP } from "../data/holds";
import {
  DEFAULT_GARRISON_MORALE,
  DEFAULT_GARRISON_STANCE,
  DEFAULT_GARRISON_TIREDNESS,
  garrisonHeadcount,
  isGarrisonable,
  normalizeGarrison,
  normalizeHoldRuntime,
  refillToDefault,
  suppliesUnderSiege,
} from "./hold-runtime";

const EMPTY_ACTIVITY: ArmyActivity = {
  turnsResting: 0,
  turnsFortiying: 0,
  turnsMarching: 0,
  turnsSinceMerge: null,
  turnsSinceSplit: null,
};

export function garrisonArmyId(holdId: string): string {
  return `garrison:${holdId}`;
}

export function isGarrisonArmyId(id: string): boolean {
  return id.startsWith("garrison:");
}

export function holdIdFromGarrisonArmyId(id: string): string | null {
  if (!isGarrisonArmyId(id)) return null;
  return id.slice("garrison:".length);
}

/** Synthetic army for battle API — garrison behind walls. */
export function garrisonAsArmy(
  holdId: string,
  runtime: HoldRuntime,
  sideFaction: Faction
): Army {
  const hold = HOLDS_MAP.get(holdId);
  const g = normalizeGarrison(runtime.garrison);
  return {
    id: garrisonArmyId(holdId),
    name: `${hold?.name ?? holdId} Garrison`,
    holdId,
    faction: g.faction ?? sideFaction,
    units: g.units.map((u) => ({ ...u })),
    leaders: g.leaders.map((l) => ({ ...l })),
    notables: (g.notables ?? []).map((n) => ({ ...n })),
    morale: g.morale,
    tiredness: g.tiredness,
    stance: g.stance,
    activity: { ...EMPTY_ACTIVITY },
  };
}

function eid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function eventsFromSiegeTick(
  turn: number,
  holdId: string,
  siege: NonNullable<HoldRuntime["siege"]>,
  kind: "invest" | "continue" | "lifted"
): FactionEvent[] {
  const hold = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const events: FactionEvent[] = [];
  const factions: Faction[] =
    kind === "lifted"
      ? ["north", "westerlands"]
      : [siege.besiegerFaction];

  for (const faction of factions) {
    if (kind === "invest" && faction !== siege.besiegerFaction) continue;
    if (kind === "continue" && faction !== siege.besiegerFaction) continue;
    const summary =
      kind === "invest"
        ? `Siege lines opened at ${hold}`
        : kind === "continue"
          ? `Siege of ${hold} continues (turn ${siege.turns})`
          : `Siege of ${hold} lifted`;
    events.push({
      id: eid("ev"),
      turn,
      faction,
      kind: kind === "invest" ? "invest" : "other",
      holdIds: [holdId],
      summary,
      detail: `${summary}. Besieger: ${siege.besiegerFaction}. Investing armies: ${siege.armyIds.join(", ")}.`,
    });
  }
  return events;
}

/** Lift by withdrawal / sally break: refill headcount + scar + clear skipUpdates. */
export function liftSiegeRecovery(hs: HoldRuntime, holdId: string): HoldRuntime {
  let next: HoldRuntime = {
    ...normalizeHoldRuntime(hs),
    siege: null,
    postSiegeTurnsLeft: 3,
    scar: hs.scar ?? "Scarred by recent siege.",
    supplies: "Siege lifted; the seat is recovering.",
    skipUpdates: false,
  };
  // Headcount refill toward default — do NOT snap soft condition
  next = refillToDefault(holdId, next);
  return next;
}

/**
 * Sole field faction at a hold, if exactly one faction is present.
 * Contested (both) or empty → null.
 */
export function soleFieldFaction(
  armies: Army[],
  holdId: string
): { faction: Faction; armies: Army[] } | null {
  const here = armies.filter((a) => a.holdId === holdId);
  const northHere = here.filter((a) => a.faction === "north");
  const westHere = here.filter((a) => a.faction === "westerlands");
  if (northHere.length > 0 && westHere.length === 0) {
    return { faction: "north", armies: northHere };
  }
  if (westHere.length > 0 && northHere.length === 0) {
    return { faction: "westerlands", armies: westHere };
  }
  return null;
}

/**
 * Investor = sole present field faction that does not already control the seat.
 * Home faction does not matter — a Westerlands-held Riverrun (home North) is
 * invested the moment a North host is alone there; same for hostile/null seats.
 */
export function investorAtHold(
  hs: HoldRuntime,
  armies: Army[],
  holdId: string
): { faction: Faction; armies: Army[] } | null {
  if (garrisonHeadcount(hs.garrison) <= 0) return null;
  const sole = soleFieldFaction(armies, holdId);
  if (!sole) return null;
  if (hs.controller === sole.faction) return null;
  return sole;
}

type SiegePresenceMode = "advance" | "reconcile";

/**
 * Apply investment start / continue / lift from current field presence.
 *
 * - `advance` (after marches): tick scar timers; continued sieges +1 turn and food--
 * - `reconcile` (after battles / retreats): start or lift immediately; do not
 *   re-advance turns/food/scars for sieges that already match
 *
 * New invest always: turns = 1, food NOT decremented on opening day.
 */
function applySiegePresence(
  turn: number,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  prevHoldStates: Record<string, HoldRuntime>,
  mode: SiegePresenceMode
): { holdStates: Record<string, HoldRuntime>; events: FactionEvent[] } {
  const next: Record<string, HoldRuntime> = {};
  for (const [id, hs] of Object.entries(holdStates)) {
    next[id] = normalizeHoldRuntime(hs);
  }
  const events: FactionEvent[] = [];

  if (mode === "advance") {
    for (const holdId of Object.keys(next)) {
      const hs = next[holdId];
      if (hs.postSiegeTurnsLeft > 0 && !hs.siege) {
        const left = hs.postSiegeTurnsLeft - 1;
        next[holdId] = {
          ...hs,
          postSiegeTurnsLeft: left,
          supplies:
            left === 0
              ? hs.scar
                ? "Ravaged but no longer starving; scars remain."
                : hs.supplies
              : hs.supplies,
          scar: left === 0 ? hs.scar ?? "Scarred by recent siege." : hs.scar,
          skipUpdates: false,
        };
      }
    }
  }

  for (const holdId of Object.keys(next)) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) {
      if (next[holdId].siege) {
        next[holdId] = { ...next[holdId], siege: null };
      }
      continue;
    }

    const hs = next[holdId];
    const men = garrisonHeadcount(hs.garrison);
    const investor = investorAtHold(hs, armies, holdId);
    const sole = soleFieldFaction(armies, holdId);
    const contested =
      armies.some((a) => a.holdId === holdId && a.faction === "north") &&
      armies.some((a) => a.holdId === holdId && a.faction === "westerlands");

    // No invest: empty garrison, contested field, or friendly sole presence
    if (men <= 0 || contested || !investor) {
      if (hs.siege) {
        events.push(
          ...eventsFromSiegeTick(turn, holdId, hs.siege, "lifted")
        );
        next[holdId] =
          men <= 0
            ? {
                ...hs,
                siege: null,
                postSiegeTurnsLeft: 3,
                scar: "Garrison broken or emptied.",
                supplies: "Empty walls after the fighting.",
                skipUpdates: false,
              }
            : liftSiegeRecovery(hs, holdId);
      }
      // Friendly sole presence: keep non-siege state (refill handled elsewhere)
      void sole;
      continue;
    }

    const prev = prevHoldStates[holdId]?.siege;
    const sameBesieger =
      !!hs.siege && hs.siege.besiegerFaction === investor.faction;
    const isNew = !sameBesieger && (!prev || prev.besiegerFaction !== investor.faction);

    if (mode === "reconcile" && sameBesieger) {
      // Already investing — only refresh investing army ids
      next[holdId] = {
        ...hs,
        siege: {
          ...hs.siege!,
          armyIds: investor.armies.map((a) => a.id),
        },
        skipUpdates: false,
      };
      continue;
    }

    const turns =
      mode === "advance" &&
      prev &&
      prev.besiegerFaction === investor.faction
        ? prev.turns + 1
        : sameBesieger && hs.siege
          ? hs.siege.turns
          : 1;
    const food =
      mode === "advance" &&
      prev &&
      prev.besiegerFaction === investor.faction &&
      hs.foodDaysRemaining != null
        ? Math.max(0, hs.foodDaysRemaining - 1)
        : hs.foodDaysRemaining;

    const siege = {
      besiegerFaction: investor.faction,
      turns,
      armyIds: investor.armies.map((a) => a.id),
    };
    const kind =
      isNew || !sameBesieger
        ? "invest"
        : "continue";
    events.push(...eventsFromSiegeTick(turn, holdId, siege, kind));
    next[holdId] = {
      ...hs,
      siege,
      foodDaysRemaining: food,
      supplies: suppliesUnderSiege(turns, food),
      skipUpdates: false,
    };
  }

  return { holdStates: next, events };
}

/**
 * After marches: start/continue/lift investments (advances siege day + food).
 */
export function tickSieges(
  turn: number,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  prevHoldStates: Record<string, HoldRuntime>
): { holdStates: Record<string, HoldRuntime>; events: FactionEvent[] } {
  return applySiegePresence(turn, armies, holdStates, prevHoldStates, "advance");
}

/**
 * After battles / retreats: if a sole hostile host remains against a living
 * garrison, open investment immediately (no timer advance).
 */
export function reconcileSieges(
  turn: number,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>
): { holdStates: Record<string, HoldRuntime>; events: FactionEvent[] } {
  return applySiegePresence(turn, armies, holdStates, holdStates, "reconcile");
}

/** Holds that need a soft-condition adjudication this turn. */
export function selectGarrisonsForConditionUpdate(
  turn: number,
  holdStates: Record<string, HoldRuntime>
): GarrisonConditionContext[] {
  const out: GarrisonConditionContext[] = [];
  const decade = turn > 0 && turn % 10 === 0;

  for (const [holdId, raw] of Object.entries(holdStates)) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) continue;
    const hs = normalizeHoldRuntime(raw);
    if (garrisonHeadcount(hs.garrison) <= 0) continue;

    let phase: GarrisonConditionPhase | null = null;
    if (hs.siege) phase = "siege";
    else if (hs.postSiegeTurnsLeft > 0) phase = "scar";
    else if (!hs.skipUpdates && decade) phase = "decade";
    else continue;

    const hold = HOLDS_MAP.get(holdId);
    const g = normalizeGarrison(hs.garrison);
    out.push({
      holdId,
      holdName: hold?.name ?? holdId,
      phase,
      morale: g.morale,
      tiredness: g.tiredness,
      stance: g.stance,
      supplies: hs.supplies,
      foodDaysRemaining: hs.foodDaysRemaining,
      siegeTurns: hs.siege?.turns ?? null,
      postSiegeTurnsLeft: hs.postSiegeTurnsLeft,
      scar: hs.scar,
      men: garrisonHeadcount(g),
      defaultGarrison: seed.defaultGarrison,
      capacity: seed.capacity,
      siteKind: seed.siteKind,
    });
  }
  return out;
}

/** Build storm / sally battle contexts (skip holds that already have a field battle). */
export function detectSiegeBattles(
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  fieldBattleHoldIds: Set<string>,
  stormArmyIds: string[],
  sallyHoldIds: string[],
  armyOrdersMap: Record<string, "march" | "rest" | "fortify">
): BattleContext[] {
  const battles: BattleContext[] = [];
  const stormSet = new Set(stormArmyIds);
  const sallySet = new Set(sallyHoldIds);
  const usedHolds = new Set<string>(fieldBattleHoldIds);

  function defenderFactionFor(hs: HoldRuntime, besieger: Faction): Faction {
    if (hs.garrison.faction === "north" || hs.garrison.faction === "westerlands") {
      return hs.garrison.faction;
    }
    if (hs.controller === "north" || hs.controller === "westerlands") {
      return hs.controller;
    }
    return besieger === "north" ? "westerlands" : "north";
  }

  function pushSiegeBattle(
    holdId: string,
    hs: HoldRuntime,
    engagement: "storm" | "sally",
    includeRelief: boolean
  ) {
    const besieger = hs.siege!.besiegerFaction;
    const defenderFaction = defenderFactionFor(hs, besieger);
    const besiegerArmies = armies.filter(
      (a) => a.holdId === holdId && a.faction === besieger
    );
    if (besiegerArmies.length === 0) return;

    const relief = includeRelief
      ? armies.filter(
          (a) => a.holdId === holdId && a.faction === defenderFaction
        )
      : [];

    const garrisonArmy = garrisonAsArmy(holdId, hs, defenderFaction);
    const defenderArmies = [...relief, garrisonArmy];

    battles.push({
      holdId,
      northArmies: besieger === "north" ? besiegerArmies : defenderArmies,
      westArmies: besieger === "westerlands" ? besiegerArmies : defenderArmies,
      armyOrders: armyOrdersMap,
      engagement,
      garrisonHoldId: holdId,
    });
    usedHolds.add(holdId);
  }

  for (const holdId of sallySet) {
    if (usedHolds.has(holdId)) continue;
    const hs = holdStates[holdId];
    if (!hs?.siege || garrisonHeadcount(hs.garrison) <= 0) continue;
    pushSiegeBattle(holdId, hs, "sally", true);
  }

  for (const armyId of stormSet) {
    const army = armies.find((a) => a.id === armyId);
    if (!army) continue;
    const holdId = army.holdId;
    if (usedHolds.has(holdId)) continue;
    const hs = holdStates[holdId];
    if (!hs?.siege || garrisonHeadcount(hs.garrison) <= 0) continue;
    if (hs.siege.besiegerFaction !== army.faction) continue;
    pushSiegeBattle(holdId, hs, "storm", false);
  }

  return battles;
}

export function applyGarrisonCasualties(
  garrison: HoldGarrison,
  casualties: { unitType: string; house: string; count: number }[]
): HoldGarrison {
  const norm = (s: string) =>
    s.toLowerCase().replace(/^\s*house\s+/i, "").trim();
  const base = normalizeGarrison(garrison);
  const units = base.units.map((u) => ({ ...u }));
  for (const c of casualties) {
    const match = units.find(
      (u) =>
        u.type === c.unitType &&
        (u.house === c.house || norm(u.house) === norm(c.house))
    );
    if (match) {
      match.count = Math.max(0, match.count - c.count);
    } else {
      const typeUnits = units.filter((u) => u.type === c.unitType);
      const total = typeUnits.reduce((s, u) => s + u.count, 0);
      if (total <= 0) continue;
      let remaining = c.count;
      for (const u of typeUnits) {
        const share = Math.round((u.count / total) * c.count);
        const take = Math.min(u.count, share, remaining);
        u.count -= take;
        remaining -= take;
      }
    }
  }
  return {
    ...base,
    units: units.filter((u) => u.count > 0),
  };
}

export {
  garrisonHeadcount,
  isGarrisonable,
  refillToDefault,
  DEFAULT_GARRISON_MORALE,
  DEFAULT_GARRISON_TIREDNESS,
  DEFAULT_GARRISON_STANCE,
};
