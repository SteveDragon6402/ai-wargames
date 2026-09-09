import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyFriendlyPresenceRefill,
  holdSpineColor,
  holdSpineOwner,
} from "./hold-runtime";
import { holdRuntime } from "./test-helpers";
import { army } from "./test-helpers";

describe("applyFriendlyPresenceRefill", () => {
  it("does not hand a conquered garrison back to home just because a home army is present", () => {
    const holds = {
      "16": holdRuntime({
        homeFaction: "north",
        controller: null,
        garrison: {
          faction: "westerlands",
          units: [{ house: "Lannister", type: "infantry", count: 200 }],
          leaders: [],
          notables: [],
          morale: "Holding",
          tiredness: "Tired",
          stance: "Thin on the walls",
        },
      }),
    };
    const next = applyFriendlyPresenceRefill(
      [army({ id: "n1", faction: "north", holdId: "16" })],
      holds
    );
    assert.equal(next["16"].controller, null);
    assert.equal(next["16"].garrison.faction, "westerlands");
    assert.equal(next["16"].garrison.units[0]?.count, 200);
  });

  it("does liberate a truly empty home seat when a home army stands on it", () => {
    const holds = {
      "16": holdRuntime({
        homeFaction: "north",
        controller: null,
        garrison: {
          faction: null,
          units: [],
          leaders: [],
          notables: [],
          morale: "None",
          tiredness: "None",
          stance: "Vacant",
        },
      }),
    };
    const next = applyFriendlyPresenceRefill(
      [army({ id: "n1", faction: "north", holdId: "16" })],
      holds
    );
    assert.equal(next["16"].controller, "north");
    assert.ok((next["16"].garrison.units[0]?.count ?? 0) > 0);
  });
});

describe("holdSpineOwner", () => {
  it("falls back to home country when the seat is unheld", () => {
    assert.equal(holdSpineOwner(null, "north"), "north");
    assert.equal(holdSpineOwner(null, "westerlands"), "westerlands");
    assert.equal(holdSpineColor(null, "north"), "#3a6ea8");
    assert.equal(holdSpineColor("westerlands", "north"), "#b03030");
  });
});
