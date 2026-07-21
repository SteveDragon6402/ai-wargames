"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Army } from "../types";
import { REGION_COLORS, REGION_BORDER_COLORS } from "../data/holds";

export interface HoldNodeData {
  id: string;
  label: string;
  region: string;
  armies: Army[];
  isSelected: boolean;
  isMoveTarget: boolean;
  isInMoveMode: boolean;
  [key: string]: unknown;
}

const FACTION_COLORS = {
  north: "#3a6ea8",
  westerlands: "#b03030",
};

function ArmyDot({
  faction,
  fortified,
  resting,
}: {
  faction: "north" | "westerlands";
  fortified?: boolean;
  resting?: boolean;
}) {
  return (
    <span
      title={fortified ? "Fortifying" : resting ? "Resting" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: fortified ? 10 : 6,
        height: fortified ? 10 : 6,
        borderRadius: fortified ? 1 : "50%",
        background: FACTION_COLORS[faction],
        border: fortified
          ? "1px solid rgba(255,255,255,0.35)"
          : "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
        opacity: resting && !fortified ? 0.45 : 1,
        fontSize: 5,
        color: "rgba(255,255,255,0.8)",
        lineHeight: 1,
      }}
    >
      {fortified ? "▣" : ""}
    </span>
  );
}

function HoldNode({ data }: { data: HoldNodeData }) {
  const { label, region, armies, isSelected, isMoveTarget, isInMoveMode } = data;

  const northArmies = armies.filter((a) => a.faction === "north");
  const westArmies = armies.filter((a) => a.faction === "westerlands");
  const hasArmies = armies.length > 0;

  const bg = REGION_COLORS[region] ?? "#111";
  const borderBase = REGION_BORDER_COLORS[region] ?? "#2a2a2a";

  let borderColor = borderBase;
  let glowStyle = "";
  if (isSelected) {
    borderColor = "#c8941a";
    glowStyle = "0 0 0 2px #c8941a55";
  } else if (isMoveTarget) {
    borderColor = "#c8941a";
    glowStyle = "0 0 8px 2px #c8941a88";
  } else if (isInMoveMode) {
    borderColor = "#333";
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{
          background: bg,
          border: `1px solid ${borderColor}`,
          boxShadow: glowStyle || undefined,
          borderRadius: 2,
          padding: "4px 7px",
          minWidth: 90,
          maxWidth: 130,
          cursor: "pointer",
          userSelect: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          position: "relative",
          opacity: isInMoveMode && !isMoveTarget && !isSelected ? 0.4 : 1,
        }}
      >
        {/* Hold name */}
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: isSelected ? "#c8941a" : isMoveTarget ? "#f0b429" : "#aaa",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>

        {/* Army dots row */}
        {hasArmies && (
          <div
            style={{
              display: "flex",
              gap: 3,
              marginTop: 3,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {northArmies.map((a) => (
              <ArmyDot
                key={a.id}
                faction="north"
                fortified={(a.activity?.turnsFortiying ?? 0) > 0}
                resting={(a.activity?.turnsResting ?? 0) > 0}
              />
            ))}
            {westArmies.map((a) => (
              <ArmyDot
                key={a.id}
                faction="westerlands"
                fortified={(a.activity?.turnsFortiying ?? 0) > 0}
                resting={(a.activity?.turnsResting ?? 0) > 0}
              />
            ))}
          </div>
        )}

        {/* Move target indicator */}
        {isMoveTarget && (
          <div
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#c8941a",
              boxShadow: "0 0 4px #c8941a",
            }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

export default memo(HoldNode);
