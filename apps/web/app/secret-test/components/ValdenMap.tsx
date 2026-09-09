"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SEATS } from "../data/valden";
import type { FactionId, PublicSeat } from "../types";
import { CAMPAIGN_SHORT, rivalFaction } from "../types";
import SeatNode, { type SeatNodeData } from "./SeatNode";

const nodeTypes: NodeTypes = { seat: SeatNode as never };

function MapInner({ seats }: { seats: PublicSeat[] }) {
  const leanById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  const nodes: Node[] = useMemo(
    () =>
      SEATS.map((def) => {
        const live = leanById.get(def.id);
        const data: SeatNodeData = {
          name: def.name,
          stateId: def.stateId,
          lean: live?.lean ?? def.startLean,
          summary: live?.summary ?? def.demographics.summary,
        };
        return {
          id: def.id,
          type: "seat",
          position: { x: def.x, y: def.y },
          data,
          draggable: false,
        };
      }),
    [leanById]
  );

  const edges: Edge[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Edge[] = [];
    for (const seat of SEATS) {
      for (const n of seat.neighbors) {
        const key = [seat.id, n].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: key,
          source: seat.id,
          target: n,
          style: { stroke: "#4a453c", strokeWidth: 1.4 },
          type: "straight",
        });
      }
    }
    return out;
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.4}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} color="#2a261c" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function ValdenMap({ seats, youAre }: { seats: PublicSeat[]; youAre: FactionId }) {
  const other = rivalFaction(youAre);
  return (
    <div style={{ width: "100%", background: "#0c0c0c", border: "1px solid #2a261c" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          borderBottom: "1px solid #2a261c",
          flexWrap: "wrap",
        }}
      >
        <div className="rose-label" style={{ color: youAre === "red" ? "#e07070" : "#7a9ae0" }}>
          You are {CAMPAIGN_SHORT[youAre]} — {youAre === "red" ? "red" : "blue"} seats are yours
        </div>
        <div className="rose-label">
          <span style={{ color: "#e07070" }}>Red = {CAMPAIGN_SHORT.red}</span>
          <span style={{ margin: "0 10px", color: "#4a4a4e" }}>·</span>
          <span style={{ color: "#7a9ae0" }}>Blue = {CAMPAIGN_SHORT.blue}</span>
          <span style={{ margin: "0 10px", color: "#4a4a4e" }}>·</span>
          <span style={{ color: "#8a8a8e" }}>Grey = toss-up</span>
          <span style={{ margin: "0 10px", color: "#4a4a4e" }}>·</span>
          <span style={{ color: "#8a8a8e" }}>{CAMPAIGN_SHORT[other]} is the other campaign</span>
        </div>
      </div>
      <div style={{ height: 360 }}>
        <ReactFlowProvider>
          <MapInner seats={seats} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
