"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  MarkerType,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef } from "react";
import type { GameState } from "@wargame/shared";
import { isContested } from "@wargame/engine/node-utils";
import { edgeStyle } from "@/lib/map-display";
import { edgeRouteStyles, layoutTerritoryPositions } from "@/lib/map-layout";
import type { MapPickMode } from "@/lib/order-draft";
import { TerritoryNode, type TerritoryHighlight } from "./map/TerritoryNode";
import { RouteEdge } from "./map/RouteEdge";
import { BackgroundVariant } from "@xyflow/react";

const nodeTypes = { territory: TerritoryNode };
const edgeTypes = { route: RouteEdge };

interface MapViewProps {
  state: GameState;
  myFaction: string | undefined;
  selectedUnitId: string | null;
  validNodeIds: string[];
  pickMode: MapPickMode;
  pickableUnitIds: string[];
  onSelectUnit: (unitId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

function nodeHighlight(
  nodeId: string,
  unitNodeId: string | undefined,
  pickMode: MapPickMode,
  validSet: Set<string>
): TerritoryHighlight {
  if (nodeId === unitNodeId) return "current";
  if (pickMode === "destination" || pickMode === "breakthrough") {
    return validSet.has(nodeId) ? "valid" : "invalid";
  }
  // enemy/ally picking is handled inline in the panel — don't dim other nodes
  return "none";
}

export function MapView({
  state,
  myFaction,
  selectedUnitId,
  validNodeIds,
  pickMode,
  pickableUnitIds,
  onSelectUnit,
  onSelectNode,
}: MapViewProps) {
  const fitOnce = useRef(false);
  const validSet = useMemo(() => new Set(validNodeIds), [validNodeIds]);
  const pickableSet = useMemo(() => new Set(pickableUnitIds), [pickableUnitIds]);

  const selectedUnit = selectedUnitId ? state.units[selectedUnitId] : null;
  const unitNodeId = selectedUnit?.nodeId;

  const unitsByNode = useMemo(() => {
    const m = new Map<string, (typeof state.units)[string][]>();
    for (const u of Object.values(state.units)) {
      const list = m.get(u.nodeId) ?? [];
      list.push(u);
      m.set(u.nodeId, list);
    }
    return m;
  }, [state.units]);

  const onSelectUnitStable = useCallback(
    (id: string) => onSelectUnit(id),
    [onSelectUnit]
  );

  const positions = useMemo(
    () => layoutTerritoryPositions(state.map.nodes),
    [state.map.nodes]
  );

  const routes = useMemo(
    () => edgeRouteStyles(state.map.edges, positions),
    [state.map.edges, positions]
  );

  const nodes: Node[] = useMemo(
    () =>
      state.map.nodes.map((n) => {
        const units = unitsByNode.get(n.id) ?? [];
        const contested = isContested(state, n.id);
        const isCapital =
          state.meta.capitalNodes.rohan === n.id ||
          state.meta.capitalNodes.isengard === n.id;

        return {
          id: n.id,
          type: "territory",
          position: positions.get(n.id) ?? n.layout,
          data: {
            name: n.name,
            terrainTags: n.tags,
            units,
            myFaction,
            selectedUnitId,
            highlight: nodeHighlight(n.id, unitNodeId, pickMode, validSet),
            isCapital,
            contested,
            pickableUnitIds: pickableSet,
            onSelectUnit: onSelectUnitStable,
          },
        };
      }),
    [
      state,
      positions,
      unitsByNode,
      myFaction,
      selectedUnitId,
      pickMode,
      validSet,
      pickableSet,
      unitNodeId,
      onSelectUnitStable,
    ]
  );

  const edges: Edge[] = useMemo(
    () =>
      state.map.edges.map((e) => {
        const style = edgeStyle(e.tags);
        const route = routes.get(e.id);
        return {
          id: e.id,
          type: "route",
          source: e.from,
          target: e.to,
          sourceHandle: route?.sourceHandle,
          targetHandle: route?.targetHandle,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: style.stroke,
            width: 16,
            height: 16,
          },
          style: {
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            strokeDasharray: style.strokeDasharray,
          },
          data: {
            label: style.label,
            curvature: route?.curvature,
            routeType: e.tags.includes("river")
              ? "river"
              : e.tags.includes("road")
                ? "road"
                : "rugged",
          },
          animated: e.tags.includes("road"),
        };
      }),
    [state.map.edges, routes]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    if (fitOnce.current) return;
    fitOnce.current = true;
    void instance.fitView({ padding: 0.32, duration: 200 });
  }, []);

  return (
    <section className="game-map rounded-lg border border-[#3f3a33] shadow-inner">
      {pickMode !== "none" && (
        <p className="pick-hint">
          {pickMode === "destination" && "Click a highlighted territory to move or retreat."}
          {pickMode === "enemy" && "Click an enemy unit to attack."}
          {pickMode === "ally" && "Click an ally to cover."}
          {pickMode === "breakthrough" && "Click adjacent territory for breakthrough."}
        </p>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Lines} color="#2a2218" gap={40} />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border-slate-700 !bg-slate-900/95 !shadow-lg [&>button]:!border-slate-600 [&>button]:!bg-slate-800 [&>button]:!fill-slate-200"
        />
        <MiniMap
          nodeColor={(n) => {
            const nd = n.data as { highlight?: TerritoryHighlight; units?: { factionId: string }[] };
            const h = nd?.highlight;
            if (h === "valid") return "#d97706";
            if (h === "current") return "#64748b";
            if (h === "invalid") return "#1c1917";
            const u = nd?.units;
            if (u && u.length > 0) {
              return u[0]!.factionId === "rohan" ? "#065f46" : "#7f1d1d";
            }
            return "#292524";
          }}
          maskColor="rgba(20 17 13 / 0.8)"
          className="!rounded-md"
          pannable
          zoomable
        />
      </ReactFlow>
    </section>
  );
}
