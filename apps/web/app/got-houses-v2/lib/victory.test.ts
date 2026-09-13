import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CharacterState, HoldRuntime } from "../types";
import { army, holdRuntime } from "./test-helpers";
import { evaluateVictory, tickNorthPrize, westRiverlandsHeld } from "./victory";

function host(faction: "north" | "westerlands", men = 1000) {
  return army({
    id: `army-${faction}`,
    faction,
    units: [{ house: "Test", type: "infantry", count: men }],
  });
}

function hold(controller: HoldRuntime["controller"]): HoldRuntime {
  return holdRuntime({
    controller,
    garrison: {
      faction: controller === "north" || controller === "westerlands" ? controller : null,
      units: [],
      leaders: [],
      notables: [],
      morale: "",
      tiredness: "",
      stance: "",
    },
  });
}

function chars(robbAlive = true): Record<string, CharacterState> {
  return {
    "robb-stark": {
      kind: "player",
      id: "robb-stark",
      name: "Robb Stark",
      faction: "north",
      role: "lord",
      background: "",
      armyId: "army-north",
      alive: robbAlive,
    },
  };
}

const bothArmies = [host("north"), host("westerlands")];

describe("evaluateVictory", () => {
  it("gives Tywin the war if Robb is dead", () => {
    const out = evaluateVictory({
      finishedTurn: 3,
      armies: bothArmies,
      holdStates: {},
      characters: chars(false),
    });
    assert.equal(out.outcome?.winner, "westerlands");
    assert.equal(out.outcome?.reason, "robb_dead");
  });

  it("ends the war when one side has no men left", () => {
    const northGone = evaluateVictory({
      finishedTurn: 4,
      armies: [host("westerlands")],
      holdStates: {},
      characters: chars(),
    });
    assert.equal(northGone.outcome?.reason, "army_destroyed");
    assert.equal(northGone.outcome?.winner, "westerlands");

    const westGone = evaluateVictory({
      finishedTurn: 4,
      armies: [host("north")],
      holdStates: {},
      characters: chars(),
    });
    assert.equal(westGone.outcome?.winner, "north");
  });

  it("does not call a mutual wipe a win", () => {
    const out = evaluateVictory({
      finishedTurn: 4,
      armies: [],
      holdStates: {},
      characters: chars(),
    });
    assert.equal(out.outcome, null);
  });

  it("gives Tywin the Riverlands when he holds Riverrun, the Twins, and two more", () => {
    const holdStates: Record<string, HoldRuntime> = {
      "16": hold("westerlands"),
      "17": hold("westerlands"),
      "18": hold("westerlands"),
      "19": hold("westerlands"),
    };
    const out = evaluateVictory({
      finishedTurn: 8,
      armies: bothArmies,
      holdStates,
      characters: chars(),
    });
    assert.equal(out.outcome?.winner, "westerlands");
    assert.equal(out.outcome?.reason, "riverlands");
    assert.equal(westRiverlandsHeld(holdStates).length, 4);
  });

  it("does not give Tywin the Riverlands without the Twins", () => {
    const out = evaluateVictory({
      finishedTurn: 8,
      armies: bothArmies,
      holdStates: {
        "16": hold("westerlands"),
        "18": hold("westerlands"),
        "19": hold("westerlands"),
        "20": hold("westerlands"),
      },
      characters: chars(),
    });
    assert.equal(out.outcome, null);
  });

  it("gives Robb the war after three turns holding King's Landing", () => {
    const holdStates = { "30": hold("north") };
    const t1 = evaluateVictory({
      finishedTurn: 5,
      armies: bothArmies,
      holdStates,
      characters: chars(),
    });
    assert.equal(t1.outcome, null);
    assert.equal(t1.northPrize?.turnsHeld, 1);

    const t2 = evaluateVictory({
      finishedTurn: 6,
      armies: bothArmies,
      holdStates,
      characters: chars(),
      northPrize: t1.northPrize,
    });
    assert.equal(t2.outcome, null);

    const t3 = evaluateVictory({
      finishedTurn: 7,
      armies: bothArmies,
      holdStates,
      characters: chars(),
      northPrize: t2.northPrize,
    });
    assert.equal(t3.outcome?.winner, "north");
    assert.equal(t3.outcome?.reason, "kings_landing");
  });

  it("resets the prize streak if the seat is lost", () => {
    const next = tickNorthPrize({ "30": hold("westerlands") }, {
      holdId: "30",
      turnsHeld: 2,
    });
    assert.equal(next, null);
  });

  it("gives Robb the war on turn 25 if nothing else has landed", () => {
    const out = evaluateVictory({
      finishedTurn: 25,
      armies: bothArmies,
      holdStates: {},
      characters: chars(),
    });
    assert.equal(out.outcome?.winner, "north");
    assert.equal(out.outcome?.reason, "time");
  });
});
