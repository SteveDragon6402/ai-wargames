"use client";

import { Children, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { HoldTip } from "@/components/ui/hold-tip";
import { cn } from "@/lib/utils";

export function OrderButton({
  label,
  hint,
  disabledHint,
  disabled = false,
  active = false,
  accent = false,
  spendsTurn = false,
  onClick,
}: {
  label: string;
  hint: string;
  disabledHint?: string;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
  /** True when this order is the host's action for the turn. */
  spendsTurn?: boolean;
  onClick: () => void;
}) {
  const body = disabled ? disabledHint ?? hint : hint;
  return (
    <HoldTip
      side="left"
      content={
        <div className="space-y-1.5">
          <div className="font-display text-[16px] leading-tight text-foreground">
            {label}
          </div>
          <div
            className={cn(
              "text-[11px] font-medium",
              spendsTurn ? "text-primary" : "text-muted-foreground"
            )}
          >
            {spendsTurn ? "This is their job for the turn" : "They can still march or rest"}
          </div>
          <p className="text-[12px] font-normal leading-snug text-popover-foreground/90">
            {body}
          </p>
        </div>
      }
    >
      <span className={cn("inline-flex max-w-full", disabled && "cursor-not-allowed")}>
        <Button
          type="button"
          size="sm"
          variant={accent ? "default" : active ? "secondary" : "outline"}
          disabled={disabled}
          onClick={onClick}
            className={cn(
              "relative h-8 max-w-full overflow-hidden rounded-sm px-2.5 text-[12px] font-medium tracking-normal",
            active &&
              !accent &&
              "border-primary/70 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
          )}
        >
            <span className="truncate">{label}</span>
          </Button>
      </span>
    </HoldTip>
  );
}

export function OrderGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className="flex min-w-0 flex-wrap gap-1.5">{items}</div>
    </div>
  );
}
