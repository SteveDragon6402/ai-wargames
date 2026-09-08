import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyCasualties, buildRetreats } from "./useGameState";
import { army, battle } from "../lib/test-helpers";

describe("applyCasualties", () => {
  it("never heals a unit when a row is larger than the stack", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [{ house: "Stark", type: "infantry", count: 500 }],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", unitType: "infantry", house: "Stark", count: 800 },
    ]);
    assert.equal(next.length, 0);
  });

  it("does not mutate the incoming army objects", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [{ house: "Stark", type: "infantry", count: 500 }],
      }),
    ];
    applyCasualties(start, [
      { armyId: "n1", unitType: "infantry", house: "Stark", count: 100 },
    ]);
    assert.equal(start[0].units[0].count, 500);
  });

  it("spreads a house-mismatched row across the matching type without losing remainder", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [
          { house: "Stark", type: "infantry", count: 100 },
          { house: "Umber", type: "infantry", count: 100 },
          { house: "Karstark", type: "infantry", count: 100 },
        ],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", unitType: "infantry", house: "Nobody", count: 1 },
    ]);
    const remaining = next[0].units.reduce((s, u) => s + u.count, 0);
    assert.equal(remaining, 299);
  });

  it("leaves an army that was not named in the casualty list untouched", () => {
    const start = [
      army({ id: "n1", faction: "north" }),
      army({
        id: "w1",
        faction: "westerlands",
        units: [{ house: "Lannister", type: "infantry", count: 800 }],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", unitType: "infantry", house: "Stark", count: 50 },
    ]);
    assert.equal(
      next.find((a) => a.id === "w1")?.units[0].count,
      800
    );
  });
});

describe("buildRetreats", () => {
  it("allows retreat to any adjacent hold that is not enemy-occupied", () => {
    // Winterfell (01) links include 02 (Dreadfort).
    const north = army({ id: "n1", faction: "north", holdId: "01", lastHoldId: "07" });
    const west = army({ id: "w1", faction: "westerlands", holdId: "01", lastHoldId: "08" });
    const otherWest = army({
      id: "w2",
      faction: "westerlands",
      holdId: "02",
    });
    const retreats = buildRetreats(
      ["n1"],
      [north, west, otherWest],
      [battle([north], [west], "01")]
    );
    assert.equal(retreats.length, 1);
    assert.ok(!retreats[0].validTargets.includes("02"));
    assert.ok(retreats[0].validTargets.includes("07"));
  });

  it("marks an army with no legal neighbour as having zero targets", () => {
    // White Harbor (03) only links to 08 and 01.
    const north = army({ id: "n1", faction: "north", holdId: "03" });
    const westA = army({ id: "w1", faction: "westerlands", holdId: "03" });
    const westB = army({ id: "w2", faction: "westerlands", holdId: "08" });
    const westC = army({ id: "w3", faction: "westerlands", holdId: "01" });
    const retreats = buildRetreats(
      ["n1"],
      [north, westA, westB, westC],
      [battle([north], [westA], "03")]
    );
    assert.equal(retreats[0].validTargets.length, 0);
  });
});
