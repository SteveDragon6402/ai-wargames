"use client";

import { useState } from "react";
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
  /** Called when the player clicks "Select All" on this node */
  onSelectAll?: () => void;
  /** Unit IDs currently in the active group selection */
  groupedUnitIds?: Set<string>;
  battleNarrative: string | null;
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
  if (faction === "lannister") return "#7a5a00";
  if (faction === "stark") return "#2a4a6a";
  return "#1e1e1e";
}

/** Background tint based on terrain type */
function terrainBg(tags: TerrainTag[]): string {
  if (tags.includes("stronghold") || tags.includes("fortified")) return "#0d0f0d";
  if (tags.includes("river_crossing")) return "#090d12";
  if (tags.includes("capital_rohan")) return "#0a0f0a";
  if (tags.includes("capital_isengard")) return "#100808";
  if (tags.includes("capital_lannister")) return "#0f0d04";
  if (tags.includes("capital_stark")) return "#060b10";
  if (tags.includes("rugged") || tags.includes("ambush")) return "#0e0d0b";
  return "#0a0a0a";
}

function factionTextColor(factionId: string): string {
  if (factionId === "rohan") return "#5ecb6b";
  if (factionId === "isengard") return "#e05555";
  if (factionId === "lannister") return "#c8941a";
  if (factionId === "stark") return "#5b8db8";
  return "#aaaaaa";
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
    ? "rgba(0,217,146,0.15)"
    : pickable
      ? "rgba(0,217,146,0.08)"
      : "transparent";

  const rowBorder = selected
    ? "1px solid rgba(0,217,146,0.5)"
    : pickable
      ? "1px solid rgba(0,217,146,0.3)"
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
            className="min-w-0 flex-1 truncate font-bold uppercase font-mono"
            style={{ fontSize: "9px", letterSpacing: "0.06em", color: "#ccc" }}
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
  const [battleOpen, setBattleOpen] = useState(false);

  const dim = d.highlight === "invalid" ? "opacity-20 grayscale" : "opacity-100";

  const control = d.contested ? null : controlFaction(d.units);
  const topColor = factionTopColor(control, d.contested);

  let borderColor = "#3d3a39";
  let glowStyle = "";
  if (d.highlight === "valid") {
    borderColor = "#00d992";
    glowStyle = "0 0 16px rgba(0,217,146,0.4)";
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

  const nodeBg = terrainBg(d.terrainTags);

  return (
    <article className={`relative w-[190px] ${dim}`}>
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
          background: nodeBg,
          border: `1px solid ${borderColor}`,
          boxShadow: glowStyle || "0 3px 12px rgba(0,0,0,0.7)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {/* Faction control bar — thick top border */}
        <div style={{ height: 4, background: topColor, width: "100%" }} />

        {/* Territory name header */}
        <div
          className="flex items-center justify-between px-2.5 py-2"
          style={{
            background: `${topColor}18`,
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <h3
              className="font-bold uppercase leading-tight truncate"
              style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#e0e0e0" }}
            >
              {d.name}
            </h3>
            {terrainLabel && (
              <Tooltip content={terrainLabel}>
                <p
                  className="cursor-help leading-tight truncate italic"
                  style={{ fontSize: "8px", color: "#555", marginTop: 1 }}
                >
                  {terrainLabel}
                </p>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {d.isCapital && (
              <span
                className="font-bold"
                style={{ fontSize: "10px", color: "#c8941a" }}
                title="Capital"
              >
                ★
              </span>
            )}
            {d.contested && (
              <span
                className="font-bold uppercase px-1 py-px"
                style={{ fontSize: "7px", color: "#c8941a", border: "1px solid #8b6914", letterSpacing: "0.1em" }}
              >
                ENG
              </span>
            )}
          </div>
        </div>

        {/* Contested critical banner */}
        {d.contested && (
          <div
            className="mx-2 mb-1 py-px text-center font-bold uppercase tracking-widest"
            style={{ fontSize: "7px", color: "#c8941a", border: "1px solid #2a1a00", background: "#120d00" }}
          >
            ⚔ CRITICAL COMBAT ZONE
          </div>
        )}

        {/* Unit list */}
        <div className="px-1.5 pb-1 pt-0.5">
          {sorted.length === 0 ? (
            <p
              className="py-1 text-center italic"
              style={{ fontSize: "8px", color: "#333" }}
            >
              UNOCCUPIED
            </p>
          ) : (
            <>
              {/* Select All button — only when 2+ own units and not in pick mode */}
              {d.onSelectAll &&
                sorted.filter((u) => u.factionId === d.myFaction).length >= 2 && (
                  <Tooltip content="Select all your units here and issue one command to all of them">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        d.onSelectAll?.();
                      }}
                      className="mb-1 w-full rounded px-1.5 py-0.5 text-left transition-colors"
                      style={{
                        border: d.groupedUnitIds?.size
                          ? "1px solid #c8941a"
                          : "1px solid #222",
                        background: d.groupedUnitIds?.size ? "#1a0f00" : "#0d0d0d",
                        fontFamily: "var(--font-mono), monospace",
                      }}
                      onMouseEnter={(e) => {
                        if (!d.groupedUnitIds?.size)
                          e.currentTarget.style.borderColor = "#444";
                      }}
                      onMouseLeave={(e) => {
                        if (!d.groupedUnitIds?.size)
                          e.currentTarget.style.borderColor = "#222";
                      }}
                    >
                      <span
                        className="font-bold uppercase tracking-widest"
                        style={{
                          fontSize: "7px",
                          color: d.groupedUnitIds?.size ? "#c8941a" : "#555",
                        }}
                      >
                        {d.groupedUnitIds?.size ? "◈ Group Selected" : "⊞ Select All"}
                      </span>
                    </button>
                  </Tooltip>
                )}
              <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto overscroll-contain">
                {sorted.map((u) => (
                  <UnitRow
                    key={u.id}
                    unit={u}
                    selected={
                      u.id === d.selectedUnitId ||
                      (d.groupedUnitIds?.has(u.id) ?? false)
                    }
                    pickable={d.pickableUnitIds.has(u.id)}
                    mine={u.factionId === d.myFaction}
                    onSelect={() => d.onSelectUnit(u.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Battle narrative toggle */}
        {d.battleNarrative && (
          <div style={{ borderTop: "1px solid #1a1a1a" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setBattleOpen((o) => !o); }}
              className="flex w-full items-center justify-between px-1.5 py-1 transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1a0d00")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="font-bold uppercase tracking-widest"
                style={{ fontSize: "7px", color: "#8b6914" }}
              >
                ⚔ Battle report
              </span>
              <span style={{ fontSize: "8px", color: "#555" }}>{battleOpen ? "▲" : "▼"}</span>
            </button>
            {battleOpen && (
              <div
                className="px-2 pb-2 font-narrative"
                style={{ background: "#0f0900", borderTop: "1px solid #1a1200" }}
              >
                <p
                  className="leading-relaxed italic"
                  style={{ fontSize: "9px", color: "#a08040" }}
                >
                  {d.battleNarrative}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
