"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
  ReactFlowProvider,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { HOLDS, REGION_COLORS } from "../data/holds";
import { isSeaCrossing } from "../data/pathways";
import type {
  GameState,
  GameAction,
  Army,
  Faction,
  MoveOrder,
} from "../types";
import { getCastleSeed, homeFactionForRegion } from "../data/castles";
import { holdSpineColor, isGarrisonable } from "../lib/hold-runtime";
import { headcountOf, minimumSiegeForce } from "../lib/siege";
import { forageStepAtHold, forageStepOnPath } from "../lib/forage";
import HoldNode, {
  type GarrisonBand,
  type HoldNodeData,
  type MapView,
} from "./HoldNode";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Scale factors: (x: 0–80) → rfX, (y: 0–100, north=up) → rfY
const SCALE_X = 32;
const SCALE_Y = 28;

function toRf(x: number, y: number) {
  return { x: x * SCALE_X, y: (100 - y) * SCALE_Y };
}

const MAP_VIEWS: { id: MapView; label: string; hint: string }[] = [
  {
    id: "seats",
    label: "Seats",
    hint: "Who holds each castle. Colour is the controller; the left strip is home country.",
  },
  {
    id: "hosts",
    label: "Hosts",
    hint: "Field armies, sieges, and fights. Numbers on the dots are thousands of men.",
  },
  {
    id: "country",
    label: "Country",
    hint: "How picked-over the land is. Darker and browner means less forage left.",
  },
];

const FORAGE_STROKE = ["#3a6a40", "#5a6a38", "#7a6a30", "#8a5030", "#6a3830"];

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
  const [mapView, setMapView] = useState<MapView>("hosts");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wargame-map-view");
      if (saved === "seats" || saved === "hosts" || saved === "country") {
        setMapView(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function chooseView(view: MapView) {
    setMapView(view);
    try {
      localStorage.setItem("wargame-map-view", view);
    } catch {
      /* ignore */
    }
  }
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
      const seed = getCastleSeed(hold.id);
      const garrisonable = isGarrisonable(seed);

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
        mapView,
        forageStep: forageStepAtHold(state.forage, hold.id),
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
    state.forage,
    pledgedHoldIds,
    handleHoldClick,
    mapView,
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
        const forageStep = forageStepOnPath(state.forage, hold.id, targetId);
        const countryStroke = FORAGE_STROKE[forageStep] ?? FORAGE_STROKE[0];
        edges.push({
          id: `road-${key}`,
          source: hold.id,
          target: targetId,
          style: sea
            ? {
                stroke: mapView === "country" ? countryStroke : "#1e3a4a",
                strokeWidth: 1,
                strokeDasharray: "2 4",
              }
            : {
                stroke: mapView === "country" ? countryStroke : "#2a2a2a",
                strokeWidth: mapView === "country" ? 1.5 : 1,
              },
          type: "straight",
          selectable: false,
          focusable: false,
          zIndex: 1,
        });
      });
    });
    return edges;
  }, [mapView, state.forage]);

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
          const data = node.data as HoldNodeData;
          if (mapView === "country") {
            return FORAGE_STROKE[data.forageStep ?? 0] ?? "#111";
          }
          if (mapView === "seats") {
            if (data.controller === "north") return "#3a6ea8";
            if (data.controller === "westerlands") return "#b03030";
            if (data.controller === "hostile") return "#c8941a";
            return "#333";
          }
          return REGION_COLORS[data.region] ?? "#111";
        }}
        maskColor="rgba(0,0,0,0.7)"
      />

      <Panel position="top-left" className="flex max-w-[min(280px,calc(100vw-24px))] flex-col gap-2">
        <div className="flex overflow-hidden rounded-sm border border-border bg-card/95 shadow-lg backdrop-blur">
          {MAP_VIEWS.map((view) => (
            <Tooltip key={view.id} delayDuration={480}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => chooseView(view.id)}
                  className={cn(
                    "relative h-8 min-w-0 flex-1 px-2.5 text-[12px] font-medium",
                    mapView === view.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="truncate">{view.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <div className="font-display text-[15px] text-foreground">{view.label}</div>
                <p className="mt-1 text-[12px] leading-snug">{view.hint}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <details className="rounded-sm border border-border bg-card/95 shadow-lg backdrop-blur">
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Map key
          </summary>
          <div className="space-y-1.5 border-t border-border px-3 py-2.5">
            {mapView === "seats" && (
              <>
                <LegendRow color="#3a6ea8">Held by the North</LegendRow>
                <LegendRow color="#b03030">Held by the Westerlands</LegendRow>
                <LegendRow color="#c8941a">Held against both</LegendRow>
                <LegendRow color="#333">Unheld</LegendRow>
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12px] text-muted-foreground">
                  <div>Left strip = home country</div>
                  <div>▤ ▦ ▩ garrison thin / full / reinforced</div>
                  <div>⚑ walls empty</div>
                </div>
              </>
            )}
            {mapView === "hosts" && (
              <>
                <LegendRow color="#3a6ea8" rounded>
                  Northern host (thousands)
                </LegendRow>
                <LegendRow color="#b03030" rounded>
                  Westerlands host
                </LegendRow>
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12px] text-muted-foreground">
                  <div>⊘ siege turn · ! too few to hold</div>
                  <div>⚐ terms · ⚔ contested</div>
                </div>
              </>
            )}
            {mapView === "country" && (
              <>
                <LegendRow color="#3a6a40">Full country</LegendRow>
                <LegendRow color="#7a6a30">Picked over</LegendRow>
                <LegendRow color="#6a3830">Stripped bare</LegendRow>
                <div className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
                  Roads take the same colour as the path between seats.
                </div>
              </>
            )}
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
