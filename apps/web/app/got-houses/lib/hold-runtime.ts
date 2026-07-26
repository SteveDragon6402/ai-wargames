import type {
  ArmyUnit,
  Faction,
  HoldGarrison,
  HoldRuntime,
  Leader,
  Notable,
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
  };
}

export function refillToDefault(
  holdId: string,
  runtime: HoldRuntime
): HoldRuntime {
  const seed = getCastleSeed(holdId);
  if (!isGarrisonable(seed)) return runtime;
  const current = garrisonHeadcount(runtime.garrison);
  if (current >= seed.defaultGarrison) return runtime;

  const home = runtime.homeFaction;
  const need = seed.defaultGarrison - current;
  const add = makeDefaultGarrisonUnits(holdId, need, home);
  const units = [...runtime.garrison.units];
  for (const u of add) {
    const existing = units.find(
      (x) => x.house === u.house && x.type === u.type
    );
    if (existing) existing.count += u.count;
    else units.push({ ...u });
  }
  return {
    ...runtime,
    controller: home === "hostile" ? "hostile" : home,
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
        },
        supplies: "No walls to hold — open ground.",
        foodDaysRemaining: null,
        siege: null,
        postSiegeTurnsLeft: 0,
        scar: null,
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
    };
  }
  return out;
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
