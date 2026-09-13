import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { gameReducer } from "./useGameState";
import { buildSeatFateChoice } from "../lib/pending-choices";
import { createPrisonerGroup } from "../lib/prisoners";
import { queryBattleLogs, formatBattleLog } from "../lib/battle-records";
import type { GameState } from "../types";

describe("prisoners / terms / raze walk", () => {
  it("blocks submit, records a broken promise, and razes nobody's prize", () => {
    const choice = buildSeatFateChoice({
      turn: 1,
      holdId: "21",
      faction: "westerlands",
      promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
      garrisonUnits: [{ house: "Tully", type: "infantry", count: 200 }],
      captiveCharacterIds: [],
      escortArmyIds: [],
      stormed: false,
    });
    let state: GameState = {
      ...INITIAL_GAME_STATE,
      pendingChoices: [choice],
      holdStates: {
        ...INITIAL_GAME_STATE.holdStates,
        "21": {
          ...INITIAL_GAME_STATE.holdStates["21"],
          controller: "westerlands",
        },
      },
    };

    const blocked = gameReducer(state, {
      type: "SUBMIT_FACTION",
      faction: "westerlands",
    });
    assert.equal(blocked.westerlands.submitted, false);
    assert.equal(blocked.phase, "planning");

    state = gameReducer(state, {
      type: "RESOLVE_PENDING_CHOICE",
      choiceId: choice.id,
      fates: { garrison: "execute", leaders: "execute", town: "occupy" },
    });
    assert.equal((state.pendingChoices ?? []).length, 0);
    assert.ok((state.deeds ?? []).some((d) => d.circumstances.brokeWord));

    const host = state.armies.find(
      (a) => a.faction === "westerlands" && a.holdId === "21"
    );
    if (host) {
      state = gameReducer(state, {
        type: "SET_RAZE_ORDER",
        armyId: host.id,
        holdId: "21",
        active: true,
      });
      assert.ok((state.westerlands.razeOrders ?? []).some((o) => o.holdId === "21"));
    }
  });

  it("liberates an escort when the host is destroyed, and cells when the city is retaken", () => {
    const jaime = INITIAL_GAME_STATE.armies.find((a) => a.id === "army-jaime");
    assert.ok(jaime);
    const group = createPrisonerGroup({
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "army", armyId: jaime.id },
      units: [{ house: "Tully", type: "infantry", count: 40 }],
      characterIds: [],
      takenAtHoldId: "21",
      takenTurn: 1,
      origin: "battle",
      battleId: "b-escort",
    });
    assert.ok(group);

    let state: GameState = {
      ...INITIAL_GAME_STATE,
      phase: "resolving",
      prisoners: [group],
      pendingBattles: [
        {
          holdId: jaime.holdId,
          northArmies: INITIAL_GAME_STATE.armies.filter((a) => a.faction === "north").slice(0, 1),
          westArmies: [jaime],
        },
      ],
    };

    state = gameReducer(state, {
      type: "BATTLES_RESOLVED",
      reports: [
        {
          id: "b-escort",
          turn: state.turn,
          holdId: jaime.holdId,
          holdResult: "north",
          defeatType: "shattering",
          narrative: "Jaime's host is destroyed.",
          shortSummary: "Jaime shattered.",
          headline: "Jaime's host ceases to be",
          casualties: jaime.units.map((u) => ({
            faction: "westerlands" as const,
            armyId: jaime.id,
            unitType: u.type,
            house: u.house,
            count: u.count,
          })),
          fallen: [],
          captured: [],
          retreatingArmyIds: ["army-jaime"],
        },
      ],
    });

    assert.equal(
      (state.prisoners ?? []).some((g) => g.id === group.id && g.location.kind === "army"),
      false
    );

    const cells = createPrisonerGroup({
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "hold", holdId: "16" },
      units: [{ house: "Tully", type: "infantry", count: 20 }],
      characterIds: [],
      takenAtHoldId: "16",
      takenTurn: 1,
      origin: "siege",
    });
    assert.ok(cells);
    const northHost = state.armies.find((a) => a.faction === "north");
    assert.ok(northHost);
    const emptied = {
      ...state.holdStates["16"],
      controller: "westerlands" as const,
      garrison: {
        ...state.holdStates["16"].garrison,
        units: [],
        leaders: [],
        notables: [],
      },
    };
    state = {
      ...state,
      phase: "resolving",
      prisoners: [cells],
      armies: state.armies.map((a) =>
        a.id === northHost.id
          ? { ...a, holdId: "16" }
          : a.holdId === "16"
            ? { ...a, holdId: "21" }
            : a
      ),
      holdStates: { ...state.holdStates, "16": emptied },
      pendingBattles: [],
    };
    state = gameReducer(state, { type: "BATTLES_RESOLVED", reports: [] });
    assert.equal((state.prisoners ?? []).some((g) => g.id === cells.id), false);
    assert.ok((state.deeds ?? []).some((d) => d.kind === "prisoners_liberated"));
  });

  it("back-fills retreats onto the battle record so get_battle_logs can read them", () => {
    let state: GameState = {
      ...INITIAL_GAME_STATE,
      phase: "retreat",
      battleReports: [
        {
          id: "b-field",
          turn: 1,
          holdId: "21",
          holdResult: "north",
          defeatType: "structured_withdrawal",
          narrative: "The west falls back.",
          shortSummary: "West withdraws.",
          headline: "West leaves Riverrun in good order",
          casualties: [],
          fallen: [],
          captured: [],
          retreatingArmyIds: ["army-jaime"],
          aftermath: {
            seatChanged: null,
            destroyedArmyIds: [],
            retreatedTo: {},
          },
        },
      ],
      retreats: [
        {
          armyId: "army-jaime",
          fromHoldId: "21",
          forbiddenHoldIds: [],
          validTargets: ["16"],
          chosenHoldId: "16",
        },
      ],
    };

    state = gameReducer(state, { type: "COMMIT_RETREATS" });
    const logs = queryBattleLogs(state.battleReports, { holdId: "21" });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].aftermath?.retreatedTo["army-jaime"], "16");
    assert.match(formatBattleLog(logs[0]), /Retreats/);
  });
});
