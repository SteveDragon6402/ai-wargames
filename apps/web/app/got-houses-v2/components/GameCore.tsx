"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameState, determineTerritory } from "../hooks/useGameState";
import TopBar from "./TopBar";
import WesterosMap from "./WesterosMap";
import SidePanel from "./SidePanel";
import RetreatPanel from "./RetreatPanel";
import BattleSummaries from "./BattleSummaries";
import SplitPanel from "./SplitPanel";
import GarrisonPanel from "./GarrisonPanel";
import CommanderRenamePanel from "./CommanderRenamePanel";
import VictoryOverlay from "./VictoryOverlay";
import CounselPanel from "./CounselPanel";
import StewardDock, {
  type StewardBriefRequest,
} from "./StewardDock";
import { HOLDS, HOLDS_MAP } from "../data/holds";
import { FACTION_HOMELAND } from "../data/homeland";
import { regionSoftFor, regionTrait } from "../data/regions";
import { getPathwayRoute } from "../data/pathways";
import { forageAtHold, forageOnPath } from "../lib/forage";
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
  AudienceEffects,
} from "../types";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { snapshotForApi } from "../lib/converse-client";
import { normalizeState } from "../lib/normalize-state";
import {
  audienceThisTurn,
  audiencesReadyToFinish,
  replaceAudience,
} from "../lib/audience";
import {
  armyFieldPresence,
  presenceNote,
  selectGarrisonsForConditionUpdate,
} from "../lib/siege";
import { buildForceSummary } from "../lib/battle-forces";
import { buildFallbackReport } from "../lib/battle-fallback";
import type { SurrenderDecision } from "../lib/character-tools";
import {
  aiMayDecideTerms,
  applySurrenderDecision,
  holdsRipeForAiSurrender,
} from "../lib/surrender";
import {
  boardFingerprint,
  moveOrdersResolvable,
  rivalPlanningSliceEqual,
  stateProgress,
} from "../lib/room-sync";
import {
  applyBriefsToBattle,
  collectBattleCharacterIds,
} from "../lib/battle-briefs";
import { describePrisonerBurden } from "../lib/prisoners";

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
  const lastStewardBriefRef = useRef<string | null>(null);
  const counselKeyRef = useRef<string>("");
  const [stewardBriefing, setStewardBriefing] =
    useState<StewardBriefRequest | null>(null);

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
      if (rivalPlanningSliceEqual(state, remoteState, viewerFaction)) return;
      dispatch({
        type: "PULL_RIVAL_ORDERS",
        faction: viewerFaction,
        north: remoteState.north,
        westerlands: remoteState.westerlands,
        armies: remoteState.armies,
        characters: remoteState.characters,
        holdStates: remoteState.holdStates,
        prisoners: remoteState.prisoners ?? [],
      });
      return;
    }

    if (
      state.phase === "retreat" &&
      remoteState.phase === "retreat" &&
      remoteState.turn === state.turn
    ) {
      dispatch({
        type: "PULL_RIVAL_RETREATS",
        myFaction: viewerFaction,
        retreats: remoteState.retreats ?? [],
      });
      return;
    }

    if (
      state.phase === "counsel" &&
      remoteState.phase === "counsel" &&
      remoteState.turn === state.turn &&
      !isGuest
    ) {
      dispatch({
        type: "PULL_RIVAL_AUDIENCE_ANSWERS",
        myFaction: viewerFaction,
        audiences: remoteState.audiences ?? [],
      });
      return;
    }

    if (!isGuest) return;
    if (stateProgress(remoteState) < stateProgress(state)) return;
    let incoming = remoteState;
    if (
      state.phase === "counsel" &&
      remoteState.phase === "counsel" &&
      remoteState.turn === state.turn &&
      viewerFaction
    ) {
      const mine = audienceThisTurn(state.audiences, state.turn, viewerFaction);
      if (mine?.answer) {
        const remoteMine =
          (remoteState.audiences ?? []).find((a) => a.id === mine.id) ??
          audienceThisTurn(remoteState.audiences, state.turn, viewerFaction);
        if (remoteMine && !remoteMine.answer) {
          incoming = {
            ...remoteState,
            audiences: replaceAudience(remoteState.audiences, remoteMine.id, {
              answer: mine.answer,
            }),
          };
        }
      }
    }
    let sameBoard = false;
    try {
      sameBoard = boardFingerprint(incoming) === boardFingerprint(state);
    } catch {
      sameBoard = false;
    }
    if (sameBoard) return;
    dispatch({ type: "HYDRATE_REMOTE", state: normalizeState(incoming) });
  }, [
    twoBrowser,
    isGuest,
    remoteState,
    viewerFaction,
    state.phase,
    state.turn,
    state.north,
    state.westerlands,
    state.armies,
    dispatch,
  ]);

  // Host (and only the host) resolves once both locks are on the merged board.
  const adjudicatedTurnRef = useRef<number | null>(null);
  useEffect(() => {
    if (isGuest) return;
    if (state.phase !== "planning") return;
    if (!state.north.submitted || !state.westerlands.submitted) return;
    if (!twoBrowser) return;
    // Split children live on the other browser until we pull them. Resolving
    // against the unsplit parent no-ops those marches and looks like a cancel.
    if (!moveOrdersResolvable(state)) return;
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
    state.armies,
    state.north.orders,
    state.westerlands.orders,
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

  // Host-only counsel: propose → voice → wait for both answers → outcome → next planning.
  useEffect(() => {
    if (isGuest) return;
    if (state.phase !== "counsel") {
      counselKeyRef.current = "";
      return;
    }

    const sides: Faction[] = ["north", "westerlands"];
    const snapshot = sides.map((faction) =>
      audienceThisTurn(state.audiences, state.turn, faction)
    );
    const key = snapshot
      .map((a, i) => {
        const f = sides[i];
        if (!a) return `${f}:none`;
        if (a.skipped) return `${f}:skip`;
        if (!a.text) return `${f}:voice`;
        if (!a.answer) return `${f}:wait`;
        if (!a.effectsApplied) return `${f}:out`;
        return `${f}:done`;
      })
      .join("|");
    if (counselKeyRef.current === key) return;
    counselKeyRef.current = key;

    const bothAnswered = snapshot.every((a) => a && (a.skipped || !!a.answer));

    async function runCounsel() {
      const missing = sides.find(
        (f) => !audienceThisTurn(state.audiences, state.turn, f)
      );
      if (missing) {
        try {
          const res = await fetch("/api/got-houses-v2/counsel/propose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ faction: missing, state }),
          });
          if (!res.ok) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: missing,
              reason: "propose failed",
            });
            return;
          }
          const data = (await res.json()) as {
            proposal?: {
              speakerId: string;
              addresseeId: string;
              kind: string;
              situation: string;
              whyNow: string;
            };
          };
          const p = data.proposal;
          if (!p?.speakerId) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: missing,
              reason: "propose failed",
            });
            return;
          }
          dispatch({
            type: "APPLY_AUDIENCE_PROPOSAL",
            audience: {
              id: `aud-${missing}-${state.turn}-${p.speakerId}`,
              turn: state.turn,
              faction: missing,
              speakerId: p.speakerId,
              addresseeId: p.addresseeId,
              kind: p.kind,
              situation: p.situation,
              whyNow: p.whyNow,
              text: "",
              options: [],
              answer: null,
              narration: null,
              effects: null,
              effectsApplied: false,
              skipped: false,
            },
          });
        } catch (err) {
          console.warn("Counsel propose failed", err);
          dispatch({
            type: "SKIP_AUDIENCE",
            faction: missing,
            reason: "propose failed",
          });
        }
        return;
      }

      const voiceless = snapshot.find((a) => a && !a.skipped && !a.text);
      if (voiceless) {
        try {
          const res = await fetch("/api/got-houses-v2/counsel/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audience: voiceless, state }),
          });
          if (!res.ok) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: voiceless.faction,
              reason: "voice failed",
            });
            return;
          }
          const data = (await res.json()) as {
            text?: string;
            options?: { id: string; label: string }[];
            patches?: NpcRuntimePatch[];
          };
          if (!data.text || !data.options?.length) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: voiceless.faction,
              reason: "voice failed",
            });
            return;
          }
          dispatch({
            type: "APPLY_AUDIENCE_VOICE",
            audienceId: voiceless.id,
            text: data.text,
            options: data.options,
            patches: data.patches,
          });
        } catch (err) {
          console.warn("Counsel voice failed", err);
          dispatch({
            type: "SKIP_AUDIENCE",
            faction: voiceless.faction,
            reason: "voice failed",
          });
        }
        return;
      }

      if (!bothAnswered) return;

      const pendingOutcome = snapshot.find(
        (a) => a && !a.skipped && a.answer && !a.effectsApplied
      );
      if (pendingOutcome) {
        try {
          const res = await fetch("/api/got-houses-v2/counsel/outcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audience: pendingOutcome, state }),
          });
          if (!res.ok) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: pendingOutcome.faction,
              reason: "outcome failed",
            });
            return;
          }
          const data = (await res.json()) as {
            narration?: string;
            effects?: AudienceEffects;
            patches?: NpcRuntimePatch[];
          };
          if (!data.effects) {
            dispatch({
              type: "SKIP_AUDIENCE",
              faction: pendingOutcome.faction,
              reason: "outcome failed",
            });
            return;
          }
          dispatch({
            type: "APPLY_AUDIENCE_OUTCOME",
            audienceId: pendingOutcome.id,
            narration: data.narration ?? "",
            effects: data.effects,
            patches: data.patches,
          });
        } catch (err) {
          console.warn("Counsel outcome failed", err);
          dispatch({
            type: "SKIP_AUDIENCE",
            faction: pendingOutcome.faction,
            reason: "outcome failed",
          });
        }
        return;
      }

      if (audiencesReadyToFinish(state)) {
        dispatch({ type: "FINISH_COUNSEL" });
      }
    }

    void runCounsel();
  }, [isGuest, state.phase, state.turn, state.audiences, dispatch, state]);

  const viewer = viewerFaction ?? state.activeFaction;
  useEffect(() => {
    if (state.phase !== "planning") return;
    const key = `${viewer}:${state.turn}`;
    if ((state.stewardBriefedTurn?.[viewer] ?? null) === state.turn) {
      lastStewardBriefRef.current = key;
      return;
    }
    if (lastStewardBriefRef.current === key) return;
    lastStewardBriefRef.current = key;
    dispatch({ type: "MARK_STEWARD_BRIEFED", faction: viewer, turn: state.turn });
    if (state.turn <= 1) {
      dispatch({ type: "SET_STEWARD_OPEN", open: true });
    } else if (!state.stewardOpen) {
      dispatch({
        type: "SET_STEWARD_UNREAD",
        faction: viewer,
        unread: true,
      });
    }
    setStewardBriefing({ turn: state.turn, faction: viewer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.turn, viewer, dispatch]);

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
      ...(state.pendingBattles ?? []).map(
        (b) => `${b.holdId}:${b.engagement ?? "field"}:${b.lastStand ? "ls" : "-"}`
      ),
    ].join("|");
    if (resolvedBatchRef.current === batchKey) return;

    if (tirednessUpdatedRef.current !== state.turn) {
      tirednessUpdatedRef.current = state.turn;

      // Empty field: hold the resolving overlay until stance/morale/condition
      // land. Mark the batch so a mid-flight UPDATE_TIREDNESS re-render cannot
      // skip ahead and settle the turn. Always resolve in finally so a failed
      // tiredness call cannot leave the room stuck.
      const emptyField = (state.pendingBattles ?? []).length === 0;
      if (emptyField) {
        resolvedBatchRef.current = batchKey;
      }

      async function updateSoftConditions() {
        console.group(`%c⚡ Soft conditions — turn ${state.turn}`, "color:#4a9eff;font-weight:bold");

        const turnHistory = state.turnHistory ?? [];
        const lastTurnHistory = turnHistory[turnHistory.length - 1];

        const tirednessRequest: TirednessRequest = {
          armies: state.armies.map((army) => {
            const hold = HOLDS_MAP.get(army.holdId);
            const holdRuntime = state.holdStates?.[army.holdId];
            const presence = armyFieldPresence(army, holdRuntime);
            const territory = hold
              ? presence === "siege_camp"
                ? "hostile"
                : determineTerritory(army, hold, holdRuntime)
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
                    forage: forageOnPath(state.forage, fromHold.id, hold.id),
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
              holdForage: hold
                ? forageAtHold(state.forage, hold.id)
                : undefined,
              ...(marchRoute?.forage ? { marchForage: marchRoute.forage } : {}),
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
              presence,
              presenceNote: presenceNote(
                presence,
                hold?.name ?? "Unknown",
                holdRuntime?.siege?.turns
              ),
              ...(presence === "siege_camp" && holdRuntime?.siege
                ? { siegeTurns: holdRuntime.siege.turns }
                : {}),
              // Pass pre-merge conditions so the tiredness API can describe
              // the heterogeneous state of a freshly merged army.
              ...(army.mergedFrom ? { mergedFrom: army.mergedFrom } : {}),
              ...(describePrisonerBurden(state.prisoners, army.id, state.characters)
                ? {
                    prisonerEscort: describePrisonerBurden(
                      state.prisoners,
                      army.id,
                      state.characters
                    )!,
                  }
                : {}),
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
        ).filter((holdId) => aiMayDecideTerms(state, holdId));

        console.log(`→ Tiredness for ${tirednessRequest.armies.length} armies`);
        console.log(`→ Garrison condition for ${garrisonBatch.length} holds`);
        if (surrenderCandidates.length > 0) {
          console.log(`→ Terms decision for ${surrenderCandidates.length} besieged seats`);
        }
        const needingRefuge = (state.travellers ?? []).filter((t) => t.needsDestination);
        if (needingRefuge.length > 0) {
          console.log(`→ Refuge choice for ${needingRefuge.length} freed men`);
        }

        try {
          const [tiredRes, garRes, surrRes, destRes] = await Promise.all([
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
                    forage: state.forage,
                    factionEvents: state.factionEvents,
                    adviceLog: state.adviceLog,
                    prisoners: state.prisoners,
                    deeds: state.deeds,
                    turnHistory: state.turnHistory,
                    turn: state.turn,
                  }),
                })
              : Promise.resolve(null),
            needingRefuge.length > 0
              ? fetch("/api/got-houses-v2/release/destination", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    travellers: needingRefuge,
                    characters: state.characters,
                    armies: state.armies,
                    battleReports: state.battleReports,
                    holdStates: state.holdStates ?? {},
                    prisoners: state.prisoners,
                    deeds: state.deeds,
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
            dispatch({ type: "UPDATE_TIREDNESS", updates: [] });
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

          if (destRes?.ok) {
            const data = (await destRes.json()) as {
              choices?: {
                characterId: string;
                destHoldId: string;
                arrivesTurn: number;
              }[];
            };
            for (const c of data.choices ?? []) {
              dispatch({
                type: "SET_TRAVELLER_DESTINATION",
                characterId: c.characterId,
                destHoldId: c.destHoldId,
                arrivesTurn: c.arrivesTurn,
              });
            }
          } else if (destRes && !destRes.ok) {
            console.warn("⚠ Refuge destination API failed");
          }
        } catch (err) {
          console.error("✗ Soft condition update error:", err);
          // Battles wait for UPDATE_TIREDNESS to re-enter the effect. Empty
          // field settles in finally either way.
          if (!emptyField) {
            dispatch({ type: "UPDATE_TIREDNESS", updates: [] });
          }
        } finally {
          console.groupEnd();
          if (emptyField) {
            dispatch({ type: "BATTLES_RESOLVED", reports: [] });
          }
        }
      }

      void updateSoftConditions();
      return;
    }

    resolvedBatchRef.current = batchKey;

    if ((state.pendingBattles ?? []).length === 0) {
      dispatch({ type: "BATTLES_RESOLVED", reports: [] });
      return;
    }

    async function runBattles() {
      const reports: BattleReport[] = [];
      let characters = state.characters;

      for (const battle of state.pendingBattles ?? []) {
        console.group(`%c⚔ Battle: ${battle.holdId} — turn ${state.turn}${battle.lastStand ? " [LAST STAND]" : ""}`, "color:#c8941a;font-weight:bold");
        console.log("North armies:", battle.northArmies.map((a) => `${a.name} (${a.id})`));
        console.log("West armies:", battle.westArmies.map((a) => `${a.name} (${a.id})`));
        console.log("Last stand:", battle.lastStand ?? false);

        // Every living NPC in the fight — commanders and notables, beasts too.
        // Player lords (Robb, Tywin) stay out of the AI pass.
        let commanderBriefs: CommanderBrief[] = [];
        const commanderIds = collectBattleCharacterIds(battle, characters);

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

        const applied = applyBriefsToBattle(battle, commanderBriefs);
        if (
          commanderBriefs.length > 0 ||
          applied.flips.length > 0 ||
          applied.turnedHouses.length > 0 ||
          (applied.battle.rogueArmies?.length ?? 0) > 0
        ) {
          dispatch({
            type: "APPLY_BATTLE_BRIEFS",
            flips: applied.flips,
            turnedHouses: applied.turnedHouses,
            rogueArmyIds: (applied.battle.rogueArmies ?? []).map((a) => a.id),
            armyCommitments: applied.battle.armyCommitments,
            commanderBriefs,
          });
        }
        const battleWithBriefs: BattleContext = applied.battle;

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
            console.log("  Captured:", data.captured);
            console.log("  Prisoners taken:", data.prisonersTaken);
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

  const totalBattleArmies = (state.pendingBattles ?? []).reduce(
    (sum, b) =>
      sum + (b.northArmies ?? []).length + (b.westArmies ?? []).length,
    0
  );
  const totalBattles = (state.pendingBattles ?? []).length;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
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
              <div className="absolute inset-0 z-[28] flex flex-col items-center justify-center gap-3 bg-background/70">
                <div className="font-display text-2xl text-primary">
                  Both sides have marched
                </div>
                <div className="text-sm text-muted-foreground">
                  Waiting for the turn to resolve…
                </div>
              </div>
            )}

            {isResolving && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/80">
                <div className="font-display text-2xl text-primary">
                  Adjudicating
                </div>
                <div className="text-sm text-muted-foreground">
                  {totalBattles > 0
                    ? `${totalBattleArmies} ${totalBattleArmies !== 1 ? "hosts" : "host"} · ${totalBattles} ${totalBattles !== 1 ? "battles" : "battle"}`
                    : "Updating conditions…"}
                </div>
                <div className="h-0.5 w-10 animate-pulse bg-primary" />
              </div>
            )}

            {/* Retreat overlay */}
            {isRetreat && (
              <RetreatPanel
                state={state}
                dispatch={dispatch}
                viewerFaction={viewerFaction ?? state.activeFaction}
                twoBrowser={twoBrowser}
                canCommit={!isGuest}
              />
            )}
            {state.phase === "counsel" && (
              <CounselPanel
                state={state}
                dispatch={dispatch}
                viewerFaction={viewerFaction ?? state.activeFaction}
              />
            )}
            {state.outcome && <VictoryOverlay outcome={state.outcome} />}
            <StewardDock
              state={state}
              dispatch={dispatch}
              faction={viewerFaction ?? state.activeFaction}
              briefing={stewardBriefing}
              onBriefingConsumed={() => setStewardBriefing(null)}
            />
          </div>

          {/* Side panel */}
          <SidePanel
            state={state}
            dispatch={dispatch}
            viewerFaction={viewerFaction}
          />
        </div>

        {/* Battle log */}
        {state.battleLogOpen && (
          <BattleSummaries
            reports={state.battleReports ?? []}
            onClose={() => dispatch({ type: "TOGGLE_BATTLE_LOG" })}
          />
        )}
      </div>

      {/* Commander rename overlay */}
      {isRename && <CommanderRenamePanel state={state} dispatch={dispatch} />}

      {/* Split army overlay */}
      {state.splitPanelArmyId && <SplitPanel state={state} dispatch={dispatch} />}
      {state.garrisonPanel && <GarrisonPanel state={state} dispatch={dispatch} />}
    </div>
  );
}
