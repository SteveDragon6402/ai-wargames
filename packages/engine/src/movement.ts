import type {
  CombatConfig,
  FactionId,
  GameState,
  MoveCommand,
  Speed,
  TurnEvent,
} from "@wargame/shared";
import { GameGraph } from "./graph.js";
import { speedDefenseBonus, speedTier } from "./terrain.js";
import { isContested, recordEntryEdge } from "./node-utils.js";

export interface ArrivalRecord {
  unitId: string;
  from: string;
  to: string;
  speed: Speed;
  factionId: FactionId;
}

export interface MovementResult {
  state: GameState;
  events: TurnEvent[];
  arrivals: ArrivalRecord[];
  speedDefenseByUnit: Map<string, number>;
}

export function resolveMovement(
  state: GameState,
  moveOrders: MoveCommand[],
  graph: GameGraph,
  config: CombatConfig,
  deniedNodes: Set<string>
): MovementResult {
  const events: TurnEvent[] = [];
  let next = { ...state, units: { ...state.units } };
  const allArrivals: ArrivalRecord[] = [];
  const speedDefenseByUnit = new Map<string, number>();

  const byTier: Record<number, MoveCommand[]> = { 1: [], 2: [], 3: [] };
  for (const o of moveOrders) {
    byTier[speedTier(o.speed)].push(o);
  }

  for (const tier of [3, 2, 1]) {
    const orders = byTier[tier];
    const pending: Array<{
      unitId: string;
      from: string;
      to: string;
      speed: Speed;
      factionId: FactionId;
    }> = [];

    for (const order of orders) {
      const unit = next.units[order.unitId];
      if (!unit) continue;
      if (isContested(next, unit.nodeId) && unit.engaged) continue;
      if (deniedNodes.has(order.targetNodeId)) continue;
      if (!graph.isAdjacent(unit.nodeId, order.targetNodeId)) continue;

      pending.push({
        unitId: order.unitId,
        from: unit.nodeId,
        to: order.targetNodeId,
        speed: order.speed,
        factionId: unit.factionId,
      });
    }

    const swaps = detectSwaps(pending);
    const tierArrivals = new Map<string, typeof pending>();

    for (const p of pending) {
      const list = tierArrivals.get(p.to) ?? [];
      list.push(p);
      tierArrivals.set(p.to, list);
    }

    for (const [dest, group] of tierArrivals) {
      const byFaction = new Map<FactionId, typeof group>();
      for (const p of group) {
        const list = byFaction.get(p.factionId) ?? [];
        list.push(p);
        byFaction.set(p.factionId, list);
      }
      if (byFaction.size < 2) continue;

      const factions = [...byFaction.keys()];
      let fastest: FactionId = factions[0]!;
      let fastestTier = 0;
      for (const f of factions) {
        const maxTier = Math.max(
          ...byFaction.get(f)!.map((p) => speedTier(p.speed))
        );
        if (maxTier > fastestTier) {
          fastestTier = maxTier;
          fastest = f;
        }
      }

      for (const f of factions) {
        if (f === fastest) {
          for (const p of byFaction.get(f)!) {
            speedDefenseByUnit.set(p.unitId, 1 + config.speedDefenseBonus);
          }
        } else {
          for (const p of byFaction.get(f)!) {
            const fastestSpeed = byFaction
              .get(fastest)!
              .find((x) => speedTier(x.speed) === fastestTier)?.speed ?? "normal";
            speedDefenseByUnit.set(
              p.unitId,
              speedDefenseBonus(fastestSpeed, p.speed, config.speedDefenseBonus)
            );
          }
        }
      }
    }

    for (const p of pending) {
      if (swaps.has(p.unitId)) {
        applyMove(next, p, events, graph, allArrivals);
        continue;
      }
      applyMove(next, p, events, graph, allArrivals);
    }
  }

  return { state: next, events, arrivals: allArrivals, speedDefenseByUnit };
}

function applyMove(
  state: GameState,
  p: { unitId: string; from: string; to: string; speed: Speed; factionId: FactionId },
  events: TurnEvent[],
  graph: GameGraph,
  allArrivals: ArrivalRecord[]
): void {
  const u = state.units[p.unitId];
  if (!u) return;

  state.units[p.unitId] = {
    ...u,
    nodeId: p.to,
    dugIn: 0,
    tiredness: Math.min(1, u.tiredness + (p.speed === "forced" ? 0.08 : 0.03)),
    arrivedThisTurn: true,
  };
  events.push({ type: "move", unitId: p.unitId, from: p.from, to: p.to });
  allArrivals.push({
    unitId: p.unitId,
    from: p.from,
    to: p.to,
    speed: p.speed,
    factionId: p.factionId,
  });

  const edge = graph.findEdge(p.from, p.to);
  if (edge) {
    const updated = recordEntryEdge(state, p.to, p.factionId, edge.id);
    state.engagements = updated.engagements;

    // Flanking detection: if the destination is already contested and the arriving
    // faction's edge matches the enemy faction's recorded entry edge, the enemy is flanked.
    const eng = state.engagements[p.to];
    if (eng) {
      const factions = Object.keys(eng.entryEdgeByFaction) as FactionId[];
      for (const otherFaction of factions) {
        if (otherFaction === p.factionId) continue;
        const otherEdgeId = eng.entryEdgeByFaction[otherFaction];
        if (otherEdgeId && otherEdgeId === edge.id) {
          // Arriving faction used the same edge as the enemy — that faction is flanked
          state.engagements = {
            ...state.engagements,
            [p.to]: { ...eng, flankedFaction: otherFaction },
          };
          break;
        }
      }
    }
  }
}

function detectSwaps(
  pending: Array<{ unitId: string; from: string; to: string }>
): Set<string> {
  const swaps = new Set<string>();
  const map = new Map(pending.map((p) => [p.unitId, p]));
  for (const p of pending) {
    const other = [...map.values()].find(
      (o) => o.unitId !== p.unitId && o.from === p.to && o.to === p.from
    );
    if (other) {
      swaps.add(p.unitId);
      swaps.add(other.unitId);
    }
  }
  return swaps;
}

export function extractMoveOrders(
  commands: import("@wargame/shared").Command[]
): MoveCommand[] {
  return commands.filter((c): c is MoveCommand => c.type === "move");
}
