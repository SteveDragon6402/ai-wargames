import type {
  AttackIntention,
  BattleOutcome,
  CombatConfig,
  DigInIntention,
  GameState,
  MoveIntention,
  Stance,
  TurnEvent,
  UnitState,
  UnitType,
} from "@wargame/shared";
import { GameGraph } from "./graph.js";
import {
  attackIntentionAttackMult,
  attackIntentionDefenseMult,
  moveIntentionAttackMult,
  nodeDefenseMultiplier,
  stanceAttackMult,
  stanceDefenseMult,
  unitTypeTerrainMult,
} from "./terrain.js";
import { pruneDead } from "./node-utils.js";

export interface UnitCombatOrder {
  stance: Stance;
  moveIntention?: MoveIntention;
  attackIntention?: AttackIntention;
  digInIntention?: DigInIntention;
  targetUnitId?: string;
  breakthroughTargetNodeId?: string;
  speedDefenseMult?: number;
  reinforceDefenseMult?: number;
  arrivedThisTurn?: boolean;
  isAssault?: boolean;
  // Fallback-path fields — only applied when AI adjudication is unavailable
  unitType?: UnitType;
  flanked?: boolean;
  flanking?: boolean;
}

export function unitCombatPower(
  unit: UnitState,
  order: UnitCombatOrder,
  nodeTags: string[],
  config: CombatConfig,
  mode: "attack" | "defense"
): number {
  const fatigue = 1 - Math.min(0.75, unit.tiredness);
  const moraleMult = 0.5 + unit.morale / 200;
  const dugIn =
    mode === "defense" ? 1 + unit.dugIn * config.dugInBonus : 1;

  let stanceMult =
    mode === "attack"
      ? stanceAttackMult(order.stance)
      : stanceDefenseMult(order.stance);

  if (mode === "attack") {
    if (order.moveIntention) {
      stanceMult *= moveIntentionAttackMult(order.moveIntention);
    }
    if (order.attackIntention) {
      stanceMult *= attackIntentionAttackMult(order.attackIntention);
    }
  } else {
    if (order.attackIntention) {
      stanceMult *= attackIntentionDefenseMult(order.attackIntention);
    }
    if (order.digInIntention === "deny") {
      stanceMult *= config.denyDefensePenalty;
    }
    if (order.reinforceDefenseMult) {
      stanceMult *= order.reinforceDefenseMult;
    }
  }

  const base = mode === "attack" ? unit.attack : unit.defense;
  const edgeMult = order.speedDefenseMult ?? 1;

  // Fallback-only: unit type × terrain and flanking nudges.
  // When the AI adjudicator is active these factors are reasoned qualitatively instead.
  const unitTerrainMult = unitTypeTerrainMult(order.unitType, nodeTags);
  const flankMult =
    mode === "attack" && order.flanking ? 1.15
    : mode === "defense" && order.flanked ? 0.80
    : 1;

  return (
    base *
    unit.strength *
    nodeDefenseMultiplier(nodeTags) *
    stanceMult *
    dugIn *
    fatigue *
    moraleMult *
    edgeMult *
    unitTerrainMult *
    flankMult
  );
}

export function assaultBonusMult(
  order: UnitCombatOrder,
  config: CombatConfig
): number {
  const isAssault =
    order.isAssault ||
    order.moveIntention === "assault" ||
    order.attackIntention === "assault";
  if (!isAssault) return 1;
  const base = config.assaultAttackBonus;
  if (order.arrivedThisTurn) return 1 + (base - 1) * 0.75;
  return base;
}

export interface ClashOptions {
  attackerCasualtyRate?: number;
  defenderCasualtyRate?: number;
}

export function resolveClash(
  state: GameState,
  nodeId: string,
  attackerId: string,
  defenderId: string,
  attackerOrder: UnitCombatOrder,
  defenderOrder: UnitCombatOrder,
  config: CombatConfig,
  _graph: GameGraph,
  options?: ClashOptions
): { state: GameState; events: TurnEvent[]; outcome: BattleOutcome } {
  const events: TurnEvent[] = [];
  const node = _graph.getNode(nodeId)!;
  const attacker = state.units[attackerId]!;
  const defender = state.units[defenderId]!;

  const atk =
    unitCombatPower(attacker, attackerOrder, node.tags, config, "attack") *
    assaultBonusMult(attackerOrder, config);
  const def = unitCombatPower(
    defender,
    defenderOrder,
    node.tags,
    config,
    "defense"
  );

  let outcome: BattleOutcome = "draw";
  let winnerFactionId: typeof attacker.factionId | null = null;

  if (atk > def * 1.05) {
    outcome = "win";
    winnerFactionId = attacker.factionId;
  } else if (def > atk * 1.05) {
    outcome = "loss";
    winnerFactionId = defender.factionId;
  }

  const atkRate = options?.attackerCasualtyRate ?? config.casualtyRate;
  const defRate = options?.defenderCasualtyRate ?? config.casualtyRate;
  const casualties: Record<string, number> = {};
  const units = { ...state.units };

  if (outcome === "draw") {
    applyCasualty(units, attackerId, config.mutualAttrition, casualties);
    applyCasualty(units, defenderId, config.mutualAttrition, casualties);
  } else if (outcome === "win") {
    applyCasualty(units, defenderId, defRate, casualties);
    applyCasualty(units, attackerId, atkRate * 0.5, casualties);
    bumpMorale(units, attackerId, config.morale.win);
    dropMorale(units, defenderId, config.morale.loss);
  } else {
    applyCasualty(units, attackerId, atkRate, casualties);
    applyCasualty(units, defenderId, defRate * 0.5, casualties);
    bumpMorale(units, defenderId, config.morale.win);
    dropMorale(units, attackerId, config.morale.loss);
  }

  if (
    defenderOrder.digInIntention === "hold" &&
    outcome !== "draw" &&
    units[defenderId]
  ) {
    units[defenderId] = {
      ...units[defenderId]!,
      dugIn: Math.max(0.15, units[defenderId]!.dugIn * 0.9),
    };
  }

  events.push({
    type: "battle_result",
    nodeId,
    attackerId,
    defenderId,
    outcome,
    winnerFactionId,
    casualties,
  });

  return {
    state: { ...state, units: pruneDead(units) },
    events,
    outcome,
  };
}

export function applyCasualty(
  units: Record<string, UnitState>,
  id: string,
  rate: number,
  log: Record<string, number>
): void {
  const u = units[id];
  if (!u) return;
  const loss = Math.max(0.12, u.strength * rate);
  log[id] = loss;
  const next = u.strength - loss;
  if (next <= 0.05) {
    delete units[id];
  } else {
    units[id] = {
      ...u,
      strength: next,
      tiredness: Math.min(1, u.tiredness + 0.15),
      dugIn: Math.max(0, u.dugIn - 0.2),
    };
  }
}

export function bumpMorale(
  units: Record<string, UnitState>,
  id: string,
  delta: number
): void {
  const u = units[id];
  if (!u) return;
  units[id] = { ...u, morale: Math.min(100, u.morale + delta) };
}

export function dropMorale(
  units: Record<string, UnitState>,
  id: string,
  delta: number
): void {
  const u = units[id];
  if (!u) return;
  units[id] = { ...u, morale: Math.max(0, u.morale + delta) };
}
