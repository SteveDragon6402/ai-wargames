import type { GamePhase, SecretTestState, Winner } from "../types";

export function createInitialState(): SecretTestState {
  return {
    turn: 1,
    phase: "awaiting_actions",
    scratchpad: "",
    briefings: { lancaster: "", york: "" },
    pendingActions: {},
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
  if (typeof o.turn !== "number" || !isPhase(o.phase)) return null;
  const briefings = o.briefings as SecretTestState["briefings"] | undefined;
  if (!briefings || typeof briefings.lancaster !== "string" || typeof briefings.york !== "string") {
    return null;
  }
  return {
    turn: o.turn,
    phase: o.phase,
    scratchpad: typeof o.scratchpad === "string" ? o.scratchpad : "",
    briefings,
    pendingActions:
      o.pendingActions && typeof o.pendingActions === "object"
        ? (o.pendingActions as SecretTestState["pendingActions"])
        : {},
    history: Array.isArray(o.history) ? (o.history as SecretTestState["history"]) : [],
    winner: o.winner as Winner | undefined,
    gmLock: o.gmLock === true,
    gmLockAt: typeof o.gmLockAt === "string" ? o.gmLockAt : undefined,
  };
}

export function bothActionsIn(state: SecretTestState): boolean {
  return Boolean(state.pendingActions.lancaster?.trim() && state.pendingActions.york?.trim());
}

export function isOpeningResolve(state: SecretTestState): boolean {
  return (
    state.history.length === 0 &&
    !state.briefings.lancaster.trim() &&
    !state.briefings.york.trim() &&
    !state.pendingActions.lancaster &&
    !state.pendingActions.york
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

export function archiveCurrentTurn(state: SecretTestState): SecretTestState["history"][number] {
  return {
    turn: state.turn,
    briefings: { ...state.briefings },
    actions: {
      lancaster: state.pendingActions.lancaster ?? "",
      york: state.pendingActions.york ?? "",
    },
  };
}
