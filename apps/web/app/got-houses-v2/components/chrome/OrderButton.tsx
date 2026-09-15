"use client";

import { Children, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { cn } from "@/lib/utils";

export function OrderButton({
  label,
  hint,
  disabledHint,
  disabled = false,
  active = false,
  accent = false,
  onClick,
}: {
  label: string;
  hint: string;
  disabledHint?: string;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <Hint label={disabled ? disabledHint ?? hint : hint}>
      <span className="inline-flex">
        <Button
          type="button"
          size="sm"
          variant={accent ? "default" : active ? "secondary" : "outline"}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "h-8 rounded-sm px-2.5 text-[12px] font-medium tracking-normal",
            active &&
              !accent &&
              "border-primary/70 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
          )}
        >
          {label}
        </Button>
      </span>
    </Hint>
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
    <div className="space-y-1.5">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">{items}</div>
    </div>
  );
}
