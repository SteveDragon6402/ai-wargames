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

export type GamePhase = "planning" | "resolving" | "retreat" | "rename_commanders";

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

/**
 * Tracks how many consecutive turns an army has spent in each mode,
 * and how recently it merged or split. No booleans — all counters.
 * turnsSinceMerge/Split: null = never happened; 0 = happened this resolve.
 */
export interface ArmyActivity {
  turnsResting: number;
  turnsFortiying: number;
  turnsMarching: number;
  turnsSinceMerge: number | null;
  turnsSinceSplit: number | null;
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
  /** Qualitative one-liner — updated by tiredness bot and battle adjudicator */
  stance: string;
  /** Activity history counters — fed to AI bots each turn */
  activity: ArmyActivity;
  /** Number of consecutive moves without rest */
  movesSinceRest?: number;
  /** The hold this army was at immediately before its current position (for retreat blocking) */
  lastHoldId?: string;
}

export interface MoveOrder {
  armyId: string;
  fromHoldId: string;
  toHoldId: string;
}

export interface FactionOrders {
  orders: MoveOrder[];
  /** REST or FORTIFY orders issued by the player this turn — cleared on resolve */
  stanceOrders: Record<string, "rest" | "fortify">;
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

/** Post-battle qualitative morale + tiredness + stance update for one army */
export interface ArmyConditionUpdate {
  armyId: string;
  morale: string;
  tiredness: string;
  stance?: string;
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
  /** Qualitative morale + tiredness + stance after the battle for each involved army */
  conditionUpdates?: ArmyConditionUpdate[];
}

export interface BattleContext {
  holdId: string;
  northArmies: Army[];
  westArmies: Army[];
  /** hold the north army marched from; undefined = was already there (defender) */
  northFromHoldId?: string;
  /** hold the westerlands army marched from; undefined = defender */
  westFromHoldId?: string;
  /** Per-army order type for this engagement */
  armyOrders?: Record<string, "march" | "rest" | "fortify">;
  /** When true, one side is trapped with no retreat options — fight to the last */
  lastStand?: boolean;
}

export interface RetreatEntry {
  armyId: string;
  fromHoldId: string;
  /** holds the army CANNOT retreat to */
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
  morale?: string;
  stance?: string;
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
  currentMorale: string;
  currentStance: string;
  moveType: "rest" | "march";
  movesSinceRest: number;
  territory: "home" | "neutral";
  holdName: string;
  /** Full activity history — fed verbatim to AI */
  activity: ArmyActivity;
  /** The explicit stance order the player issued this turn (if any) */
  stanceOrder: "rest" | "fortify" | "march";
}

/* ── Split types ─────────────────────────────────────────────── */

export interface SplitConfig {
  sourceArmyId: string;
  army1: { units: ArmyUnit[]; leaderNames: string[]; notableNames: string[] };
  army2: { units: ArmyUnit[]; leaderNames: string[]; notableNames: string[] };
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
  /** Army IDs awaiting post-battle commander selection */
  pendingRenames: string[];
  /** Army ID currently open in the split panel (null = panel closed) */
  splitPanelArmyId: string | null;
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
  | { type: "UPDATE_TIREDNESS"; updates: TirednessUpdate[] }
  | { type: "SET_STANCE_ORDER"; armyId: string; order: "rest" | "fortify" | null }
  | { type: "OPEN_SPLIT"; armyId: string }
  | { type: "CLOSE_SPLIT" }
  | { type: "SPLIT_ARMY"; config: SplitConfig }
  | { type: "SELECT_LEAD_COMMANDER"; armyId: string; leaderName: string };
