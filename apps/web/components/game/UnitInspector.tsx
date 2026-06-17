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

export function UnitInspector({ unit, nodeName }: UnitInspectorProps) {
  if (!unit) {
    return (
      <section className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
        <div className="text-2xl opacity-30">⚔</div>
        <p className="text-xs font-medium text-slate-400">No unit selected</p>
        <p className="max-w-[180px] text-[10px] leading-snug text-slate-600">
          Click a friendly unit on the map to inspect it and issue orders
        </p>
      </section>
    );
  }

  const factionColor =
    unit.factionId === "rohan"
      ? "text-emerald-400 border-emerald-600/50"
      : "text-red-400 border-red-600/50";
  const factionBg =
    unit.factionId === "rohan" ? "bg-emerald-950/60" : "bg-red-950/60";

  const sLabel = strengthLabel(unit.strength);
  const sColor = strengthColor(unit.strength);
  const sPct = Math.round(unit.strength * 100);

  const mLabel = moraleLabel(unit.morale);
  const mColor = moraleColor(unit.morale);
  const mPct = Math.round(unit.morale);

  return (
    <section className="p-3 space-y-3">
      {/* Identity */}
      <header className={`rounded-md border px-2.5 py-2 ${factionBg} ${factionColor}`}>
        <h2 className="text-sm font-bold leading-tight text-slate-50">{unit.name}</h2>
        <p className={`mt-0.5 text-[10px] font-medium uppercase tracking-wider ${factionColor.split(" ")[0]}`}>
          {factionDisplayName(unit.factionId)}
        </p>
        {nodeName && (
          <p className="mt-1 text-[10px] text-slate-400">
            Stationed at <span className="font-medium text-slate-200">{nodeName}</span>
          </p>
        )}
        {unit.engaged && (
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-red-900/60 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-red-300">
            ⚔ In contact
          </p>
        )}
      </header>

      {/* Strength */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Strength
          </span>
          <span className="text-[10px] text-slate-300">{sLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${sColor} transition-all`}
            style={{ width: `${sPct}%` }}
          />
        </div>
        <p className="mt-0.5 text-[9px] text-slate-500">{troopCount(unit.strength)}</p>
      </div>

      {/* Morale */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Morale
          </span>
          <span className="text-[10px] text-slate-300">{mLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${mColor} transition-all`}
            style={{ width: `${mPct}%` }}
          />
        </div>
      </div>

      {/* Combat qualities */}
      <dl className="grid grid-cols-2 gap-x-2 gap-y-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-[11px]">
        <dt className="text-slate-500">Attack</dt>
        <dd>
          <Tooltip content={`${attackLabel(unit.attack)} (${unit.attack}/10)`}>
            <span className="cursor-help font-mono text-amber-400 tracking-widest">
              {combatStars(unit.attack)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-slate-500">Defence</dt>
        <dd>
          <Tooltip content={`${defenseLabel(unit.defense)} (${unit.defense}/10)`}>
            <span className="cursor-help font-mono text-sky-400 tracking-widest">
              {combatStars(unit.defense)}
            </span>
          </Tooltip>
        </dd>

        <dt className="text-slate-500">Fortification</dt>
        <dd className="text-slate-200">{fortificationLabel(unit.dugIn)}</dd>

        <dt className="text-slate-500">Condition</dt>
        <dd className={unit.tiredness > 0.6 ? "text-amber-400" : "text-slate-200"}>
          {fatigueLabel(unit.tiredness)}
        </dd>

        {(unit.turnsInContact ?? 0) > 0 && (
          <>
            <dt className="text-slate-500">In combat</dt>
            <dd className={unit.turnsInContact! >= 3 ? "text-amber-400" : "text-slate-200"}>
              {unit.turnsInContact} turn{unit.turnsInContact !== 1 ? "s" : ""}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
