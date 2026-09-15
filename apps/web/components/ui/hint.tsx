"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          "max-w-[260px] border border-border bg-popover px-3 py-2 text-left text-[13px] font-normal leading-snug text-popover-foreground shadow-lg",
          className
        )}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
