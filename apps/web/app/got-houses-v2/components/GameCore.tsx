"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGameState, determineTerritory } from "../hooks/useGameState";
import TopBar from "./TopBar";
import WesterosMap from "./WesterosMap";
import SidePanel from "./SidePanel";
import RetreatPanel from "./RetreatPanel";
import BattleSummaries from "./BattleSummaries";
import SplitPanel from "./SplitPanel";
import GarrisonPanel from "./GarrisonPanel";
import CommanderRenamePanel from "./CommanderRenamePanel";
import { HOLDS, HOLDS_MAP } from "../data/holds";
import { FACTION_HOMELAND } from "../data/homeland";
import { regionSoftFor, regionTrait } from "../data/regions";
import { getPathwayRoute } from "../data/pathways";
import type {
  BattleReport,
  TirednessRequest,
  TirednessUpdate,
  GarrisonConditionUpdate,
  GameState,
  CommanderBrief,
  NpcRuntimePatch,
  BattleContext,
  Faction,
} from "../types";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { snapshotForApi } from "../lib/converse-client";
import { buildInitialCharacters } from "../data/characters";
import { normalizeHoldRuntime } from "../lib/hold-runtime";
import { selectGarrisonsForConditionUpdate } from "../lib/siege";
import { buildForceSummary } from "../lib/battle-forces";
import { buildFallbackReport } from "../lib/battle-fallback";
import type { SurrenderDecision } from "../lib/character-tools";
import {
  applySurrenderDecision,
  holdsRipeForAiSurrender,
} from "../lib/surrender";
import { boardFingerprint, factionOrdersEqual, stateProgress } from "../lib/room-sync";

export type SyncRole = "host" | "guest" | "solo";

interface GameCoreProps {
  /** Override starting state (e.g. loaded from DB for room games). Defaults to INITIAL_GAME_STATE. */
  initialState?: GameState;
  /** Called with current state whenever it changes (debounced ~500 ms). Used by room games for persistence. */
  onSave?: (state: GameState) => void;
  /**
   * Two-player rooms: host (North) resolves the turn; guest (West) hydrates.
   * Solo / standalone omit this and behave as before.
   */
  syncRole?: SyncRole;
  viewerFaction?: Faction;
  /** Latest room save from the poller. Ignored in solo / standalone. */
  remoteState?: GameState | null;
}

function normalizeState(raw: GameState): GameState {
  const characters = raw.characters ?? buildInitialCharacters();
  const normalizedCharacters = Object.fromEntries(
    Object.entries(characters).map(([id, c]) => [
      id,
      c.kind === "npc"
        ? { ...c, adviceGivenIds: c.adviceGivenIds ?? [] }
        : c,
    ])
  );
  return {
    ...INITIAL_GAME_STATE,
    ...raw,
    characters: normalizedCharacters,
    conversations: raw.conversations ?? [],
    speechesThisTurn: raw.speechesThisTurn ?? [],
    speechArmyId: raw.speechArmyId ?? null,
    openConversationIds: raw.openConversationIds ?? [],
    talkPickerOpen: raw.talkPickerOpen ?? false,
    focusedConversationId: raw.focusedConversationId ?? null,
    factionEvents: raw.factionEvents ?? [],
    adviceLog: raw.adviceLog ?? [],
    lastStandHoldIds: raw.lastStandHoldIds ?? [],
    capturePledges: raw.capturePledges ?? [],
    holdStates: Object.fromEntries(
      Object.entries(raw.holdStates ?? INITIAL_GAME_STATE.holdStates).map(
        ([id, hs]) => [id, normalizeHoldRuntime(hs)]
      )
    ),
    battleReports: (raw.battleReports ?? []).map((r) => ({
      ...r,
      shortSummary: r.shortSummary ?? "",
      summaryError: r.summaryError,
    })),
    garrisonPanel: raw.garrisonPanel ?? null,
    north: {
      orders: raw.north?.orders ?? [],
      stanceOrders: raw.north?.stanceOrders ?? {},
      stormArmyIds: raw.north?.stormArmyIds ?? [],
      sallyHoldIds: raw.north?.sallyHoldIds ?? [],
      submitted: raw.north?.submitted ?? false,
    },
    westerlands: {
      orders: raw.westerlands?.orders ?? [],
      stanceOrders: raw.westerlands?.stanceOrders ?? {},
      stormArmyIds: raw.westerlands?.stormArmyIds ?? [],
      sallyHoldIds: raw.westerlands?.sallyHoldIds ?? [],
      submitted: raw.westerlands?.submitted ?? false,
    },
  };
}

