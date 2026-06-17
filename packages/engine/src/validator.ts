import type {
  Command,
  FactionId,
  GameState,
  UnitState,
} from "@wargame/shared";
import { GameGraph } from "./graph.js";
import { isAloneOnNode, isContested, nodeAcrossEntryEdge } from "./node-utils.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function validateStanceIntention(
  stance: import("@wargame/shared").Stance,
  intention: string,
  context: "move" | "attack"
): void {
  if (intention === "assault" && stance !== "aggressive") {
    throw new ValidationError("Assault requires aggressive stance");
  }
  if (context === "move" && intention === "attack" && stance === "defensive") {
    throw new ValidationError("Cannot attack while in defensive stance on move");
  }
}

export function validateCommand(
  state: GameState,
  graph: GameGraph,
  factionId: FactionId,
  command: Command
): void {
  if (command.type === "abandon_capital") {
    if (factionId !== "rohan") throw new ValidationError("Only Rohan may abandon capital");
    if (state.meta.abandonCapitalUsed.rohan) {
      throw new ValidationError("Abandon capital already used");
    }
    return;
  }

  const unit = state.units[command.unitId];
  if (!unit) throw new ValidationError("Unit not found");
  if (unit.factionId !== factionId) {
    throw new ValidationError("Cannot command enemy unit");
  }

  const contested = isContested(state, unit.nodeId);
  const alone = isAloneOnNode(state, unit);

  switch (command.type) {
    case "move":
      if (contested && unit.engaged) {
        throw new ValidationError("Cannot move while engaged; use retreat or disengage");
      }
      if (!graph.isAdjacent(unit.nodeId, command.targetNodeId)) {
        throw new ValidationError("Target node is not adjacent");
      }
      validateStanceIntention(command.stance, command.intention, "move");
      if (
        unit.arrivedThisTurn &&
        command.intention === "assault" &&
        command.stance !== "aggressive"
      ) {
        throw new ValidationError(
          "Cannot assault after arriving unless aggressive"
        );
      }
      break;
    case "dig_in":
      if (!alone) throw new ValidationError("Dig in only when alone on a node");
      if (command.intention === "deny" && unit.dugIn < 0.2) {
        throw new ValidationError("Deny requires dug-in troops");
      }
      break;
    case "attack":
      if (!contested) throw new ValidationError("Attack only when enemy is present");
      if (command.targetUnitId) validateTargetEnemy(state, unit, command.targetUnitId);
      validateStanceIntention(command.stance, command.intention, "attack");
      if (command.intention === "breakthrough") {
        if (!command.breakthroughTargetNodeId) {
          throw new ValidationError("Breakthrough requires a destination node");
        }
        if (!graph.isAdjacent(unit.nodeId, command.breakthroughTargetNodeId)) {
          throw new ValidationError("Breakthrough destination must be adjacent");
        }
      }
      break;
    case "cover":
      if (!contested) throw new ValidationError("Cover only when enemy is present");
      validateFriendly(state, unit, command.coverUnitId);
      break;
    case "retreat": {
      if (!contested) throw new ValidationError("Retreat only when enemy is present");
      if (!graph.isAdjacent(unit.nodeId, command.targetNodeId)) {
        throw new ValidationError("Retreat target must be adjacent");
      }
      const eng = state.engagements[unit.nodeId];
      const entryEdge = eng?.entryEdgeByFaction?.[unit.factionId];
      if (entryEdge) {
        const required = nodeAcrossEntryEdge(graph, unit.nodeId, entryEdge);
        if (required && command.targetNodeId !== required) {
          throw new ValidationError("Retreat must withdraw along your entry route");
        }
      }
      break;
    }
    case "disengage":
      if (!contested) throw new ValidationError("Disengage only when enemy is present");
      break;
  }
}

function validateTargetEnemy(
  state: GameState,
  unit: UnitState,
  targetId: string
): void {
  const target = state.units[targetId];
  if (!target || target.factionId === unit.factionId) {
    throw new ValidationError("Invalid attack target");
  }
  if (target.nodeId !== unit.nodeId) {
    throw new ValidationError("Attack target must be on same node");
  }
}

function validateFriendly(
  state: GameState,
  unit: UnitState,
  allyId: string
): void {
  const ally = state.units[allyId];
  if (!ally || ally.factionId !== unit.factionId) {
    throw new ValidationError("Invalid cover target");
  }
  if (ally.nodeId !== unit.nodeId) {
    throw new ValidationError("Cover target must be on same node");
  }
}

export function validateOrders(
  state: GameState,
  graph: GameGraph,
  factionId: FactionId,
  orders: Command[]
): void {
  const perUnit = new Set<string>();
  for (const cmd of orders) {
    validateCommand(state, graph, factionId, cmd);
    if ("unitId" in cmd) {
      if (perUnit.has(cmd.unitId)) {
        throw new ValidationError("Duplicate order for unit");
      }
      perUnit.add(cmd.unitId);
    }
  }
}

export function enrichMoveCommand(
  graph: GameGraph,
  state: GameState,
  cmd: import("@wargame/shared").MoveCommand
): import("@wargame/shared").MoveCommand {
  const unit = state.units[cmd.unitId]!;
  const edge = graph.findEdge(unit.nodeId, cmd.targetNodeId);
  return { ...cmd, edgeId: edge?.id };
}

export function getDeniedNodes(
  state: GameState,
  commands: Command[],
  dugInThreshold: number
): Set<string> {
  const denied = new Set<string>();
  for (const cmd of commands) {
    if (cmd.type !== "dig_in" || cmd.intention !== "deny") continue;
    const u = state.units[cmd.unitId];
    if (u && u.dugIn >= dugInThreshold) {
      denied.add(u.nodeId);
    }
  }
  return denied;
}
