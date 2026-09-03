export type FactionId = "lancaster" | "york";
export type GamePhase = "resolving" | "awaiting_actions" | "ended";

export const FACTIONS: FactionId[] = ["lancaster", "york"];

export function isFactionId(value: unknown): value is FactionId {
  return value === "lancaster" || value === "york";
}

export function rivalFaction(faction: FactionId): FactionId {
  return faction === "lancaster" ? "york" : "lancaster";
}

export function randomFaction(): FactionId {
  return Math.random() < 0.5 ? "lancaster" : "york";
}

export interface TurnRecord {
  turn: number;
  briefings: Record<FactionId, string>;
  actions: Record<FactionId, string>;
}

export interface Winner {
  factionId: FactionId;
  reason: string;
  breakdowns: Record<FactionId, string>;
}

export interface SecretTestState {
  turn: number;
  phase: GamePhase;
  scratchpad: string;
  briefings: Record<FactionId, string>;
  pendingActions: Partial<Record<FactionId, string>>;
  history: TurnRecord[];
  winner?: Winner;
  gmLock: boolean;
  gmLockAt?: string;
}

export interface ChronicleEntry {
  turn: number;
  briefing: string;
  action: string;
}

export interface PlayerViewGame {
  turn: number;
  phase: GamePhase;
  myFaction: FactionId;
  briefing: string;
  myPendingAction: string | null;
  opponentSubmitted: boolean;
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

export const HOUSE_LABEL: Record<FactionId, string> = {
  lancaster: "House of Lancaster",
  york: "House of York",
};

export const HOUSE_SHORT: Record<FactionId, string> = {
  lancaster: "Lancaster",
  york: "York",
};

export const MAX_ACTION_WORDS = 500;
export const MAX_ACTION_CHARS = 4000;
export const SCRATCHPAD_MAX_CHARS = 12_000;
export const GM_MAX_TOKENS = 8192;
export const GM_LOCK_MS = 180_000;
