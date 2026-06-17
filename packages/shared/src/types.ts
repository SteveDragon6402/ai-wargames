export type FactionId = "rohan" | "isengard";
export type RoomStatus = "lobby" | "playing" | "finished";
export type GamePhase = "planning" | "resolving";
export type Speed = "slow" | "normal" | "forced";
export type Stance = "aggressive" | "defensive" | "balanced";
export type MoveIntention = "assault" | "attack" | "reinforce" | "balanced";
export type AttackIntention = "assault" | "attack" | "defend" | "breakthrough";
export type DigInIntention = "deny" | "hold";
export type BattleOutcome = "win" | "loss" | "draw";

export type UnitType =
  | "heavy_cavalry"
  | "medium_cavalry"
  | "light_cavalry"
  | "heavy_infantry"
  | "medium_infantry"
  | "light_infantry"
  | "shock_infantry";

export type TerrainTag =
  | "capital_rohan"
  | "capital_isengard"
  | "fortified"
  | "stronghold"
  | "easy_defend"
  | "hard_defend"
  | "rugged"
  | "open"
  | "plains"
  | "river_crossing"
  | "fast_march"
  | "industrial"
  | "ambush";
export type EdgeTag = "road" | "rugged" | "river";

export interface NodeDef {
  id: string;
  name: string;
  tags: TerrainTag[];
  layout: { x: number; y: number };
}

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  tags: EdgeTag[];
}

export interface MapDef {
  id: string;
  name: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface UnitTemplate {
  id: string;
  name: string;
  factionId: FactionId;
  nodeId: string;
  attack: number;
  defense: number;
  strength: number;
  morale?: number;
  unitType?: UnitType;
}

export interface CombatConfig {
  casualtyRate: number;
  mutualAttrition: number;
  dugInBonus: number;
  speedDefenseBonus: number;
  retreatLossMultiplier: number;
  assaultAttackBonus: number;
  denyDefensePenalty: number;
  routThreshold: number;
  dugInThreshold: number;
  morale: { win: number; loss: number; rout: number; digIn: number };
}

export interface ScenarioDef {
  id: string;
  name: string;
  mapId: string;
  factions: FactionId[];
  capitalNodes: Record<FactionId, string>;
  fallbackCapital?: Partial<Record<FactionId, string>>;
  units: UnitTemplate[];
  combat: CombatConfig;
}

export interface UnitState {
  id: string;
  templateId: string;
  name: string;
  factionId: FactionId;
  nodeId: string;
  attack: number;
  defense: number;
  strength: number;
  tiredness: number;
  dugIn: number;
  morale: number;
  engaged: boolean;
  unitType?: UnitType;
  reinforced?: boolean;
  arrivedThisTurn?: boolean;
  turnsInContact?: number;
  /** Retained from the previous turn to drive default orders */
  lastStance?: Stance;
  lastAttackIntention?: AttackIntention;
}

export interface NodeEngagement {
  nodeId: string;
  disengageVotes: Partial<Record<FactionId, boolean>>;
  entryEdgeByFaction: Partial<Record<FactionId, string>>;
  flankedFaction?: FactionId;
}

export interface MoveCommand {
  type: "move";
  unitId: string;
  targetNodeId: string;
  speed: Speed;
  stance: Stance;
  intention: MoveIntention;
  edgeId?: string;
}

export interface DigInCommand {
  type: "dig_in";
  unitId: string;
  intention: DigInIntention;
}

export interface AttackCommand {
  type: "attack";
  unitId: string;
  targetUnitId?: string;
  stance: Stance;
  intention: AttackIntention;
  breakthroughTargetNodeId?: string;
}

export interface CoverCommand {
  type: "cover";
  unitId: string;
  coverUnitId: string;
}

export interface RetreatCommand {
  type: "retreat";
  unitId: string;
  targetNodeId: string;
  speed: Speed;
}

export interface DisengageCommand {
  type: "disengage";
  unitId: string;
}

export interface AbandonCapitalCommand {
  type: "abandon_capital";
}

export type Command =
  | MoveCommand
  | DigInCommand
  | AttackCommand
  | CoverCommand
  | RetreatCommand
  | DisengageCommand
  | AbandonCapitalCommand;

export interface GameMeta {
  scenarioId: string;
  capitalNodes: Record<FactionId, string>;
  abandonCapitalUsed: Record<FactionId, boolean>;
  winnerFactionId: FactionId | null;
}

export interface GameState {
  map: MapDef;
  meta: GameMeta;
  units: Record<string, UnitState>;
  engagements: Record<string, NodeEngagement>;
  turn: number;
  phase: GamePhase;
}

export type TurnEvent =
  | { type: "move"; unitId: string; from: string; to: string }
  | {
      type: "battle_result";
      nodeId: string;
      attackerId: string;
      defenderId: string;
      outcome: BattleOutcome;
      winnerFactionId: FactionId | null;
      casualties: Record<string, number>;
    }
  | {
      type: "combat";
      nodeId: string;
      attackers: string[];
      defenders: string[];
      winner: FactionId | "draw";
      casualties: Record<string, number>;
    }
  | {
      type: "intention_achieved";
      unitId: string;
      intention: MoveIntention | AttackIntention;
    }
  | { type: "rout"; unitId: string; from: string; to: string | null }
  | { type: "deny_blocked"; nodeId: string; unitId: string }
  | { type: "disengage"; nodeId: string }
  | { type: "morale_change"; unitId: string; delta: number; newMorale: number }
  | { type: "dig_in"; unitId: string; nodeId: string; intention: DigInIntention }
  | { type: "capital_shift"; factionId: FactionId; from: string; to: string }
  | { type: "victory"; factionId: FactionId; reason: string }
  | {
      type: "intercept";
      nodeId: string;
      attackerId: string;
      targetId: string;
      casualties: Record<string, number>;
    }
  | { type: "reinforce"; unitId: string; nodeId: string }
  | {
      type: "node_battle";
      nodeId: string;
      narrative: string;
      overallWinner: "side1" | "side2" | "draw";
      side1FactionId: string;
      side2FactionId: string;
      unitOutcomes: Array<{
        unitId: string;
        strengthLossPct: number;
        moraleDelta: number;
        expelled: boolean;
      }>;
    };

export interface TurnResult {
  state: GameState;
  events: TurnEvent[];
}

export interface ResolveOptions {
  combat: CombatConfig;
  rohanFallbackCapital?: string;
}
