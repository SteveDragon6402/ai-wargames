"use client";

import { useState, useMemo } from "react";
import type { GameState, GameAction, Army, ArmyUnit, SplitConfig } from "../types";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };

export default function SplitPanel({ state, dispatch }: Props) {
  const army = state.armies.find((a) => a.id === state.splitPanelArmyId);
  if (!army) return null;

  return <SplitPanelInner army={army} dispatch={dispatch} />;
}

function SplitPanelInner({
  army,
  dispatch,
}: {
  army: Army;
  dispatch: React.Dispatch<GameAction>;
}) {
  // Per unit group: how many go to army 1 (remainder go to army 2)
  const [unitSplit, setUnitSplit] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const u of army.units) {
      init[unitKey(u)] = 0; // default: all to army 2
    }
    return init;
  });

  // Leaders: "1" or "2"
  const [leaderSplit, setLeaderSplit] = useState<Record<string, "1" | "2">>(() => {
    const init: Record<string, "1" | "2"> = {};
    for (const l of army.leaders) {
      init[l.name] = "2"; // default: all to army 2
    }
    return init;
  });

  // Notables: "1" or "2"
  const [notableSplit, setNotableSplit] = useState<Record<string, "1" | "2">>(() => {
    const init: Record<string, "1" | "2"> = {};
    for (const n of army.notables ?? []) {
      init[n.name] = "2";
    }
    return init;
  });

  // Validate: each army must have at least 1 unit and at least 1 leader
  const army1Units: ArmyUnit[] = army.units
    .map((u) => ({ ...u, count: unitSplit[unitKey(u)] ?? 0 }))
    .filter((u) => u.count > 0);
  const army2Units: ArmyUnit[] = army.units
    .map((u) => ({ ...u, count: u.count - (unitSplit[unitKey(u)] ?? 0) }))
    .filter((u) => u.count > 0);

  const army1Leaders = army.leaders.filter((l) => leaderSplit[l.name] === "1");
  const army2Leaders = army.leaders.filter((l) => leaderSplit[l.name] === "2");

  const army1TotalUnits = army1Units.reduce((s, u) => s + u.count, 0);
  const army2TotalUnits = army2Units.reduce((s, u) => s + u.count, 0);

  const canConfirm =
    army1TotalUnits > 0 &&
    army2TotalUnits > 0 &&
    army1Leaders.length > 0 &&
    army2Leaders.length > 0;

  const isValid = useMemo(() => canConfirm, [canConfirm]);

  function handleConfirm() {
    if (!isValid) return;
    const config: SplitConfig = {
      sourceArmyId: army.id,
      army1: {
        units: army1Units,
        leaderNames: army1Leaders.map((l) => l.name),
        notableNames: (army.notables ?? [])
          .filter((n) => notableSplit[n.name] === "1")
          .map((n) => n.name),
      },
      army2: {
        units: army2Units,
        leaderNames: army2Leaders.map((l) => l.name),
        notableNames: (army.notables ?? [])
          .filter((n) => notableSplit[n.name] === "2")
          .map((n) => n.name),
      },
    };
    dispatch({ type: "SPLIT_ARMY", config });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#0d0d0d",
          border: "1px solid #2a2a2a",
          width: 560,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ ...MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#c8941a" }}>
              Split Army
            </div>
            <div style={{ ...MONO, fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
              {army.name}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "CLOSE_SPLIT" })}
            style={{ ...MONO, fontSize: 10, color: "#333", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", gap: 4, marginBottom: 8, alignItems: "center" }}>
            <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em" }}>Unit Group</div>
            <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>← All A1</div>
            <div style={{ ...MONO, fontSize: 8, color: "#3a6ea8", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Army 1</div>
            <div style={{ ...MONO, fontSize: 8, color: "#b03030", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Army 2</div>
            <div style={{ ...MONO, fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>All A2 →</div>
          </div>

          {/* Unit rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {army.units.map((u) => {
              const key = unitKey(u);
              const a1Val = unitSplit[key] ?? 0;
              const a2Val = u.count - a1Val;

              function setA1(v: number) {
                const clamped = Math.max(0, Math.min(u.count, v));
                setUnitSplit((prev) => ({ ...prev, [key]: clamped }));
              }

              return (
                <div
                  key={key}
                  style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", gap: 4, alignItems: "center" }}
                >
                  <div>
                    <span style={{ ...MONO, fontSize: 9, color: "#aaa" }}>
                      {u.house} {u.type}
                    </span>
                    <span style={{ ...MONO, fontSize: 8, color: "#444", marginLeft: 6 }}>
                      ({u.count.toLocaleString()})
                    </span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <SmallButton label="← All" onClick={() => setA1(u.count)} />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={u.count}
                      value={a1Val}
                      onChange={(e) => setA1(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={u.count}
                      value={a2Val}
                      onChange={(e) => setA1(u.count - Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <SmallButton label="All →" onClick={() => setA1(0)} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: "6px 0", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
            <span style={{ ...MONO, fontSize: 9, color: "#3a6ea8" }}>
              Army 1 total: {army1TotalUnits.toLocaleString()}
              {army1TotalUnits === 0 && <span style={{ color: "#c04040" }}> — needs troops</span>}
            </span>
            <span style={{ ...MONO, fontSize: 9, color: "#b03030" }}>
              Army 2 total: {army2TotalUnits.toLocaleString()}
              {army2TotalUnits === 0 && <span style={{ color: "#c04040" }}> — needs troops</span>}
            </span>
          </div>

          {/* Commanders */}
          <div style={{ marginBottom: 16 }}>
            <SectionHeader label="Commanders" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {army.leaders.map((l) => (
                <div key={l.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...MONO, fontSize: 9, color: "#aaa" }}>
                    {l.name}{l.title ? ` — ${l.title}` : ""}
                  </span>
                  <AssignToggle
                    value={leaderSplit[l.name] ?? "2"}
                    onChange={(v) => setLeaderSplit((prev) => ({ ...prev, [l.name]: v }))}
                  />
                </div>
              ))}
            </div>
            {(army1Leaders.length === 0 || army2Leaders.length === 0) && (
              <div style={{ ...MONO, fontSize: 8, color: "#c04040", marginTop: 4 }}>
                Each army needs at least one commander
              </div>
            )}
          </div>

          {/* Notables */}
          {(army.notables?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 8 }}>
              <SectionHeader label="Notable Figures" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {army.notables!.map((n) => (
                  <div key={n.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ ...MONO, fontSize: 9, color: "#888" }}>
                      {n.name}
                    </span>
                    <AssignToggle
                      value={notableSplit[n.name] ?? "2"}
                      onChange={(v) => setNotableSplit((prev) => ({ ...prev, [n.name]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #1e1e1e",
            padding: "10px 16px",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => dispatch({ type: "CLOSE_SPLIT" })}
            style={{ ...MONO, ...ghostButtonStyle }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleConfirm}
            style={{
              ...MONO,
              ...primaryButtonStyle,
              opacity: isValid ? 1 : 0.4,
              cursor: isValid ? "pointer" : "default",
            }}
          >
            Split Army
          </button>
        </div>
      </div>
    </div>
  );
}

function unitKey(u: ArmyUnit): string {
  return `${u.house}::${u.type}`;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 8,
        color: "#444",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        borderBottom: "1px solid #1a1a1a",
        paddingBottom: 3,
      }}
    >
      {label}
    </div>
  );
}

function AssignToggle({
  value,
  onChange,
}: {
  value: "1" | "2";
  onChange: (v: "1" | "2") => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {(["1", "2"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "2px 8px",
            cursor: "pointer",
            border: value === v ? "1px solid #c8941a" : "1px solid #2a2a2a",
            background: value === v ? "#1a1200" : "#0a0a0a",
            color: value === v ? "#c8941a" : "#555",
          }}
        >
          A{v}
        </button>
      ))}
    </div>
  );
}

function SmallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 8,
        color: "#555",
        background: "none",
        border: "1px solid #1e1e1e",
        cursor: "pointer",
        padding: "2px 5px",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: 9,
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  color: "#aaa",
  padding: "3px 6px",
  width: "100%",
  textAlign: "right",
};

const ghostButtonStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "5px 14px",
  cursor: "pointer",
  border: "1px solid #2a2a2a",
  background: "#0a0a0a",
  color: "#666",
};

const primaryButtonStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  padding: "5px 14px",
  border: "1px solid #3a2a00",
  background: "#1a1200",
  color: "#c8941a",
};
