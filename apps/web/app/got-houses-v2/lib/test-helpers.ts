import type { Army, ArmyActivity, BattleContext, HoldRuntime } from "../types";
import {
  DEFAULT_GARRISON_MORALE,
  DEFAULT_GARRISON_STANCE,
  DEFAULT_GARRISON_TIREDNESS,
} from "./hold-runtime";

export const EMPTY_ACTIVITY: ArmyActivity = {
  turnsResting: 0,
  turnsFortiying: 0,
  turnsMarching: 0,
  turnsSinceMerge: null,
  turnsSinceSplit: null,
};

export function army(partial: Partial<Army> & Pick<Army, "id" | "faction">): Army {
  return {
    name: partial.name ?? partial.id,
    holdId: partial.holdId ?? "01",
    units: partial.units ?? [{ house: "Stark", type: "infantry", count: 1000 }],
    leaders: partial.leaders ?? [],
    notables: partial.notables ?? [],
    morale: partial.morale ?? "Steady",
    tiredness: partial.tiredness ?? "Rested",
    stance: partial.stance ?? "Holding",
    activity: partial.activity ?? { ...EMPTY_ACTIVITY },
    ...partial,
  };
}

export function battle(
  north: Army[],
  west: Army[],
  holdId = "01"
): BattleContext {
  return {
    holdId,
    northArmies: north,
    westArmies: west,
  };
}

export function holdRuntime(
  partial: Partial<HoldRuntime> = {}
): HoldRuntime {
  return {
    homeFaction: "north",
    controller: "north",
    garrison: {
      faction: "north",
      units: [{ house: "Stark", type: "infantry", count: 1000 }],
      leaders: [],
      notables: [],
      morale: DEFAULT_GARRISON_MORALE,
      tiredness: DEFAULT_GARRISON_TIREDNESS,
      stance: DEFAULT_GARRISON_STANCE,
    },
    supplies: "Stores full.",
    foodDaysRemaining: 10,
    siege: null,
    postSiegeTurnsLeft: 0,
    scar: null,
    skipUpdates: true,
    ...partial,
  };
}
