import type {
  ArmyUnit,
  Faction,
  HoldGarrison,
  HoldRuntime,
} from "../types";
import { HOLDS, HOLDS_MAP } from "../data/holds";
import {
  getCastleSeed,
  homeFactionForRegion,
  type CastleSeed,
} from "../data/castles";

export function isGarrisonable(seed: CastleSeed): boolean {
  return seed.siteKind === "castle" || seed.siteKind === "ruin";
}

export function isFriendlyTo(
  state: HoldRuntime,
  faction: Faction
): boolean {
  return state.controller === faction;
}

const SPINE: Record<"north" | "westerlands" | "hostile" | "none", string> = {
  north: "#3a6ea8",
  westerlands: "#b03030",
  hostile: "#6a5a3a",
  none: "#555555",
};

/**
 * Who the ownership strip should show. An empty seat still wears its
 * country's colour — `controller` is often null after the opening turn.
 */
export function holdSpineOwner(
  controller: Faction | "hostile" | null | undefined,
  homeFaction: Faction | "hostile" | null | undefined
): Faction | "hostile" | null {
  if (
    controller === "north" ||
    controller === "westerlands" ||
    controller === "hostile"
  ) {
    return controller;
  }
  if (
    homeFaction === "north" ||
    homeFaction === "westerlands" ||
    homeFaction === "hostile"
  ) {
    return homeFaction;
  }
  return null;
}

export function holdSpineColor(
  controller: Faction | "hostile" | null | undefined,
  homeFaction: Faction | "hostile" | null | undefined
): string {
  const who = holdSpineOwner(controller, homeFaction);
  if (who === "north" || who === "westerlands" || who === "hostile") {
    return SPINE[who];
  }
  return SPINE.none;
}

/** Abstract default garrison units for home/hostile refill. */
export function makeDefaultGarrisonUnits(
  holdId: string,
  men: number,
  faction: Faction | "hostile"
): ArmyUnit[] {
  if (men <= 0) return [];
  const hold = HOLDS_MAP.get(holdId);
  const house =
    faction === "hostile"
      ? hold?.house ?? "Local"
      : faction === "north"
        ? hold?.house ?? "Stark"
        : hold?.house ?? "Lannister";
  return [{ house, type: "infantry", count: men }];
}

export function garrisonHeadcount(g: HoldGarrison): number {
  return g.units.reduce((s, u) => s + u.count, 0);
}

export const DEFAULT_GARRISON_MORALE = "Steady behind the walls";
export const DEFAULT_GARRISON_TIREDNESS = "Rested on garrison duty";
export const DEFAULT_GARRISON_STANCE = "Holding the keep";

export function buildDefaultGarrison(
  holdId: string,
  faction: Faction | "hostile",
  men: number
): HoldGarrison {
  const units = makeDefaultGarrisonUnits(holdId, men, faction);
  return {
    faction: faction === "hostile" ? null : faction,
    units,
    leaders: [],
    notables: [],
    morale: DEFAULT_GARRISON_MORALE,
    tiredness: DEFAULT_GARRISON_TIREDNESS,
    stance: DEFAULT_GARRISON_STANCE,
  };
}

/** Ensure older saves / partial garrisons have soft fields. */
export function normalizeGarrison(g: HoldGarrison): HoldGarrison {
  return {
    ...g,
    notables: g.notables ?? [],
    morale: g.morale ?? DEFAULT_GARRISON_MORALE,
    tiredness: g.tiredness ?? DEFAULT_GARRISON_TIREDNESS,
    stance: g.stance ?? DEFAULT_GARRISON_STANCE,
  };
}

/**
 * Top a garrison back up toward its default headcount.
 *
 * Refill is strictly a headcount operation and never touches ownership. It also
 * only applies to a seat still held by its home faction, because the levies
 * being drawn on are that region's own smallfolk. A conquered castle raises
 * nobody: whoever took it holds it with the men they left behind and no more.
 *
 * This split matters — the old version rewrote `controller` back to
 * `homeFaction`, so any siege lift or successful sally silently handed a
 * conquered seat back to its original owner without a battle.
 */
export function refillToDefault(
  holdId: string,
  runtime: HoldRuntime
): HoldRuntime {
  const seed = getCastleSeed(holdId);
  if (!isGarrisonable(seed)) return runtime;
  if (runtime.controller !== runtime.homeFaction) return runtime;
  // A foreign garrison left on the walls is not household levies, even if
  // controller was wrongly flipped back to home.
  const occupying = runtime.garrison.faction;
  if (
    (occupying === "north" || occupying === "westerlands") &&
    occupying !== runtime.homeFaction
  ) {
    return runtime;
  }

  const current = garrisonHeadcount(runtime.garrison);
  if (current >= seed.defaultGarrison) return runtime;

  const home = runtime.homeFaction;
  const need = seed.defaultGarrison - current;
  const units = runtime.garrison.units.map((u) => ({ ...u }));
  for (const u of makeDefaultGarrisonUnits(holdId, need, home)) {
    const existing = units.find((x) => x.house === u.house && x.type === u.type);
    if (existing) existing.count += u.count;
    else units.push({ ...u });
  }

  return {
    ...runtime,
    garrison: {
      ...runtime.garrison,
      faction: home === "hostile" ? null : home,
      units,
    },
    foodDaysRemaining:
      runtime.foodDaysRemaining == null || runtime.foodDaysRemaining <= 0
        ? seed.defaultFoodDays
        : runtime.foodDaysRemaining,
    supplies:
      current === 0
        ? "Stores restocked; the castle holds its default strength."
        : runtime.supplies,
  };
}

