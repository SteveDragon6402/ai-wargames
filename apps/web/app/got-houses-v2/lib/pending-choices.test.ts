import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BoardSlice } from "./pending-choices";
import {
  applyPendingChoice,
  blockingChoicesFor,
  blockingMessage,
  buildSeatFateChoice,
  disposePrisonerGroup,
} from "./pending-choices";
import { createPrisonerGroup } from "./prisoners";
import { holdRuntime } from "./test-helpers";
import type { NpcAgentState } from "../types";

function npc(id: string, name: string, faction: "north" | "westerlands"): NpcAgentState {
  return {
    id,
    name,
    kind: "npc",
    faction,
    role: "castellan",
    alive: true,
    armyId: null,
    holdId: "21",
    mood: "grim",
    notepad: "",
    inviteHistory: [],
    captive: false,
    dispositionToward: {},
    adviceGivenIds: [],
  };
}

function board(partial: Partial<BoardSlice> = {}): BoardSlice {
  return {
    turn: 3,
    armies: [],
    holdStates: {
      "21": holdRuntime({ controller: "westerlands", homeFaction: "north" }),
    },
    characters: {
      "edmure-tully": npc("edmure-tully", "Edmure Tully", "north"),
    },
    prisoners: [],
    travellers: [],
    deeds: [],
    battleReports: [],
    pendingChoices: [],
    ...partial,
  };
}

describe("pending choices", () => {
  it("blocks submit until the captor settles a seat", () => {
    const choice = buildSeatFateChoice({
      turn: 3,
      holdId: "21",
      faction: "westerlands",
      promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
      garrisonUnits: [{ house: "Tully", type: "infantry", count: 400 }],
      captiveCharacterIds: ["edmure-tully"],
      escortArmyIds: [],
      stormed: false,
    });
    assert.equal(blockingChoicesFor([choice], "westerlands").length, 1);
    assert.equal(blockingChoicesFor([choice], "north").length, 0);
    assert.match(blockingMessage([choice], "westerlands") ?? "", /Settle/);
  });

  it("records a broken promise when the act is harsher than the word", () => {
    const choice = buildSeatFateChoice({
      turn: 3,
      holdId: "21",
      faction: "westerlands",
      promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
      garrisonUnits: [{ house: "Tully", type: "infantry", count: 400 }],
      captiveCharacterIds: ["edmure-tully"],
      escortArmyIds: [],
      stormed: false,
    });
    const result = applyPendingChoice(
      board({ pendingChoices: [choice] }),
      choice.id,
      { garrison: "execute", leaders: "prisoner", town: "occupy" }
    );
    assert.ok(result);
    assert.equal(result.board.pendingChoices.length, 0);
    const kinds = result.board.deeds.map((d) => d.kind);
    assert.ok(kinds.includes("garrison_executed"));
    assert.ok(kinds.includes("leaders_imprisoned"));
    assert.ok(result.board.deeds.some((d) => d.circumstances.brokeWord));
    assert.equal(result.board.prisoners.length, 1);
    const held = result.board.characters["edmure-tully"];
    assert.ok(held?.kind === "npc" && held.captive);
  });

  it("lets prisoners go and puts named men on the road", () => {
    const group = createPrisonerGroup({
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "hold", holdId: "21" },
      units: [{ house: "Tully", type: "infantry", count: 80 }],
      characterIds: ["edmure-tully"],
      takenAtHoldId: "21",
      takenTurn: 2,
      origin: "siege",
    });
    assert.ok(group);
    const start = board({
      prisoners: [group],
      characters: {
        "edmure-tully": {
          ...npc("edmure-tully", "Edmure Tully", "north"),
          captive: true,
        },
      },
    });
    const out = disposePrisonerGroup(start, group.id, "release");
    assert.ok(out);
    assert.equal(out.board.prisoners.length, 0);
    assert.ok(out.board.travellers.some((t) => t.characterId === "edmure-tully"));
    assert.ok(out.board.deeds.some((d) => d.kind === "prisoners_released"));
  });
});
