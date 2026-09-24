import type { NodeId } from "../data/map";
import type { BaseTypeId, UnitTypeId } from "../data/wiki";

export type ReputationKey = "holt" | "ashmarch" | "mere" | "nobles" | "peasants";

export const REPUTATION_KEYS: ReputationKey[] = ["holt", "ashmarch", "mere", "nobles", "peasants"];

export const REPUTATION_LABEL: Record<ReputationKey, string> = {
  holt: "Holt",
  ashmarch: "Ashmarch",
  mere: "The Mere",
  nobles: "Nobles",
  peasants: "Peasants",
};

export interface BattleRecord {
  week: number;
  place: string;
  foe: string;
  approach: string;
  result: string;
  deaths: number;
}

export interface Unit {
  id: string;
  name: string;
  type: UnitTypeId;
  count: number;
  origin: string;
  /** Living description. Starts as how they were raised, and grows as they drill. */
  lines: string[];
  battles: BattleRecord[];
}

export interface Decision {
  week: number;
  text: string;
}

export interface ChatTurn {
  role: "player" | "elder";
  text: string;
}

export type WeekAction =
  | { kind: "move"; to: NodeId }
  | { kind: "rest" }
  | { kind: "train"; unitIds: [string, string]; drill: string }
  | { kind: "forage" }
  | { kind: "convert"; direction: "to-good" | "to-basic" }
  | { kind: "recruit"; type: UnitTypeId; count: number; names: string[]; into?: string | "new" }
  | { kind: "buy"; store: "basic" | "good" | "supply"; amount: number };

export type WeekOrder = "action-first" | "movement-first";

export type MovementOrder = { kind: "rest" } | { kind: "march"; to: NodeId };

export type DeedOrder =
  | { kind: "rest" }
  | { kind: "train"; unitIds: [string, string]; drill: string }
  | { kind: "forage" }
  | { kind: "convert"; direction: "to-good" | "to-basic" }
  | { kind: "recruit"; type: UnitTypeId; count: number; names: string[]; into?: string | "new" }
  | { kind: "buy"; store: "basic" | "good" | "supply"; amount: number };

export interface WeekPlan {
  movement: MovementOrder;
  deed: DeedOrder;
  order: WeekOrder;
}

export interface LineDiff {
  unitId: string;
  name: string;
  before: string[];
  after: string[];
}

export interface ReputationShift {
  key: ReputationKey;
  text: string;
}

export interface ContractOffer {
  id: string;
  payer: ReputationKey;
  place: NodeId;
  payAt: NodeId;
  bandName: string;
  leaderName: string;
  count: number;
  purse: number;
  offer: string;
  blurb: string;
  status: "offered" | "taken";
}

export interface BanditForce {
  count: number;
  origin: string;
  lines: string[];
  morale: string;
  stance: string;
}

export interface LeaderMemory {
  name: string;
  blurb: string;
  generalHistory: string;
  withCompany: string[];
}

export type Phase = "name" | "types" | "unit-names" | "reputation" | "play" | "year-end" | "wiped";

export type Screen = "dashboard" | "map" | "elder" | "forest" | "approach" | "result" | "choice" | "chronicle";

export interface PendingBattle {
  reason: "fight" | "retreat" | "leader";
  sneakNote: string | null;
  from: NodeId;
  approach: string;
  supplySpent: number;
}

export interface GameState {
  version: 1;
  phase: Phase;
  screen: Screen;
  companyName: string;
  chosenTypes: BaseTypeId[];
  week: number;
  location: NodeId;
  cameFrom: NodeId | null;
  morale: string;
  stance: string;
  condition: string;
  moraleFromBattle: boolean;
  money: number;
  basicFood: number;
  goodFood: number;
  /** Food bought after this week's march. It is in the stores, and it is not eaten until next week. */
  lateBasic: number;
  lateGood: number;
  supply: number;
  ration: "hearty" | "plain";
  units: Unit[];
  nextUnitId: number;
  reputation: Record<ReputationKey, string>;
  decisions: Decision[];
  weekPlan: WeekPlan;
  queue: WeekAction[];
  resolveIndex: number;
  movedThisWeek: boolean;
  /** Marches since the company last rested its movement. */
  weeksSinceRest: number;
  /** Double rests in a row. */
  weeksDoubleRest: number;
  /** Where the current band is waiting. Arrival there opens the encounter. */
  bandAt: NodeId;
  payAt: NodeId;
  contract: ContractOffer | null;
  contractStep: number;
  hungerNote: string | null;
  weekScene: string | null;
  drillDiffs: LineDiff[];
  reputationShift: ReputationShift[];
  yearClosing: string | null;
  notices: string[];
  villageWork: boolean;
  rewardClaimed: boolean;
  rewardPurse: number | null;
  bandits: BanditForce | null;
  leader: LeaderMemory;
  elderTalk: ChatTurn[];
  villageDeeds: string[];
  pendingBattle: PendingBattle | null;
  lastBrief: string | null;
  lastChronicle: string | null;
  banditSurvivors: number | null;
}

export type Ok<T> = { ok: true; state: T };
export type Err = { ok: false; error: string };
export type Result = Ok<GameState> | Err;

export type Step =
  | { kind: "continue"; state: GameState }
  | { kind: "forest"; state: GameState }
  | { kind: "train"; state: GameState; unitIds: [string, string]; drill: string }
  | { kind: "forage"; state: GameState }
  | { kind: "done"; state: GameState };

export interface ValidatedBattle {
  playerHoldsField: boolean;
  banditDeaths: number;
  deaths: { unitId: string; count: number }[];
  morale: string;
  stance: string;
  condition: string;
  lines: { unitId: string; lines: string[] }[];
}

export type ForceComparison = "larger" | "smaller" | "close";
export type Aftermath = "kill" | "justice" | "recruit";
