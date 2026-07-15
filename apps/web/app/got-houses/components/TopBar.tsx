"use client";

import Link from "next/link";
import type { GameState, GameAction, Faction } from "../types";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const FACTION_COLORS: Record<Faction, { bg: string; border: string; text: string; activeBg: string }> = {
  north: {
    bg: "#0a0f1a",
    border: "#1a3a5a",
    text: "#6aaad8",
    activeBg: "#0d1a2e",
  },
  westerlands: {
    bg: "#1a0a0a",
    border: "#5a1a1a",
    text: "#d87070",
    activeBg: "#2a0f0f",
  },
};

export default function TopBar({ state, dispatch }: Props) {
  const { turn, north, westerlands, adminMode, activeFaction } = state;

  const northSubmitted = north.submitted;
  const westSubmitted = westerlands.submitted;

  function handleSubmit(faction: Faction) {
    dispatch({ type: "SUBMIT_FACTION", faction });
  }

  function handleSwitchFaction(faction: Faction) {
    dispatch({ type: "SWITCH_FACTION", faction });
  }

  const currentOrders = activeFaction === "north" ? north : westerlands;
  const currentSubmitted = activeFaction === "north" ? northSubmitted : westSubmitted;
  const factionColors = FACTION_COLORS[activeFaction];

  return (
    <div
      style={{
        height: 48,
        borderBottom: "1px solid #1e1e1e",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        gap: 0,
        paddingRight: 12,
        flexShrink: 0,
      }}
    >
      {/* Back link */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          height: "100%",
          borderRight: "1px solid #1e1e1e",
          textDecoration: "none",
          color: "#333",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
      >
        ← Command
      </Link>

      {/* Title + turn */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderRight: "1px solid #1e1e1e",
          height: "100%",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#c8941a",
          }}
        >
          Game of Thrones
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 9,
            color: "#333",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Turn {turn}
        </span>
      </div>

      {/* Faction tabs (admin mode) */}
      {adminMode && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #1e1e1e",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", height: "100%" }}>
            {(["north", "westerlands"] as Faction[]).map((f) => {
              const active = activeFaction === f;
              const c = FACTION_COLORS[f];
              const submitted = f === "north" ? northSubmitted : westSubmitted;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleSwitchFaction(f)}
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 10,
                    fontWeight: active ? 700 : 400,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: active ? c.text : "#333",
                    background: active ? c.activeBg : "transparent",
                    border: "none",
                    borderRight: "1px solid #1e1e1e",
                    padding: "0 18px",
                    height: "100%",
                    cursor: submitted ? "default" : "pointer",
                    borderBottom: active ? `2px solid ${c.text}` : "2px solid transparent",
                    transition: "color 0.12s, background 0.12s",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = c.text;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = "#333";
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: active ? c.text : "#333",
                      flexShrink: 0,
                    }}
                  />
                  {f === "north" ? "The North" : "Westerlands"}
                  {submitted ? (
                    <span style={{ color: "#5ecb6b", fontSize: 9, fontWeight: 700 }}>✓ Locked</span>
                  ) : active ? (
                    <span style={{ color: c.text, fontSize: 8, opacity: 0.6 }}>▶ ordering</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-admin faction indicator */}
      {!adminMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 16px",
            height: "100%",
            borderRight: "1px solid #1e1e1e",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: factionColors.text,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9,
              color: factionColors.text,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {activeFaction === "north" ? "The North" : "Westerlands"}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Order status indicators */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginRight: 12,
        }}
      >
        <StatusPip label="N" submitted={northSubmitted} orderCount={north.orders.length} />
        <StatusPip label="W" submitted={westSubmitted} orderCount={westerlands.orders.length} />
      </div>

      {/* Submit orders button */}
      <SubmitButton
        faction={activeFaction}
        submitted={currentSubmitted}
        orderCount={currentOrders.orders.length}
        onSubmit={() => handleSubmit(activeFaction)}
      />

      {/* Admin toggle */}
      <button
        type="button"
        onClick={() => dispatch({ type: "TOGGLE_ADMIN" })}
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 9,
          color: adminMode ? "#c8941a" : "#333",
          background: adminMode ? "#1a1200" : "transparent",
          border: `1px solid ${adminMode ? "#3a2a00" : "#222"}`,
          padding: "4px 10px",
          marginLeft: 8,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          transition: "color 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#c8941a";
          e.currentTarget.style.borderColor = "#3a2a00";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = adminMode ? "#c8941a" : "#333";
          e.currentTarget.style.borderColor = adminMode ? "#3a2a00" : "#222";
        }}
      >
        Admin {adminMode ? "✓" : ""}
      </button>
    </div>
  );
}

function StatusPip({
  label,
  submitted,
  orderCount,
}: {
  label: string;
  submitted: boolean;
  orderCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-mono), monospace",
        fontSize: 8,
        color: submitted ? "#5ecb6b" : orderCount > 0 ? "#c8941a" : "#333",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: submitted ? "#5ecb6b" : orderCount > 0 ? "#c8941a" : "#2a2a2a",
        }}
      />
      {label}{submitted ? " ✓" : orderCount > 0 ? ` (${orderCount})` : ""}
    </div>
  );
}

function SubmitButton({
  faction,
  submitted,
  orderCount,
  onSubmit,
}: {
  faction: Faction;
  submitted: boolean;
  orderCount: number;
  onSubmit: () => void;
}) {
  const label = submitted
    ? "Orders Locked ✓"
    : `Submit Orders (${faction === "north" ? "North" : "West"})`;

  return (
    <button
      type="button"
      disabled={submitted}
      onClick={onSubmit}
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        padding: "5px 14px",
        cursor: submitted ? "default" : "pointer",
        border: submitted ? "1px solid #1a3a1a" : "1px solid #3a2a00",
        background: submitted ? "#0a1a0a" : "#1a1200",
        color: submitted ? "#5ecb6b" : "#c8941a",
        transition: "border-color 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!submitted) {
          e.currentTarget.style.borderColor = "#c8941a";
          e.currentTarget.style.color = "#f0b429";
        }
      }}
      onMouseLeave={(e) => {
        if (!submitted) {
          e.currentTarget.style.borderColor = "#3a2a00";
          e.currentTarget.style.color = "#c8941a";
        }
      }}
    >
      {label}
    </button>
  );
}
