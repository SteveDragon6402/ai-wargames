import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { mergeRoomState, stateProgress } from "./room-sync";
import type { GameState, RetreatEntry } from "../types";

function withOrders(
  state: GameState,
  side: "north" | "westerlands",
  submitted: boolean,
  armyId = side === "north" ? "army-robb" : "army-jaime"
): GameState {
  return {
    ...state,
    [side]: {
      ...state[side],
      submitted,
      orders: submitted
        ? [{ armyId, fromHoldId: "08", toHoldId: "09" }]
        : state[side].orders,
    },
  };
}

describe("mergeRoomState", () => {
  it("does not let a West save unlock a North lock", () => {
    const lockedNorth = withOrders(INITIAL_GAME_STATE, "north", true);
    const staleWest = withOrders(INITIAL_GAME_STATE, "westerlands", true);
    const merged = mergeRoomState(lockedNorth, staleWest, "westerlands");
    assert.equal(merged.north.submitted, true);
    assert.equal(merged.north.orders[0]?.armyId, "army-robb");
    assert.equal(merged.westerlands.submitted, true);
  });

  it("does not let a North save unlock a West lock", () => {
    const lockedWest = withOrders(INITIAL_GAME_STATE, "westerlands", true);
    const staleNorth = withOrders(INITIAL_GAME_STATE, "north", true);
    const merged = mergeRoomState(lockedWest, staleNorth, "north");
    assert.equal(merged.westerlands.submitted, true);
    assert.equal(merged.north.submitted, true);
  });

  it("takes a resolving host save over a stale planning guest save", () => {
    const planning = INITIAL_GAME_STATE;
    const resolving: GameState = { ...INITIAL_GAME_STATE, phase: "resolving" };
    const merged = mergeRoomState(planning, resolving, "north");
    assert.equal(merged.phase, "resolving");
    assert.ok(stateProgress(resolving) > stateProgress(planning));
  });

  it("rejects a stale resolving save after the next planning turn", () => {
    const nextTurn: GameState = { ...INITIAL_GAME_STATE, turn: 2, phase: "planning" };
    const staleResolve: GameState = { ...INITIAL_GAME_STATE, turn: 1, phase: "resolving" };
    const merged = mergeRoomState(nextTurn, staleResolve, "westerlands");
    assert.equal(merged.turn, 2);
    assert.equal(merged.phase, "planning");
  });

  it("lets each side keep its own retreat pick", () => {
    const northArmy = INITIAL_GAME_STATE.armies.find((a) => a.faction === "north");
    const westArmy = INITIAL_GAME_STATE.armies.find((a) => a.faction === "westerlands");
    assert.ok(northArmy && westArmy);

    const retreats = (chosen: Record<string, string | null>): RetreatEntry[] => [
      {
        armyId: northArmy.id,
        fromHoldId: northArmy.holdId,
        forbiddenHoldIds: [],
        validTargets: ["02", "03"],
        chosenHoldId: chosen[northArmy.id] ?? null,
      },
      {
        armyId: westArmy.id,
        fromHoldId: westArmy.holdId,
        forbiddenHoldIds: [],
        validTargets: ["20", "21"],
        chosenHoldId: chosen[westArmy.id] ?? null,
      },
    ];

    const host: GameState = {
      ...INITIAL_GAME_STATE,
      phase: "retreat",
      retreats: retreats({ [northArmy.id]: "02" }),
    };
    const guest: GameState = {
      ...INITIAL_GAME_STATE,
      phase: "retreat",
      retreats: retreats({ [westArmy.id]: "20" }),
    };

    const afterGuest = mergeRoomState(host, guest, "westerlands");
    assert.equal(
      afterGuest.retreats.find((r) => r.armyId === northArmy.id)?.chosenHoldId,
      "02"
    );
    assert.equal(
      afterGuest.retreats.find((r) => r.armyId === westArmy.id)?.chosenHoldId,
      "20"
    );
  });
});
