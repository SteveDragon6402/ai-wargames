import type { Command, CombatConfig, GameState, TurnEvent } from "@wargame/shared";
import { GameGraph } from "./graph.js";
import { applyCasualty } from "./combat.js";
import { speedTier } from "./terrain.js";
import { pruneDead } from "./node-utils.js";
import type { ArrivalRecord } from "./movement.js";

export function resolveInterceptFire(
  preMoveState: GameState,
  postMoveState: GameState,
  allCommands: Command[],
  arrivals: ArrivalRecord[],
  graph: GameGraph,
  config: CombatConfig
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const orderMap = new Map<string, Command>();
  for (const c of allCommands) {
    if (c.type !== "abandon_capital" && "unitId" in c) {
      orderMap.set(c.unitId, c);
    }
  }

  const leaving = new Map<
    string,
    { from: string; to: string; speed: import("@wargame/shared").Speed }
  >();

  for (const cmd of allCommands) {
    if (cmd.type === "retreat") {
      const u = preMoveState.units[cmd.unitId];
      if (u) leaving.set(cmd.unitId, { from: u.nodeId, to: cmd.targetNodeId, speed: cmd.speed });
    }
    if (cmd.type === "move") {
      const u = preMoveState.units[cmd.unitId];
      if (u && u.nodeId !== cmd.targetNodeId) {
        leaving.set(cmd.unitId, { from: u.nodeId, to: cmd.targetNodeId, speed: cmd.speed });
      }
    }
  }

  const arrivalByUnit = new Map(arrivals.map((a) => [a.unitId, a]));
  let units = { ...postMoveState.units };
  const intercepted = new Set<string>();

  for (const [targetId, leave] of leaving) {
    if (intercepted.has(targetId)) continue;
    const target = preMoveState.units[targetId];
    if (!target) continue;

    const enemiesOnNode = Object.values(preMoveState.units).filter(
      (u) => u.nodeId === leave.from && u.factionId !== target.factionId
    );

    for (const enemy of enemiesOnNode) {
      const enemyCmd = orderMap.get(enemy.id);
      let enemySpeed = speedTier("normal");
      let enemyAggressive = false;
      let enemyAttacking = false;

      if (enemyCmd?.type === "move") {
        enemySpeed = speedTier(enemyCmd.speed);
        enemyAggressive = enemyCmd.stance === "aggressive";
        enemyAttacking =
          enemyCmd.intention === "attack" || enemyCmd.intention === "assault";
        const arr = arrivalByUnit.get(enemy.id);
        if (arr && arr.to === leave.to && arr.from === leave.from) {
          // enemy pursuing to same destination
        } else if (enemy.nodeId === leave.from && enemyCmd.targetNodeId === leave.to) {
          // enemy on node moving to leaver's destination
        } else if (!(enemy.nodeId === leave.from)) {
          continue;
        }
      } else if (enemyCmd?.type === "attack") {
        enemySpeed = speedTier("normal");
        enemyAggressive = enemyCmd.stance === "aggressive";
        enemyAttacking =
          enemyCmd.intention === "attack" || enemyCmd.intention === "assault";
        if (enemy.nodeId !== leave.from) continue;
      } else {
        continue;
      }

      const leaverSpeed = speedTier(leave.speed);
      if (enemySpeed <= leaverSpeed) continue;
      if (!enemyAggressive || !enemyAttacking) continue;

      const casualties: Record<string, number> = {};
      applyCasualty(units, targetId, config.casualtyRate * 0.35, casualties);
      intercepted.add(targetId);
      events.push({
        type: "intercept",
        nodeId: leave.from,
        attackerId: enemy.id,
        targetId,
        casualties,
      });
      break;
    }
  }

  return { state: { ...postMoveState, units: pruneDead(units) }, events };
}
