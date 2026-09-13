import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { HoldRuntime } from "../types";
import {
  applyFriendlyPresenceRefill,
  garrisonHeadcount,
  holdSpineColor,
  holdSpineOwner,
  postedGarrisonCondition,
  recoverNativeGarrisons,
  restoreHomeHousehold,
} from "./hold-runtime";
import { army, holdRuntime } from "./test-helpers";

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

const EMPTY_GARRISON = {
  faction: null as null,
  units: [] as { house: string; type: "infantry"; count: number }[],
  leaders: [] as [],
  notables: [] as [],
  morale: "None",
  tiredness: "None",
  stance: "Vacant",
};

describe("recoverNativeGarrisons", () => {
  it("hands an abandoned conquest back to the household and grows toward default", () => {
    let holds: Record<string, HoldRuntime> = {
      "16": holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
        garrison: { ...EMPTY_GARRISON },
      }),
    };
    holds = recoverNativeGarrisons([], holds);
    assert.equal(holds["16"].controller, "north");
    assert.equal(holds["16"].garrison.faction, "north");
    const first = garrisonHeadcount(holds["16"].garrison);
    assert.ok(first > 0);
    assert.ok(first < 900);

    holds = recoverNativeGarrisons([], holds);
    const second = garrisonHeadcount(holds["16"].garrison);
    assert.ok(second > first);

    for (let i = 0; i < 6; i++) holds = recoverNativeGarrisons([], holds);
    assert.equal(garrisonHeadcount(holds["16"].garrison), 900);
  });

  it("does not grow a living occupying garrison", () => {
    const holds = {
      "17": holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
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
    const next = recoverNativeGarrisons([], holds);
    assert.equal(next["17"].controller, "westerlands");
    assert.equal(next["17"].garrison.faction, "westerlands");
    assert.equal(garrisonHeadcount(next["17"].garrison), 200);
  });

  it("does not raise a ruin", () => {
    const holds = {
      "08": holdRuntime({
        homeFaction: "north",
        controller: null,
        garrison: { ...EMPTY_GARRISON },
      }),
    };
    const next = recoverNativeGarrisons([], holds);
    assert.equal(garrisonHeadcount(next["08"].garrison), 0);
  });

  it("does not grow while the seat is sieged or an enemy host is on the tile", () => {
    const sieged = recoverNativeGarrisons(
      [],
      {
        "16": holdRuntime({
          homeFaction: "north",
          controller: "north",
          garrison: {
            faction: "north",
            units: [{ house: "Tully", type: "infantry", count: 100 }],
            leaders: [],
            notables: [],
            morale: "Holding",
            tiredness: "Tired",
            stance: "Under siege",
          },
          siege: {
            besiegerFaction: "westerlands",
            turns: 2,
            armyIds: ["w1"],
          },
        }),
      }
    );
    assert.equal(garrisonHeadcount(sieged["16"].garrison), 100);

    const enemyOnTile = recoverNativeGarrisons(
      [army({ id: "w1", faction: "westerlands", holdId: "16" })],
      {
        "16": holdRuntime({
          homeFaction: "north",
          controller: null,
          garrison: { ...EMPTY_GARRISON },
        }),
      }
    );
    assert.equal(enemyOnTile["16"].controller, null);
    assert.equal(garrisonHeadcount(enemyOnTile["16"].garrison), 0);
  });

  it("does not wipe a living native garrison just to relabel the seat", () => {
    const next = recoverNativeGarrisons(
      [],
      {
        "16": holdRuntime({
          homeFaction: "north",
          controller: null,
          garrison: {
            faction: "north",
            units: [{ house: "Tully", type: "infantry", count: 400 }],
            leaders: [],
            notables: [],
            morale: "Holding",
            tiredness: "Rested",
            stance: "Manning the walls",
          },
        }),
      }
    );
    assert.equal(next["16"].controller, "north");
    assert.ok(garrisonHeadcount(next["16"].garrison) >= 400);
  });
});

describe("postedGarrisonCondition", () => {
  it("inherits the host's morale when the walls are empty or broken", () => {
    const cond = postedGarrisonCondition(
      {
        morale: "High after the storm",
        tiredness: "Bloodied but standing",
        stance: "Pressed to the gates",
      },
      {
        faction: null,
        units: [],
        leaders: [],
        notables: [],
        morale: "Broken — the walls are lost",
        tiredness: "Scattered or dead",
        stance: "None — hold vacant",
      }
    );
    assert.equal(cond.morale, "High after the storm");
    assert.equal(cond.tiredness, "Bloodied but standing");
    assert.match(cond.stance, /Pressed to the gates/);
    assert.match(cond.stance, /holding the keep/);
  });

  it("keeps a living garrison's own condition when reinforcing", () => {
    const cond = postedGarrisonCondition(
      {
        morale: "Fresh from the road",
        tiredness: "Rested",
        stance: "Marching",
      },
      {
        faction: "westerlands",
        units: [{ house: "Lannister", type: "infantry", count: 200 }],
        leaders: [],
        notables: [],
        morale: "Thin but holding",
        tiredness: "Tired",
        stance: "Manning the walls",
      }
    );
    assert.equal(cond.morale, "Thin but holding");
    assert.equal(cond.tiredness, "Tired");
    assert.equal(cond.stance, "Manning the walls");
  });
});

describe("restoreHomeHousehold", () => {
  it("returns the seat to its household with empty walls", () => {
    const next = restoreHomeHousehold(
      "16",
      holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
        garrison: {
          faction: "westerlands",
          units: [],
          leaders: [],
          notables: [],
          morale: "None",
          tiredness: "None",
          stance: "Vacant",
        },
      })
    );
    assert.equal(next.controller, "north");
    assert.equal(next.garrison.faction, "north");
    assert.equal(garrisonHeadcount(next.garrison), 0);
  });
});
