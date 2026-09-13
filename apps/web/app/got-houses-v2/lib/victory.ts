import type {
  Army,
  CharacterState,
  Faction,
  GameOutcome,
  HoldRuntime,
  NorthPrizeStreak,
} from "../types";
import { HOLDS } from "../data/holds";
import { garrisonHeadcount } from "./hold-runtime";
import { armyMen } from "./forage";

export const VICTORY_TURN_LIMIT = 25;
export const NORTH_PRIZE_HOLD_TURNS = 3;
export const WEST_RIVERLANDS_NEEDED = 4;

export const RIVERRUN_ID = "16";
export const TWINS_ID = "17";
export const CASTERLY_ROCK_ID = "23";
export const KINGS_LANDING_ID = "30";

export const RIVERLANDS_HOLD_IDS = HOLDS.filter((h) => h.region === "riverlands").map(
  (h) => h.id
);

const PRIZE_NAME: Record<string, string> = {
  [KINGS_LANDING_ID]: "King's Landing",
  [CASTERLY_ROCK_ID]: "Casterly Rock",
};

export function factionStrength(
  faction: Faction,
  armies: Army[],
  holdStates: Record<string, HoldRuntime>
): number {
  let n = 0;
  for (const a of armies) {
    if (a.faction === faction) n += armyMen(a);
  }
  for (const hs of Object.values(holdStates ?? {})) {
    const who = hs.garrison.faction ?? hs.controller;
    if (who === faction) n += garrisonHeadcount(hs.garrison);
  }
  return n;
}

/**
 * A burned seat is worth nothing to anybody.
 *
 * Razing King's Landing or Riverrun denies the prize to both sides rather than
 * handing it to the arsonist, so razed holds drop out of every count below.
 */
export function countsForVictory(hs: HoldRuntime | undefined): boolean {
  return !!hs && !hs.razed;
}

export function westRiverlandsHeld(
  holdStates: Record<string, HoldRuntime>
): string[] {
  return RIVERLANDS_HOLD_IDS.filter(
    (id) =>
      holdStates[id]?.controller === "westerlands" &&
      countsForVictory(holdStates[id])
  );
}

export function northPrizeHold(
  holdStates: Record<string, HoldRuntime>,
  prefer?: string | null
): string | null {
  const holds = [KINGS_LANDING_ID, CASTERLY_ROCK_ID].filter(
    (id) =>
      holdStates[id]?.controller === "north" &&
      countsForVictory(holdStates[id])
  );
  if (holds.length === 0) return null;
  if (prefer && holds.includes(prefer)) return prefer;
  return holds[0] ?? null;
}

export function tickNorthPrize(
  holdStates: Record<string, HoldRuntime>,
  prev: NorthPrizeStreak | null | undefined
): NorthPrizeStreak | null {
  const holdId = northPrizeHold(holdStates, prev?.holdId);
  if (!holdId) return null;
  if (prev?.holdId === holdId) {
    return { holdId, turnsHeld: prev.turnsHeld + 1 };
  }
  return { holdId, turnsHeld: 1 };
}

export function robbDeadOutcome(): GameOutcome {
  return {
    winner: "westerlands",
    reason: "robb_dead",
    text: "Robb Stark is dead. The North's war dies with him — Tywin Lannister has won.",
  };
}

export function evaluateVictory(input: {
  finishedTurn: number;
  armies: Army[];
  holdStates: Record<string, HoldRuntime>;
  characters: Record<string, CharacterState>;
  northPrize?: NorthPrizeStreak | null;
}): { outcome: GameOutcome | null; northPrize: NorthPrizeStreak | null } {
  const northPrize = tickNorthPrize(input.holdStates, input.northPrize);
  const robb = input.characters["robb-stark"];
  if (robb && !robb.alive) {
    return { outcome: robbDeadOutcome(), northPrize };
  }

  const northMen = factionStrength("north", input.armies, input.holdStates);
  const westMen = factionStrength("westerlands", input.armies, input.holdStates);
  if (northMen <= 0 && westMen > 0) {
    return {
      outcome: {
        winner: "westerlands",
        reason: "army_destroyed",
        text: "The Northern host is gone. Tywin Lannister has won the war.",
      },
      northPrize,
    };
  }
  if (westMen <= 0 && northMen > 0) {
    return {
      outcome: {
        winner: "north",
        reason: "army_destroyed",
        text: "The Lannister host is gone. Robb Stark has won the war.",
      },
      northPrize,
    };
  }

  const westHeld = westRiverlandsHeld(input.holdStates);
  if (
    westHeld.includes(RIVERRUN_ID) &&
    westHeld.includes(TWINS_ID) &&
    westHeld.length >= WEST_RIVERLANDS_NEEDED
  ) {
    return {
      outcome: {
        winner: "westerlands",
        reason: "riverlands",
        text: `Tywin holds Riverrun, the Twins, and ${westHeld.length} riverland seats. The Riverlands are his.`,
      },
      northPrize,
    };
  }

  if (northPrize && northPrize.turnsHeld >= NORTH_PRIZE_HOLD_TURNS) {
    const name = PRIZE_NAME[northPrize.holdId] ?? northPrize.holdId;
    return {
      outcome: {
        winner: "north",
        reason:
          northPrize.holdId === KINGS_LANDING_ID
            ? "kings_landing"
            : "casterly_rock",
        text: `Robb Stark has held ${name} for ${northPrize.turnsHeld} turns. The war is his.`,
      },
      northPrize,
    };
  }

  if (input.finishedTurn >= VICTORY_TURN_LIMIT) {
    return {
      outcome: {
        winner: "north",
        reason: "time",
        text: `Twenty-five turns have passed. Robb Stark has outlasted the lion.`,
      },
      northPrize,
    };
  }

  return { outcome: null, northPrize };
}

export function victoryProgress(input: {
  turn: number;
  armies: Army[];
  holdStates: Record<string, HoldRuntime>;
  characters: Record<string, CharacterState>;
  northPrize?: NorthPrizeStreak | null;
}) {
  const westHeld = westRiverlandsHeld(input.holdStates);
  const prize = northPrizeHold(input.holdStates, input.northPrize?.holdId);
  return {
    turn: input.turn,
    turnLimit: VICTORY_TURN_LIMIT,
    robbAlive: input.characters["robb-stark"]?.alive !== false,
    northMen: factionStrength("north", input.armies, input.holdStates),
    westMen: factionStrength("westerlands", input.armies, input.holdStates),
    westRiverlands: {
      names: westHeld.map((id) => HOLDS.find((h) => h.id === id)?.name ?? id),
      count: westHeld.length,
      hasRiverrun: westHeld.includes(RIVERRUN_ID),
      hasTwins: westHeld.includes(TWINS_ID),
    },
    northPrize: prize
      ? {
          name: PRIZE_NAME[prize] ?? prize,
          turnsHeld: input.northPrize?.holdId === prize ? input.northPrize.turnsHeld : 0,
        }
      : null,
  };
}
