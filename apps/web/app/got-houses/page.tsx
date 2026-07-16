"use client";

import { useEffect, useRef } from "react";
import { useGameState, determineTerritory } from "./hooks/useGameState";
import TopBar from "./components/TopBar";
import WesterosMap from "./components/WesterosMap";
import SidePanel from "./components/SidePanel";
import RetreatPanel from "./components/RetreatPanel";
import BattleSummaries from "./components/BattleSummaries";
import { HOLDS, HOLDS_MAP } from "./data/holds";
import type { BattleReport, TirednessRequest, TirednessUpdate } from "./types";

export default function GotHousesPage() {
  const { state, dispatch } = useGameState();

  const resolvingRef = useRef(false);
  const tirednessUpdatedRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.phase !== "resolving") {
      resolvingRef.current = false;
      return;
    }
    if (resolvingRef.current) return;

    if (tirednessUpdatedRef.current !== state.turn) {
      tirednessUpdatedRef.current = state.turn;
      
      async function updateTiredness() {
        console.group(`%c⚡ Tiredness Update — turn ${state.turn}`, "color:#4a9eff;font-weight:bold");
        
        const turnHistory = state.turnHistory ?? [];
        const lastTurnHistory = turnHistory[turnHistory.length - 1];
        
        const tirednessRequest: TirednessRequest = {
          armies: state.armies.map((army) => {
            const hold = HOLDS_MAP.get(army.holdId);
            const territory = hold ? determineTerritory(army, hold) : "neutral";
            const moved = lastTurnHistory?.armyMoves.find(m => m.armyId === army.id)?.moved ?? false;
            
            return {
              armyId: army.id,
              name: army.name,
              units: army.units,
              leaders: army.leaders,
              notables: army.notables,
              currentTiredness: army.tiredness,
              moveType: moved ? "march" : "rest",
              movesSinceRest: army.movesSinceRest ?? 0,
              territory,
              holdName: hold?.name ?? "Unknown",
            };
          }),
        };

        console.log(`→ Updating tiredness for ${tirednessRequest.armies.length} armies`);

        try {
          const res = await fetch("/api/got-houses/tiredness", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tirednessRequest),
          });

          if (!res.ok) {
            console.warn("⚠ Tiredness API failed, continuing with current values");
            console.groupEnd();
            return;
          }

          const updates = await res.json() as TirednessUpdate[];
          console.log("✓ Received", updates.length, "tiredness updates");
          
          dispatch({ type: "UPDATE_TIREDNESS", updates });
        } catch (err) {
          console.error("✗ Tiredness update error:", err);
        } finally {
          console.groupEnd();
        }
      }

      updateTiredness();
      return;
    }

    resolvingRef.current = true;

    // Peaceful turn — tiredness already updated, no battles to fight
    if (state.pendingBattles.length === 0) {
      dispatch({ type: "BATTLES_RESOLVED", reports: [] });
      return;
    }

    async function runBattles() {
      const reports: BattleReport[] = [];

      for (const battle of state.pendingBattles) {
        console.group(`%c⚔ Battle: hold ${battle.holdId} — turn ${state.turn}`, "color:#c8941a;font-weight:bold");
        console.log("North armies:", battle.northArmies.map((a) => `${a.name} (${a.id})`));
        console.log("West armies:", battle.westArmies.map((a) => `${a.name} (${a.id})`));
        console.log("North from:", battle.northFromHoldId ?? "(defender)");
        console.log("West from:", battle.westFromHoldId ?? "(defender)");

        try {
          console.log("→ POSTing to /api/got-houses/battle …");
          const res = await fetch("/api/got-houses/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ battle, holds: HOLDS }),
          });

          console.log("← HTTP status:", res.status, res.statusText);

          // Capture raw text FIRST before any parsing
          const rawBody = await res.text();
          console.log("=== RAW API RESPONSE BODY ===");
          console.log(rawBody);
          console.log("=== END RAW API RESPONSE BODY ===");

          let parsedForInspect: unknown;
          try { parsedForInspect = JSON.parse(rawBody); } catch { parsedForInspect = rawBody; }
          console.log("=== PARSED RESPONSE OBJECT ===");
          console.log(parsedForInspect);
          console.log("=== END PARSED RESPONSE OBJECT ===");

          const data = JSON.parse(rawBody) as Omit<BattleReport, "id" | "turn" | "holdId"> & {
            _debug?: string;
            _error?: string;
            _raw?: string;
            _rawFull?: string;
            _responseDebug?: string;
          };

          if (data._debug) {
            console.warn("⚠ Fallback triggered — reason:", data._debug);
            if (data._error) console.error("  Error detail:", data._error);
            if (data._raw) { console.log("=== RAW CLAUDE TEXT ==="); console.log(data._raw); console.log("=== END ==="); }
            if (data._responseDebug) { console.log("=== FULL ANTHROPIC RESPONSE OBJECT ==="); console.log(data._responseDebug); console.log("=== END ==="); }
          } else {
            console.log("✓ Parsed — holdResult:", data.holdResult);
            console.log("  Casualties:", data.casualties);
            console.log("  Fallen:", data.fallen);
            console.log("  Retreating:", data.retreatingArmyIds);
          }

          if (!res.ok) throw new Error(`Battle API ${res.status}: ${data._error ?? res.statusText}`);

          reports.push({
            ...data,
            id: crypto.randomUUID(),
            turn: state.turn,
            holdId: battle.holdId,
          });
        } catch (err) {
          console.error("✗ Fetch/parse error:", err);
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
        } finally {
          console.groupEnd();
        }
      }

      dispatch({ type: "BATTLES_RESOLVED", reports });
    }

    runBattles();
  }, [state.phase, state.pendingBattles, state.turn, state.armies, state.turnHistory, dispatch]);

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
