"use client";

import type { UnitState } from "@wargame/shared";
import {
  attackLabel,
  combatStars,
  defenseLabel,
  fatigueLabel,
  factionDisplayName,
  fortificationLabel,
  moraleColor,
  moraleLabel,
  strengthColor,
  strengthLabel,
  troopCount,
} from "@/lib/unit-labels";
import { Tooltip } from "@/components/ui/Tooltip";

interface UnitInspectorProps {
  unit: UnitState | null;
  nodeName?: string;
}

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 w-full" style={{ background: "#1a1a1a" }}>
      <div
        className="h-full transition-all"
        style={{ width: `${Math.round(value * 100)}%`, background: color }}
      />
    </div>
  );
}

export function UnitInspector({ unit, nodeName }: UnitInspectorProps) {
  if (!unit) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        <div
          className="text-2xl"
          style={{ color: "#2a2a2a" }}
        >
          ⊕
        </div>
        <p
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "#333" }}
        >
          No unit selected
        </p>
        <p
          className="max-w-[180px] text-[8px] uppercase tracking-wide leading-relaxed"
          style={{ color: "#2a2a2a" }}
        >
          Select a friendly unit on the map to issue orders
        </p>
      </div>
    );
  }

  const factionColor =
    unit.factionId === "rohan" ? "#5ecb6b" : "#e05555";
  const factionBg =
    unit.factionId === "rohan" ? "rgba(45,106,53,0.2)" : "rgba(139,26,26,0.2)";
  const factionBorder =
    unit.factionId === "rohan" ? "#2d6a35" : "#8b1a1a";

  const sLabel = strengthLabel(unit.strength);
  const sPct = Math.round(unit.strength * 100);
  const mLabel = moraleLabel(unit.morale);
  const mPct = Math.round(unit.morale);
  const sBarColor = unit.strength >= 0.7 ? "#5ecb6b" : unit.strength >= 0.4 ? "#c8941a" : "#e05555";
  const mBarColor = unit.morale >= 70 ? "#5ecb6b" : unit.morale >= 40 ? "#c8941a" : "#e05555";

  return (
    <section className="p-3 space-y-3" style={{ fontFamily: "var(--font-mono), monospace" }}>
      {/* Identity header */}
      <header
        className="px-2.5 py-2"
        style={{ background: factionBg, borderLeft: `3px solid ${factionBorder}` }}
      >
        <h2
          className="text-sm font-bold uppercase leading-tight tracking-wider"
          style={{ color: "#ddd" }}
        >
          {unit.name}
        </h2>
        <p
          className="mt-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: factionColor }}
        >
          {factionDisplayName(unit.factionId)}
        </p>
        {nodeName && (
          <p className="mt-1 text-[9px] uppercase tracking-wider" style={{ color: "#555" }}>
            AT: <span style={{ color: "#888" }}>{nodeName}</span>
          </p>
        )}
        {unit.engaged && (
          <span
            className="mt-1 inline-flex items-center gap-1 px-1.5 py-px text-[8px] font-bold uppercase tracking-widest"
            style={{ color: "#e05555", border: "1px solid #8b1a1a", background: "#1a0a0a" }}
          >
            ⚔ ENGAGED
          </span>
        )}
      </header>

      {/* Strength */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
            Strength
          </span>
          <span className="text-[9px]" style={{ color: "#888" }}>
            {sLabel} · {sPct}%
          </span>
        </div>
        <StatBar value={unit.strength} color={sBarColor} />
        <p className="mt-0.5 text-[8px] uppercase tracking-wide" style={{ color: "#333" }}>
          {troopCount(unit.strength)}
        </p>
      </div>

      {/* Morale */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
            Morale
          </span>
          <span className="text-[9px]" style={{ color: "#888" }}>
            {mLabel} · {mPct}
          </span>
        </div>
        <StatBar value={unit.morale / 100} color={mBarColor} />
      </div>

      {/* Combat data */}
      <dl
        className="grid grid-cols-2 gap-x-2 gap-y-1.5 px-2 py-2 text-[10px]"
        style={{ border: "1px solid #1a1a1a", background: "#0d0d0d" }}
      >
        <dt className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
          Attack
        </dt>
        <dd>
          <Tooltip content={`${attackLabel(unit.attack)} (${unit.attack}/10)`}>
            <span
              className="cursor-help font-bold tracking-widest"
              style={{ color: "var(--color-gold)" }}
            >
              {combatStars(unit.attack)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
          Defence
        </dt>
        <dd>
          <Tooltip content={`${defenseLabel(unit.defense)} (${unit.defense}/10)`}>
            <span
              className="cursor-help font-bold tracking-widest"
              style={{ color: "#5ecb6b" }}
            >
              {combatStars(unit.defense)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
          Fortified
        </dt>
        <dd style={{ color: "#888" }}>{fortificationLabel(unit.dugIn)}</dd>

        <dt className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
          Condition
        </dt>
        <dd style={{ color: unit.tiredness > 0.6 ? "#c8941a" : "#888" }}>
          {fatigueLabel(unit.tiredness)}
        </dd>

        {(unit.turnsInContact ?? 0) > 0 && (
          <>
            <dt className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>
              In Combat
            </dt>
            <dd style={{ color: (unit.turnsInContact ?? 0) >= 3 ? "#c8941a" : "#888" }}>
              {unit.turnsInContact}T
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
