"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { leanColor } from "../lib/lean";
import type { StateId } from "../types";

export type SeatNodeData = {
  name: string;
  stateId: StateId;
  lean: number;
  summary: string;
};

function SeatNodeInner({ data }: NodeProps) {
  const d = data as SeatNodeData;
  const fill = leanColor(d.lean);
  return (
    <div
      title={d.summary}
      style={{
        minWidth: 108,
        padding: "8px 10px",
        borderRadius: 6,
        background: fill,
        color: Math.abs(d.lean) < 0.18 ? "#1a1a1a" : "#f4f4f4",
        border: "1px solid rgba(0,0,0,0.35)",
        fontSize: 11,
        lineHeight: 1.3,
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 700 }}>{d.name}</div>
      <div style={{ fontSize: 9, opacity: 0.85, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {d.stateId}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(SeatNodeInner);
