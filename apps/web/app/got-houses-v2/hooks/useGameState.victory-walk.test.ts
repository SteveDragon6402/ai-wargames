import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { gameReducer } from "./useGameState";
import type { GameState } from "../types";

function passTurn(state: GameState): GameState {
  const afterNorth = gameReducer(state, {
    type: "SUBMIT_FACTION",
    faction: "north",
  });
  const afterBoth = gameReducer(afterNorth, {
    type: "SUBMIT_FACTION",
    faction: "westerlands",
  });
  assert.equal(afterBoth.phase, "resolving");
  return gameReducer(afterBoth, { type: "BATTLES_RESOLVED", reports: [] });
}

describe("walk the opening board to a win", () => {
  it("gives Robb the war after 25 quiet turns", () => {
    let state = INITIAL_GAME_STATE;
    for (let n = 1; n <= 25; n++) {
      assert.equal(state.phase, "planning");
      assert.equal(state.outcome, null);
      state = passTurn(state);
    }
    assert.equal(state.phase, "ended");
    assert.equal(state.outcome?.winner, "north");
    assert.equal(state.outcome?.reason, "time");
    assert.equal(state.turn, 25);
    assert.ok(state.forage);
    assert.match(JSON.stringify(state.forage), /step/);
  });

  it("gives Tywin the war if Robb falls in battle", () => {
    let state = INITIAL_GAME_STATE;
    state = gameReducer(state, { type: "SUBMIT_FACTION", faction: "north" });
    state = gameReducer(state, { type: "SUBMIT_FACTION", faction: "westerlands" });
    const robb = state.armies.find((a) => a.leaders.some((l) => l.name === "Robb Stark"));
    assert.ok(robb);
    state = {
      ...state,
      pendingBattles: [
        {
          holdId: robb.holdId,
          northArmies: [robb],
          westArmies: state.armies.filter((a) => a.faction === "westerlands").slice(0, 1),
        },
      ],
    };
    state = gameReducer(state, {
      type: "BATTLES_RESOLVED",
      reports: [
        {
          id: "walk-robb",
          turn: state.turn,
          holdId: robb.holdId,
          holdResult: "westerlands",
          narrative: "Robb falls.",
          shortSummary: "Robb falls.",
          casualties: [],
          fallen: [{ armyId: robb.id, name: "Robb Stark", isLeader: true }],
          retreatingArmyIds: [],
        },
      ],
    });
    assert.equal(state.phase, "ended");
    assert.equal(state.outcome?.reason, "robb_dead");
    assert.equal(state.outcome?.winner, "westerlands");
    assert.equal(state.characters["robb-stark"]?.alive, false);
  });
});
