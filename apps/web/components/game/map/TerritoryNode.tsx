"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TerrainTag, UnitState } from "@wargame/shared";
import { terrainTooltip } from "@/lib/map-display";
import { Tooltip } from "@/components/ui/Tooltip";

export type TerritoryHighlight =
  | "none"
  | "valid"
  | "invalid"
  | "selected"
  | "current";

export interface TerritoryNodeData {
  name: string;
  terrainTags: TerrainTag[];
  units: UnitState[];
  myFaction: string | undefined;
  selectedUnitId: string | null;
  highlight: TerritoryHighlight;
  isCapital: boolean;
  contested: boolean;
  pickableUnitIds: Set<string>;
  onSelectUnit: (unitId: string) => void;
  [key: string]: unknown;
}

const HANDLES: { id: string; type: "source" | "target"; position: Position }[] = [
  { id: "top-s", type: "source", position: Position.Top },
  { id: "top-t", type: "target", position: Position.Top },
  { id: "right-s", type: "source", position: Position.Right },
  { id: "right-t", type: "target", position: Position.Right },
  { id: "bottom-s", type: "source", position: Position.Bottom },
  { id: "bottom-t", type: "target", position: Position.Bottom },
  { id: "left-s", type: "source", position: Position.Left },
  { id: "left-t", type: "target", position: Position.Left },
];

