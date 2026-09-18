"use client";

import { useState, type MouseEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Army, UnitType } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StanceOrder = "rest" | "fortify" | null;

const UNIT_SHORT: Record<UnitType, string> = {
  cavalry: "Cav",
  infantry: "Inf",
  archers: "Arch",
};

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
  const [open, setOpen] = useState(false);
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
      <div className="flex min-w-0 items-stretch">
        <button
          type="button"
          onClick={select}
          disabled={isLocked}
          className={cn(
            "min-w-0 flex-1 px-2.5 py-2 text-left",
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
                  className="mt-0.5 h-4 px-1 text-[10px] font-normal"
                >
                  {status}
                </Badge>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Hide host details" : "Show host details"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="flex w-7 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border/60 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
          {commander && (
            <div className="truncate text-foreground/85">
              {commander.title
                ? `${commander.name} — ${commander.title}`
                : commander.name}
            </div>
          )}
          {(["cavalry", "infantry", "archers"] as UnitType[]).map((type) => {
            const rows = army.units.filter((u) => u.type === type);
            if (rows.length === 0) return null;
            return (
              <div key={type}>
                <div className="text-[11px] text-muted-foreground/80">
                  {UNIT_LABELS[type]}
                </div>
                {rows.map((row) => (
                  <div
                    key={`${row.house}-${row.type}`}
                    className="flex justify-between gap-2 pl-2"
                  >
                    <span className="min-w-0 truncate">{row.house}</span>
                    <span className="shrink-0 font-mono">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
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
          {army.notables && army.notables.length > 0 && (
            <div className="border-t border-border/60 pt-2">
              {army.notables.map((n) => (
                <div key={n.name} className="mb-1 last:mb-0">
                  <div className="text-foreground/80">{n.name}</div>
                  <div className="italic">{n.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
