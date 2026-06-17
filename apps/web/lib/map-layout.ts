import type { EdgeDef, NodeDef } from "@wargame/shared";

/** Scale positions from centroid so territories and routes have room. */
export const LAYOUT_SPREAD = 2.0;

/** Approximate React Flow node footprint for collision resolution. */
export const TERRITORY_NODE_WIDTH = 112;
export const TERRITORY_NODE_HEIGHT = 110;

export type HandleId = "top" | "right" | "bottom" | "left";

export type SourceHandleId = `${HandleId}-s`;
export type TargetHandleId = `${HandleId}-t`;

export interface EdgeRoute {
  sourceHandle: SourceHandleId;
  targetHandle: TargetHandleId;
  curvature: number;
}

/** Scale node positions from centroid so territories and routes don't overlap. */
export function spreadNodePosition(
  layout: { x: number; y: number },
  nodes: NodeDef[],
  factor = LAYOUT_SPREAD
): { x: number; y: number } {
  if (nodes.length === 0) return layout;

  let cx = 0;
  let cy = 0;
  for (const n of nodes) {
    cx += n.layout.x;
    cy += n.layout.y;
  }
  cx /= nodes.length;
  cy /= nodes.length;

  return {
    x: cx + (layout.x - cx) * factor,
    y: cy + (layout.y - cy) * factor,
  };
}

/** Spread + gentle repulsion so node cards don't stack on shared corridors. */
export function layoutTerritoryPositions(
  nodes: NodeDef[],
  spread = LAYOUT_SPREAD
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    positions.set(n.id, spreadNodePosition(n.layout, nodes, spread));
  }
  resolveOverlaps(positions, TERRITORY_NODE_WIDTH, TERRITORY_NODE_HEIGHT, 32);
  return positions;
}

function resolveOverlaps(
  positions: Map<string, { x: number; y: number }>,
  width: number,
  height: number,
  iterations: number
): void {
  const ids = [...positions.keys()];
  const pad = 28;
  const minX = width + pad;
  const minY = height + pad;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]!;
        const idB = ids[j]!;
        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        const overlapX = minX - Math.abs(a.x - b.x);
        const overlapY = minY - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const dx = a.x - b.x || (i % 2 === 0 ? 1 : -1);
        const dy = a.y - b.y || (j % 2 === 0 ? 1 : -1);
        const dist = Math.hypot(dx, dy) || 1;
        const push = (Math.min(overlapX, overlapY) / 2) * 0.9;
        const nx = (dx / dist) * push;
        const ny = (dy / dist) * push;
        positions.set(idA, { x: a.x + nx, y: a.y + ny });
        positions.set(idB, { x: b.x - nx, y: b.y - ny });
      }
    }
  }
}

function handleSide(
  from: { x: number; y: number },
  to: { x: number; y: number }
): HandleId {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function opposite(side: HandleId): HandleId {
  switch (side) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/** Per-edge handles on territory perimeter + curvature fan for shared hubs. */
export function edgeRouteStyles(
  edges: EdgeDef[],
  positions: Map<string, { x: number; y: number }>
): Map<string, EdgeRoute> {
  const out = new Map<string, EdgeRoute>();
  const bySource = new Map<string, EdgeDef[]>();

  for (const e of edges) {
    const list = bySource.get(e.from) ?? [];
    list.push(e);
    bySource.set(e.from, list);
  }

  for (const e of edges) {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    if (!from || !to) continue;

    const srcSide = handleSide(from, to);
    const tgtSide = opposite(srcSide);

    const siblings = bySource.get(e.from) ?? [e];
    const sorted = [...siblings].sort((a, b) => {
      const pa = positions.get(a.to)!;
      const pb = positions.get(b.to)!;
      return (
        Math.atan2(pa.y - from.y, pa.x - from.x) -
        Math.atan2(pb.y - from.y, pb.x - from.x)
      );
    });
    const idx = sorted.findIndex((s) => s.id === e.id);
    const center = (sorted.length - 1) / 2;
    const curvature = 0.12 + (idx - center) * 0.22;

    out.set(e.id, {
      sourceHandle: `${srcSide}-s`,
      targetHandle: `${tgtSide}-t`,
      curvature,
    });
  }

  return out;
}
