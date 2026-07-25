"use client";

import { useState } from "react";
import type { GameState, GameAction, Army } from "../types";
import { armyNameForCommander } from "../lib/army-naming";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };

const FACTION_COLORS = {
  north: { accent: "#3a6ea8", text: "#6aaad8", border: "#1a3a5a" },
  westerlands: { accent: "#b03030", text: "#d87070", border: "#5a1a1a" },
};

export default function CommanderRenamePanel({ state, dispatch }: Props) {
  if (state.voluntaryCommanderChange) {
    const army = state.armies.find((a) => a.id === state.voluntaryCommanderChange);
    if (army) {
      return (
        <ArmyRenameCard
          key={army.id}
          army={army}
          dispatch={dispatch}
          mode="voluntary"
        />
      );
    }
  }

  const armies = state.pendingRenames
    .map((id) => state.armies.find((a) => a.id === id))
    .filter(Boolean) as Army[];

  if (armies.length === 0) return null;

  const army = armies[0];
  return <ArmyRenameCard key={army.id} army={army} dispatch={dispatch} mode="forced" />;
}

function ArmyRenameCard({
  army,
  dispatch,
  mode,
}: {
  army: Army;
  dispatch: React.Dispatch<GameAction>;
  mode: "forced" | "voluntary";
}) {
  const colors = FACTION_COLORS[army.faction];
  /** null = explicitly no commander; undefined = not chosen yet */
  const [selected, setSelected] = useState<string | null | undefined>(undefined);

  const leaderNames = army.leaders.map((l) => l.name);
  const notableNames = (army.notables ?? []).map((n) => n.name);
  const allCandidates = [...leaderNames, ...notableNames];

  const effectiveSelected =
    selected === undefined
      ? mode === "forced" && allCandidates.length === 0
        ? null
        : leaderNames[0] ?? notableNames[0] ?? null
      : selected;

  const previewName = armyNameForCommander(
    effectiveSelected,
    army.units,
    army.faction,
    army.name
  );

  function handleConfirm() {
    dispatch({
      type: "SELECT_LEAD_COMMANDER",
      armyId: army.id,
      leaderName: effectiveSelected,
    });
  }

  const totalUnits = army.units.reduce((s, u) => s + u.count, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#0d0d0d",
          border: `1px solid ${colors.border}`,
          width: 420,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            padding: "12px 16px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ ...MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#c8941a", marginBottom: 4 }}>
              {mode === "voluntary" ? "Appoint Commander" : "Commander Lost"}
            </div>
            {mode === "voluntary" && (
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_COMMANDER_CHANGE" })}
                style={{
                  ...MONO,
                  fontSize: 10,
                  color: "#333",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginTop: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ ...MONO, fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            {army.name} · {totalUnits.toLocaleString()} troops
          </div>
          <div style={{ ...MONO, fontSize: 9, color: "#666", lineHeight: 1.6 }}>
            {mode === "voluntary"
              ? "Choose who leads this army, promote a notable, or leave it without a named commander."
              : "This army has lost its lead commander. Appoint a successor, promote a notable, or leave it commanderless."}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {leaderNames.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #1a1a1a", paddingBottom: 3, marginBottom: 8 }}>
                Commanders
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {army.leaders.map((l) => {
                  const isSelected = effectiveSelected === l.name;
                  return (
                    <button
                      key={l.name}
                      type="button"
                      onClick={() => setSelected(l.name)}
                      style={{
                        ...MONO,
                        background: isSelected ? "#1a1200" : "#0a0a0a",
                        border: `1px solid ${isSelected ? "#c8941a" : "#2a2a2a"}`,
                        color: isSelected ? "#c8941a" : "#888",
                        padding: "7px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {l.name}
                      </div>
                      {l.title && (
                        <div style={{ fontSize: 8, color: "#555", marginTop: 2, fontStyle: "italic" }}>
                          {l.title}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {notableNames.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #1a1a1a", paddingBottom: 3, marginBottom: 8 }}>
                Notable figures — promote to commander
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(army.notables ?? []).map((n) => {
                  const isSelected = effectiveSelected === n.name;
                  return (
                    <button
                      key={n.name}
                      type="button"
                      onClick={() => setSelected(n.name)}
                      style={{
                        ...MONO,
                        background: isSelected ? "#0d1a0d" : "#0a0a0a",
                        border: `1px solid ${isSelected ? "#4a8a4a" : "#2a2a2a"}`,
                        color: isSelected ? "#6aaa6a" : "#666",
                        padding: "7px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {n.name}
                        <span style={{ fontSize: 7, color: "#4a7a4a", marginLeft: 6, letterSpacing: "0.1em" }}>PROMOTE</span>
                      </div>
                      <div style={{ fontSize: 8, color: "#444", marginTop: 2, fontStyle: "italic" }}>
                        {n.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                ...MONO,
                width: "100%",
                background: effectiveSelected === null ? "#1a1510" : "#0a0a0a",
                border: `1px solid ${effectiveSelected === null ? "#3a2a00" : "#2a2a2a"}`,
                color: effectiveSelected === null ? "#c8941a" : "#666",
                padding: "7px 10px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                No commander
              </div>
              <div style={{ fontSize: 8, color: "#555", marginTop: 2 }}>
                Host takes a house name (e.g. Lannister Host)
              </div>
            </button>
          </div>

          <div style={{ marginTop: 14, padding: "8px 10px", border: "1px solid #1e1e1e", background: "#080808" }}>
            <span style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em" }}>Name: </span>
            <span style={{ ...MONO, fontSize: 9, color: "#c8941a" }}>
              {previewName}
            </span>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #1e1e1e",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "5px 18px",
              border: "1px solid #3a2a00",
              background: "#1a1200",
              color: "#c8941a",
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
