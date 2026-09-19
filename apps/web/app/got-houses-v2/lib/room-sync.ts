import type {
  Army,
  CharacterState,
  Faction,
  FactionOrders,
  GamePhase,
  GameState,
  HoldRuntime,
  PrisonerGroup,
  RetreatEntry,
} from "../types";

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
    case "ended":
      return 4;
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

function clipMoveOrders(fo: FactionOrders, armyIds: Set<string>): FactionOrders {
  return {
    ...fo,
    orders: (fo.orders ?? []).filter((o) => armyIds.has(o.armyId)),
  };
}

function holdTouchedByWriter(
  holdId: string,
  hs: HoldRuntime,
  writer: Faction,
  writerArmyHoldIds: Set<string>
): boolean {
  if (hs.controller === writer) return true;
  if (hs.garrison?.faction === writer) return true;
  if (hs.razeInProgress?.faction === writer) return true;
  if (hs.siege?.besiegerFaction === writer) return true;
  return writerArmyHoldIds.has(holdId);
}

function prisonerOnWriterBoard(
  group: PrisonerGroup,
  writer: Faction,
  writerArmyIds: Set<string>
): boolean {
  if (group.captorFaction === writer) return true;
  return group.location.kind === "army" && writerArmyIds.has(group.location.armyId);
}

/**
 * Each client owns its faction's hosts. A North save must not restore a
 * Westerlands army the West player just split, and the reverse.
 */
export function mergePlanningBoards(
  current: GameState,
  incoming: GameState,
  writer: Faction
): Pick<GameState, "armies" | "characters" | "holdStates" | "prisoners"> {
  const currentArmies = current.armies ?? [];
  const incomingArmies = incoming.armies ?? [];
  const writerArmies = incomingArmies.filter((a) => a.faction === writer);
  const otherArmies = currentArmies.filter((a) => a.faction !== writer);
  const armies: Army[] = [...otherArmies, ...writerArmies];

  const characters: Record<string, CharacterState> = {};
  for (const [id, c] of Object.entries(current.characters ?? {})) {
    if (c.faction !== writer) characters[id] = c;
  }
  for (const [id, c] of Object.entries(incoming.characters ?? {})) {
    if (c.faction === writer) characters[id] = c;
  }

  const writerArmyHoldIds = new Set(
    writerArmies.map((a) => a.holdId).filter((id): id is string => !!id)
  );
  const holdStates: Record<string, HoldRuntime> = { ...(current.holdStates ?? {}) };
  for (const [id, hs] of Object.entries(incoming.holdStates ?? {})) {
    if (holdTouchedByWriter(id, hs, writer, writerArmyHoldIds)) {
      holdStates[id] = hs;
    }
  }

  const writerArmyIds = new Set(writerArmies.map((a) => a.id));
  const incomingPrisoners = incoming.prisoners ?? [];
  const currentPrisoners = current.prisoners ?? [];
  const fromWriter = incomingPrisoners.filter((p) =>
    prisonerOnWriterBoard(p, writer, writerArmyIds)
  );
  const fromWriterIds = new Set(fromWriter.map((p) => p.id));
  const fromOther = currentPrisoners.filter(
    (p) => !fromWriterIds.has(p.id) && !prisonerOnWriterBoard(p, writer, writerArmyIds)
  );
  const prisoners: PrisonerGroup[] = [...fromOther, ...fromWriter];

  return { armies, characters, holdStates, prisoners };
}

function armySliceKey(state: GameState, faction: Faction): string {
  return JSON.stringify(
    (state.armies ?? [])
      .filter((a) => a.faction === faction)
      .map((a) => [a.id, a.holdId, a.name, a.units, a.leaders, a.notables])
  );
}

/** True when this client already has the rival's planning slice. */
export function rivalPlanningSliceEqual(
  local: GameState,
  remote: GameState,
  mine: Faction
): boolean {
  const rival: Faction = mine === "north" ? "westerlands" : "north";
  if (!factionOrdersEqual(local[rival], remote[rival])) return false;
  return armySliceKey(local, rival) === armySliceKey(remote, rival);
}

/** March orders that name a missing host cannot be resolved yet. */
export function moveOrdersResolvable(state: GameState): boolean {
  const ids = new Set((state.armies ?? []).map((a) => a.id));
  const orders = [...(state.north?.orders ?? []), ...(state.westerlands?.orders ?? [])];
  return orders.every((o) => ids.has(o.armyId));
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

    const boards = mergePlanningBoards(current, incoming, writer);
    const armyIds = new Set(boards.armies.map((a) => a.id));

    return {
      ...current,
      ...boards,
      north: clipMoveOrders(north, armyIds),
      westerlands: clipMoveOrders(westerlands, armyIds),
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
  const pending = state.pendingBattles ?? [];
  const reports = state.battleReports ?? [];
  const armies = state.armies ?? [];
  const retreats = state.retreats ?? [];
  return JSON.stringify({
    turn: state.turn,
    phase: state.phase,
    pending: pending.map((b) => `${b.holdId}:${b.lastStand ? 1 : 0}`),
    reports: reports.length,
    armies: armies.map((a) => [a.id, a.holdId, a.units, a.name]),
    retreats: retreats.map((r) => [r.armyId, r.chosenHoldId]),
    north: state.north,
    westerlands: state.westerlands,
    rename: state.pendingRenames,
    // Settling a seat's fate changes nothing above, so without these the guest
    // would never re-hydrate after the host decided.
    choices: (state.pendingChoices ?? []).map((c) => c.id),
    prisoners: (state.prisoners ?? []).map((p) => [p.id, p.location]),
    deeds: (state.deeds ?? []).length,
  });
}
