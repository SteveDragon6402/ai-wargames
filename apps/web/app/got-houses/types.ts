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

export type GamePhase = "planning" | "resolving" | "retreat";

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

export interface Notable {
  name: string;
  /** Brief description of who/what they are */
  description: string;
}

export interface Army {
  id: string;
  name: string;
  holdId: string;
  faction: Faction;
  units: ArmyUnit[];
  leaders: Leader[];
  /** Named warriors, companions, or creatures of significance */
  notables?: Notable[];
  /** Qualitative one-liner */
  morale: string;
  /** Qualitative one-liner */
  tiredness: string;
  /** Number of consecutive moves without rest */
  movesSinceRest?: number;
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

/* ── Battle types ─────────────────────────────────────────────── */

export interface Casualty {
  faction: Faction;
  armyId: string;
  unitType: UnitType;
  house: string;
  count: number;
}

export interface FallenFigure {
  armyId: string;
  name: string;
  /** true = removed from leaders[], false = removed from notables[] */
  isLeader: boolean;
}

export interface BattleReport {
  id: string;
  turn: number;
  holdId: string;
  /** Claude's ASOIAF-style narrative (2–3 paragraphs) */
  narrative: string;
  holdResult: Faction | "abandoned";
  casualties: Casualty[];
  fallen: FallenFigure[];
  retreatingArmyIds: string[];
}

export interface BattleContext {
  holdId: string;
  northArmies: Army[];
  westArmies: Army[];
  /** hold the north army marched from; undefined = was already there (defender) */
  northFromHoldId?: string;
  /** hold the westerlands army marched from; undefined = defender */
  westFromHoldId?: string;
}

export interface RetreatEntry {
  armyId: string;
  fromHoldId: string;
  /** holds the army CANNOT retreat to (came from opponent) */
  forbiddenHoldIds: string[];
  validTargets: string[];
  chosenHoldId: string | null;
}

export interface TurnHistory {
  turn: number;
  armyMoves: { armyId: string; moved: boolean }[];
}

/* ── Tiredness types ──────────────────────────────────────────── */

export interface TirednessUpdate {
  armyId: string;
  tiredness: string;
}

export interface TirednessRequest {
  armies: TirednessArmyContext[];
}

export interface TirednessArmyContext {
  armyId: string;
  name: string;
  units: ArmyUnit[];
  leaders: Leader[];
  notables?: Notable[];
  currentTiredness: string;
  moveType: "rest" | "march";
  movesSinceRest: number;
  territory: "home" | "neutral";
  holdName: string;
}

/* ── Game state ───────────────────────────────────────────────── */

export interface GameState {
  turn: number;
  phase: GamePhase;
  armies: Army[];
  selectedHoldId: string | null;
  selectedArmyIds: string[];
  moveMode: { active: boolean; validTargets: string[] };
  north: FactionOrders;
  westerlands: FactionOrders;
  adminMode: boolean;
  /** The faction currently issuing orders */
  activeFaction: Faction;
  /** Battles detected after move application — consumed by page.tsx → API */
  pendingBattles: BattleContext[];
  /** Accumulated battle history */
  battleReports: BattleReport[];
  /** Armies that must retreat after battles resolve */
  retreats: RetreatEntry[];
  /** Whether the battle log panel is open */
  battleLogOpen: boolean;
  /** Turn-by-turn movement history */
  turnHistory?: TurnHistory[];
}

export type GameAction =
  | { type: "SELECT_HOLD"; holdId: string | null }
  | { type: "SELECT_ARMY"; armyId: string; shift: boolean }
  | { type: "SELECT_ALL_AT_HOLD"; holdId: string }
  | { type: "BEGIN_MOVE" }
  | { type: "QUEUE_MOVE"; toHoldId: string }
  | { type: "CANCEL_MOVE" }
  | { type: "SUBMIT_FACTION"; faction: Faction }
  | { type: "ADJUDICATE_MOVES" }
  | { type: "BATTLES_RESOLVED"; reports: BattleReport[] }
  | { type: "SET_RETREAT"; armyId: string; toHoldId: string }
  | { type: "COMMIT_RETREATS" }
  | { type: "COMBINE_ARMIES" }
  | { type: "TOGGLE_ADMIN" }
  | { type: "SWITCH_FACTION"; faction: Faction }
  | { type: "TOGGLE_BATTLE_LOG" }
  | { type: "UPDATE_TIREDNESS"; updates: TirednessUpdate[] };
