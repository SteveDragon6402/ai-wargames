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
    <header className="flex shrink-0 items-center justify-between border-b border-hairline bg-canvas-soft px-4 py-2 text-xs font-mono">
      {/* Left: logo + room context */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-xs font-semibold tracking-tight text-primary-soft transition-opacity hover:opacity-70"
        >
          War Room: Middle-earth
        </Link>
        <span className="text-hairline">|</span>
        <span className="font-medium text-mute">
          CODE: <span className="text-body">{code}</span>
        </span>
        <span className="text-mute">
          TURN <span className="text-body">{turn}</span>
        </span>

        {/* Faction badge / switcher */}
        {soloDualFaction && onFactionChange ? (
          <div className="flex items-center gap-1">
            <span className="text-mute">CMD:</span>
            {(["rohan", "isengard"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFactionChange(f)}
                className="rounded-xs px-2 py-px text-xs font-semibold uppercase tracking-wide transition-all"
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
            className="rounded-xs px-2 py-px text-xs font-semibold uppercase tracking-wide"
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
          <span className="text-sm font-semibold uppercase tracking-wide text-primary-soft">
            {(FACTION_LABEL[winner] ?? winner)} WINS
          </span>
        ) : resolving ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs uppercase tracking-wide text-mute">
              Resolving orders…
            </span>
          </div>
        ) : (
          <>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-mute">
                Turn Deadline
              </div>
              <div
                className="text-xl font-semibold leading-none tabular-nums"
                style={{ color: urgent ? "var(--stat-bad)" : "#e8e8e8" }}
              >
                {mm}:{ss}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-xs uppercase tracking-wide text-mute">
                Ready {readyPlayerIds.length}/{totalPlayers}
                {mySubmitted ? " · Locked" : ""}
              </span>
              <button
                type="button"
                disabled={submitting || mySubmitted}
                onClick={onSubmit}
                className="btn-primary"
                style={{ padding: "6px 16px", fontSize: "11px" }}
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
