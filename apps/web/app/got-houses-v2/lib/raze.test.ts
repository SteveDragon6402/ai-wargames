import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCastleSeed } from "../data/castles";
import { army, holdRuntime } from "./test-helpers";
import { buildInitialForage } from "./forage";
import { recoverNativeGarrisons, refillToDefault, freeCapacity } from "./hold-runtime";
import {
  applyRaze,
  beginRaze,
  canRaze,
  effectiveCastleSeed,
  stripForageAtHold,
} from "./raze";
import { evaluateVictory } from "./victory";
import type { CharacterState, HoldRuntime } from "../types";

function chars(): Record<string, CharacterState> {
  return {
    "robb-stark": {
      kind: "player",
      id: "robb-stark",
      name: "Robb Stark",
      faction: "north",
      role: "lord",
      background: "",
      armyId: "army-north",
      alive: true,
    },
  };
}

describe("effectiveCastleSeed", () => {
  it("leaves a standing castle alone", () => {
    const raw = getCastleSeed("16");
    const hs = holdRuntime();
    assert.deepEqual(effectiveCastleSeed("16", hs), raw);
  });

  it("turns a razed castle into a ruin that raises nobody", () => {
    const raw = getCastleSeed("16");
    const razed = effectiveCastleSeed("16", holdRuntime({ razed: true }));
    assert.equal(razed.siteKind, "ruin");
    assert.equal(razed.defaultGarrison, 0);
    assert.equal(razed.capacity, Math.floor(raw.capacity * 0.5));
    assert.equal(razed.defaultFoodDays, 15);
  });
});

describe("applyRaze", () => {
  it("empties the walls and leaves a scar", () => {
    const hs = applyRaze("16", holdRuntime(), "north");
    assert.equal(hs.razed, true);
    assert.equal(hs.razeInProgress, null);
    assert.equal(hs.garrison.units.length, 0);
    assert.match(hs.scar ?? "", /torch/);
    assert.equal(hs.controller, "north");
  });

  it("will not let a host raze a seat it does not hold", () => {
    const host = army({ id: "a", faction: "north", holdId: "16" });
    const hs = holdRuntime({ controller: "westerlands" });
    assert.equal(canRaze(host, "16", hs).ok, false);
  });

  it("will not raze open ground", () => {
    const host = army({ id: "a", faction: "westerlands", holdId: "29" });
    const hs = holdRuntime({ controller: "westerlands" });
    assert.equal(canRaze(host, "29", hs).ok, false);
  });

  it("marks a raze in progress without finishing it", () => {
    const hs = beginRaze(holdRuntime(), "north", 4);
    assert.equal(hs.razeInProgress?.startedTurn, 4);
    assert.equal(hs.razed, undefined);
  });
});

describe("a razed seat does not regrow", () => {
  it("refuses household refill", () => {
    const razed = applyRaze("16", holdRuntime(), "north");
    const next = refillToDefault("16", razed);
    assert.equal(next.garrison.units.reduce((s, u) => s + u.count, 0), 0);
  });

  it("skips native recovery", () => {
    const razed = applyRaze("16", holdRuntime({ homeFaction: "north", controller: "north" }), "north");
    const recovered = recoverNativeGarrisons([], { "16": razed });
    assert.equal(recovered["16"].garrison.units.length, 0);
    assert.equal(recovered["16"].razed, true);
  });

  it("holds half as many men", () => {
    const raw = getCastleSeed("16");
    const razed = applyRaze("16", holdRuntime(), "north");
    assert.equal(freeCapacity("16", razed), Math.floor(raw.capacity * 0.5));
  });
});

describe("stripForageAtHold", () => {
  it("burns the country around a razed seat", () => {
    const forage = stripForageAtHold(buildInitialForage(), "16");
    assert.equal(forage?.holds["16"].step, 4);
    assert.match(forage?.holds["16"].line ?? "", /Burned/);
  });
});

describe("razed seats count for nobody", () => {
  function hold(controller: HoldRuntime["controller"], razed = false): HoldRuntime {
    return holdRuntime({
      controller,
      razed,
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

  const armies = [
    army({ id: "army-north", faction: "north" }),
    army({ id: "army-west", faction: "westerlands" }),
  ];

  it("denies Tywin a burned Riverrun", () => {
    const out = evaluateVictory({
      finishedTurn: 8,
      armies,
      holdStates: {
        "16": hold("westerlands", true),
        "17": hold("westerlands"),
        "18": hold("westerlands"),
        "19": hold("westerlands"),
      },
      characters: chars(),
    });
    assert.equal(out.outcome, null);
  });

  it("denies Robb a burned King's Landing", () => {
    const t1 = evaluateVictory({
      finishedTurn: 5,
      armies,
      holdStates: { "30": hold("north", true) },
      characters: chars(),
    });
    assert.equal(t1.northPrize, null);
    const t3 = evaluateVictory({
      finishedTurn: 7,
      armies,
      holdStates: { "30": hold("north", true) },
      characters: chars(),
      northPrize: { holdId: "30", turnsHeld: 2 },
    });
    assert.equal(t3.outcome, null);
  });
});
