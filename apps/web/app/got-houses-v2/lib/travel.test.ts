import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  describeSeat,
  isOccupyingGarrison,
  nearestFriendlyHold,
  retreatCountryKind,
  turnsBetween,
} from "./travel";
import { army, holdRuntime } from "./test-helpers";
import { HOLDS_MAP } from "../data/holds";

describe("turnsBetween", () => {
  it("counts each link as one turn", () => {
    assert.equal(turnsBetween("01", "01"), 0);
    const n = turnsBetween("01", "08");
    assert.ok(n !== null && n >= 1);
  });

  it("returns null for unknown holds", () => {
    assert.equal(turnsBetween("01", "nope"), null);
  });
});

describe("nearestFriendlyHold", () => {
  it("picks the closest own-controlled seat that is not enemy-occupied", () => {
    const holds = {
      "17": holdRuntime({ homeFaction: "north", controller: "westerlands" }),
      "16": holdRuntime({ homeFaction: "north", controller: "westerlands" }),
      "18": holdRuntime({ homeFaction: "westerlands", controller: "westerlands" }),
    };
    const dest = nearestFriendlyHold("17", "westerlands", holds, [
      army({ id: "w1", faction: "westerlands", holdId: "17" }),
    ]);
    assert.ok(dest);
    assert.notEqual(dest, "17");
  });
});

describe("isOccupyingGarrison", () => {
  it("is true only for a foreign posted garrison", () => {
    assert.equal(
      isOccupyingGarrison(
        holdRuntime({
          homeFaction: "north",
          controller: "westerlands",
          garrison: {
            faction: "westerlands",
            units: [{ house: "Lannister", type: "infantry", count: 400 }],
            leaders: [],
            notables: [],
            morale: "Holding",
            tiredness: "Tired",
            stance: "On the walls",
          },
        })
      ),
      true
    );
    assert.equal(
      isOccupyingGarrison(
        holdRuntime({
          homeFaction: "north",
          controller: "north",
          garrison: {
            faction: "north",
            units: [{ house: "Frey", type: "infantry", count: 400 }],
            leaders: [],
            notables: [],
            morale: "Holding",
            tiredness: "Rested",
            stance: "On the walls",
          },
        })
      ),
      false
    );
  });
});

describe("retreatCountryKind", () => {
  it("treats an enemy-held seat as hostile country", () => {
    assert.equal(
      retreatCountryKind(
        "16",
        "westerlands",
        { "16": holdRuntime({ homeFaction: "north", controller: "north" }) }
      ),
      "hostile"
    );
    assert.equal(
      retreatCountryKind(
        "21",
        "westerlands",
        { "21": holdRuntime({ homeFaction: "westerlands", controller: "westerlands" }) }
      ),
      "friendly"
    );
  });
});

describe("describeSeat", () => {
  it("says who holds the walls now, not only who built them", () => {
    const twins = HOLDS_MAP.get("17");
    const text = describeSeat(
      twins,
      holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
        garrison: {
          faction: "westerlands",
          units: [{ house: "Lannister", type: "infantry", count: 400 }],
          leaders: [],
          notables: [],
          morale: "Holding",
          tiredness: "Tired",
          stance: "On the walls",
        },
      })
    );
    assert.match(text, /HELD BY THE WESTERLANDS/i);
    assert.match(text, /House Frey does not hold/i);
  });
});
