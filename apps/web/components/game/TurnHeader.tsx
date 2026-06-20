"use client";

import Link from "next/link";

interface TurnHeaderProps {
  code: string;
  turn: number;
  faction: string;
  secondsLeft: number;
  mySubmitted: boolean;
  readyPlayerIds: string[];
  totalPlayers: number;
  winner: string | null;
  resolving: boolean;
  onSubmit: () => void;
  submitting: boolean;
  soloDualFaction?: boolean;
  activeFaction?: string;
  onFactionChange?: (faction: string) => void;
}

const FACTION_LABEL: Record<string, string> = {
  rohan: "ROHAN",
  isengard: "ISENGARD",
};

const FACTION_COLOR: Record<string, string> = {
  rohan: "#5ecb6b",
  isengard: "#e05555",
};

export function TurnHeader({
  code,
  turn,
  faction,
  secondsLeft,
  mySubmitted,
  readyPlayerIds,
  totalPlayers,
  winner,
  resolving,
  onSubmit,
  submitting,
  soloDualFaction,
  activeFaction,
  onFactionChange,
}: TurnHeaderProps) {
  const displayFaction = soloDualFaction ? (activeFaction ?? faction) : faction;
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const urgent = secondsLeft > 0 && secondsLeft <= 15;

  return (
    <header
      className="flex shrink-0 items-center justify-between px-4 py-2 text-[11px]"
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {/* Left: logo + room context */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ color: "var(--color-gold)" }}
        >
          ✕ WAR ROOM: MIDDLE-EARTH
        </Link>
        <span style={{ color: "var(--color-border)" }}>|</span>
        <span className="font-bold tracking-widest" style={{ color: "#555" }}>
          CODE:{" "}
          <span style={{ color: "#ccc" }}>{code}</span>
        </span>
        <span style={{ color: "#444" }}>
          TURN <span style={{ color: "#ccc" }}>{turn}</span>
        </span>

        {/* Faction badge / switcher */}
        {soloDualFaction && onFactionChange ? (
          <div className="flex items-center gap-1">
            <span style={{ color: "#444" }}>CMD:</span>
            {(["rohan", "isengard"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFactionChange(f)}
                className="rounded px-2 py-px text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  color: displayFaction === f ? FACTION_COLOR[f] : "#444",
                  border: `1px solid ${displayFaction === f ? FACTION_COLOR[f] : "#2a2a2a"}`,
                  background: "transparent",
                }}
              >
                {FACTION_LABEL[f] ?? f}
              </button>
            ))}
          </div>
        ) : (
          <span
            className="rounded px-2 py-px text-[9px] font-bold uppercase tracking-wider"
            style={{
              color: FACTION_COLOR[displayFaction] ?? "#888",
              border: `1px solid ${FACTION_COLOR[displayFaction] ?? "#444"}`,
            }}
          >
            {FACTION_LABEL[displayFaction] ?? displayFaction}
          </span>
        )}
      </div>

      {/* Right: turn deadline + submit */}
      <div className="flex items-center gap-4">
        {winner ? (
          <span
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: "var(--color-gold)" }}
          >
            {(FACTION_LABEL[winner] ?? winner)} WINS
          </span>
        ) : resolving ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ background: "var(--color-gold)" }}
            />
            <span style={{ color: "#888" }} className="uppercase tracking-widest text-[10px]">
              Resolving orders…
            </span>
          </div>
        ) : (
          <>
            <div className="text-right">
              <div
                className="text-[9px] uppercase tracking-widest"
                style={{ color: "#444" }}
              >
                Turn Deadline
              </div>
              <div
                className="font-bold tabular-nums text-xl leading-none"
                style={{ color: urgent ? "#e05555" : "#e8e8e8" }}
              >
                {mm}:{ss}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: "#444" }}>
                Ready {readyPlayerIds.length}/{totalPlayers}
                {mySubmitted ? " · Locked" : ""}
              </span>
              <button
                type="button"
                disabled={submitting || mySubmitted}
                onClick={onSubmit}
                className="btn-gold"
                style={{ padding: "6px 16px", fontSize: "10px" }}
              >
                {mySubmitted ? "Orders Locked" : "Submit Turn"}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