/** Share of the native default that returns to the walls each turn. */
export const NATIVE_GARRISON_RECOVERY_SHARE = 0.25;

function recoveryStep(defaultGarrison: number): number {
  if (defaultGarrison <= 0) return 0;
  return Math.max(50, Math.ceil(defaultGarrison * NATIVE_GARRISON_RECOVERY_SHARE));
}

/**
 * Hand an empty seat back to its household without filling the walls.
 * The levies come back over turns via recoverNativeGarrisons.
 */
export function restoreHomeHousehold(
  holdId: string,
  runtime: HoldRuntime
): HoldRuntime {
  const home = runtime.homeFaction;
  const seed = getCastleSeed(holdId);
  const empty = buildDefaultGarrison(holdId, home, 0);
  return {
    ...runtime,
    controller: home === "hostile" ? "hostile" : home,
    garrison: {
      ...empty,
      units: [],
    },
    siege: null,
    supplies:
      seed.defaultGarrison > 0
        ? "The household is returning to the walls."
        : runtime.supplies,
    skipUpdates: false,
  };
}

/**
 * Each turn, a home-held seat that is not invested and not enemy-occupied
 * grows its native garrison back toward default. Conquered walls with a
 * foreign garrison do not raise levies.
 */
export function recoverNativeGarrisons(
  armies: { holdId: string; faction: Faction }[],
  holdStates: Record<string, HoldRuntime>
): Record<string, HoldRuntime> {
  const next = { ...holdStates };
  for (const holdId of Object.keys(next)) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) continue;
    let hs = normalizeHoldRuntime(next[holdId]);
    if (hs.siege) {
      next[holdId] = hs;
      continue;
    }

    const home = hs.homeFaction;
    const here = armies.filter((a) => a.holdId === holdId);
    const occupier =
      hs.controller === "north" || hs.controller === "westerlands"
        ? hs.controller
        : null;
    const conquerorStillHere =
      occupier !== null &&
      occupier !== home &&
      here.some((a) => a.faction === occupier);
    if (conquerorStillHere) {
      next[holdId] = hs;
      continue;
    }

    const occupyingMen =
      (hs.garrison.faction === "north" ||
        hs.garrison.faction === "westerlands") &&
      hs.garrison.faction !== home
        ? garrisonHeadcount(hs.garrison)
        : 0;
    if (occupyingMen > 0) {
      next[holdId] = hs;
      continue;
    }

    const enemyHere = here.some(
      (a) => a.faction !== home && (a.faction === "north" || a.faction === "westerlands")
    );
    if (enemyHere) {
      next[holdId] = hs;
      continue;
    }

    const emptyOrUnheld =
      occupier === null || (occupier !== home && occupyingMen === 0);
    if (emptyOrUnheld && home !== "hostile") {
      const nativeMen =
        hs.garrison.faction === home ? garrisonHeadcount(hs.garrison) : 0;
      // Don't wipe a living household garrison just to relabel the seat.
      hs =
        nativeMen > 0
          ? { ...hs, controller: home, skipUpdates: false }
          : restoreHomeHousehold(holdId, hs);
    }

    if (hs.controller !== home) {
      next[holdId] = hs;
      continue;
    }

    const current = garrisonHeadcount(hs.garrison);
    if (current >= seed.defaultGarrison) {
      next[holdId] = hs;
      continue;
    }

    const add = Math.min(
      recoveryStep(seed.defaultGarrison),
      seed.defaultGarrison - current
    );
    if (add <= 0) {
      next[holdId] = hs;
      continue;
    }

    const grown = buildDefaultGarrison(holdId, home, current + add);
    next[holdId] = {
      ...hs,
      controller: home,
      garrison: {
        ...grown,
        leaders: hs.garrison.leaders,
        notables: hs.garrison.notables ?? [],
        morale:
          current === 0
            ? "Household men filtering back to the walls"
            : hs.garrison.morale,
        tiredness: hs.garrison.tiredness,
        stance: hs.garrison.stance,
      },
      supplies:
        current + add >= seed.defaultGarrison
          ? "The household has manned the walls again."
          : "The household is returning to the walls.",
    };
  }
  return next;
}

