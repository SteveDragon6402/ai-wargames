import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyBriefsToBattle,
  clipWords,
  collectBattleCharacterIds,
  enemyBand,
  primaryHouse,
} from "./battle-briefs";
import { army } from "./test-helpers";
import type { BattleContext, CharacterState, CommanderBrief } from "../types";

function brief(
  armyId: string,
  partial: Partial<CommanderBrief> = {}
): CommanderBrief {
  return {
    characterId: "roose-bolton",
    name: "Roose Bolton",
    armyId,
    mood: "cold",
    take: "wait",
    outlook: "long",
    approach: "hold",
    commitment: "commit",
    betrayal: "loyal",
    instructions: "Hold back the van.",
    role: "commander",
    house: "Bolton",
    ...partial,
  };
}

describe("enemyBand", () => {
  it("names the other host relative to this army, not as a count", () => {
    assert.equal(enemyBand(1000, 400), "small");
    assert.equal(enemyBand(1000, 800), "medium");
    assert.equal(enemyBand(1000, 1500), "large");
    assert.equal(enemyBand(1000, 3000), "overwhelming");
  });
});

describe("applyBriefsToBattle", () => {
  const north = army({
    id: "army-bolton",
    faction: "north",
    units: [{ house: "Bolton", type: "infantry", count: 2000 }],
  });
  const west = army({
    id: "army-jaime",
    faction: "westerlands",
    units: [{ house: "Lannister", type: "infantry", count: 3000 }],
  });
  const battle: BattleContext = {
    holdId: "16",
    northArmies: [north],
    westArmies: [west],
  };

  it("moves a turning host onto the enemy side and marks the house", () => {
    const { battle: next, flips, turnedHouses } = applyBriefsToBattle(battle, [
      brief("army-bolton", { betrayal: "turn_join_enemy" }),
    ]);
    assert.equal(next.northArmies.length, 0);
    assert.equal(next.westArmies.length, 2);
    assert.equal(next.westArmies.find((a) => a.id === "army-bolton")?.faction, "westerlands");
    assert.deepEqual(flips, [{ armyId: "army-bolton", faction: "westerlands" }]);
    assert.deepEqual(turnedHouses, ["Bolton"]);
  });

  it("peels a host that turns but will not join the enemy", () => {
    const { battle: next, flips } = applyBriefsToBattle(battle, [
      brief("army-bolton", { betrayal: "turn_independent" }),
    ]);
    assert.equal(next.northArmies.length, 0);
    assert.equal(next.westArmies.length, 1);
    assert.equal(next.rogueArmies?.[0]?.id, "army-bolton");
    assert.equal(flips.length, 0);
  });

  it("records hold-back without moving the host", () => {
    const { battle: next, flips } = applyBriefsToBattle(battle, [
      brief("army-bolton", { commitment: "hold_back" }),
    ]);
    assert.equal(next.armyCommitments?.["army-bolton"], "hold_back");
    assert.equal(next.northArmies.length, 1);
    assert.equal(flips.length, 0);
  });

  it("does not let a notable flip a host", () => {
    const { battle: next } = applyBriefsToBattle(battle, [
      brief("army-bolton", { role: "notable", betrayal: "turn_join_enemy" }),
    ]);
    assert.equal(next.northArmies.length, 1);
  });

  it("lets the named leader's judgment beat another commander on the same host", () => {
    const hosted = {
      ...north,
      leaders: [{ name: "Roose Bolton", title: "Lord" }],
    };
    const field: BattleContext = {
      holdId: "16",
      northArmies: [hosted],
      westArmies: [west],
    };
    const { battle: next } = applyBriefsToBattle(field, [
      brief("army-bolton", {
        characterId: "other",
        name: "Other",
        commitment: "commit",
      }),
      brief("army-bolton", {
        name: "Roose Bolton",
        commitment: "hold_back",
      }),
    ]);
    assert.equal(next.armyCommitments?.["army-bolton"], "hold_back");
  });
});

describe("collectBattleCharacterIds", () => {
  it("skips player lords and anyone not in the fight", () => {
    const chars = {
      "robb-stark": {
        kind: "player",
        id: "robb-stark",
        name: "Robb",
        faction: "north",
        role: "lord",
        armyId: "army-robb",
        alive: true,
      },
      "roose-bolton": {
        kind: "npc",
        id: "roose-bolton",
        name: "Roose",
        faction: "north",
        role: "commander",
        armyId: "army-bolton",
        alive: true,
        mood: "cold",
        notepad: "",
        dispositionToward: {},
        inviteHistory: [],
        adviceGivenIds: [],
      },
    } as unknown as Record<string, CharacterState>;
    const battle: BattleContext = {
      holdId: "16",
      northArmies: [army({ id: "army-bolton", faction: "north" })],
      westArmies: [army({ id: "army-jaime", faction: "westerlands" })],
    };
    assert.deepEqual(collectBattleCharacterIds(battle, chars), ["roose-bolton"]);
  });
});

describe("clipWords", () => {
  it("keeps the first N words", () => {
    assert.equal(clipWords("one two three four", 3), "one two three");
  });
});

describe("primaryHouse", () => {
  it("picks the house with the most men", () => {
    assert.equal(
      primaryHouse(
        army({
          id: "a",
          faction: "north",
          units: [
            { house: "Stark", type: "infantry", count: 100 },
            { house: "Bolton", type: "infantry", count: 800 },
          ],
        })
      ),
      "Bolton"
    );
  });
});
