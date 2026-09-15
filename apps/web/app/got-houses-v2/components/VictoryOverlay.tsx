"use client";

import { useState } from "react";
import type { GameOutcome } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WINNER: Record<GameOutcome["winner"], { title: string; tone: string }> = {
  north: { title: "Robb Stark is victorious", tone: "text-north" },
  westerlands: { title: "Tywin Lannister is victorious", tone: "text-west" },
};

export default function VictoryOverlay({ outcome }: { outcome: GameOutcome }) {
  const [open, setOpen] = useState(true);
  const who = WINNER[outcome.winner];

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-6">
      <div className="w-[min(440px,100%)] rounded-sm border border-border bg-card p-6">
        <div className="text-[12px] text-muted-foreground">The war is over</div>
        <div className={cn("mt-2 font-display text-3xl leading-tight", who.tone)}>
          {who.title}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {outcome.text}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => setOpen(false)}
        >
          Look at the board
        </Button>
      </div>
    </div>
  );
}
