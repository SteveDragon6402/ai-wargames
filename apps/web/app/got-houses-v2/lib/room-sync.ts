import type { Faction, FactionOrders, GamePhase, GameState, RetreatEntry } from "../types";

export type RoomWriter = Faction | "both";

function phaseRank(phase: GamePhase): number {
  switch (phase) {
    case "planning":
      return 0;
    case "resolving":
      return 1;
    case "retreat":
      return 2;
    case "rename_commanders":
      return 3;
    default:
      return 0;
  }
}

/** Higher means further through the turn. Used so a stale client cannot rewind the room. */
export function stateProgress(state: Pick<GameState, "turn" | "phase">): number {
  return state.turn * 10 + phaseRank(state.phase);
}

function keepSubmitted(current: FactionOrders, next: FactionOrders): FactionOrders {
  // A locked side must not be unlocked by a stale save from the other browser.
  if (current.submitted && !next.submitted) return current;
  return next;
}

function mergeRetreats(
  current: GameState,
  incoming: GameState,
  writer: Faction
): RetreatEntry[] {
  const source = current.retreats.length >= incoming.retreats.length ? current : incoming;
  return source.retreats.map((entry) => {
    const other = (source === current ? incoming : current).retreats.find(
      (r) => r.armyId === entry.armyId
    );
    const army =
      incoming.armies.find((a) => a.id === entry.armyId) ??
      current.armies.find((a) => a.id === entry.armyId);
    const incomingEntry = incoming.retreats.find((r) => r.armyId === entry.armyId) ?? entry;
    const currentEntry = current.retreats.find((r) => r.armyId === entry.armyId) ?? entry;
    if (!army) return other ?? entry;
    return army.faction === writer ? incomingEntry : currentEntry;
  });
}

/**
 * Merge two clients' full-state saves so they cannot overwrite each other.
 *
 * Each browser holds a complete GameState. Without this, the West player's
 * save (North still unsubmitted in their copy) erases the North lock, and
 * neither client ever sees both sides submitted — so the turn never resolves.
 *
 * Host is always North; guest is always Westerlands.
 */
export function mergeRoomState(
  current: GameState,
  incoming: GameState,
  writer: RoomWriter
): GameState {
  if (writer === "both") return incoming;

  const incomingAhead = stateProgress(incoming) > stateProgress(current);
  const currentAhead = stateProgress(current) > stateProgress(incoming);

  if (incomingAhead) return incoming;
  if (currentAhead) return current;

  if (current.phase === "planning" && incoming.phase === "planning") {
    const north =
      writer === "north"
        ? keepSubmitted(current.north, incoming.north)
        : keepSubmitted(incoming.north, current.north);
    const westerlands =
      writer === "westerlands"
        ? keepSubmitted(current.westerlands, incoming.westerlands)
        : keepSubmitted(incoming.westerlands, current.westerlands);

    return {
      ...incoming,
      north,
      westerlands,
      activeFaction: incoming.activeFaction,
    };
  }

  if (current.phase === "retreat" && incoming.phase === "retreat") {
    const retreats = mergeRetreats(current, incoming, writer);
    // Guest must not clobber the host board; they may only land their own retreat picks.
    if (writer === "westerlands") {
      return { ...current, retreats };
    }
    return { ...incoming, retreats };
  }

  // Resolving / rename at the same progress: only the host (North) may write.
  if (writer === "westerlands") return current;
  return incoming;
}

export function factionOrdersEqual(a: FactionOrders, b: FactionOrders): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Shared-board identity so the guest poller does not re-hydrate the same snapshot. */
export function boardFingerprint(state: GameState): string {
  return JSON.stringify({
    turn: state.turn,
    phase: state.phase,
    pending: state.pendingBattles.map((b) => `${b.holdId}:${b.lastStand ? 1 : 0}`),
    reports: state.battleReports.length,
    armies: state.armies.map((a) => [a.id, a.holdId, a.units, a.name]),
    retreats: state.retreats.map((r) => [r.armyId, r.chosenHoldId]),
    north: state.north,
    westerlands: state.westerlands,
    rename: state.pendingRenames,
  });
}
