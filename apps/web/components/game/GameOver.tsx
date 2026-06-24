"use client";

import Link from "next/link";

interface GameOverProps {
  winner: string;
  myFaction: string;
  totalUnitsLost?: number;
  finalMorale?: number;
  turn: number;
}

const FACTION_DISPLAY: Record<string, string> = {
  rohan: "ROHAN",
  isengard: "ISENGARD",
};

const FACTION_SUBTITLE: Record<string, string> = {
  rohan: "The Horse-lords Prevail at the Fords of Isen",
  isengard: "The White Hand Crushes All Resistance",
};

const FACTION_ICON: Record<string, string> = {
  rohan: "⚔",
  isengard: "✊",
};

const FACTION_TEXT: Record<string, string> = {
  rohan: "var(--faction-rohan)",
  isengard: "var(--faction-isengard)",
};

export function GameOver({ winner, myFaction, totalUnitsLost, finalMorale, turn }: GameOverProps) {
  const isVictor = winner === myFaction;
  const winnerLabel = FACTION_DISPLAY[winner] ?? winner.toUpperCase();
  const subtitle = FACTION_SUBTITLE[winner] ?? `${winnerLabel} wins the field`;
  const icon = FACTION_ICON[winner] ?? "⚔";
  const accentColor = FACTION_TEXT[winner] ?? "var(--color-primary)";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(ellipse at center, #1a1a1a 0%, #101010 70%)" }}
    >
      {/* Winner heading */}
      <h1 className="mb-2 text-center font-narrative text-6xl font-semibold tracking-wide text-primary-soft">
        THE WAR IS {isVictor ? "WON" : "LOST"}
      </h1>

      <p className="mb-10 text-center text-xs uppercase tracking-[0.25em] text-mute">
        {subtitle}
      </p>

      {/* Faction emblem card */}
      <div
        className="mb-10 flex h-48 w-80 items-center justify-center rounded-md border border-hairline bg-canvas-soft"
        style={{ boxShadow: `0 0 60px ${accentColor}22` }}
      >
        <div className="text-center">
          <div
            className="mb-3 text-6xl"
            style={{ filter: `drop-shadow(0 0 20px ${accentColor})` }}
          >
            {icon}
          </div>
          <div
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {winnerLabel}
          </div>
          <div
            className="mt-1 h-0.5 mx-auto w-16"
            style={{ background: accentColor, opacity: 0.5 }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-10 flex items-stretch gap-0">
        {[
          { icon: "⚔", value: turn.toString(), label: "Turns Fought" },
          totalUnitsLost != null
            ? { icon: "✖", value: totalUnitsLost.toLocaleString(), label: "Units Lost" }
            : null,
          finalMorale != null
            ? { icon: "♥", value: `${finalMorale}%`, label: "Final Morale" }
            : null,
        ]
          .filter(Boolean)
          .map((stat, i) => (
            <div
              key={i}
              className={`flex flex-col items-center border border-hairline px-8 py-4 ${
                i === 1 ? "bg-canvas-soft" : "bg-canvas"
              } ${i > 0 ? "border-l-0" : ""}`}
              style={{ minWidth: 120 }}
            >
              <span className="mb-1 text-xl text-mute">{stat!.icon}</span>
              <span className="text-2xl font-semibold tabular-nums text-ink font-mono">
                {stat!.value}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-mute">
                {stat!.label}
              </span>
            </div>
          ))}
      </div>

      {/* Ticker */}
      <div className="mb-8 text-xs uppercase tracking-[0.2em] text-hairline-dim">
        &gt; ENGAGEMENT CONCLUDED · AWAITING NEW ORDERS FROM THE COMMANDER…
      </div>

      {/* Return link */}
      <Link href="/" className="btn-primary">
        Return to Command →
      </Link>
    </div>
  );
}
