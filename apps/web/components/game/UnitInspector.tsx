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
    <div className="h-1 w-full bg-hairline-dim">
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
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center font-mono">
        <div className="text-2xl text-hairline-dim">⊕</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-hairline-dim">
          No unit selected
        </p>
        <p className="max-w-[180px] text-xs uppercase tracking-wide leading-relaxed text-hairline-dim">
          Select a friendly unit on the map to issue orders
        </p>
      </div>
    );
  }

  const factionColor =
    unit.factionId === "rohan" ? "var(--faction-rohan)" : "var(--faction-isengard)";
  const factionBg =
    unit.factionId === "rohan" ? "rgba(45,106,53,0.2)" : "rgba(139,26,26,0.2)";
  const factionBorder =
    unit.factionId === "rohan" ? "var(--faction-rohan-deep)" : "var(--faction-isengard-deep)";

  const sLabel = strengthLabel(unit.strength);
  const sPct = Math.round(unit.strength * 100);
  const mLabel = moraleLabel(unit.morale);
  const mPct = Math.round(unit.morale);
  const sBarColor = unit.strength >= 0.7 ? "var(--stat-good)" : unit.strength >= 0.4 ? "var(--stat-warn)" : "var(--stat-bad)";
  const mBarColor = unit.morale >= 70 ? "var(--stat-good)" : unit.morale >= 40 ? "var(--stat-warn)" : "var(--stat-bad)";

  return (
    <section className="space-y-3 p-3 font-mono">
      {/* Identity header */}
      <header
        className="px-2.5 py-2"
        style={{ background: factionBg, borderLeft: `3px solid ${factionBorder}` }}
      >
        <h2 className="text-sm font-semibold uppercase leading-tight tracking-wide text-ink">
          {unit.name}
        </h2>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide" style={{ color: factionColor }}>
          {factionDisplayName(unit.factionId)}
        </p>
        {nodeName && (
          <p className="mt-1 text-xs uppercase tracking-wide text-mute">
            AT: <span className="text-body">{nodeName}</span>
          </p>
        )}
        {unit.engaged && (
          <span
            className="mt-1 inline-flex items-center gap-1 px-1.5 py-px text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--faction-isengard)", border: "1px solid var(--faction-isengard-deep)", background: "#1a0a0a" }}
          >
            ⚔ ENGAGED
          </span>
        )}
      </header>

      {/* Strength */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Strength
          </span>
          <span className="text-xs text-body">
            {sLabel} · {sPct}%
          </span>
        </div>
        <StatBar value={unit.strength} color={sBarColor} />
        <p className="mt-0.5 text-xs uppercase tracking-wide text-hairline-dim">
          {troopCount(unit.strength)}
        </p>
      </div>

      {/* Morale */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Morale
          </span>
          <span className="text-xs text-body">
            {mLabel} · {mPct}
          </span>
        </div>
        <StatBar value={unit.morale / 100} color={mBarColor} />
      </div>

      {/* Combat data */}
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 border border-hairline-dim bg-canvas-soft px-2 py-2 text-xs">
        <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
          Attack
        </dt>
        <dd>
          <Tooltip content={`${attackLabel(unit.attack)} (${unit.attack}/10)`}>
            <span className="cursor-help font-semibold tracking-wide text-primary-soft">
              {combatStars(unit.attack)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
          Defence
        </dt>
        <dd>
          <Tooltip content={`${defenseLabel(unit.defense)} (${unit.defense}/10)`}>
            <span className="cursor-help font-semibold tracking-wide text-faction-rohan">
              {combatStars(unit.defense)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
          Fortified
        </dt>
        <dd className="text-body">{fortificationLabel(unit.dugIn)}</dd>

        <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
          Condition
        </dt>
        <dd style={{ color: unit.tiredness > 0.6 ? "var(--stat-warn)" : "#888" }}>
          {fatigueLabel(unit.tiredness)}
        </dd>

        {(unit.turnsInContact ?? 0) > 0 && (
          <>
            <dt className="text-xs font-semibold uppercase tracking-wide text-mute">
              In Combat
            </dt>
            <dd style={{ color: (unit.turnsInContact ?? 0) >= 3 ? "var(--stat-warn)" : "#888" }}>
              {unit.turnsInContact}T
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
