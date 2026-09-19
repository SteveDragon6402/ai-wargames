"use client";

import type { ReactNode } from "react";
import { HoldTip } from "@/components/ui/hold-tip";
import { cn } from "@/lib/utils";

interface HintProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Hint({ label, children, side = "top", className }: HintProps) {
  if (!label) return <>{children}</>;
  return (
    <HoldTip
      content={label}
      side={side}
      className={cn("px-3 py-2", className)}
    >
      {children}
    </HoldTip>
  );
}
