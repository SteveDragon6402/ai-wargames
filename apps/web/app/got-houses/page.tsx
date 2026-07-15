"use client";

import { useEffect, useRef } from "react";
import { useGameState } from "./hooks/useGameState";
import TopBar from "./components/TopBar";
import WesterosMap from "./components/WesterosMap";
import SidePanel from "./components/SidePanel";
import RetreatPanel from "./components/RetreatPanel";
import BattleSummaries from "./components/BattleSummaries";
import { HOLDS } from "./data/holds";
import type { BattleReport } from "./types";

export default function GotHousesPage() {
  const { state, dispatch } = useGameState();

  // Prevent re-triggering if the same pendingBattles reference hasn't changed
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "resolving" || state.pendingBattles.length === 0) {
      resolvingRef.current = false;
      return;
    }
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    async function runBattles() {
      const reports: BattleReport[] = [];

      for (const battle of state.pendingBattles) {
        try {
          const res = await fetch("/api/got-houses/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ battle, holds: HOLDS }),
          });

          if (!res.ok) throw new Error(`Battle API ${res.status}`);

          const data = await res.json() as Omit<BattleReport, "id" | "turn" | "holdId">;
          reports.push({
            ...data,
            id: crypto.randomUUID(),
            turn: state.turn,
            holdId: battle.holdId,
          });
        } catch (err) {
          console.error("Battle adjudication failed:", err);
          // Fallback: contested with no losses
          reports.push({
            id: crypto.randomUUID(),
            turn: state.turn,
            holdId: battle.holdId,
            narrative:
              "The two forces clashed in a bloody but inconclusive engagement. Both sides withdrew to regroup, neither willing to press the advantage.",
            holdResult: "abandoned",
            casualties: [],
            fallen: [],
            retreatingArmyIds: [],
          });
        }
      }

      dispatch({ type: "BATTLES_RESOLVED", reports });
    }

    runBattles();
  }, [state.phase, state.pendingBattles, state.turn, dispatch]);

  const isResolving = state.phase === "resolving";
  const isRetreat = state.phase === "retreat";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "#080808",
      }}
    >
      <TopBar state={state} dispatch={dispatch} />

      {/* Main content area — map + side panel + optional battle log */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          {/* Map */}
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <WesterosMap state={state} dispatch={dispatch} />

            {/* Resolving overlay */}
            {isResolving && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.72)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 30,
                  gap: 16,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.3em",
                    color: "#c8941a",
                  }}
                >
                  ⚔ Adjudicating Battle
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    color: "#555",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                  }}
                >
                  {state.pendingBattles.length} engagement
                  {state.pendingBattles.length !== 1 ? "s" : ""} — consulting the maesters…
                </div>
                <div
                  style={{
                    width: 40,
                    height: 2,
                    background: "#c8941a",
                    animation: "pulse 1.2s ease-in-out infinite",
                    opacity: 0.6,
                  }}
                />
              </div>
            )}

            {/* Retreat overlay */}
            {isRetreat && (
              <RetreatPanel state={state} dispatch={dispatch} />
            )}
          </div>

          {/* Side panel */}
          <SidePanel state={state} dispatch={dispatch} />
        </div>

        {/* Battle log (collapsible bottom panel) */}
        {state.battleLogOpen && (
          <BattleSummaries
            reports={state.battleReports}
            onClose={() => dispatch({ type: "TOGGLE_BATTLE_LOG" })}
          />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scaleX(0.6); }
          50% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