function controlFaction(units: UnitState[]): string | null {
  if (units.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const u of units) counts[u.factionId] = (counts[u.factionId] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function factionTopColor(faction: string | null, contested: boolean): string {
  if (contested) return "#8b6914";
  if (faction === "rohan") return "#2d6a35";
  if (faction === "isengard") return "#8b1a1a";
  return "#222";
}

function factionTextColor(factionId: string): string {
  return factionId === "rohan" ? "#5ecb6b" : "#e05555";
}

function strengthBar(val: number, color: string) {
  return (
    <div
      className="h-1 rounded-sm"
      style={{ background: "#1a1a1a", width: "100%" }}
    >
      <div
        className="h-full rounded-sm transition-all"
        style={{ width: `${Math.round(val * 100)}%`, background: color }}
      />
    </div>
  );
}

function statColor(val: number): string {
  if (val >= 0.7) return "#5ecb6b";
  if (val >= 0.4) return "#c8941a";
  return "#e05555";
}

interface UnitRowProps {
  unit: UnitState;
  selected: boolean;
  pickable: boolean;
  mine: boolean;
  onSelect: () => void;
}

function UnitRow({ unit, selected, pickable, mine, onSelect }: UnitRowProps) {
  const str = Math.round(unit.strength * 100);
  const mor = Math.round(unit.morale);
  const fat = Math.round(unit.tiredness * 100);

  const tooltip = [
    unit.name,
    `STR: ${str}%`,
    `MOR: ${mor}`,
    `FAT: ${fat}%`,
    unit.dugIn > 0.1 ? `DIG: ${Math.round(unit.dugIn * 100)}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rowBg = selected
    ? "rgba(200,148,26,0.15)"
    : pickable
      ? "rgba(200,148,26,0.08)"
      : "transparent";

  const rowBorder = selected
    ? "1px solid rgba(200,148,26,0.5)"
    : pickable
      ? "1px solid rgba(200,148,26,0.3)"
      : "1px solid transparent";

  return (
    <Tooltip content={tooltip} side="top">
      <button
        type="button"
        disabled={!mine && !pickable}
        onClick={(e) => {
          e.stopPropagation();
          if (mine || pickable) onSelect();
        }}
        className="w-full rounded px-1.5 py-1 text-left transition-all"
        style={{
          background: rowBg,
          border: rowBorder,
          cursor: mine || pickable ? "pointer" : "default",
          opacity: !mine && !pickable ? 0.55 : 1,
          animation: pickable ? "pulse 2s infinite" : undefined,
        }}
        aria-label={unit.name}
      >
        {/* Unit name row */}
        <div className="flex items-center gap-1 mb-0.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: factionTextColor(unit.factionId) }}
          />
          <span
            className="min-w-0 flex-1 truncate font-bold uppercase"
            style={{
              fontSize: "9px",
              letterSpacing: "0.06em",
              color: "#ccc",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {unit.name}
          </span>
          {unit.engaged && (
            <span
              className="shrink-0 rounded px-0.5 font-bold uppercase"
              style={{ fontSize: "7px", color: "#e05555", border: "1px solid #8b1a1a", letterSpacing: "0.08em" }}
            >
              ENG
            </span>
          )}
        </div>
        {/* Stats row */}
        <div
          className="flex items-center gap-2"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: "8px", color: "#555" }}
        >
          <span>STR: <span style={{ color: statColor(unit.strength) }}>{str}</span></span>
          <span>MOR: <span style={{ color: statColor(unit.morale / 100) }}>{mor}</span></span>
          <span>FAT: <span style={{ color: unit.tiredness > 0.6 ? "#e05555" : "#555" }}>{fat}%</span></span>
        </div>
        {/* Strength bar */}
        <div className="mt-0.5">
          {strengthBar(unit.strength, statColor(unit.strength))}
        </div>
      </button>
    </Tooltip>
  );
}

export function TerritoryNode({ data }: NodeProps) {
  const d = data as TerritoryNodeData;

  const dim = d.highlight === "invalid" ? "opacity-20 grayscale" : "opacity-100";

  const control = d.contested ? null : controlFaction(d.units);
  const topColor = factionTopColor(control, d.contested);

  let borderColor = "#242424";
  let glowStyle = "";
  if (d.highlight === "valid") {
    borderColor = "#c8941a";
    glowStyle = "0 0 16px rgba(200,148,26,0.4)";
  } else if (d.highlight === "selected") {
    borderColor = "#5ecb6b";
    glowStyle = "0 0 10px rgba(94,203,107,0.3)";
  } else if (d.highlight === "current") {
    borderColor = "#555";
  } else if (d.contested) {
    borderColor = "#c8941a";
    glowStyle = "0 0 14px rgba(200,148,26,0.35)";
  }

  const sorted = [...d.units].sort((a, b) => {
    const aOwn = a.factionId === d.myFaction ? 0 : 1;
    const bOwn = b.factionId === d.myFaction ? 0 : 1;
    return aOwn - bOwn;
  });

  const terrainLabel = d.terrainTags.length > 0
    ? d.terrainTags.map((t) => terrainTooltip(t)).join(" · ")
    : null;

  return (
    <article className={`relative w-[160px] ${dim}`}>
      {HANDLES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.type}
          position={h.position}
          className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
        />
      ))}

      <div
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${borderColor}`,
          boxShadow: glowStyle || "0 2px 8px rgba(0,0,0,0.6)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {/* Faction control bar — thick top border */}
        <div style={{ height: 3, background: topColor, width: "100%" }} />

        {/* Territory name header */}
        <div
          className="flex items-center justify-between px-2 py-1.5"
          style={{
            background: `${topColor}22`,
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <h3
            className="font-bold uppercase leading-tight tracking-widest truncate"
            style={{ fontSize: "10px", color: "#ddd" }}
          >
            {d.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {d.isCapital && (
              <span
                className="font-bold"
                style={{ fontSize: "9px", color: "#c8941a" }}
                title="Capital"
              >
                ★
              </span>
            )}
            {d.contested && (
              <span
                className="font-bold uppercase px-1 rounded"
                style={{ fontSize: "7px", color: "#c8941a", border: "1px solid #8b6914", letterSpacing: "0.1em" }}
              >
                ENGAGED
              </span>
            )}
          </div>
        </div>

        {/* Terrain label */}
        {terrainLabel && (
          <Tooltip content={terrainLabel}>
            <p
              className="cursor-help px-2 pb-1 italic leading-tight truncate"
              style={{ fontSize: "8px", color: "#444" }}
            >
              {terrainLabel}
            </p>
          </Tooltip>
        )}

        {/* Contested critical banner */}
        {d.contested && (
          <div
            className="mx-1.5 mb-1 py-px text-center font-bold uppercase tracking-widest"
            style={{ fontSize: "7px", color: "#c8941a", border: "1px solid #8b6914", background: "#1a1200" }}
          >
            CRITICAL COMBAT ZONE
          </div>
        )}

        {/* Unit list */}
        <div className="px-1.5 pb-1.5 pt-0.5">
          {sorted.length === 0 ? (
            <p
              className="py-1 text-center italic"
              style={{ fontSize: "8px", color: "#333" }}
            >
              UNOCCUPIED
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto overscroll-contain">
              {sorted.map((u) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  selected={u.id === d.selectedUnitId}
                  pickable={d.pickableUnitIds.has(u.id)}
                  mine={u.factionId === d.myFaction}
                  onSelect={() => d.onSelectUnit(u.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
