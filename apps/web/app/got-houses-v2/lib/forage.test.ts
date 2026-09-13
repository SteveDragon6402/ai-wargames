import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyArmyForage,
  armyMen,
  buildInitialForage,
  forageAtHold,
  forageOnPath,
  grazeSteps,
  normalizeForage,
  renderForageLine,
} from "./forage";
import { pathwayKey } from "../data/pathways";

describe("grazeSteps", () => {
  it("ignores a scrap of men", () => {
    assert.equal(grazeSteps(50), 0);
  });
  it("bites harder as the host grows", () => {
    assert.equal(grazeSteps(800), 1);
    assert.equal(grazeSteps(2500), 2);
    assert.equal(grazeSteps(8000), 3);
  });
});

describe("renderForageLine", () => {
  it("starts as the seed text and thins with each step", () => {
    assert.equal(renderForageLine("Riverland farms", 0), "Riverland farms");
    assert.match(renderForageLine("Riverland farms", 1), /easy pickings/);
    assert.match(renderForageLine("Riverland farms", 4), /stripped bare/);
  });
});

describe("applyArmyForage", () => {
  it("thins the road and the arrival seat when a host marches", () => {
    const start = buildInitialForage();
    const riverrun = start.holds["16"].step;
    const twins = start.holds["17"].step;
    const road = start.paths[pathwayKey("16", "17")].step;

    const next = applyArmyForage(
      start,
      [{ fromHoldId: "16", toHoldId: "17", men: 3000 }],
      [],
      1
    );

    assert.ok(next.holds["17"].step > twins);
    assert.equal(next.holds["16"].step, riverrun);
    assert.ok(next.paths[pathwayKey("16", "17")].step > road);
    assert.match(next.holds["17"].line, /picked over|gleanings|stripped|easy pickings/);
  });

  it("lets a camped host graze the seat it sits on", () => {
    const start = buildInitialForage();
    const before = start.holds["16"].step;
    const next = applyArmyForage(start, [], [{ holdId: "16", men: 3000 }], 1);
    assert.ok(next.holds["16"].step > before);
  });

  it("lets unused country creep back on even turns", () => {
    const start = buildInitialForage();
    const bitten = applyArmyForage(
      start,
      [{ fromHoldId: "16", toHoldId: "17", men: 8000 }],
      [],
      1
    );
    const afterBite = bitten.holds["17"].step;
    const recovered = applyArmyForage(bitten, [], [], 2);
    assert.ok(recovered.holds["17"].step <= afterBite);
  });

  it("strips a seat if hosts keep coming", () => {
    let forage = buildInitialForage();
    for (let turn = 1; turn <= 8; turn++) {
      forage = applyArmyForage(
        forage,
        [{ fromHoldId: "16", toHoldId: "17", men: 8000 }],
        [],
        turn
      );
    }
    assert.equal(forage.holds["17"].step, 4);
    assert.match(forageAtHold(forage, "17"), /stripped bare/);
    assert.match(forageOnPath(forage, "16", "17"), /stripped bare/);
  });

  it("reads old saves that stored richness and a reverse level", () => {
    const migrated = normalizeForage({
      holds: {
        "16": {
          base: "Rich riverland fields",
          richness: 4,
          level: 0,
          line: "old",
        } as never,
      },
      paths: {},
    });
    assert.equal(migrated.holds["16"].step, 4);
    assert.match(migrated.holds["16"].line, /stripped bare/);
  });
});

describe("armyMen", () => {
  it("sums the stack", () => {
    assert.equal(
      armyMen({
        units: [{ count: 400 }, { count: 100 }],
      }),
      500
    );
  });
});
