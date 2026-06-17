"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TerrainTag, UnitState } from "@wargame/shared";
import { terrainPhrase, terrainTooltip } from "@/lib/map-display";
import { Tooltip } from "@/components/ui/Tooltip";

export type TerritoryHighlight =
  | "none"
  | "valid"
  | "invalid"
  | "selected"
  | "current";

const MAX_VISIBLE = 20; // show all units; list scrolls internally

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

/* Invisible perimeter handles — edges attach to the correct side */
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

function factionBarClass(faction: string | null, contested: boolean): string {
  if (contested) return "bg-gradient-to-r from-emerald-600 via-red-700 to-red-700";
  if (faction === "rohan") return "bg-emerald-700";
  if (faction === "isengard") return "bg-red-800";
  return "bg-slate-700";
}

function unitDotClass(factionId: string): string {
  if (factionId === "rohan") return "bg-emerald-500";
  return "bg-red-500";
}

function unitRowClass(selected: boolean, pickable: boolean, mine: boolean): string {
  const base = "flex w-full items-center gap-1 rounded px-1 py-px text-left transition-colors";
  if (selected) return `${base} bg-amber-500/20 ring-1 ring-amber-400/60`;
  if (pickable) return `${base} animate-pulse bg-amber-500/10 ring-1 ring-amber-400/40`;
  if (mine) return `${base} hover:bg-slate-700/60 cursor-pointer`;
  return `${base} opacity-70 cursor-default`;
}

function strengthColor(s: number): string {
  if (s >= 0.7) return "text-emerald-400";
  if (s >= 0.4) return "text-amber-400";
  return "text-red-400";
}

function tooltipContent(u: UnitState): string {
  const type = u.unitType ? u.unitType.replace(/_/g, " ") : "";
  const str = `${Math.round(u.strength * 100)}% str`;
  const mor = `${Math.round(u.morale)} morale`;
  return [u.name, type, str, mor].filter(Boolean).join(" · ");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface UnitRowProps {
  unit: UnitState;
  selected: boolean;
  pickable: boolean;
  mine: boolean;
  onSelect: () => void;
}

function UnitRow({ unit, selected, pickable, mine, onSelect }: UnitRowProps) {
  return (
    <Tooltip content={tooltipContent(unit)} side="top">
      <button
        type="button"
        disabled={!mine && !pickable}
        onClick={(e) => {
          e.stopPropagation();
          if (mine || pickable) onSelect();
        }}
        className={unitRowClass(selected, pickable, mine)}
        aria-label={unit.name}
      >
        {/* Faction dot */}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unitDotClass(unit.factionId)}`} />

        {/* Unit name */}
        <span className="min-w-0 flex-1 truncate text-[10px] leading-tight text-slate-200">
          {truncate(unit.name, 22)}
        </span>

        {/* Strength % */}
        <span className={`shrink-0 text-[9px] tabular-nums font-medium ${strengthColor(unit.strength)}`}>
          {Math.round(unit.strength * 100)}%
        </span>
      </button>
    </Tooltip>
  );
}

export function TerritoryNode({ data }: NodeProps) {
  const d = data as TerritoryNodeData;

  const dim = d.highlight === "invalid" ? "opacity-20 grayscale" : "opacity-100";

  const ringClass =
    d.highlight === "valid"
      ? "ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.45)]"
      : d.highlight === "selected"
        ? "ring-2 ring-sky-400"
        : d.highlight === "current"
          ? "ring-2 ring-slate-400/70"
          : d.contested
            ? "ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
            : "ring-1 ring-slate-600/80";

  const control = d.contested ? null : controlFaction(d.units);
  const barClass = factionBarClass(control, d.contested);
  const phrase = terrainPhrase(d.terrainTags);

  // Sort: own faction first, then enemy
  const sorted = [...d.units].sort((a, b) => {
    const aOwn = a.factionId === d.myFaction ? 0 : 1;
    const bOwn = b.factionId === d.myFaction ? 0 : 1;
    return aOwn - bOwn;
  });


  return (
    <article className={`relative w-[148px] ${dim}`}>
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
        className={`rounded-md border border-slate-700/90 bg-slate-900 shadow-lg ${ringClass}`}
      >
        {/* Faction control bar */}
        <div className={`h-1.5 w-full rounded-t-md ${barClass}`} />

        {/* Territory name + capital badge */}
        <div className="flex items-start justify-between gap-1 px-2 pt-1.5 pb-0.5">
          <h3 className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-100">
            {d.name}
          </h3>
          {d.isCapital && (
            <span
              className="shrink-0 rounded bg-amber-500/20 px-1 py-px text-[8px] font-bold uppercase text-amber-300"
              title="Capital"
            >
              ★
            </span>
          )}
        </div>

        {/* Terrain description */}
        {phrase && (
          <Tooltip content={d.terrainTags.map((t) => terrainTooltip(t)).join(" · ")}>
            <p className="cursor-help px-2 pb-0.5 text-[9px] italic text-slate-500 leading-tight">
              {phrase}
            </p>
          </Tooltip>
        )}

        {/* Contested banner */}
        {d.contested && (
          <div className="mx-1.5 mb-0.5 rounded bg-red-900/60 px-1.5 py-px text-center text-[8px] font-bold uppercase tracking-widest text-red-300">
            Contested
          </div>
        )}

        {/* Unit list — scrolls internally when many units */}
        <div className="border-t border-slate-800/80 px-1.5 py-1">
          {sorted.length === 0 ? (
            <p className="py-0.5 text-center text-[9px] italic text-slate-700">Unoccupied</p>
          ) : (
            <div className="max-h-36 overflow-y-auto overscroll-contain flex flex-col gap-px pr-0.5">
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
