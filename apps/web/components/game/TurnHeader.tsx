"use client";

import Link from "next/link";
import { factionDisplayName } from "@/lib/unit-labels";

interface TurnHeaderProps {
  code: string;
  turn: number;
  faction: string;
  secondsLeft: number;
  mySubmitted: boolean;
  readyPlayerIds: string[];
  totalPlayers: number;
  winner: string | null;
  onSubmit: () => void;
  submitting: boolean;
  /** Solo mode: show faction switcher to command both sides */
  soloDualFaction?: boolean;
  activeFaction?: string;
  onFactionChange?: (faction: string) => void;
}

export function TurnHeader({
  code,
  turn,
  faction,
  secondsLeft,
  mySubmitted,
  readyPlayerIds,
  totalPlayers,
  winner,
  onSubmit,
  submitting,
  soloDualFaction,
  activeFaction,
  onFactionChange,
}: TurnHeaderProps) {
  const displayFaction = soloDualFaction ? (activeFaction ?? faction) : faction;
  const mm = Math.floor(secondsLeft / 60);
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const urgent = secondsLeft > 0 && secondsLeft <= 15;

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
      <section className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <Link href="/" className="text-[10px] text-slate-600 hover:text-slate-400">
          ← Home
        </Link>
        <span className="font-mono text-base font-bold tracking-widest text-amber-400">
          {code}
        </span>
        <span className="text-slate-500">Turn {turn}</span>
        {soloDualFaction && onFactionChange ? (
          <span className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-slate-600">
              Commanding
            </span>
            {(["rohan", "isengard"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFactionChange(f)}
                className={`rounded-full px-2 py-px text-[10px] font-semibold transition ${
                  displayFaction === f
                    ? f === "rohan"
                      ? "bg-emerald-700 text-emerald-100 ring-1 ring-emerald-500"
                      : "bg-red-800 text-red-100 ring-1 ring-red-500"
                    : "bg-slate-800/80 text-slate-500 hover:text-slate-300"
                }`}
              >
                {factionDisplayName(f)}
              </button>
            ))}
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-px text-[10px] font-semibold ${
              displayFaction === "rohan"
                ? "bg-emerald-900/70 text-emerald-300"
                : displayFaction === "isengard"
                  ? "bg-red-900/70 text-red-300"
                  : "bg-slate-800 text-slate-200"
            }`}
          >
            {factionDisplayName(displayFaction)}
          </span>
        )}
        {soloDualFaction && (
          <span className="rounded bg-amber-900/40 px-1.5 py-px text-[9px] font-medium text-amber-400">
            Solo · both sides
          </span>
        )}
      </section>

      <section className="flex items-center gap-2">
        {winner ? (
          <span className="text-sm font-semibold text-amber-400">
            {winner ? factionDisplayName(winner) : ""} wins!
          </span>
        ) : (
          <>
            <span
              className={`font-mono text-xl tabular-nums ${urgent ? "text-red-400" : "text-slate-100"}`}
            >
              {mm}:{ss}
            </span>
            <span className="hidden text-[10px] text-slate-500 sm:inline">
              Ready {readyPlayerIds.length}/{totalPlayers}
              {mySubmitted && " · Locked"}
            </span>
            <button
              type="button"
              disabled={submitting || mySubmitted}
              onClick={onSubmit}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {mySubmitted ? "Orders locked" : "Submit orders"}
            </button>
          </>
        )}
      </section>
    </header>
  );
}