export default function GameCore({
  initialState,
  onSave,
  syncRole,
  viewerFaction,
  remoteState,
}: GameCoreProps) {
  const twoBrowser = syncRole === "host" || syncRole === "guest";
  const isGuest = syncRole === "guest";
  const { state, dispatch } = useGameState(
    normalizeState(initialState ?? INITIAL_GAME_STATE)
  );

  /**
   * Which battle batch we have already dispatched to the adjudicator.
   *
   * This used to be a bare boolean that was only cleared when the phase left
   * `resolving` — so when the reducer queued a last stand while *staying* in
   * `resolving`, the effect re-ran, hit the guard, and the game hung forever
   * with the last stand never sent. Keying on the turn plus the identity of the
   * pending batch means a genuinely new batch always runs, while a re-render of
   * the same batch never resolves twice.
   */
  const resolvedBatchRef = useRef<string | null>(null);
  const tirednessUpdatedRef = useRef<number | null>(null);
  const lastDigestedTurnRef = useRef<number | null>(null);
  const prevPhaseRef = useRef(state.phase);

  // Persist state to DB (debounced) whenever it changes — only when onSave is provided
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableOnSave = useRef(onSave);
  stableOnSave.current = onSave;

  useEffect(() => {
    if (!stableOnSave.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      stableOnSave.current?.(state);
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state]);

  // Pull the other player's orders, or (guest) take the host's resolved board.
  useEffect(() => {
    if (!twoBrowser || !remoteState || !viewerFaction) return;

    if (
      state.phase === "planning" &&
      remoteState.phase === "planning" &&
      remoteState.turn === state.turn
    ) {
      const remoteRival = viewerFaction === "north" ? remoteState.westerlands : remoteState.north;
      const localRival = viewerFaction === "north" ? state.westerlands : state.north;
      if (factionOrdersEqual(remoteRival, localRival)) return;
      dispatch({
        type: "PULL_RIVAL_ORDERS",
        faction: viewerFaction,
        north: remoteState.north,
        westerlands: remoteState.westerlands,
      });
      return;
    }

    if (!isGuest) return;
    if (stateProgress(remoteState) < stateProgress(state)) return;
    // Same-phase retreat: do not wipe a pick the guest has not saved yet.
    if (
      state.phase === "retreat" &&
      remoteState.phase === "retreat" &&
      remoteState.turn === state.turn
    ) {
      return;
    }
    if (boardFingerprint(remoteState) === boardFingerprint(state)) return;
    dispatch({ type: "HYDRATE_REMOTE", state: normalizeState(remoteState) });
  }, [
    twoBrowser,
    isGuest,
    remoteState,
    viewerFaction,
    state.phase,
    state.turn,
    state.north,
    state.westerlands,
    dispatch,
  ]);

  // Host (and only the host) resolves once both locks are on the merged board.
  const adjudicatedTurnRef = useRef<number | null>(null);
  useEffect(() => {
    if (isGuest) return;
    if (state.phase !== "planning") return;
    if (!state.north.submitted || !state.westerlands.submitted) return;
    if (!twoBrowser) return;
    if (adjudicatedTurnRef.current === state.turn) return;
    adjudicatedTurnRef.current = state.turn;
    dispatch({ type: "ADJUDICATE_MOVES" });
  }, [
    isGuest,
    twoBrowser,
    state.phase,
    state.north.submitted,
    state.westerlands.submitted,
    state.turn,
    dispatch,
  ]);

  // When we enter planning after resolve/retreat/rename, NPCs digest the turn that just ended
  useEffect(() => {
    if (isGuest) return;
    const enteredPlanning =
      state.phase === "planning" && prevPhaseRef.current !== "planning";
    prevPhaseRef.current = state.phase;
    if (!enteredPlanning || state.turn <= 1) return;

    const resolvedTurn = state.turn - 1;
    if (lastDigestedTurnRef.current === resolvedTurn) return;
    lastDigestedTurnRef.current = resolvedTurn;

    const snap = snapshotForApi(state);

    async function runDigest() {
      try {
        console.log(`%c📓 Commander digest — turn ${resolvedTurn}`, "color:#8a9a6a");
        const res = await fetch("/api/got-houses-v2/converse/digest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolvedTurn,
            ...snap,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { patches?: NpcRuntimePatch[] };
        if (data.patches?.length) {
          dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
        }
      } catch (err) {
        console.warn("Digest failed", err);
      }
    }

    void runDigest();
    // Snap frozen when entering planning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.turn, dispatch, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    if (state.phase !== "resolving") {
      resolvedBatchRef.current = null;
      return;
    }

    // Identity of this batch: the turn plus every pending battle's hold and
    // last-stand flag. A follow-up last stand at the same hold is a different
    // batch, so it gets resolved instead of being swallowed by the guard.
    const batchKey = [
      state.turn,
      ...state.pendingBattles.map(
        (b) => `${b.holdId}:${b.engagement ?? "field"}:${b.lastStand ? "ls" : "-"}`
      ),
    ].join("|");
    if (resolvedBatchRef.current === batchKey) return;

    if (tirednessUpdatedRef.current !== state.turn) {
      tirednessUpdatedRef.current = state.turn;

      async function updateSoftConditions() {
        console.group(`%c⚡ Soft conditions — turn ${state.turn}`, "color:#4a9eff;font-weight:bold");

        const turnHistory = state.turnHistory ?? [];
        const lastTurnHistory = turnHistory[turnHistory.length - 1];

        const tirednessRequest: TirednessRequest = {
          armies: state.armies.map((army) => {
            const hold = HOLDS_MAP.get(army.holdId);
            const holdRuntime = state.holdStates?.[army.holdId];
            const territory = hold
              ? determineTerritory(army, hold, holdRuntime)
              : "neutral";
            const moved = lastTurnHistory?.armyMoves.find((m) => m.armyId === army.id)?.moved ?? false;

            let stanceOrder: "rest" | "fortify" | "march";
            if (moved) {
              stanceOrder = "march";
            } else if (army.activity.turnsFortiying > (army.activity.turnsResting > 0 ? 0 : -1) &&
                       army.activity.turnsFortiying > 0) {
              stanceOrder = "fortify";
            } else {
              stanceOrder = "rest";
            }

            const fromHold =
              moved && army.lastHoldId ? HOLDS_MAP.get(army.lastHoldId) : undefined;
            const marchRoute =
              moved && fromHold && hold
                ? {
                    fromHoldName: fromHold.name,
                    toHoldName: hold.name,
                    route: getPathwayRoute(fromHold.id, hold.id),
                  }
                : undefined;

            return {
              armyId: army.id,
              name: army.name,
              units: army.units,
              leaders: army.leaders,
              notables: army.notables,
              currentTiredness: army.tiredness,
              currentMorale: army.morale,
              currentStance: army.stance,
              moveType: moved ? "march" : "rest",
              movesSinceRest: army.movesSinceRest ?? 0,
              territory,
              holdName: hold?.name ?? "Unknown",
              holdGround: hold?.ground ?? "Unknown ground",
              homeland: FACTION_HOMELAND[army.faction],
              regionMarch: hold
                ? regionTrait(hold.region).marchSoft
                : "Unknown country",
              regionFit: hold
                ? regionSoftFor(hold.region, army.faction)
                : "Unknown country",
              ...(marchRoute ? { marchRoute } : {}),
              activity: army.activity,
              stanceOrder,
              // Pass pre-merge conditions so the tiredness API can describe
              // the heterogeneous state of a freshly merged army.
              ...(army.mergedFrom ? { mergedFrom: army.mergedFrom } : {}),
            };
          }),
        };

        const garrisonBatch = selectGarrisonsForConditionUpdate(
          state.turn,
          state.holdStates ?? {}
        );

        // Seats whose position is bad enough that their castellan should get
        // the chance to sue for terms rather than starve quietly.
        const surrenderCandidates = holdsRipeForAiSurrender(
          state.holdStates ?? {},
          state.armies
        );

        console.log(`→ Tiredness for ${tirednessRequest.armies.length} armies`);
        console.log(`→ Garrison condition for ${garrisonBatch.length} holds`);
        if (surrenderCandidates.length > 0) {
          console.log(`→ Terms decision for ${surrenderCandidates.length} besieged seats`);
        }

        try {
          const [tiredRes, garRes, surrRes] = await Promise.all([
            fetch("/api/got-houses-v2/tiredness", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tirednessRequest),
            }),
            garrisonBatch.length > 0
              ? fetch("/api/got-houses-v2/garrison-condition", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    turn: state.turn,
                    garrisons: garrisonBatch,
                  }),
                })
              : Promise.resolve(null),
            surrenderCandidates.length > 0
              ? fetch("/api/got-houses-v2/surrender/decide", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    holdIds: surrenderCandidates,
                    characters: state.characters,
                    armies: state.armies,
                    battleReports: state.battleReports,
                    conversations: state.conversations,
                    holdStates: state.holdStates ?? {},
                    factionEvents: state.factionEvents,
                    adviceLog: state.adviceLog,
                    turn: state.turn,
                  }),
                })
              : Promise.resolve(null),
          ]);

          if (tiredRes.ok) {
            const updates = (await tiredRes.json()) as TirednessUpdate[];
            console.log("✓ Received", updates.length, "tiredness updates");
            dispatch({ type: "UPDATE_TIREDNESS", updates });
          } else {
            console.warn("⚠ Tiredness API failed, continuing with current values");
          }

          if (garRes?.ok) {
            const gUpdates = (await garRes.json()) as GarrisonConditionUpdate[];
            console.log("✓ Received", gUpdates.length, "garrison condition updates");
            if (gUpdates.length > 0) {
              dispatch({ type: "UPDATE_GARRISON_CONDITION", updates: gUpdates });
            }
          } else if (garRes && !garRes.ok) {
            console.warn("⚠ Garrison condition API failed");
          }

          if (surrRes?.ok) {
            const data = (await surrRes.json()) as {
              decisions?: {
                holdId: string;
                name: string;
                decision: SurrenderDecision;
                spoken: string;
              }[];
              failures?: string[];
            };
            for (const f of data.failures ?? []) {
              console.warn("⚠ Terms decision failed —", f);
            }
            for (const d of data.decisions ?? []) {
              const note = applySurrenderDecision(
                dispatch,
                state,
                d.holdId,
                d.decision
              );
              if (!note) continue;
              console.log(`✓ ${d.name}: ${note}`);
              dispatch({
                type: "APPEND_FACTION_EVENTS",
                events: [
                  {
                    id: `ev-${Math.random().toString(36).slice(2, 10)}`,
                    turn: state.turn,
                    faction:
                      state.holdStates?.[d.holdId]?.siege?.besiegerFaction ??
                      "north",
                    kind: "other",
                    holdIds: [d.holdId],
                    summary: note,
                    detail: d.spoken
                      ? `${d.name}: "${d.spoken}"`
                      : note,
                  },
                ],
              });
            }
          } else if (surrRes && !surrRes.ok) {
            console.warn("⚠ Terms decision API failed");
          }
        } catch (err) {
          console.error("✗ Soft condition update error:", err);
        } finally {
          console.groupEnd();
        }
      }

      void updateSoftConditions();
      return;
    }

    resolvedBatchRef.current = batchKey;

    if (state.pendingBattles.length === 0) {
      dispatch({ type: "BATTLES_RESOLVED", reports: [] });
      return;
    }

    async function runBattles() {
      const reports: BattleReport[] = [];
      let characters = state.characters;

      for (const battle of state.pendingBattles) {
        console.group(`%c⚔ Battle: ${battle.holdId} — turn ${state.turn}${battle.lastStand ? " [LAST STAND]" : ""}`, "color:#c8941a;font-weight:bold");
        console.log("North armies:", battle.northArmies.map((a) => `${a.name} (${a.id})`));
        console.log("West armies:", battle.westArmies.map((a) => `${a.name} (${a.id})`));
        console.log("Last stand:", battle.lastStand ?? false);

        // NPC commander briefs (never player lords)
        let commanderBriefs: CommanderBrief[] = [];
        const armyIds = new Set(
          [...battle.northArmies, ...battle.westArmies].map((a) => a.id)
        );
        const commanderIds = Object.values(characters)
          .filter(
            (c) =>
              c.kind === "npc" &&
              c.alive &&
              c.role === "commander" &&
              c.armyId &&
              armyIds.has(c.armyId)
          )
          .map((c) => c.id);

        if (commanderIds.length > 0) {
          try {
            console.log("→ Commander briefs for", commanderIds);
            const briefRes = await fetch("/api/got-houses-v2/converse/battle-brief", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                battle,
                commanderIds,
                ...snapshotForApi({ ...state, characters }),
              }),
            });
            if (briefRes.ok) {
              const briefData = (await briefRes.json()) as {
                briefs?: CommanderBrief[];
                patches?: NpcRuntimePatch[];
              };
              commanderBriefs = briefData.briefs ?? [];
              if (briefData.patches?.length) {
                dispatch({ type: "PATCH_CHARACTERS", patches: briefData.patches });
                for (const p of briefData.patches) {
                  const cur = characters[p.id];
                  if (cur?.kind === "npc") {
                    characters = {
                      ...characters,
                      [p.id]: {
                        ...cur,
                        ...(p.mood !== undefined ? { mood: p.mood } : {}),
                        ...(p.notepad !== undefined ? { notepad: p.notepad } : {}),
                      },
                    };
                  }
                }
              }
            }
          } catch (err) {
            console.warn("Commander briefs failed — continuing without", err);
          }
        }

        const battleWithBriefs: BattleContext = {
          ...battle,
          commanderBriefs,
        };

        try {
          console.log("→ POSTing to /api/got-houses-v2/battle …");
          const res = await fetch("/api/got-houses-v2/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ battle: battleWithBriefs, holds: HOLDS }),
          });

          console.log("← HTTP status:", res.status, res.statusText);
          const rawBody = await res.text();

          let parsedForInspect: unknown;
          try { parsedForInspect = JSON.parse(rawBody); } catch { parsedForInspect = rawBody; }
          console.log("=== PARSED RESPONSE OBJECT ===");
          console.log(parsedForInspect);
          console.log("=== END PARSED RESPONSE OBJECT ===");

          const data = JSON.parse(rawBody) as Omit<BattleReport, "id" | "turn" | "holdId"> & {
            error?: string;
          };

          if (!res.ok || data.error) {
            throw new Error(`Battle API ${res.status}: ${data.error ?? res.statusText}`);
          }

          if (data.fallbackReason) {
            console.warn("⚠ Resolved by deterministic fallback:", data.fallbackReason);
          } else {
            console.log("✓ Resolved — holdResult:", data.holdResult);
            console.log("  Casualties:", data.casualties);
            console.log("  Fallen:", data.fallen);
            console.log("  Retreating:", data.retreatingArmyIds);
            if (data.validation?.length) {
              console.warn("  Validator corrections:", data.validation);
            }
          }

          reports.push({
            ...data,
            shortSummary: data.shortSummary ?? "",
            summaryError: data.summaryError,
            id: crypto.randomUUID(),
            turn: state.turn,
            holdId: battle.holdId,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error("✗ Battle request failed:", reason);
          // Same deterministic outcome the server would have produced, so a
          // network blip cannot hand anyone a free win or a costless stalemate.
          reports.push({
            ...buildFallbackReport(
              battleWithBriefs,
              HOLDS_MAP,
              buildForceSummary(battleWithBriefs),
              `Client could not reach the adjudicator: ${reason}`
            ),
            id: crypto.randomUUID(),
            turn: state.turn,
            holdId: battle.holdId,
          });
        } finally {
          console.groupEnd();
        }
      }

      dispatch({ type: "BATTLES_RESOLVED", reports });
    }

    runBattles();
  }, [state.phase, state.pendingBattles, state.turn, state.armies, state.turnHistory, dispatch, isGuest]);

  const isResolving = state.phase === "resolving";
  const isRetreat = state.phase === "retreat";
  const isRename = state.phase === "rename_commanders" || !!state.voluntaryCommanderChange;

  const totalBattleArmies = state.pendingBattles.reduce(
    (sum, b) => sum + b.northArmies.length + b.westArmies.length,
    0
  );
  const totalBattles = state.pendingBattles.length;

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
      <TopBar
        state={state}
        dispatch={dispatch}
        deferAdjudicate={twoBrowser}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          {/* Map — full bleed; right rail only when army selected or Talk open */}
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <WesterosMap state={state} dispatch={dispatch} />

            {/* Guest is locked; host is still marching the turn through the adjudicator. */}
            {isGuest &&
              state.phase === "planning" &&
              state.north.submitted &&
              state.westerlands.submitted && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.55)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 28,
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.28em",
                    color: "#c8941a",
                  }}
                >
                  Both sides have marched
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 9,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                  }}
                >
                  Waiting for the turn to resolve…
                </div>
              </div>
            )}

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
                  Adjudicating
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
                  {totalBattles > 0
                    ? `${totalBattleArmies} arm${totalBattleArmies !== 1 ? "ies" : "y"} · ${totalBattles} battle${totalBattles !== 1 ? "s" : ""} being adjudicated`
                    : "Updating conditions…"}
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
            {isRetreat && <RetreatPanel state={state} dispatch={dispatch} />}
          </div>

          {/* Side panel */}
          <SidePanel state={state} dispatch={dispatch} />
        </div>

        {/* Battle log */}
        {state.battleLogOpen && (
          <BattleSummaries
            reports={state.battleReports}
            onClose={() => dispatch({ type: "TOGGLE_BATTLE_LOG" })}
          />
        )}
      </div>

      {/* Commander rename overlay */}
      {isRename && <CommanderRenamePanel state={state} dispatch={dispatch} />}

      {/* Split army overlay */}
      {state.splitPanelArmyId && <SplitPanel state={state} dispatch={dispatch} />}
      {state.garrisonPanel && <GarrisonPanel state={state} dispatch={dispatch} />}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scaleX(0.6); }
          50% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
