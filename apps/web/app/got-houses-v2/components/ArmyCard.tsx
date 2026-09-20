"use client";

import type { MouseEvent } from "react";
import type { Army, UnitType } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StanceOrder = "rest" | "fortify" | null;

const UNIT_SHORT: Record<UnitType, string> = {
  cavalry: "Cav",
  infantry: "Inf",
  archers: "Arch",
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
      ? "Walls"
      : stanceOrder === "rest"
        ? "Rest"
        : stanceOrder === "fortify"
          ? "Fortify"
          : hadSpeech
            ? "Speech"
            : hasOrder
              ? "March"
              : null;

  function select(e: MouseEvent) {
    if (isLocked) return;
    onClick(army.id, e.shiftKey);
  }

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-sm border",
        isNorth ? "border-north/25" : "border-west/25",
        isSelected
          ? isNorth
            ? "bg-north-deep/80 ring-1 ring-north/60"
            : "bg-west-deep/80 ring-1 ring-west/60"
          : "bg-background/40",
        isLocked && !isSelected && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={select}
        disabled={isLocked}
        className={cn(
          "w-full min-w-0 px-2.5 py-2 text-left",
          !isLocked && "hover:bg-accent/40"
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
            <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {commander
                ? commander.title
                  ? `${commander.name} — ${commander.title}`
                  : commander.name
                : "No named captain"}
            </div>
            <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
              {(["infantry", "archers", "cavalry"] as UnitType[]).map((type) => {
                const n = byType[type];
                if (!n) return null;
                return (
                  <span key={type} className="whitespace-nowrap">
                    {UNIT_SHORT[type]} {n.toLocaleString()}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[13px] text-foreground">
              {totalUnits.toLocaleString()}
            </div>
            {status && (
              <Badge
                variant="outline"
                className="mt-0.5 h-4 max-w-[72px] truncate px-1 text-[10px] font-normal"
              >
                {status}
              </Badge>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[12px] leading-snug text-muted-foreground">
            <div className="break-words">
              <span className="text-muted-foreground/70">Morale </span>
              {army.morale}
            </div>
            <div className="break-words">
              <span className="text-muted-foreground/70">Condition </span>
              {army.tiredness}
            </div>
            {army.stance && (
              <div className="break-words">
                <span className="text-muted-foreground/70">Stance </span>
                {army.stance}
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
