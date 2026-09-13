import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCastleSeed } from "../data/castles";
import { freeCapacity, garrisonHeadcount } from "./hold-runtime";
import {
  foldSiegeIntoBattles,
  garrisonArmyId,
  investorCheckAtHold,
  MIN_SIEGE_ABSOLUTE,
  MIN_SIEGE_FRACTION,
  minimumHoldingGarrison,
  minimumSiegeForce,
  reconcilePledges,
  resolveSelectableArmy,
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

  it("hands an unmanned conquest back to the household instead of leaving it unheld", () => {
    const holds = {
      "16": holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
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
    assert.equal(settled.holdStates["16"].controller, "north");
    assert.equal(settled.holdStates["16"].garrison.faction, "north");
    assert.equal(garrisonHeadcount(settled.holdStates["16"].garrison), 0);
    assert.equal(settled.pledges.length, 0);
    assert.match(
      settled.events[0]?.detail ?? "",
      /household is returning to the walls/
    );
  });
});

describe("foldSiegeIntoBattles", () => {
  it("merges a storm, a sally, and a relieving host into one fight", () => {
    const holdId = "17";
    const north = army({ id: "army-robb", faction: "north", holdId });
    const west = army({ id: "army-tywin", faction: "westerlands", holdId });
    const hs = holdRuntime({
      homeFaction: "north",
      controller: "north",
      garrison: {
        faction: "north",
        units: [{ house: "Frey", type: "infantry", count: 800 }],
        leaders: [{ name: "Walder Frey" }],
        notables: [],
        morale: "Holding",
        tiredness: "Tired",
        stance: "On the walls",
      },
      siege: {
        besiegerFaction: "westerlands",
        armyIds: ["army-tywin"],
        turns: 2,
        terms: null,
      },
    });
    const field = [
      {
        holdId,
        northArmies: [north],
        westArmies: [west],
        engagement: "field" as const,
      },
    ];
    const out = foldSiegeIntoBattles(
      field,
      [north, west],
      { [holdId]: hs },
      ["army-tywin"],
      [holdId],
      {}
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].engagement, "storm");
    assert.equal(out[0].combinedAssault, true);
    assert.ok(out[0].northArmies.some((a) => a.id.startsWith("garrison:")));
    assert.equal(out[0].wallsStand, false);
  });

  it("leaves a field fight outside a living garrison as field-only", () => {
    const holdId = "30";
    const north = army({ id: "army-robb", faction: "north", holdId });
    const west = army({ id: "army-tywin", faction: "westerlands", holdId });
    const hs = holdRuntime({
      homeFaction: "westerlands",
      controller: "westerlands",
      garrison: {
        faction: "westerlands",
        units: [{ house: "Lannister", type: "infantry", count: 2000 }],
        leaders: [],
        notables: [],
        morale: "Holding",
        tiredness: "Rested",
        stance: "On the walls",
      },
    });
    const out = foldSiegeIntoBattles(
      [{ holdId, northArmies: [north], westArmies: [west] }],
      [north, west],
      { [holdId]: hs },
      [],
      [],
      {}
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].engagement, "field");
    assert.equal(out[0].wallsStand, true);
    assert.ok(!out[0].northArmies.some((a) => a.id.startsWith("garrison:")));
  });
});

describe("resolveSelectableArmy", () => {
  it("returns the posted garrison as a selectable host", () => {
    const holds = {
      "17": holdRuntime({
        homeFaction: "north",
        controller: "westerlands",
        garrison: {
          faction: "westerlands",
          units: [{ house: "Lannister", type: "infantry", count: 300 }],
          leaders: [{ name: "Ser Addam" }],
          notables: [],
          morale: "High after the storm",
          tiredness: "Bloodied but standing",
          stance: "Pressed to the gates — now holding the keep",
        },
      }),
    };
    const card = resolveSelectableArmy([], holds, garrisonArmyId("17"));
    assert.equal(card?.id, "garrison:17");
    assert.equal(card?.faction, "westerlands");
    assert.equal(card?.morale, "High after the storm");
    assert.equal(resolveSelectableArmy([], holds, "garrison:16"), undefined);
  });
});
