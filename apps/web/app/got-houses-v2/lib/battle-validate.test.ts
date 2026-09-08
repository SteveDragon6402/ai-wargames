import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distributeProportional,
  validateBattleOutcome,
} from "./battle-validate";
import { army, battle } from "./test-helpers";

describe("distributeProportional", () => {
  it("never invents or drops men, even when shares would round away", () => {
    const units = [
      { house: "Stark", type: "infantry" as const, count: 100 },
      { house: "Umber", type: "infantry" as const, count: 100 },
      { house: "Karstark", type: "infantry" as const, count: 100 },
    ];
    const assigned = [...distributeProportional(units, 1).values()];
    assert.equal(assigned.reduce((s, n) => s + n, 0), 1);
    assert.ok(assigned.every((n) => n === 0 || n === 1));
  });

  it("clamps the request to available headcount", () => {
    const units = [{ house: "Stark", type: "infantry" as const, count: 40 }];
    const assigned = distributeProportional(units, 999);
    assert.equal(assigned.get(units[0]), 40);
  });

  it("treats a negative request as zero", () => {
    const units = [{ house: "Stark", type: "infantry" as const, count: 40 }];
    const assigned = distributeProportional(units, -12);
    assert.equal(assigned.get(units[0]), 0);
  });
});

describe("validateBattleOutcome", () => {
  const north = army({
    id: "n1",
    faction: "north",
    holdId: "18",
    units: [{ house: "Stark", type: "infantry", count: 2000 }],
    leaders: [{ name: "Robb Stark" }],
  });
  const west = army({
    id: "w1",
    faction: "westerlands",
    holdId: "18",
    units: [{ house: "Lannister", type: "infantry", count: 1500 }],
    leaders: [{ name: "Jaime Lannister" }],
  });

  it("drops casualty rows for armies that are not in this battle", () => {
    const out = validateBattleOutcome(battle([north], [west], "18"), {
      holdResult: "north",
      casualties: [
        { armyId: "n1", unitType: "infantry", house: "Stark", count: 100 },
        { armyId: "ghost", unitType: "infantry", house: "Frey", count: 400 },
      ],
    });
    assert.equal(out.casualties.every((c) => c.armyId === "n1"), true);
    assert.ok(out.notes.some((n) => n.kind === "dropped_unknown_army"));
  });

  it("clamps a casualty row that would heal or overkill", () => {
    const out = validateBattleOutcome(battle([north], [west], "18"), {
      holdResult: "north",
      casualties: [
        { armyId: "w1", unitType: "infantry", house: "Lannister", count: -50 },
        { armyId: "n1", unitType: "infantry", house: "Stark", count: 99999 },
      ],
    });
    assert.ok(!out.casualties.some((c) => c.count < 0));
    const nLoss = out.casualties
      .filter((c) => c.armyId === "n1")
      .reduce((s, c) => s + c.count, 0);
    assert.equal(nLoss, 2000);
    assert.ok(out.notes.some((n) => n.kind === "dropped_negative"));
    assert.ok(out.notes.some((n) => n.kind === "clamped_to_available"));
  });

  it("rejects fallen names that were not present", () => {
    const out = validateBattleOutcome(battle([north], [west], "18"), {
      holdResult: "north",
      fallen: [{ armyId: "n1", name: "Nobody At All", isLeader: true }],
    });
    assert.equal(out.fallen.length, 0);
    assert.ok(out.notes.some((n) => n.kind === "dropped_unknown_fallen"));
  });

  it("keeps a holdResult that names a participant and drops a stranger", () => {
    const kept = validateBattleOutcome(battle([north], [west], "18"), {
      holdResult: "westerlands",
    });
    assert.equal(kept.holdResult, "westerlands");

    const dropped = validateBattleOutcome(battle([north], [west], "18"), {
      holdResult: "dorne",
    });
    assert.notEqual(dropped.holdResult, "dorne");
    assert.ok(dropped.notes.some((n) => n.kind === "corrected_hold_result"));
  });
});
