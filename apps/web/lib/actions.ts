import type { GameState, UnitState } from "@wargame/shared";
import { GameGraph } from "@wargame/engine/graph";
import {
  hasEnemyOnNode,
  isAloneOnNode,
  nodeAcrossEntryEdge,
} from "@wargame/engine/node-utils";

export type ActionType =
  | "move"
  | "dig_in"
  | "attack"
  | "cover"
  | "retreat"
  | "disengage"
  | "abandon_capital";

export function getAvailableActions(
  state: GameState,
  unit: UnitState,
  myFaction: string
): ActionType[] {
  if (unit.factionId !== myFaction) return [];
  const graph = new GameGraph(state.map);
  const alone = isAloneOnNode(state, unit);
  const contested = hasEnemyOnNode(state, unit.nodeId, unit.factionId as never);
  const allies = Object.values(state.units).filter(
    (u) => u.nodeId === unit.nodeId && u.factionId === unit.factionId && u.id !== unit.id
  );

  const actions: ActionType[] = [];

  if (!contested || !unit.engaged) {
    actions.push("move");
  }
  if (alone) {
    actions.push("dig_in");
  }
  if (contested) {
    actions.push("attack", "retreat", "disengage");
    if (allies.length > 0) actions.push("cover");
  }
  if (myFaction === "rohan" && !state.meta.abandonCapitalUsed.rohan) {
    actions.push("abandon_capital");
  }

  return actions;
}

export function getAdjacentNodes(state: GameState, unitId: string): string[] {
  const unit = state.units[unitId];
  if (!unit) return [];
  const graph = new GameGraph(state.map);
  return graph.neighbors(unit.nodeId);
}

export function getRetreatTargets(state: GameState, unit: UnitState): string[] {
  const adjacent = getAdjacentNodes(state, unit.id);
  const eng = state.engagements[unit.nodeId];
  const entryEdge = eng?.entryEdgeByFaction?.[unit.factionId as "rohan" | "isengard"];
  if (!entryEdge) return adjacent;
  const graph = new GameGraph(state.map);
  const required = nodeAcrossEntryEdge(graph, unit.nodeId, entryEdge);
  if (required && adjacent.includes(required)) return [required];
  return adjacent;
}

export function getEnemiesOnNode(state: GameState, unit: UnitState) {
  return Object.values(state.units).filter(
    (u) => u.nodeId === unit.nodeId && u.factionId !== unit.factionId
  );
}

export function getAlliesOnNode(state: GameState, unit: UnitState) {
  return Object.values(state.units).filter(
    (u) =>
      u.nodeId === unit.nodeId &&
      u.factionId === unit.factionId &&
      u.id !== unit.id
  );
}