export function buildInitialHoldStates(): Record<string, HoldRuntime> {
  const out: Record<string, HoldRuntime> = {};
  for (const h of HOLDS) {
    const seed = getCastleSeed(h.id);
    const home = homeFactionForRegion(h.region);
    const controller: HoldRuntime["controller"] =
      home === "hostile" ? "hostile" : home;

    if (!isGarrisonable(seed)) {
      out[h.id] = {
        homeFaction: home,
        controller,
        garrison: {
          faction: null,
          units: [],
          leaders: [],
          notables: [],
          morale: DEFAULT_GARRISON_MORALE,
          tiredness: DEFAULT_GARRISON_TIREDNESS,
          stance: DEFAULT_GARRISON_STANCE,
        },
        supplies: "No walls to hold — open ground.",
        foodDaysRemaining: null,
        siege: null,
        postSiegeTurnsLeft: 0,
        scar: null,
        skipUpdates: true,
      };
      continue;
    }

    const g = buildDefaultGarrison(h.id, home, seed.defaultGarrison);
    out[h.id] = {
      homeFaction: home,
      controller,
      garrison: g,
      supplies:
        seed.siteKind === "ruin"
          ? "Ruined walls; empty until manned."
          : "Stores full; garrison at strength.",
      foodDaysRemaining:
        seed.defaultGarrison > 0 ? seed.defaultFoodDays : null,
      siege: null,
      postSiegeTurnsLeft: 0,
      scar: null,
      skipUpdates: true,
    };
  }
  return out;
}

/** Normalize hold runtime from older saves. */
export function normalizeHoldRuntime(hs: HoldRuntime): HoldRuntime {
  return {
    ...hs,
    garrison: normalizeGarrison(hs.garrison),
    skipUpdates: hs.skipUpdates ?? true,
    castellanId: hs.castellanId ?? null,
  };
}

/**
 * After moves: top garrison toward default when a field army of the
 * controlling (or home) faction is present.
 */
export function applyFriendlyPresenceRefill(
  armies: { holdId: string; faction: Faction }[],
  holdStates: Record<string, HoldRuntime>
): Record<string, HoldRuntime> {
  const next = { ...holdStates };
  for (const holdId of Object.keys(next)) {
    const seed = getCastleSeed(holdId);
    if (!isGarrisonable(seed)) continue;
    let hs = normalizeHoldRuntime(next[holdId]);
    const here = armies.filter((a) => a.holdId === holdId);
    if (here.length === 0) {
      next[holdId] = hs;
      continue;
    }
    const friendlyHere = here.some(
      (a) =>
        hs.controller === a.faction ||
        (hs.controller === null && hs.homeFaction === a.faction)
    );
    if (!friendlyHere) {
      next[holdId] = hs;
      continue;
    }
    // Liberate only a truly empty home seat. A conquered garrison that lost
    // its controller (failed pledge, storm leftovers) must not be relabelled
    // as the original household just because a home army is on the tile.
    if (
      (hs.controller === null || hs.controller === "hostile") &&
      garrisonHeadcount(hs.garrison) === 0 &&
      (hs.homeFaction === "north" || hs.homeFaction === "westerlands") &&
      here.some((a) => a.faction === hs.homeFaction)
    ) {
      hs = {
        ...hs,
        controller: hs.homeFaction,
        garrison: {
          ...hs.garrison,
          faction: hs.homeFaction,
        },
      };
    }
    if (
      hs.controller === "north" ||
      hs.controller === "westerlands"
    ) {
      const controller = hs.controller;
      if (here.some((a) => a.faction === controller)) {
        hs = refillToDefault(holdId, hs);
      }
    }
    next[holdId] = hs;
  }
  return next;
}

export function freeCapacity(holdId: string, runtime: HoldRuntime): number {
  const seed = getCastleSeed(holdId);
  if (!isGarrisonable(seed)) return 0;
  return Math.max(0, seed.capacity - garrisonHeadcount(runtime.garrison));
}

export function mergeUnits(into: ArmyUnit[], add: ArmyUnit[]): ArmyUnit[] {
  const out = into.map((u) => ({ ...u }));
  for (const u of add) {
    const existing = out.find(
      (x) => x.house === u.house && x.type === u.type
    );
    if (existing) existing.count += u.count;
    else out.push({ ...u });
  }
  return out.filter((u) => u.count > 0);
}

export function subtractUnits(
  from: ArmyUnit[],
  take: ArmyUnit[]
): ArmyUnit[] {
  const out = from.map((u) => ({ ...u }));
  for (const t of take) {
    const existing = out.find(
      (x) => x.house === t.house && x.type === t.type
    );
    if (!existing) continue;
    existing.count = Math.max(0, existing.count - t.count);
  }
  return out.filter((u) => u.count > 0);
}

export function suppliesUnderSiege(
  turns: number,
  foodDays: number | null
): string {
  if (foodDays != null && foodDays <= 0) {
    return "Starving behind the walls; rats and boiled leather.";
  }
  if (turns >= 6) {
    return "Long investment; stores dwindling, tempers short.";
  }
  if (turns >= 3) {
    return "Siege lines tighten; forage outside is cut.";
  }
  return "Under investment; cisterns and granaries still hold.";
}
