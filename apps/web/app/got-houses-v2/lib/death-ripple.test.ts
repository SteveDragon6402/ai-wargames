import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deathRipple, mergeRipple } from "./death-ripple";
import { army } from "./test-helpers";
import type { CharacterState } from "../types";

describe("deathRipple", () => {
  it("shakes every host of a fallen lord's faction", () => {
    const chars = {
      "tywin-lannister": {
        kind: "player",
        id: "tywin-lannister",
        name: "Tywin Lannister",
        faction: "westerlands",
        role: "lord",
        armyId: "army-tywin",
        alive: true,
        background: "",
      },
    } as unknown as Record<string, CharacterState>;
    const armies = [
      army({ id: "army-tywin", faction: "westerlands" }),
      army({ id: "army-jaime", faction: "westerlands", holdId: "21" }),
      army({ id: "army-robb", faction: "north" }),
    ];
    const ripple = deathRipple(
      [{ armyId: "army-tywin", name: "Tywin Lannister", isLeader: true }],
      chars,
      armies
    );
    const west = ripple.filter((u) => u.armyId.startsWith("army-") && u.armyId !== "army-robb");
    assert.ok(west.every((u) => /Tywin/.test(u.morale)));
    const north = ripple.find((u) => u.armyId === "army-robb");
    assert.ok(north && /Tywin/.test(north.morale) && /head is gone/.test(north.morale));
  });
});

describe("mergeRipple", () => {
  it("appends death word to an existing battle update", () => {
    const merged = mergeRipple(
      [{ armyId: "a", morale: "Steady after the clash.", tiredness: "Tired", stance: "Holding" }],
      [{ armyId: "a", morale: "Word that Jaime has fallen runs through the ranks. The blow lands hard.", tiredness: "Tired", stance: "Holding" }]
    );
    assert.match(merged[0].morale, /Steady after the clash/);
    assert.match(merged[0].morale, /Jaime/);
  });
});
