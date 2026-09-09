export type FactionId = "red" | "blue";
export type GamePhase = "resolving" | "awaiting_actions" | "ended";
export type StateId = "havnland" | "akerdal" | "jernmark" | "lysfjord" | "skerry";

export const FACTIONS: FactionId[] = ["red", "blue"];
export const DEBATE_MONTHS = [9, 11] as const;
export const TOTAL_MONTHS = 12;

export function isFactionId(value: unknown): value is FactionId {
  return value === "red" || value === "blue";
}

export function rivalFaction(faction: FactionId): FactionId {
  return faction === "red" ? "blue" : "red";
}

export function randomFaction(): FactionId {
  return Math.random() < 0.5 ? "red" : "blue";
}

export function isDebateMonth(month: number): boolean {
  return month === 9 || month === 11;
}

export interface SeatDemographics {
  setting: string;
  urbanRural: string;
  age: string;
  work: string;
  faith: string;
  union: string;
  education: string;
  summary: string;
}

export interface SeatDef {
  id: string;
  name: string;
  stateId: StateId;
  neighbors: string[];
  demographics: SeatDemographics;
  startLean: number;
  startTurnout: number;
  x: number;
  y: number;
}

export interface StateDef {
  id: StateId;
  name: string;
  blurb: string;
}

export interface SeatRuntime {
  id: string;
  lean: number;
  turnout: number;
}

export interface CosTranslation {
  executed: string;
  deferred: string;
  costKr: number;
  playerNote: string;
  prioritiesForGm: string;
}

export interface CosRecommendation {
  action: string;
  costKr: number;
}

export interface PendingTurn {
  text: string;
  debateAnswers?: string[];
}

export interface TurnRecord {
  month: number;
  briefings: Record<FactionId, string>;
  actions: Record<FactionId, string>;
  translations: Record<FactionId, CosTranslation>;
  debateAnswers?: Partial<Record<FactionId, string[]>>;
}

export interface Winner {
  factionId: FactionId;
  reason: string;
  breakdowns: Record<FactionId, string>;
  states: Record<StateId, FactionId | "split">;
}

export interface SecretTestState {
  month: number;
  phase: GamePhase;
  scratchpad: string;
  cash: Record<FactionId, number>;
  seats: SeatRuntime[];
  issues: string[];
  debateQuestions: string[];
  briefings: Record<FactionId, string>;
  opponentRumors: Record<FactionId, string>;
  recommendations: Record<FactionId, CosRecommendation[]>;
  pendingActions: Partial<Record<FactionId, PendingTurn>>;
  lastTranslations: Partial<Record<FactionId, CosTranslation>>;
  history: TurnRecord[];
  winner?: Winner;
  gmLock: boolean;
  gmLockAt?: string;
}

export interface PublicSeat {
  id: string;
  name: string;
  stateId: StateId;
  lean: number;
  turnout: number;
  summary: string;
}

export interface ChronicleEntry {
  month: number;
  briefing: string;
  action: string;
  note: string;
}

export interface PlayerViewGame {
  month: number;
  phase: GamePhase;
  myFaction: FactionId;
  briefing: string;
  cash: number;
  opponentName: string;
  opponentRumor: string;
  issues: string[];
  recommendations: CosRecommendation[];
  map: PublicSeat[];
  myPendingAction: string | null;
  myPendingDebate: string[] | null;
  opponentSubmitted: boolean;
  debateQuestions: string[];
  chronicle: ChronicleEntry[];
  winner: Winner | null;
}

export interface RoomPlayerPublic {
  id: string;
  factionId: string;
  displayName: string;
}

export interface SecretTestSnapshot {
  room: {
    id: string;
    code: string;
    status: string;
    scenarioId: string;
    hostPlayerId: string | null;
  };
  players: RoomPlayerPublic[];
  viewer: { playerId: string; factionId: FactionId; displayName: string } | null;
  game: PlayerViewGame | null;
}

export const CAMPAIGN_LABEL: Record<FactionId, string> = {
  red: "Red campaign",
  blue: "Blue campaign",
};

export const CAMPAIGN_SHORT: Record<FactionId, string> = {
  red: "Red",
  blue: "Blue",
};

export const MAX_ACTION_WORDS = 300;
export const MAX_ACTION_CHARS = 2400;
export const MAX_DEBATE_WORDS = 100;
export const MAX_BRIEFING_WORDS = 200;
export const MAX_OPENING_BRIEFING_WORDS = 320;
export const STARTING_CASH = 4_000_000;
export const SCRATCHPAD_MAX_CHARS = 16_000;
export const GM_MAX_TOKENS = 2800;
export const GM_MAX_ROUNDS = 3;
export const GM_LOCK_MS = 90_000;
export const PIPELINE_BUDGET_MS = 75_000;
export const LLM_TIMEOUT_MS = 18_000;
export const MAX_VOTER_POLLS = 8;
export const PLAYER_HEADER = "x-player-id";
