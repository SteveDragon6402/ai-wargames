"use client";

import type { Faction, GameAction, GameState } from "../types";
import { HOLDS_MAP } from "../data/holds";
import { blockingChoicesFor } from "../lib/pending-choices";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
};

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#0d0b06",
          border: "1px solid #3a2a10",
          padding: 16,
        }}
      >
        <div style={{ ...MONO, fontSize: 9, color: "#7a6a3a", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Turn {state.turn} — what stands
        </div>

        {reports.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...MONO, fontSize: 8, color: "#5a4a2a", marginBottom: 6 }}>BATTLES</div>
            {reports.map((r) => (
              <div key={r.id} style={{ ...MONO, fontSize: 11, color: "#c8b88a", marginBottom: 4 }}>
                {r.headline ?? twelveWords(r.shortSummary) ?? `${HOLDS_MAP.get(r.holdId)?.name ?? r.holdId} fought`}
              </div>
            ))}
          </div>
        )}

        {choices.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...MONO, fontSize: 8, color: "#c8941a", marginBottom: 6 }}>
              YOU MUST SETTLE THESE
            </div>
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  dispatch({ type: "SELECT_HOLD", holdId: c.holdId });
                  dispatch({ type: "SET_BRIEFING_OPEN", open: false });
                }}
                style={{
                  ...MONO,
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  fontSize: 11,
                  color: "#f0d080",
                  background: "#1a1406",
                  border: "1px solid #c8941a",
                  padding: "7px 9px",
                  marginBottom: 6,
                  cursor: "pointer",
                }}
              >
                {c.headline} — click to decide
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: "SET_BRIEFING_OPEN", open: false })}
          style={{
            ...MONO,
            marginTop: 14,
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#888",
            background: "transparent",
            border: "1px solid #333",
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          {choices.length > 0 ? "Decide in the field" : "To the map"}
        </button>
      </div>
    </div>
  );
}

function twelveWords(text: string | undefined): string | null {
  if (!text) return null;
  const words = text.trim().split(/\s+/).slice(0, 12);
  return words.join(" ");
}
