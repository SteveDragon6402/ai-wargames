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
import { isSeaCrossing } from "../data/pathways";
import { REGION_TRAITS } from "../data/regions";
import { REGIONS } from "../types";
import type {
  GameState,
  GameAction,
  Army,
  Faction,
  MoveOrder,
} from "../types";
import { homeFactionForRegion } from "../data/castles";
import { holdSpineColor, isGarrisonable } from "../lib/hold-runtime";
import { effectiveCastleSeed } from "../lib/raze";
import { headcountOf, minimumSiegeForce } from "../lib/siege";
import HoldNode, {
  type GarrisonBand,
  type HoldNodeData,
} from "./HoldNode";

// Scale factors: (x: 0–80) → rfX, (y: 0–100, north=up) → rfY
const SCALE_X = 32;
const SCALE_Y = 28;

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
  westSubmitted: boolean,
  /** Which side's plans this viewer is allowed to see. */
  visibleTo: Faction | "both"
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

  // Marching orders are secret. Both sides are drawn only for a hot-seat admin
  // running the board; a real player sees their own plans and nothing else.
  if (visibleTo === "both" || visibleTo === "north") {
    addOrders(northOrders, "#3a6ea8", northSubmitted);
  }
  if (visibleTo === "both" || visibleTo === "westerlands") {
    addOrders(westOrders, "#b03030", westSubmitted);
  }

  return edges;
}

function MapInner({ state, dispatch }: Props) {
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

  const pledgedHoldIds = useMemo(
    () => new Set((state.capturePledges ?? []).map((p) => p.holdId)),
    [state.capturePledges]
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

      const hs = state.holdStates?.[hold.id];
      const garrisonMen =
        hs?.garrison?.units?.reduce((s, u) => s + u.count, 0) ?? 0;
      const seed = effectiveCastleSeed(hold.id, hs);
      const garrisonable = isGarrisonable(seed, hs);

      // Banded against the seat's own default, so "3,000 men" reads as strong
      // at a watchtower and thin at Winterfell.
      const band: GarrisonBand | undefined = !garrisonable
        ? undefined
        : garrisonMen <= 0
          ? "empty"
          : garrisonMen < seed.defaultGarrison * 0.75
            ? "skeleton"
            : garrisonMen <= seed.defaultGarrison * 1.25
              ? "at_strength"
              : "reinforced";

      const besiegerMen = hs?.siege
        ? headcountOf(
            armies.filter((a) => a.faction === hs.siege!.besiegerFaction)
          )
        : 0;

      const data: HoldNodeData = {
        id: hold.id,
        label: hold.name,
        region: hold.region,
        armies,
        isSelected,
        isMoveTarget,
        isInMoveMode,
        controller: hs?.controller ?? null,
        homeFaction: hs?.homeFaction ?? homeFactionForRegion(hold.region),
        spineColor: holdSpineColor(
          hs?.controller ?? null,
          hs?.homeFaction ?? homeFactionForRegion(hold.region)
        ),
        turnedHouses: state.turnedHouses ?? [],
        hasGarrison: garrisonMen > 0,
        garrisonMen,
        garrisonBand: band,
        underSiege: !!hs?.siege,
        besiegerFaction: hs?.siege?.besiegerFaction ?? null,
        siegeTurns: hs?.siege?.turns,
        siegeUnderStrength:
          !!hs?.siege && besiegerMen < minimumSiegeForce(garrisonMen),
        termsState: hs?.siege?.terms?.status === "lapsed"
          ? null
          : hs?.siege?.terms?.status ?? null,
        awaitingGarrison:
          pledgedHoldIds.has(hold.id) ||
          (state.pendingChoices ?? []).some(
            (c) => c.holdId === hold.id && c.faction === state.activeFaction
          ),
        contested:
          armies.some((a) => a.faction === "north") &&
          armies.some((a) => a.faction === "westerlands"),
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
    state.holdStates,
    state.turnedHouses,
    state.turn,
    pledgedHoldIds,
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
        const sea = isSeaCrossing(hold.id, targetId);
        edges.push({
          id: `road-${key}`,
          source: hold.id,
          target: targetId,
          style: sea
            ? { stroke: "#1e3a4a", strokeWidth: 1, strokeDasharray: "2 4" }
            : { stroke: "#2a2a2a", strokeWidth: 1 },
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
        state.westerlands.submitted,
        state.adminMode ? "both" : state.activeFaction
      ),
    [state.north, state.westerlands, state.adminMode, state.activeFaction]
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
      minZoom={0.1}
      maxZoom={3}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={true}
      zoomOnScroll={true}
      onNodeClick={(_event, node) => handleHoldClick(node.id)}
      className="bg-background"
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

      {/* Legend — collapsed by default so the map stays the theater */}
      <Panel position="top-left">
        <details className="max-w-[220px] rounded-sm border border-border bg-card/95 shadow-lg backdrop-blur">
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Map key
          </summary>
          <div className="space-y-1.5 border-t border-border px-3 py-2.5">
            {REGIONS.map((region) => (
              <div key={region} className="flex items-center gap-2">
                <div
                  className="size-2 shrink-0"
                  style={{ background: REGION_COLORS[region] }}
                />
                <span className="text-[12px] text-muted-foreground">
                  {REGION_TRAITS[region].name}
                </span>
              </div>
            ))}
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              <LegendRow color="#3a6ea8" rounded>
                Northern host (number = thousands)
              </LegendRow>
              <LegendRow color="#b03030" rounded>
                Westerlands host
              </LegendRow>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-0.5 shrink-0 bg-north" />
                <span className="text-[12px] text-muted-foreground">
                  Left edge = who holds the seat
                </span>
              </div>
            </div>
            <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12px] text-muted-foreground">
              <div>▤ ▦ ▩ garrison thin / full / reinforced</div>
              <div>⊘ siege turn · ! too few to hold</div>
              <div>⚐ terms · ⚑ walls empty · ⚔ contested</div>
            </div>
          </div>
        </details>
      </Panel>
    </ReactFlow>
  );
}

function LegendRow({
  color,
  rounded,
  children,
}: {
  color: string;
  rounded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={rounded ? "h-2.5 w-3 rounded-full" : "size-2"}
        style={{ background: color }}
      />
      <span className="text-[12px] text-muted-foreground">{children}</span>
    </div>
  );
}

export default function WesterosMap({ state, dispatch }: Props) {
  return (
    <div className="game-map">
      <ReactFlowProvider>
        <MapInner state={state} dispatch={dispatch} />
      </ReactFlowProvider>
    </div>
  );
}
