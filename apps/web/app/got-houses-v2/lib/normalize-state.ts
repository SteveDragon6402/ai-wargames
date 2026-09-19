import { buildInitialCharacters } from "../data/characters";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import type { Army, FactionOrders, GameState } from "../types";
import { normalizeForage } from "./forage";
import { normalizeHoldRuntime } from "./hold-runtime";

function normalizeFactionOrders(raw: Partial<FactionOrders> | undefined): FactionOrders {
  return {
    orders: raw?.orders ?? [],
    stanceOrders: raw?.stanceOrders ?? {},
    stormArmyIds: raw?.stormArmyIds ?? [],
    sallyHoldIds: raw?.sallyHoldIds ?? [],
    razeOrders: raw?.razeOrders ?? [],
    submitted: raw?.submitted ?? false,
  };
}

function normalizeArmy(army: Army): Army {
  return {
    ...army,
    units: army.units ?? [],
    leaders: army.leaders ?? [],
    notables: army.notables ?? [],
  };
}

/** Fill arrays a sparse room snapshot may omit so the joiner cannot crash. */
export function normalizeState(raw: GameState): GameState {
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
    forage: normalizeForage(raw.forage),
    outcome: raw.outcome ?? null,
    northPrize: raw.northPrize ?? null,
    armies: (raw.armies ?? INITIAL_GAME_STATE.armies).map(normalizeArmy),
    pendingBattles: raw.pendingBattles ?? [],
    retreats: raw.retreats ?? [],
    pendingRenames: raw.pendingRenames ?? [],
    prisoners: raw.prisoners ?? [],
    pendingChoices: raw.pendingChoices ?? [],
    travellers: raw.travellers ?? [],
    deeds: raw.deeds ?? [],
    seatFatePanelId: raw.seatFatePanelId ?? null,
    briefingOpen: raw.briefingOpen ?? false,
    briefingShownFor: raw.briefingShownFor ?? null,
    briefingShownTurn: raw.briefingShownTurn ?? null,
    turnHistory: (raw.turnHistory ?? []).map((h) => ({
      turn: h.turn,
      armyMoves: (h.armyMoves ?? []).map((m) => ({
        armyId: m.armyId,
        armyName: m.armyName ?? m.armyId,
        faction: m.faction ?? "north",
        moved: m.moved,
        fromHoldId: m.fromHoldId ?? "",
        toHoldId: m.toHoldId ?? "",
        order: m.order ?? (m.moved ? "march" : "rest"),
        men: m.men ?? 0,
      })),
    })),
    holdStates: Object.fromEntries(
      Object.entries({
        ...INITIAL_GAME_STATE.holdStates,
        ...(raw.holdStates ?? {}),
      }).map(([id, hs]) => [
        id,
        normalizeHoldRuntime(hs ?? INITIAL_GAME_STATE.holdStates[id]),
      ])
    ),
    battleReports: (raw.battleReports ?? []).map((r) => ({
      ...r,
      shortSummary: r.shortSummary ?? "",
      summaryError: r.summaryError,
      fallen: r.fallen ?? [],
      captured: r.captured ?? [],
      prisonersTaken: r.prisonersTaken ?? [],
      casualties: r.casualties ?? [],
      narrative: r.narrative ?? "",
      prisoners: r.prisoners ?? [],
      factors: r.factors
        ? {
            ...r.factors,
            commanderMoods: r.factors.commanderMoods ?? [],
          }
        : r.factors,
    })),
    garrisonPanel: raw.garrisonPanel ?? null,
    turnedHouses: raw.turnedHouses ?? [],
    north: normalizeFactionOrders(raw.north),
    westerlands: normalizeFactionOrders(raw.westerlands),
  };
}
