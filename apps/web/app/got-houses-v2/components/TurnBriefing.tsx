"use client";

import type { Faction, GameAction, GameState } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { blockingChoicesFor } from "../lib/pending-choices";
import { Button } from "@/components/ui/button";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  faction: Faction;
}

export default function TurnBriefing({ state, dispatch, faction }: Props) {
  if (!state.briefingOpen) return null;
  const reports = (state.battleReports ?? []).filter((r) => r.turn === state.turn - 1);
  const choices = blockingChoicesFor(state.pendingChoices, faction);
  if (reports.length === 0 && choices.length === 0 && state.turn === 1) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/80 p-4">
      <div className="w-[440px] max-w-[92vw] rounded-sm border border-border bg-card p-5 shadow-xl">
        <div className="font-display text-2xl text-foreground">
          Turn {state.turn}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">What stands from the last march.</p>

        {reports.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-medium text-muted-foreground">Battles</div>
            <ul className="mt-2 space-y-1.5">
              {reports.map((r) => (
                <li key={r.id} className="text-[14px] leading-snug text-foreground/90">
                  {r.headline ??
                    twelveWords(r.shortSummary) ??
                    `${HOLDS_MAP.get(r.holdId)?.name ?? r.holdId} fought`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {choices.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-medium text-primary">You must settle these</div>
            <div className="mt-2 space-y-2">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    dispatch({ type: "SELECT_HOLD", holdId: c.holdId });
                    dispatch({ type: "SET_BRIEFING_OPEN", open: false });
                  }}
                  className="block w-full rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-left text-[13px] text-primary"
                >
                  {c.headline}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => dispatch({ type: "SET_BRIEFING_OPEN", open: false })}
        >
          {choices.length > 0 ? "Decide on the map" : "To the map"}
        </Button>
      </div>
    </div>
  );
}

function twelveWords(text: string | undefined): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).slice(0, 12);
  return words.join(" ");
}
