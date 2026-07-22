"use client";

import { useState } from "react";
import type { GameState, GameAction, Army } from "../types";

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
  // Voluntary reassignment takes priority (player-initiated)
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

  // Post-battle forced commander selection
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
  const [selected, setSelected] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string | null>(null);

  // A notable can be "promoted" — they become the lead commander
  const leaderNames = army.leaders.map((l) => l.name);
  const notableNames = (army.notables ?? []).map((n) => n.name);
  const allCandidates = [...leaderNames, ...notableNames];

  const effectiveSelected = selected ?? promoted ?? leaderNames[0] ?? null;

  function handleConfirm() {
    if (!effectiveSelected) return;
    dispatch({ type: "SELECT_LEAD_COMMANDER", armyId: army.id, leaderName: effectiveSelected });
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
        {/* Header */}
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
              ? "Choose who leads this army. The army will be renamed accordingly."
              : "This army has lost its lead commander. Choose who will take command."}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {/* Current leaders */}
          {leaderNames.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #1a1a1a", paddingBottom: 3, marginBottom: 8 }}>
                Surviving commanders
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {army.leaders.map((l) => {
                  const isSelected = effectiveSelected === l.name;
                  return (
                    <button
                      key={l.name}
                      type="button"
                      onClick={() => { setSelected(l.name); setPromoted(null); }}
                      style={{
                        ...MONO,
                        background: isSelected ? "#1a1200" : "#0a0a0a",
                        border: `1px solid ${isSelected ? "#c8941a" : "#2a2a2a"}`,
                        color: isSelected ? "#c8941a" : "#888",
                        padding: "7px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.12s, color 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#555";
                          e.currentTarget.style.color = "#aaa";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#2a2a2a";
                          e.currentTarget.style.color = "#888";
                        }
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

          {/* Notables that can be promoted */}
          {notableNames.length > 0 && (
            <div>
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
                      onClick={() => { setPromoted(n.name); setSelected(null); }}
                      style={{
                        ...MONO,
                        background: isSelected ? "#0d1a0d" : "#0a0a0a",
                        border: `1px solid ${isSelected ? "#4a8a4a" : "#2a2a2a"}`,
                        color: isSelected ? "#6aaa6a" : "#666",
                        padding: "7px 10px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#444";
                          e.currentTarget.style.color = "#888";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#2a2a2a";
                          e.currentTarget.style.color = "#666";
                        }
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

          {/* No one left */}
          {allCandidates.length === 0 && (
            <div style={{ ...MONO, fontSize: 9, color: "#555", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
              No leaders or notables remain. The army has no commander.
            </div>
          )}

          {/* Preview of new name */}
          {effectiveSelected && (
            <div style={{ marginTop: 14, padding: "8px 10px", border: "1px solid #1e1e1e", background: "#080808" }}>
              <span style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em" }}>New name: </span>
              <span style={{ ...MONO, fontSize: 9, color: "#c8941a" }}>
                {effectiveSelected}&apos;s {getArmySuffix(army.name)}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={!effectiveSelected}
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
              cursor: effectiveSelected ? "pointer" : "default",
              opacity: effectiveSelected ? 1 : 0.4,
            }}
          >
            Confirm Command
          </button>
        </div>
      </div>
    </div>
  );
}

function getArmySuffix(armyName: string): string {
  const words = armyName.split(" ");
  return words.length >= 2 ? words[words.length - 1] : "Host";
}
