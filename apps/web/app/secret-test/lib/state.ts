import { SEATS, STARTING_ISSUES } from "../data/valden";
import type { FactionId, GamePhase, PendingTurn, SecretTestState, Winner } from "../types";
import { STARTING_CASH } from "../types";

export function createInitialState(): SecretTestState {
  return {
    month: 1,
    phase: "awaiting_actions",
    scratchpad: "",
    cash: { red: STARTING_CASH, blue: STARTING_CASH },
    seats: SEATS.map((s) => ({ id: s.id, lean: s.startLean, turnout: s.startTurnout })),
    issues: [...STARTING_ISSUES],
    debateQuestions: [],
    briefings: { red: "", blue: "" },
    opponentRumors: { red: "", blue: "" },
    recommendations: { red: [], blue: [] },
    pendingActions: {},
    lastTranslations: {},
    history: [],
    gmLock: false,
  };
}

function isPhase(value: unknown): value is GamePhase {
  return value === "resolving" || value === "awaiting_actions" || value === "ended";
}

export function parseState(raw: unknown): SecretTestState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const month = typeof o.month === "number" ? o.month : typeof o.turn === "number" ? o.turn : null;
  if (month == null || !isPhase(o.phase)) return null;
  if (!Array.isArray(o.seats)) return null;
  const cash = o.cash as SecretTestState["cash"] | undefined;
  if (!cash || typeof cash.red !== "number" || typeof cash.blue !== "number") return null;
  const briefings = o.briefings as SecretTestState["briefings"] | undefined;
  if (!briefings || typeof briefings.red !== "string" || typeof briefings.blue !== "string") {
    return null;
  }
  return {
    month,
    phase: o.phase,
    scratchpad: typeof o.scratchpad === "string" ? o.scratchpad : "",
    cash,
    seats: o.seats as SecretTestState["seats"],
    issues: Array.isArray(o.issues) ? (o.issues as string[]) : [],
    debateQuestions: Array.isArray(o.debateQuestions) ? (o.debateQuestions as string[]) : [],
    briefings,
    opponentRumors: (o.opponentRumors as SecretTestState["opponentRumors"]) ?? { red: "", blue: "" },
    recommendations: (o.recommendations as SecretTestState["recommendations"]) ?? { red: [], blue: [] },
    pendingActions:
      o.pendingActions && typeof o.pendingActions === "object"
        ? (o.pendingActions as SecretTestState["pendingActions"])
        : {},
    lastTranslations:
      o.lastTranslations && typeof o.lastTranslations === "object"
        ? (o.lastTranslations as SecretTestState["lastTranslations"])
        : {},
    history: Array.isArray(o.history) ? (o.history as SecretTestState["history"]) : [],
    winner: o.winner as Winner | undefined,
    gmLock: o.gmLock === true,
    gmLockAt: typeof o.gmLockAt === "string" ? o.gmLockAt : undefined,
  };
}

export function pendingText(pending: PendingTurn | undefined): string {
  return pending?.text?.trim() ?? "";
}

export function bothActionsIn(state: SecretTestState): boolean {
  return Boolean(pendingText(state.pendingActions.red) && pendingText(state.pendingActions.blue));
}

export function isOpeningResolve(state: SecretTestState): boolean {
  return (
    state.history.length === 0 &&
    !state.briefings.red.trim() &&
    !state.briefings.blue.trim() &&
    !pendingText(state.pendingActions.red) &&
    !pendingText(state.pendingActions.blue)
  );
}

export function lockIsFresh(state: SecretTestState, lockMs: number): boolean {
  if (!state.gmLock) return false;
  if (!state.gmLockAt) return true;
  const at = Date.parse(state.gmLockAt);
  if (Number.isNaN(at)) return true;
  return Date.now() - at < lockMs;
}

export function withLock(state: SecretTestState, locked: boolean): SecretTestState {
  return {
    ...state,
    gmLock: locked,
    gmLockAt: locked ? new Date().toISOString() : undefined,
  };
}

export function emptyTranslation() {
  return {
    executed: "No executable package.",
    deferred: "Entire directive deferred.",
    costKr: 0,
    playerNote: "We could not field a plan this month.",
    prioritiesForGm: "No campaign activity.",
  };
}

export function factionCash(state: SecretTestState, faction: FactionId): number {
  return state.cash[faction] ?? 0;
}
