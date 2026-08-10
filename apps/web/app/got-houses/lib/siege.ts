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
 * After marches: start/continue/lift investments.
 * Investment = field army at unfriendly garrisonable hold with garrison.men > 0
 * and no opposing *field* army present.
 *
 * New invest: turns = 1, food NOT decremented until continued tick.
 * Lift by withdrawal: refill headcount + scar + clear skipUpdates (no soft snap).
 */
export function tickSieges(
  turn: number,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  prevHoldStates: Record<string, HoldRuntime>
): { holdStates: Record<string, HoldRuntime>; events: FactionEvent[] } {
  const next: Record<string, HoldRuntime> = {};
  for (const [id, hs] of Object.entries(holdStates)) {
    next[id] = normalizeHoldRuntime(hs);
  }
  const events: FactionEvent[] = [];

  // Tick post-siege scars everywhere first
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
    const here = armies.filter((a) => a.holdId === holdId);
    const northHere = here.filter((a) => a.faction === "north");
    const westHere = here.filter((a) => a.faction === "westerlands");
    const bothField = northHere.length > 0 && westHere.length > 0;

    // Opposing field armies → lift investment (field battle handles it)
    if (bothField || men <= 0) {
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
      continue;
    }

    const controller = hs.controller;
    let investorFaction: Faction | null = null;
    let investorArmies: Army[] = [];

    if (controller === "north" && westHere.length > 0 && northHere.length === 0) {
      investorFaction = "westerlands";
      investorArmies = westHere;
    } else if (
      controller === "westerlands" &&
      northHere.length > 0 &&
      westHere.length === 0
    ) {
      investorFaction = "north";
      investorArmies = northHere;
    } else if (controller === "hostile" || controller === null) {
      if (northHere.length > 0 && westHere.length === 0) {
        investorFaction = "north";
        investorArmies = northHere;
      } else if (westHere.length > 0 && northHere.length === 0) {
        investorFaction = "westerlands";
        investorArmies = westHere;
      }
    }

    // Friendly controller with only own troops → no siege
    if (
      (controller === "north" && northHere.length > 0 && westHere.length === 0) ||
      (controller === "westerlands" && westHere.length > 0 && northHere.length === 0)
    ) {
      if (hs.siege) {
        events.push(
          ...eventsFromSiegeTick(turn, holdId, hs.siege, "lifted")
        );
        next[holdId] = liftSiegeRecovery(hs, holdId);
      }
      continue;
    }

    if (!investorFaction || investorArmies.length === 0 || men <= 0) {
      if (hs.siege) {
        events.push(
          ...eventsFromSiegeTick(turn, holdId, hs.siege, "lifted")
        );
        next[holdId] = liftSiegeRecovery(hs, holdId);
      }
      continue;
    }

    const prev = prevHoldStates[holdId]?.siege;
    const isNew = !prev || prev.besiegerFaction !== investorFaction;
    const turns =
      prev && prev.besiegerFaction === investorFaction ? prev.turns + 1 : 1;
    // Food decrements only on continued invest, not the opening day
    const food =
      isNew || hs.foodDaysRemaining == null
        ? hs.foodDaysRemaining
        : Math.max(0, hs.foodDaysRemaining - 1);
    const siege = {
      besiegerFaction: investorFaction,
      turns,
      armyIds: investorArmies.map((a) => a.id),
    };
    events.push(
      ...eventsFromSiegeTick(turn, holdId, siege, isNew ? "invest" : "continue")
    );
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
