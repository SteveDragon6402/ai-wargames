import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildForceSummary, fallbackOutcome } from "./battle-forces";
import { army, battle } from "./test-helpers";

describe("fallbackOutcome storms", () => {
  const garrison = army({
    id: "garrison:16",
    faction: "north",
    holdId: "16",
    units: [{ house: "Tully", type: "infantry", count: 2000 }],
  });

  it("never abandons a storm as an indecisive field", () => {
    const west = army({
      id: "w1",
      faction: "westerlands",
      holdId: "16",
      units: [{ house: "Lannister", type: "infantry", count: 2000 }],
    });
    const ctx = {
      ...battle([garrison], [west], "16"),
      engagement: "storm" as const,
      garrisonHoldId: "16",
      armyOrders: { "garrison:16": "fortify" as const },
    };
    const out = fallbackOutcome(ctx, buildForceSummary(ctx));
    assert.notEqual(out.holdResult, "abandoned");
    assert.ok(out.lossShare.westerlands >= 0.2);
    assert.ok(out.lossShare.north >= 0.1);
  });

  it("lets a much larger host force the gates at a bloody price", () => {
    const west = army({
      id: "w1",
      faction: "westerlands",
      holdId: "16",
      units: [{ house: "Lannister", type: "infantry", count: 5000 }],
    });
    const ctx = {
      ...battle([garrison], [west], "16"),
      engagement: "storm" as const,
      garrisonHoldId: "16",
    };
    const out = fallbackOutcome(ctx, buildForceSummary(ctx));
    assert.equal(out.holdResult, "westerlands");
    assert.ok(out.lossShare.westerlands >= 0.2);
    assert.ok(out.lossShare.north >= 0.25);
  });

  it("throws a thin storm back and still bills the attackers", () => {
    const west = army({
      id: "w1",
      faction: "westerlands",
      holdId: "16",
      units: [{ house: "Lannister", type: "infantry", count: 800 }],
    });
    const ctx = {
      ...battle([garrison], [west], "16"),
      engagement: "storm" as const,
      garrisonHoldId: "16",
    };
    const out = fallbackOutcome(ctx, buildForceSummary(ctx));
    assert.equal(out.holdResult, "north");
    assert.ok(out.lossShare.westerlands >= 0.25);
  });
});
