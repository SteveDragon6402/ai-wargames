"use client";

import { useState } from "react";
import type { GameOutcome } from "../types";

const WINNER: Record<GameOutcome["winner"], { title: string; color: string }> = {
  north: { title: "Robb Stark is victorious", color: "#6aaad8" },
  westerlands: { title: "Tywin Lannister is victorious", color: "#d87070" },
};

export default function VictoryOverlay({ outcome }: { outcome: GameOutcome }) {
  const [open, setOpen] = useState(true);
  const who = WINNER[outcome.winner];

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          border: "1px solid #2a2a2a",
          background: "#0c0c0c",
          padding: "28px 26px 22px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 8,
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            marginBottom: 10,
          }}
        >
          The war is over
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: who.color,
            marginBottom: 12,
          }}
        >
          {who.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            color: "#aaa",
            lineHeight: 1.55,
          }}
        >
          {outcome.text}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            marginTop: 22,
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            color: "#888",
            background: "none",
            border: "1px solid #2a2a2a",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Look at the board
        </button>
      </div>
    </div>
  );
}
