"use client";

import type { Army, UnitType } from "../types";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/hint";
import { cn } from "@/lib/utils";

type StanceOrder = "rest" | "fortify" | null;

const UNIT_LABELS: Record<UnitType, string> = {
  cavalry: "Cavalry",
  infantry: "Infantry",
  archers: "Archers",
};

interface Props {
  army: Army;
  isSelected: boolean;
  hasOrder: boolean;
  stanceOrder?: StanceOrder;
  hadSpeech?: boolean;
  isLocked: boolean;
  onTheWalls?: boolean;
  onClick: (armyId: string, shift: boolean) => void;
}

export default function ArmyCard({
  army,
  isSelected,
  hasOrder,
  stanceOrder,
  hadSpeech,
  isLocked,
  onTheWalls,
  onClick,
}: Props) {
  const isNorth = army.faction === "north";
  const totalUnits = army.units.reduce((s, u) => s + u.count, 0);
  const commander = army.leaders[0];
  const byType = army.units.reduce<Partial<Record<UnitType, number>>>(
    (acc, unit) => {
      acc[unit.type] = (acc[unit.type] ?? 0) + unit.count;
      return acc;
    },
    {}
  );

  const status =
    onTheWalls
      ? "On the walls"
      : stanceOrder === "rest"
        ? "Resting"
        : stanceOrder === "fortify"
          ? "Fortifying"
          : hadSpeech
            ? "Speech given"
            : hasOrder
              ? "Marching"
              : null;

  return (
    <Hint
      label={
        isLocked
          ? "Orders locked — this host cannot be changed"
          : "Click to select. Shift-click to add or remove."
      }
    >
      <div
        role="button"
        tabIndex={isLocked ? -1 : 0}
        onClick={(e) => !isLocked && onClick(army.id, e.shiftKey)}
        onKeyDown={(e) => {
          if (isLocked) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(army.id, e.shiftKey);
          }
        }}
        className={cn(
          "rounded-sm border px-3 py-2.5 transition-colors",
          isNorth ? "border-north/25" : "border-west/25",
          isSelected
            ? isNorth
              ? "bg-north-deep/80 ring-1 ring-north/60"
              : "bg-west-deep/80 ring-1 ring-west/60"
            : "bg-background/40 hover:bg-accent",
          isLocked && !isSelected && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={cn(
                "truncate text-[13px] font-medium",
                isSelected
                  ? isNorth
                    ? "text-north"
                    : "text-west"
                  : "text-foreground"
              )}
            >
              {army.name}
            </div>
            {commander && (
              <div className="truncate text-[12px] text-muted-foreground">
                {commander.title
                  ? `${commander.name} — ${commander.title}`
                  : commander.name}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[13px] text-foreground">
              {totalUnits.toLocaleString()}
            </div>
            {status && (
              <Badge
                variant="outline"
                className="mt-1 h-5 px-1.5 text-[10px] font-normal"
              >
                {status}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {(["cavalry", "infantry", "archers"] as UnitType[]).map((type) => {
            const n = byType[type];
            if (!n) return null;
            return (
              <span key={type}>
                {UNIT_LABELS[type]} {n.toLocaleString()}
              </span>
            );
          })}
        </div>

        <div className="mt-2 space-y-0.5 text-[12px] leading-snug text-muted-foreground">
          <div>
            <span className="text-muted-foreground/70">Morale </span>
            {army.morale}
          </div>
          <div>
            <span className="text-muted-foreground/70">Condition </span>
            {army.tiredness}
          </div>
          {army.stance && (
            <div>
              <span className="text-muted-foreground/70">Stance </span>
              {army.stance}
            </div>
          )}
        </div>

        {army.notables && army.notables.length > 0 && (
          <div className="mt-2 border-t border-border/60 pt-2">
            {army.notables.map((n) => (
              <div key={n.name} className="mb-1 last:mb-0">
                <div className="text-[12px] text-foreground/80">{n.name}</div>
                <div className="text-[11px] italic leading-snug text-muted-foreground">
                  {n.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Hint>
  );
}
