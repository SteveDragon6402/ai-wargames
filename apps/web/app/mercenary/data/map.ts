import type { SpecialTypeId } from "./wiki";

export const NODE_IDS = [
  "millcross",
  "harrow",
  "blackwood",
  "high-ash",
  "reedwaste",
  "greylake",
  "pikeham",
  "fenwatch",
  "southfen",
  "kingsway",
] as const;

export type NodeId = (typeof NODE_IDS)[number];
export type KingdomId = "holt" | "ashmarch" | "mere";
export type NodeKind = "capital" | "village" | "wild";

export interface MapNode {
  id: NodeId;
  name: string;
  kind: NodeKind;
  kingdom: KingdomId;
  ground: string;
  x: number;
  y: number;
}

export const KINGDOM_NAME: Record<KingdomId, string> = {
  holt: "Holt",
  ashmarch: "Ashmarch",
  mere: "The Mere",
};

export const KINGDOM_SPECIAL: Record<KingdomId, SpecialTypeId> = {
  holt: "light_cavalry",
  ashmarch: "berserkers",
  mere: "heavy_cavalry",
};

export const NODES: Record<NodeId, MapNode> = {
  millcross: {
    id: "millcross",
    name: "Millcross",
    kind: "village",
    kingdom: "holt",
    ground: "A farming village. Lanes, hedges, and yards. Poor ground for horse.",
    x: 18,
    y: 48,
  },
  harrow: {
    id: "harrow",
    name: "Harrow",
    kind: "capital",
    kingdom: "holt",
    ground: "Holt's capital. Stone houses, a market, and a gate. Streets favour foot.",
    x: 18,
    y: 22,
  },
  blackwood: {
    id: "blackwood",
    name: "Blackwood",
    kind: "wild",
    kingdom: "holt",
    ground: "Thick forest. Short sight, bad footing for cavalry, kind to men who know the paths.",
    x: 40,
    y: 42,
  },
  "high-ash": {
    id: "high-ash",
    name: "High Ash",
    kind: "capital",
    kingdom: "ashmarch",
    ground: "Ashmarch's capital, high and windy. Open slopes outside a timber hall.",
    x: 72,
    y: 14,
  },
  reedwaste: {
    id: "reedwaste",
    name: "Reedwaste",
    kind: "wild",
    kingdom: "ashmarch",
    ground: "Wet reed country. Slow going, and no place for a heavy charge.",
    x: 58,
    y: 24,
  },
  greylake: {
    id: "greylake",
    name: "Greylake",
    kind: "capital",
    kingdom: "mere",
    ground: "The Mere's capital on the lake shore. Open ground outside the walls.",
    x: 78,
    y: 58,
  },
  pikeham: {
    id: "pikeham",
    name: "Pikeham",
    kind: "village",
    kingdom: "mere",
    ground: "A lakeside village. Ditches and fish-sheds break up a charge.",
    x: 62,
    y: 70,
  },
  fenwatch: {
    id: "fenwatch",
    name: "Fenwatch",
    kind: "village",
    kingdom: "mere",
    ground: "A watch village on the fen edge. Soft ground, long sight.",
    x: 88,
    y: 74,
  },
  southfen: {
    id: "southfen",
    name: "Southfen",
    kind: "wild",
    kingdom: "mere",
    ground: "Open fen. Nowhere to hide, and heavy horse can run.",
    x: 70,
    y: 88,
  },
  kingsway: {
    id: "kingsway",
    name: "Kingsway",
    kind: "wild",
    kingdom: "mere",
    ground: "The old road between the kingdoms. Open, travelled, and watched.",
    x: 42,
    y: 72,
  },
};

export const EDGES: [NodeId, NodeId][] = [
  ["millcross", "harrow"],
  ["millcross", "blackwood"],
  ["harrow", "kingsway"],
  ["blackwood", "reedwaste"],
  ["reedwaste", "high-ash"],
  ["kingsway", "pikeham"],
  ["pikeham", "greylake"],
  ["greylake", "fenwatch"],
  ["greylake", "southfen"],
  ["southfen", "kingsway"],
];

export function neighbors(id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  for (const [a, b] of EDGES) {
    if (a === id) out.push(b);
    if (b === id) out.push(a);
  }
  return out;
}

export function isSettlement(id: NodeId): boolean {
  const kind = NODES[id].kind;
  return kind === "village" || kind === "capital";
}
