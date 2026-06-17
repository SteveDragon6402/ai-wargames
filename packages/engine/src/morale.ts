import type { CombatConfig, FactionId, GameState, TurnEvent } from "@wargame/shared";
import { GameGraph } from "./graph.js";
import { dropMorale, bumpMorale } from "./combat.js";
import { pruneDead, unitsAtNode } from "./node-utils.js";

export function applyMoraleAndRout(
  state: GameState,
  graph: GameGraph,
  config: CombatConfig
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const units = { ...state.units };

  for (const u of Object.values({ ...units })) {
    if (u.morale > config.routThreshold) continue;

    const enemies = unitsAtNode({ ...state, units }, u.nodeId).filter(
      (x) => x.factionId !== u.factionId
    );
    if (enemies.length === 0) continue;

    const neighbors = graph.neighbors(u.nodeId);
    const friendly = neighbors.find((nId) =>
      unitsAtNode({ ...state, units }, nId).some((x) => x.factionId === u.factionId)
    );

    dropMorale(units, u.id, config.morale.rout);
    events.push({
      type: "morale_change",
      unitId: u.id,
      delta: config.morale.rout,
      newMorale: units[u.id]?.morale ?? 0,
    });

    if (units[u.id] && units[u.id]!.morale <= config.routThreshold) {
      if (friendly) {
        units[u.id] = {
          ...units[u.id]!,
          nodeId: friendly,
          engaged: false,
          dugIn: 0,
          strength: Math.max(0.1, units[u.id]!.strength - 0.2),
        };
        events.push({ type: "rout", unitId: u.id, from: u.nodeId, to: friendly });
      } else {
        delete units[u.id];
        events.push({ type: "rout", unitId: u.id, from: u.nodeId, to: null });
      }
    }
  }

  return { state: { ...state, units: pruneDead(units) }, events };
}

export function fulfillIntention(
  state: GameState,
  unitId: string,
  intention: string,
  config: CombatConfig
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const units = { ...state.units };
  const u = units[unitId];
  if (!u) return { state, events };

  switch (intention) {
    case "raid":
      dropMorale(units, unitId, -5);
      break;
    case "breakthrough":
      units[unitId] = { ...u, dugIn: Math.min(1, u.dugIn + 0.1) };
      break;
    case "withdraw":
      bumpMorale(units, unitId, config.morale.win);
      break;
    default:
      break;
  }

  events.push({
    type: "intention_achieved",
    unitId,
    intention: intention as never,
  });

  return { state: { ...state, units }, events };
}
