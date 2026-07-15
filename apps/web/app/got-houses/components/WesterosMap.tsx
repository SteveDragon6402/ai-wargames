"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { HOLDS, REGION_COLORS } from "../data/holds";
import type { GameState, GameAction, Army, MoveOrder } from "../types";
import HoldNode, { type HoldNodeData } from "./HoldNode";

// Scale factors: (x: 0–80) → rfX, (y: 0–100, north=up) → rfY
const SCALE_X = 14;
const SCALE_Y = 11;

function toRf(x: number, y: number) {
  return { x: x * SCALE_X, y: (100 - y) * SCALE_Y };
}

const nodeTypes: NodeTypes = { holdNode: HoldNode as never };

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function buildOrderEdges(
  northOrders: MoveOrder[],
  westOrders: MoveOrder[],
  northSubmitted: boolean,
  westSubmitted: boolean
): Edge[] {
  const edges: Edge[] = [];

  const addOrders = (orders: MoveOrder[], color: string, submitted: boolean) => {
    orders.forEach((order) => {
      edges.push({
        id: `order-${order.armyId}`,
        source: order.fromHoldId,
        target: order.toHoldId,
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: submitted ? "none" : "6 3",
        },
        animated: !submitted,
        type: "straight",
        zIndex: 10,
      });
    });
  };

  // Only show own faction's orders during planning (hidden-info model)
  // In this client-only scaffold both are visible for admin use
  addOrders(northOrders, "#3a6ea8", northSubmitted);
  addOrders(westOrders, "#b03030", westSubmitted);

  return edges;
}

function MapInner({ state, dispatch }: Props) {
  const { fitView } = useReactFlow();

  const armiesByHold = useMemo(() => {
    const map = new Map<string, Army[]>();
    state.armies.forEach((army) => {
      const list = map.get(army.holdId) ?? [];
      list.push(army);
      map.set(army.holdId, list);
    });
    return map;
  }, [state.armies]);

  const handleHoldClick = useCallback(
    (holdId: string) => {
      if (state.moveMode.active) {
        if (state.moveMode.validTargets.includes(holdId)) {
          dispatch({ type: "QUEUE_MOVE", toHoldId: holdId });
        } else {
          // Click on a non-target hold cancels move mode
          dispatch({ type: "CANCEL_MOVE" });
          dispatch({ type: "SELECT_HOLD", holdId });
        }
      } else {
        dispatch({ type: "SELECT_HOLD", holdId });
      }
    },
    [state.moveMode, dispatch]
  );

  // Build nodes
  const nodes: Node[] = useMemo(() => {
    return HOLDS.map((hold) => {
      const pos = toRf(hold.x, hold.y);
      const armies = armiesByHold.get(hold.id) ?? [];
      const isSelected = state.selectedHoldId === hold.id;
      const isMoveTarget =
        state.moveMode.active && state.moveMode.validTargets.includes(hold.id);
      const isInMoveMode = state.moveMode.active;

      const data: HoldNodeData = {
        id: hold.id,
        label: hold.name,
        region: hold.region,
        armies,
        isSelected,
        isMoveTarget,
        isInMoveMode,
        onClick: handleHoldClick,
      };

      return {
        id: hold.id,
        type: "holdNode",
        position: pos,
        data,
        draggable: false,
        selectable: false,
      };
    });
  }, [
    armiesByHold,
    state.selectedHoldId,
    state.moveMode,
    handleHoldClick,
  ]);

  // Build road edges (de-duplicate: only emit A→B not also B→A)
  const roadEdges: Edge[] = useMemo(() => {
    const seen = new Set<string>();
    const edges: Edge[] = [];
    HOLDS.forEach((hold) => {
      hold.links.forEach((targetId) => {
        const key = [hold.id, targetId].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        edges.push({
          id: `road-${key}`,
          source: hold.id,
          target: targetId,
          style: { stroke: "#2a2a2a", strokeWidth: 1 },
          type: "straight",
          selectable: false,
          focusable: false,
          zIndex: 1,
        });
      });
    });
    return edges;
  }, []);

  const orderEdges = useMemo(
    () =>
      buildOrderEdges(
        state.north.orders,
        state.westerlands.orders,
        state.north.submitted,
        state.westerlands.submitted
      ),
    [state.north, state.westerlands]
  );

  const edges = useMemo(
    () => [...roadEdges, ...orderEdges],
    [roadEdges, orderEdges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.2}
      maxZoom={3}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={true}
      zoomOnScroll={true}
      style={{ background: "#080808" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={40}
        size={1}
        color="#1a1a1a"
      />
      <Controls
        style={{
          background: "#0a0a0a",
          border: "1px solid #1e1e1e",
        }}
      />
      <MiniMap
        style={{
          background: "#0a0a0a",
          border: "1px solid #1e1e1e",
        }}
        nodeColor={(node) => {
          const region = (node.data as HoldNodeData).region as string;
          return REGION_COLORS[region] ?? "#111";
        }}
        maskColor="rgba(0,0,0,0.7)"
      />

      {/* Legend */}
      <Panel position="top-left">
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #1e1e1e",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 8,
              color: "#333",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 2,
            }}
          >
            Regions
          </div>
          {Object.entries(REGION_COLORS).map(([region, color]) => (
            <div key={region} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: color,
                  border: "1px solid #333",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  color: "#444",
                  textTransform: "capitalize",
                  letterSpacing: "0.06em",
                }}
              >
                {region}
              </span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #1a1a1a", marginTop: 4, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a6ea8" }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  color: "#444",
                }}
              >
                Northern army
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{ width: 8, height: 8, borderRadius: "50%", background: "#b03030" }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 8,
                  color: "#444",
                }}
              >
                Westerlands army
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export default function WesterosMap({ state, dispatch }: Props) {
  return (
    <ReactFlowProvider>
      <MapInner state={state} dispatch={dispatch} />
    </ReactFlowProvider>
  );
}
