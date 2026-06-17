import type { FactionId, GameState, UnitState } from "@wargame/shared";
import type { GameGraph } from "./graph.js";

export function unitsAtNode(state: GameState, nodeId: string): UnitState[] {
  return Object.values(state.units).filter((u) => u.nodeId === nodeId);
}

export function hasEnemyOnNode(
  state: GameState,
  nodeId: string,
  factionId: FactionId
): boolean {
  return unitsAtNode(state, nodeId).some((u) => u.factionId !== factionId);
}

export function isAloneOnNode(state: GameState, unit: UnitState): boolean {
  const onNode = unitsAtNode(state, unit.nodeId);
  return onNode.every((u) => u.factionId === unit.factionId);
}

export function isContested(state: GameState, nodeId: string): boolean {
  const units = unitsAtNode(state, nodeId);
  if (units.length < 2) return false;
  const factions = new Set(units.map((u) => u.factionId));
  return factions.size > 1;
}

export function bucketByNode(state: GameState): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const u of Object.values(state.units)) {
    const list = m.get(u.nodeId) ?? [];
    list.push(u.id);
    m.set(u.nodeId, list);
  }
  return m;
}

export function syncEngagements(state: GameState): GameState {
  const engagements = { ...state.engagements };
  const contested = new Set<string>();

  for (const node of state.map.nodes) {
    if (isContested(state, node.id)) {
      contested.add(node.id);
      const prev = engagements[node.id];
      engagements[node.id] = {
        nodeId: node.id,
        disengageVotes: prev?.disengageVotes ?? {},
        entryEdgeByFaction: prev?.entryEdgeByFaction ?? {},
      };
    } else {
      delete engagements[node.id];
    }
  }

  const units = { ...state.units };
  for (const u of Object.values(units)) {
    units[u.id] = { ...u, engaged: contested.has(u.nodeId) };
  }

  return { ...state, engagements, units };
}

export function recordEntryEdge(
  state: GameState,
  nodeId: string,
  factionId: FactionId,
  edgeId: string
): GameState {
  const engagements = { ...state.engagements };
  const eng = engagements[nodeId] ?? {
    nodeId,
    disengageVotes: {},
    entryEdgeByFaction: {},
  };
  eng.entryEdgeByFaction = { ...eng.entryEdgeByFaction, [factionId]: edgeId };
  engagements[nodeId] = eng;
  return { ...state, engagements };
}

export function nodeAcrossEntryEdge(
  graph: GameGraph,
  nodeId: string,
  entryEdgeId: string
): string | null {
  const edge = graph.getEdge(entryEdgeId);
  if (!edge) return null;
  return edge.from === nodeId ? edge.to : edge.from;
}

export function clearArrivedFlags(state: GameState): GameState {
  const units = { ...state.units };
  for (const id of Object.keys(units)) {
    const u = units[id]!;
    if (u.arrivedThisTurn || u.reinforced) {
      const { arrivedThisTurn: _a, reinforced: _r, ...rest } = u;
      units[id] = rest as UnitState;
    }
  }
  return { ...state, units };
}

export function pruneDead(
  units: Record<string, UnitState>
): Record<string, UnitState> {
  const out: Record<string, UnitState> = {};
  for (const [id, u] of Object.entries(units)) {
    if (u.strength > 0.05) out[id] = u;
  }
  return out;
}
