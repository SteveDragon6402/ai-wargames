import type {
  Army,
  ArmyActivity,
  BattleContext,
  CapturePledge,
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
  restoreHomeHousehold,
  suppliesUnderSiege,
} from "./hold-runtime";
import { describeSeat } from "./travel";

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

/** Field host, or the living garrison addressed as `garrison:{holdId}`. */
export function resolveSelectableArmy(
  armies: Army[],
  holdStates: Record<string, HoldRuntime> | undefined,
  armyId: string
): Army | undefined {
  const field = armies.find((a) => a.id === armyId);
  if (field) return field;
  const holdId = holdIdFromGarrisonArmyId(armyId);
  if (!holdId) return undefined;
  const hs = holdStates?.[holdId];
  if (!hs || garrisonHeadcount(hs.garrison) <= 0) return undefined;
  const faction =
    hs.garrison.faction === "north" || hs.garrison.faction === "westerlands"
      ? hs.garrison.faction
      : hs.controller === "north" || hs.controller === "westerlands"
        ? hs.controller
        : null;
  if (!faction) return undefined;
  return garrisonAsArmy(holdId, hs, faction);
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
 * Smallest besieging force that can actually seal a castle off.
 *
 * There was no strength check at all, so one man could invest a three-thousand
 * man castle and starve it out. A siege line has to be long enough to hold the
 * whole circuit and strong enough that the garrison cannot simply walk out
 * through it, which in practice means being a real fraction of the garrison.
 */
export const MIN_SIEGE_FRACTION = 0.6;
export const MIN_SIEGE_ABSOLUTE = 250;

export function minimumSiegeForce(garrisonMen: number): number {
  if (garrisonMen <= 0) return 0;
  return Math.max(MIN_SIEGE_ABSOLUTE, Math.ceil(garrisonMen * MIN_SIEGE_FRACTION));
}

export function headcountOf(armies: Army[]): number {
  return armies.reduce(
    (sum, a) => sum + a.units.reduce((s, u) => s + u.count, 0),
    0
  );
}

export type InvestorCheck =
  | { status: "investing"; faction: Faction; armies: Army[]; men: number; required: number }
  | { status: "under_strength"; faction: Faction; armies: Army[]; men: number; required: number }
  | { status: "none" };

/**
 * Investor = sole present field faction that does not already control the seat
 * and brings enough men to close the ring.
 *
 * Home faction does not matter — a Westerlands-held Riverrun (home North) is
 * invested the moment a North host is alone there in strength; same for
 * hostile/null seats.
 */
export function investorCheckAtHold(
  hs: HoldRuntime,
  armies: Army[],
  holdId: string
): InvestorCheck {
  const garrisonMen = garrisonHeadcount(hs.garrison);
  if (garrisonMen <= 0) return { status: "none" };
  const sole = soleFieldFaction(armies, holdId);
  if (!sole) return { status: "none" };
  if (hs.controller === sole.faction) return { status: "none" };

  const men = headcountOf(sole.armies);
  const required = minimumSiegeForce(garrisonMen);
  return {
    status: men >= required ? "investing" : "under_strength",
    faction: sole.faction,
    armies: sole.armies,
    men,
    required,
  };
}

export function investorAtHold(
  hs: HoldRuntime,
  armies: Army[],
  holdId: string
): { faction: Faction; armies: Army[] } | null {
  const check = investorCheckAtHold(hs, armies, holdId);
  return check.status === "investing"
    ? { faction: check.faction, armies: check.armies }
    : null;
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
    const check = investorCheckAtHold(hs, armies, holdId);
    const investor =
      check.status === "investing"
        ? { faction: check.faction, armies: check.armies }
        : null;
    const contested =
      armies.some((a) => a.holdId === holdId && a.faction === "north") &&
      armies.some((a) => a.holdId === holdId && a.faction === "westerlands");

    // No invest: empty garrison, contested field, friendly sole presence, or a
    // besieging force too thin to close the ring.
    if (men <= 0 || contested || !investor) {
      if (hs.siege) {
        const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
        events.push(...eventsFromSiegeTick(turn, holdId, hs.siege, "lifted"));
        if (check.status === "under_strength") {
          events.push({
            id: eid("ev"),
            turn,
            faction: check.faction,
            kind: "other",
            holdIds: [holdId],
            summary: `Siege of ${holdName} collapsed — too few men`,
            detail: `${check.men.toLocaleString()} men cannot hold a siege line against a garrison of ${men.toLocaleString()}; at least ${check.required.toLocaleString()} are needed. The investment lifted.`,
          });
        }
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

/**
 * Smallest garrison a captor must leave behind to keep a seat.
 *
 * Deliberately well under the native default: you are holding walls, not
 * replacing the household. Clamped by what the captor actually has so a battered
 * host is never given an impossible pledge.
 */
export function minimumHoldingGarrison(holdId: string, available: number): number {
  const seed = getCastleSeed(holdId);
  if (!isGarrisonable(seed)) return 0;
  const base = Math.min(
    seed.capacity,
    Math.max(150, Math.ceil(seed.defaultGarrison * 0.25))
  );
  return Math.max(1, Math.min(base, available));
}

/**
 * Flip control of seats that a single faction is standing on unopposed with no
 * garrison to stop them, and record what each captor now owes.
 *
 * This is the one place ownership changes through presence, and it covers three
 * cases that all used to be broken:
 *  - a castle whose garrison hit zero kept its old controller forever, because
 *    nothing cleared it once `investorAtHold` started returning null
 *  - winning a field fight at a castle changed nothing about who held it
 *  - a stormed seat was left with `controller: null` and no way to take it
 *    except an optional Garrison-panel action the player could just skip
 */
export function applyPresenceControl(
  turn: number,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  causeByHold: Record<string, CapturePledge["cause"]> = {}
): {
  holdStates: Record<string, HoldRuntime>;
  events: FactionEvent[];
  pledges: CapturePledge[];
} {
  const next: Record<string, HoldRuntime> = { ...holdStates };
  const events: FactionEvent[] = [];
  const pledges: CapturePledge[] = [];

  for (const [holdId, raw] of Object.entries(holdStates)) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) continue;

    const hs = normalizeHoldRuntime(raw);
    if (garrisonHeadcount(hs.garrison) > 0) continue;

    const sole = soleFieldFaction(armies, holdId);
    if (!sole || hs.controller === sole.faction) continue;

    const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
    const available = headcountOf(sole.armies);
    const minimumMen = minimumHoldingGarrison(holdId, available);

    next[holdId] = {
      ...hs,
      controller: sole.faction,
      garrison: { ...normalizeGarrison(hs.garrison), faction: sole.faction },
      siege: null,
      supplies: "Taken; the walls stand empty until men are posted.",
      skipUpdates: false,
    };

    pledges.push({
      holdId,
      faction: sole.faction,
      minimumMen,
      turn,
      cause: causeByHold[holdId] ?? "walk_in",
    });

    events.push({
      id: eid("ev"),
      turn,
      faction: sole.faction,
      kind: "claim",
      holdIds: [holdId],
      summary: `${holdName} taken`,
        detail: `Turn ${turn}: ${sole.faction} took ${holdName}. The walls stand empty; posting a garrison is optional.`,
    });
  }

  return { holdStates: next, events, pledges };
}

/**
 * Resolve outstanding capture pledges against the current board.
 *
 * A pledge is met once the seat holds its minimum. A pledge becomes impossible
 * once the captor has no host left at the hold to peel men from — in that case
 * the seat is dropped rather than left owned by a faction with nobody in it.
 */
export function reconcilePledges(
  turn: number,
  pledges: CapturePledge[],
  holdStates: Record<string, HoldRuntime>,
  armies: Army[]
): {
  holdStates: Record<string, HoldRuntime>;
  pledges: CapturePledge[];
  events: FactionEvent[];
} {
  if (pledges.length === 0) return { holdStates, pledges, events: [] };

  const next = { ...holdStates };
  const events: FactionEvent[] = [];
  const open: CapturePledge[] = [];

  for (const pledge of pledges) {
    const hs = next[pledge.holdId];
    const holdName = HOLDS_MAP.get(pledge.holdId)?.name ?? pledge.holdId;

    // Someone else took it back, or it was never ours — the pledge is moot.
    if (!hs || hs.controller !== pledge.faction) continue;

    const men = garrisonHeadcount(hs.garrison);
    if (men >= pledge.minimumMen) {
      events.push({
        id: eid("ev"),
        turn,
        faction: pledge.faction,
        kind: "garrison",
        holdIds: [pledge.holdId],
        summary: `${holdName} garrisoned`,
        detail: `${holdName} is manned and held. The field host is free to march on.`,
      });
      continue;
    }

    const friendlyHere = armies.some(
      (a) => a.holdId === pledge.holdId && a.faction === pledge.faction
    );
    if (friendlyHere) {
      open.push(pledge);
      continue;
    }

    // Men already on the walls keep the seat. Dropping controller here used
    // to leave a living foreign garrison unheld, and the next home-army
    // presence then "liberated" the castle back to its original owner.
    if (hs.garrison.faction === pledge.faction && men > 0) {
      events.push({
        id: eid("ev"),
        turn,
        faction: pledge.faction,
        kind: "garrison",
        holdIds: [pledge.holdId],
        summary: `${holdName} held thin`,
        detail: `${holdName} is held by the men left on the walls, though fewer than the posted minimum.`,
      });
      continue;
    }

    // Nobody left to post to the walls: the household takes the seat back,
    // and the native garrison grows in over the coming turns.
    next[pledge.holdId] = restoreHomeHousehold(pledge.holdId, hs);
    events.push({
      id: eid("ev"),
      turn,
      faction: pledge.faction,
      kind: "other",
      holdIds: [pledge.holdId],
      summary: `${holdName} left unmanned`,
      detail: `${holdName} was taken but never garrisoned. The household is returning to the walls.`,
    });
  }

  return { holdStates: next, pledges: open, events };
}

/** Pledges this faction still owes, in the order they were incurred. */
export function unmetPledgesFor(
  state: { capturePledges?: CapturePledge[] },
  faction: Faction
): CapturePledge[] {
  return (state.capturePledges ?? []).filter((p) => p.faction === faction);
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

function battleSeatLine(holdId: string, hs: HoldRuntime): string {
  return describeSeat(HOLDS_MAP.get(holdId), hs);
}

export function defenderFactionFor(hs: HoldRuntime, besieger: Faction): Faction {
  if (hs.garrison.faction === "north" || hs.garrison.faction === "westerlands") {
    return hs.garrison.faction;
  }
  if (hs.controller === "north" || hs.controller === "westerlands") {
    return hs.controller;
  }
  return besieger === "north" ? "westerlands" : "north";
}

/**
 * Fold storm / sally into field clashes at the same hold so they resolve as
 * one fight, then emit leftover siege-only battles.
 *
 * A field clash at a living garrison with no storm/sally stays a field battle
 * — the walls are not in it.
 */
export function foldSiegeIntoBattles(
  fieldBattles: BattleContext[],
  armies: Army[],
  holdStates: Record<string, HoldRuntime>,
  stormArmyIds: string[],
  sallyHoldIds: string[],
  armyOrdersMap: Record<string, "march" | "rest" | "fortify">
): BattleContext[] {
  const stormHolds = new Set<string>();
  for (const armyId of stormArmyIds) {
    const army = armies.find((a) => a.id === armyId);
    if (!army) continue;
    const hs = holdStates[army.holdId];
    if (!hs?.siege || hs.siege.besiegerFaction !== army.faction) continue;
    if (garrisonHeadcount(hs.garrison) <= 0) continue;
    stormHolds.add(army.holdId);
  }
  const sallySet = new Set(sallyHoldIds);
  const usedHolds = new Set<string>();
  const out: BattleContext[] = [];

  function attachGarrison(
    battle: BattleContext,
    hs: HoldRuntime,
    engagement: "storm" | "sally",
    combined: boolean
  ): BattleContext {
    const besieger = hs.siege!.besiegerFaction;
    const defenderFaction = defenderFactionFor(hs, besieger);
    const garrisonArmy = garrisonAsArmy(battle.holdId, hs, defenderFaction);
    const already =
      battle.northArmies.some((a) => a.id === garrisonArmy.id) ||
      battle.westArmies.some((a) => a.id === garrisonArmy.id);
    let northArmies = battle.northArmies;
    let westArmies = battle.westArmies;
    if (!already) {
      if (defenderFaction === "north") {
        northArmies = [...northArmies, garrisonArmy];
      } else {
        westArmies = [...westArmies, garrisonArmy];
      }
    }
    return {
      ...battle,
      northArmies,
      westArmies,
      armyOrders: armyOrdersMap,
      engagement,
      garrisonHoldId: battle.holdId,
      wallsStand: false,
      combinedAssault: combined,
      seatLine: battle.seatLine ?? battleSeatLine(battle.holdId, hs),
    };
  }

  for (const b of fieldBattles) {
    const hs = holdStates[b.holdId];
    const storm = stormHolds.has(b.holdId);
    const sally = sallySet.has(b.holdId);
    const canFold =
      !!hs?.siege && garrisonHeadcount(hs.garrison) > 0 && (storm || sally);
    if (canFold) {
      out.push(attachGarrison(b, hs, storm ? "storm" : "sally", true));
    } else {
      const men = hs ? garrisonHeadcount(hs.garrison) : 0;
      out.push({
        ...b,
        engagement: b.engagement ?? "field",
        wallsStand: men > 0,
      });
    }
    usedHolds.add(b.holdId);
  }

  function pushSiegeOnly(
    holdId: string,
    hs: HoldRuntime,
    engagement: "storm" | "sally",
    includeRelief: boolean
  ) {
    if (usedHolds.has(holdId)) return;
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
    out.push({
      holdId,
      northArmies: besieger === "north" ? besiegerArmies : defenderArmies,
      westArmies: besieger === "westerlands" ? besiegerArmies : defenderArmies,
      armyOrders: armyOrdersMap,
      engagement,
      garrisonHoldId: holdId,
      wallsStand: false,
      seatLine: battleSeatLine(holdId, hs),
    });
    usedHolds.add(holdId);
  }

  for (const holdId of sallySet) {
    const hs = holdStates[holdId];
    if (!hs?.siege || garrisonHeadcount(hs.garrison) <= 0) continue;
    pushSiegeOnly(holdId, hs, "sally", true);
  }

  for (const holdId of stormHolds) {
    const hs = holdStates[holdId];
    if (!hs?.siege || garrisonHeadcount(hs.garrison) <= 0) continue;
    pushSiegeOnly(holdId, hs, "storm", false);
  }

  return out;
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
