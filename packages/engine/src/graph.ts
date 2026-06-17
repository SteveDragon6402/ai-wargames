import type { EdgeDef, MapDef, NodeDef } from "@wargame/shared";

export class GameGraph {
  readonly nodes: Record<string, NodeDef>;
  readonly edges: Record<string, EdgeDef>;
  private readonly adjacency: Record<string, string[]>;
  private readonly edgeBetween: Map<string, string>;

  constructor(map: MapDef) {
    this.nodes = Object.fromEntries(map.nodes.map((n) => [n.id, n]));
    this.edges = Object.fromEntries(map.edges.map((e) => [e.id, e]));
    this.adjacency = {};
    this.edgeBetween = new Map();

    for (const node of map.nodes) {
      this.adjacency[node.id] = [];
    }
    for (const edge of map.edges) {
      this.adjacency[edge.from]?.push(edge.id);
      this.adjacency[edge.to]?.push(edge.id);
      const key = edgeKey(edge.from, edge.to);
      this.edgeBetween.set(key, edge.id);
    }
  }

  getNode(nodeId: string): NodeDef | undefined {
    return this.nodes[nodeId];
  }

  getEdge(edgeId: string): EdgeDef | undefined {
    return this.edges[edgeId];
  }

  neighbors(nodeId: string): string[] {
    const edgeIds = this.adjacency[nodeId] ?? [];
    const result: string[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges[edgeId];
      if (!edge) continue;
      result.push(edge.from === nodeId ? edge.to : edge.from);
    }
    return result;
  }

  isAdjacent(from: string, to: string): boolean {
    return this.neighbors(from).includes(to);
  }

  findEdge(from: string, to: string): EdgeDef | undefined {
    const id = this.edgeBetween.get(edgeKey(from, to));
    return id ? this.edges[id] : undefined;
  }
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
