import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCastleSeed } from "../data/castles";
import { freeCapacity, garrisonHeadcount } from "./hold-runtime";
import {
  investorCheckAtHold,
  MIN_SIEGE_ABSOLUTE,
  MIN_SIEGE_FRACTION,
  minimumHoldingGarrison,
  minimumSiegeForce,
  reconcilePledges,
} from "./siege";
import { army, holdRuntime } from "./test-helpers";

describe("minimumSiegeForce", () => {
  it("is zero against an empty garrison", () => {
    assert.equal(minimumSiegeForce(0), 0);
  });

  it("never drops below the absolute floor for a living garrison", () => {
    assert.equal(minimumSiegeForce(10), MIN_SIEGE_ABSOLUTE);
  });

  it("is a fraction of a large garrison", () => {
    assert.equal(minimumSiegeForce(5000), Math.ceil(5000 * MIN_SIEGE_FRACTION));
  });
});

describe("investorCheckAtHold", () => {
  const hs = holdRuntime({
    controller: "north",
    garrison: {
      faction: "north",
      units: [{ house: "Tully", type: "infantry", count: 2000 }],
      leaders: [],
      notables: [],
      morale: "Steady",
      tiredness: "Rested",
      stance: "Holding",
    },
  });

  it("does not open a siege when the host is too thin", () => {
    const check = investorCheckAtHold(
      hs,
      [army({ id: "w1", faction: "westerlands", holdId: "16", units: [{ house: "Lannister", type: "infantry", count: 100 }] })],
      "16"
    );
    assert.equal(check.status, "under_strength");
  });

  it("opens a siege once the host meets the threshold", () => {
    const required = minimumSiegeForce(2000);
    const check = investorCheckAtHold(
      hs,
      [
        army({
          id: "w1",
          faction: "westerlands",
          holdId: "16",
          units: [{ house: "Lannister", type: "infantry", count: required }],
        }),
      ],
      "16"
    );
    assert.equal(check.status, "investing");
    assert.equal(check.status === "investing" && check.required, required);
  });

  it("does not invest a seat the present faction already holds", () => {
    const check = investorCheckAtHold(
      hs,
      [army({ id: "n1", faction: "north", holdId: "16" })],
      "16"
    );
    assert.equal(check.status, "none");
  });
});

describe("garrison floors", () => {
  it("a conquered seat's holding floor is well under its native default", () => {
    const seed = getCastleSeed("16");
    const floor = minimumHoldingGarrison("16", 10_000);
    assert.ok(floor > 0);
    assert.ok(floor < seed.defaultGarrison);
    assert.ok(floor <= Math.ceil(seed.defaultGarrison * 0.25) || floor === 150);
  });

  it("never asks for more men than the captor has", () => {
    assert.equal(minimumHoldingGarrison("16", 40), 40);
  });

  it("free capacity is capacity minus current headcount", () => {
    const hs = holdRuntime({
      garrison: {
        faction: "north",
        units: [{ house: "Tully", type: "infantry", count: 200 }],
        leaders: [],
        notables: [],
        morale: "Steady",
        tiredness: "Rested",
        stance: "Holding",
      },
    });
    const seed = getCastleSeed("16");
    assert.equal(garrisonHeadcount(hs.garrison), 200);
    assert.equal(freeCapacity("16", hs), seed.capacity - 200);
  });
});

describe("reconcilePledges", () => {
  it("keeps a thin occupying garrison when the field host has marched on", () => {
    const holds = {
      "16": holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
        garrison: {
          faction: "westerlands",
          units: [{ house: "Lannister", type: "infantry", count: 80 }],
          leaders: [],
          notables: [],
          morale: "Thin",
          tiredness: "Tired",
          stance: "Holding",
        },
      }),
    };
    const settled = reconcilePledges(
      3,
      [
        {
          holdId: "16",
          faction: "westerlands",
          minimumMen: 225,
          turn: 2,
          cause: "walk_in",
        },
      ],
      holds,
      []
    );
    assert.equal(settled.holdStates["16"].controller, "westerlands");
    assert.equal(settled.holdStates["16"].garrison.units[0]?.count, 80);
    assert.equal(settled.pledges.length, 0);
  });
});
