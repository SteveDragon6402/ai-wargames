export type Region =
  | "north"
  | "vale"
  | "riverlands"
  | "westerlands"
  | "crownlands"
  | "stormlands"
  | "reach"
  | "dorne";

export type Faction = "north" | "westerlands";

export type UnitType = "cavalry" | "infantry" | "archers";

export interface Hold {
  id: string;
  name: string;
  house: string;
  lord: string;
  region: Region;
  /** 0–80, west→east */
  x: number;
  /** 0–100, south→north */
  y: number;
  /** IDs of directly connected holds */
  links: string[];
}

export interface ArmyUnit {
  house: string;
  type: UnitType;
  count: number;
}

export interface Leader {
  name: string;
  title?: string;
}

export interface Army {
  id: string;
  name: string;
  holdId: string;
  faction: Faction;
  units: ArmyUnit[];
  leaders: Leader[];
  /** Qualitative one-liner */
  morale: string;
  /** Qualitative one-liner */
  tiredness: string;
}

export interface MoveOrder {
  armyId: string;
  fromHoldId: string;
  toHoldId: string;
}

export interface FactionOrders {
  orders: MoveOrder[];
  submitted: boolean;
}

export interface GameState {
  turn: number;
  armies: Army[];
  selectedHoldId: string | null;
  selectedArmyIds: string[];
  moveMode: { active: boolean; validTargets: string[] };
  north: FactionOrders;
  westerlands: FactionOrders;
  adminMode: boolean;
  /** The faction currently issuing orders */
  activeFaction: Faction;
}

export type GameAction =
  | { type: "SELECT_HOLD"; holdId: string | null }
  | { type: "SELECT_ARMY"; armyId: string; shift: boolean }
  | { type: "SELECT_ALL_AT_HOLD"; holdId: string }
  | { type: "BEGIN_MOVE" }
  | { type: "QUEUE_MOVE"; toHoldId: string }
  | { type: "CANCEL_MOVE" }
  | { type: "SUBMIT_FACTION"; faction: Faction }
  | { type: "ADJUDICATE" }
  | { type: "COMBINE_ARMIES" }
  | { type: "TOGGLE_ADMIN" }
  | { type: "SWITCH_FACTION"; faction: Faction };
