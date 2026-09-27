import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { millcrossPeople } from "../data/people";
import { BATTLER_SYSTEM, battlerPrompt, fightSides, mentionsPlayer, translatorPrompt } from "./battle";
import { applyOpeningReputation, chooseTypes, finishWeek, freshGame, nameStartingUnits, setCompanyName } from "./engine";
import type { GameState } from "./types";
import { applyVillageRaid, laborOf, parseFight } from "./world";

function must<T>(result: { ok: true; state: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function playing(): GameState {
  let state = must(setCompanyName(freshGame(), "The Grey Company"));
  state = must(chooseTypes(state, ["swordsmen", "archers"]));
  state = must(nameStartingUnits(state, ["The File", "The Bows"]));
  state = must(
    applyOpeningReputation(state, {
      holt: "Unknown in Holt.",
      ashmarch: "Unknown in Ashmarch.",
      mere: "Unknown in the Mere.",
      nobles: "No noble has heard of them.",
      peasants: "No village has heard of them.",
    })
  );
  return state;
}

describe("millcross people", () => {
  it("names fifty people, including the elder and the merchant", () => {
    const people = millcrossPeople();
    assert.equal(people.length, 50);
    assert.equal(new Set(people.map((person) => person.id)).size, 50);
    assert.equal(new Set(people.map((person) => person.name)).size, 50);
    const alden = people.find((person) => person.id === "alden");
    const tobin = people.find((person) => person.id === "tobin");
    assert.ok(alden && tobin);
    assert.match(alden.description, /elder/);
    assert.match(tobin.description, /sacks/);
    assert.ok(alden.relations.length > 0);
    assert.ok(alden.possessions.length > 0);
  });
});

describe("the year", () => {
  it("names the work of the year", () => {
    assert.equal(laborOf(1), "The village is tilling.");
    assert.equal(laborOf(9), "The village is planting.");
    assert.equal(laborOf(20), "The village is tending the fields.");
    assert.equal(laborOf(36), "The village is harvesting and storing.");
    assert.equal(laborOf(50), "The village is storing what the harvest brought in.");
  });

  it("plants in the planting weeks and brings the harvest home", () => {
    const planted = finishWeek({ ...playing(), week: 9 });
    const piers = planted.settlements.millcross.people.find((person) => person.id === "piers");
    const before = playing().settlements.millcross.people.find((person) => person.id === "piers");
    assert.equal(piers?.planted, true);
    assert.equal(piers?.grain, (before?.grain ?? 0) - 2);

    const place = playing().settlements.millcross;
    const harvested = finishWeek({
      ...playing(),
      week: 36,
      settlements: {
        ...playing().settlements,
        millcross: {
          ...place,
          people: place.people.map((person) =>
            person.id === "alden" ? { ...person, planted: true, grain: 14 } : { ...person, planted: false, grain: 0 }
          ),
        },
      },
    });
    const alden = harvested.settlements.millcross.people.find((person) => person.id === "alden");
    assert.equal(alden?.grain, 14);
    assert.equal(harvested.settlements.millcross.granary, 1800 + 1 - 49);
    assert.equal(harvested.settlements.millcross.labor, "The village is harvesting and storing.");
  });

  it("lets the band keep looting, and sends them into the village on week 12", () => {
    const next = finishWeek(playing());
    assert.equal(next.bandits?.coins, 43);
    assert.equal(next.bandits?.grain, 32);
    const raid = finishWeek({ ...playing(), week: 12 });
    assert.equal(raid.pendingRaid, true);
    assert.equal(raid.raidDone, false);
    const inWood = finishWeek({ ...playing(), week: 12, location: "blackwood" });
    assert.equal(inWood.pendingRaid, false);
    assert.equal(inWood.raidDone, true);
    assert.equal(finishWeek({ ...playing(), week: 12, payAt: "harrow" }).pendingRaid, false);
  });
});

describe("a fight", () => {
  it("asks what would happen, and does not mention a player", () => {
    const sides = fightSides(playing(), true);
    const text = `${BATTLER_SYSTEM}\n${battlerPrompt(sides.ground, sides.a, sides.b)}\n${translatorPrompt("They met on the lane.", [...sides.a.groups, ...sides.b.groups])}`;
    assert.equal(mentionsPlayer(text), false);
    assert.match(text, /If these forces, in these stances, fought/);
    assert.match(text, /village/);
  });

  it("records the dead it was given, and no more", () => {
    const fight = parseFight(
      { holds: "a", dead: [{ id: "band", count: 100 }, { id: "nope", count: 4 }], grainToB: 3, coinsToB: -2 },
      [{ id: "band", count: 20 }]
    );
    assert.equal(fight?.holds, "a");
    assert.equal(fight?.dead.length, 1);
    assert.equal(fight?.dead[0].count, 20);
    assert.equal(fight?.grainToB, 3);
    assert.equal(fight?.coinsToB, 0);
  });

  it("applies a raid to the people, the granary, and the band", () => {
    const state = finishWeek({ ...playing(), week: 12 });
    const applied = applyVillageRaid(
      state,
      {
        holds: "b",
        dead: [
          { id: "village", count: 2 },
          { id: "band", count: 3 },
        ],
        grainToB: 10,
        coinsToB: 5,
        morale: "They took what they came for.",
        stance: "They leave the lane.",
        condition: "They are not hurt much.",
        lines: [],
      },
      "The lane was fought, and the band left with grain."
    );
    assert.equal(applied.pendingRaid, false);
    assert.equal(applied.raidDone, true);
    assert.equal(applied.settlements.millcross.mouths, 48);
    assert.equal(applied.settlements.millcross.people.find((person) => person.id === "alden")?.alive, true);
    assert.equal(applied.settlements.millcross.people.find((person) => person.id === "tobin")?.alive, true);
    assert.equal(applied.bandits?.count, (state.bandits?.count ?? 0) - 3);
    assert.equal(applied.settlements.millcross.granary, state.settlements.millcross.granary - 10);
    assert.equal(applied.settlements.millcross.elder.coins, state.settlements.millcross.elder.coins - 5);
    assert.equal(applied.weekScene, "The lane was fought, and the band left with grain.");
  });
});
