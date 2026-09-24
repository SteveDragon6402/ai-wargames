import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NODE_IDS, NODES, neighbors } from "../data/map";
import { WIKI } from "../data/wiki";
import {
  applyAftermath,
  applyOpeningReputation,
  applyOutcome,
  applyTraining,
  beginResolution,
  canEnqueue,
  claimReward,
  chooseTypes,
  commitApproach,
  enqueue,
  finishWeek,
  foodBlocksWeek,
  forceComparison,
  freshGame,
  nameStartingUnits,
  parseReport,
  recruitmentPlan,
  openBattle,
  recruitableTypes,
  retreatStartsFight,
  setCompanyName,
  settleLeaderAttack,
  stepQueue,
  unitsNeeded,
  validateOutcome,
} from "./engine";
import type { GameState } from "./types";

function must<T extends { ok: true; state: GameState }>(result: T | { ok: false; error: string }): GameState {
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

describe("map", () => {
  it("is ten places, split 3, 2, and 5", () => {
    assert.equal(NODE_IDS.length, 10);
    const counts = { holt: 0, ashmarch: 0, mere: 0 };
    const kinds = {
      holt: { capital: 0, village: 0, wild: 0 },
      ashmarch: { capital: 0, village: 0, wild: 0 },
      mere: { capital: 0, village: 0, wild: 0 },
    };
    for (const id of NODE_IDS) {
      const node = NODES[id];
      counts[node.kingdom] += 1;
      kinds[node.kingdom][node.kind] += 1;
    }
    assert.deepEqual(counts, { holt: 3, ashmarch: 2, mere: 5 });
    assert.deepEqual(kinds.holt, { capital: 1, village: 1, wild: 1 });
    assert.deepEqual(kinds.ashmarch, { capital: 1, village: 0, wild: 1 });
    assert.deepEqual(kinds.mere, { capital: 1, village: 2, wild: 2 });
  });

  it("connects every place back to Millcross", () => {
    const seen = new Set<string>(["millcross"]);
    const queue = ["millcross"];
    while (queue.length) {
      const id = queue.pop() as (typeof NODE_IDS)[number];
      for (const next of neighbors(id)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    assert.equal(seen.size, 10);
  });
});

describe("company", () => {
  it("starts as two named units of five", () => {
    const state = playing();
    assert.equal(state.units.length, 2);
    assert.deepEqual(
      state.units.map((unit) => unit.count),
      [5, 5]
    );
    assert.equal(state.location, "millcross");
    assert.equal(state.week, 1);
  });

  it("keeps five and six of different types as two units", () => {
    let state = playing();
    state = must(enqueue(state, { kind: "recruit", type: "archers", count: 1, names: [] }));
    state = beginResolution(state);
    const step = stepQueue(state);
    assert.equal(step.kind, "continue");
    if (step.kind !== "continue") return;
    assert.equal(step.state.units.length, 2);
    assert.equal(step.state.units.find((unit) => unit.type === "archers")?.count, 6);
  });

  it("splits a type at ten", () => {
    const start = playing().units.filter((unit) => unit.type === "swordsmen");
    const plan = unitsNeeded(start, "swordsmen", 7);
    assert.deepEqual(plan.fills, [{ id: start[0].id, add: 5 }]);
    assert.deepEqual(plan.fresh, [2]);
    let state = playing();
    state = must(enqueue(state, { kind: "recruit", type: "swordsmen", count: 7, names: ["The Spare"] }));
    state = beginResolution(state);
    const step = stepQueue(state);
    assert.equal(step.kind, "continue");
    if (step.kind !== "continue") return;
    const swords = step.state.units.filter((unit) => unit.type === "swordsmen");
    assert.deepEqual(
      swords.map((unit) => unit.count).sort((a, b) => a - b),
      [2, 10]
    );
  });

  it("does not rewrite the origin line", () => {
    let state = playing();
    const origin = state.units[0].origin;
    state = must(
      enqueue(state, { kind: "train", unitIds: [state.units[0].id, state.units[1].id], drill: "Hold the hedge" })
    );
    const step = stepQueue(beginResolution(state));
    assert.equal(step.kind, "train");
    if (step.kind !== "train") return;
    const lines = Object.fromEntries(state.units.map((unit) => [unit.id, ["They hold.", "They listen.", "They are harder."] as [string, string, string]]));
    const trained = must(applyTraining(step.state, lines));
    assert.equal(trained.units[0].origin, origin);
    assert.equal(trained.units[0].origin, WIKI.swordsmen.origin);
    assert.equal(trained.units[0].lines[0], "They hold.");
  });

  it("allows one march in a week", () => {
    let state = playing();
    state = must(enqueue(state, { kind: "move", to: "blackwood" }));
    assert.equal(canEnqueue(state, { kind: "move", to: "harrow" }), "The company can march once this week.");
  });

  it("hires specials only at the right capital", () => {
    assert.deepEqual(recruitableTypes("millcross"), ["swordsmen", "spearmen", "archers"]);
    assert.ok(recruitableTypes("harrow").includes("light_cavalry"));
    assert.equal(recruitableTypes("harrow").includes("berserkers"), false);
    assert.ok(recruitableTypes("high-ash").includes("berserkers"));
    assert.ok(recruitableTypes("greylake").includes("heavy_cavalry"));
    assert.deepEqual(recruitableTypes("blackwood"), []);
    const state = playing();
    assert.match(canEnqueue(state, { kind: "recruit", type: "light_cavalry", count: 1, names: ["Riders"] }) ?? "", /not hired/);
  });
});

describe("stores", () => {
  it("turns plain food into good food at two for one", () => {
    let state = playing();
    state = must(enqueue(state, { kind: "convert", direction: "to-good" }));
    const step = stepQueue(beginResolution(state));
    assert.equal(step.kind, "continue");
    if (step.kind !== "continue") return;
    assert.equal(step.state.goodFood, 10);
    assert.equal(step.state.basicFood, 20);
  });

  it("kills men when the stores are empty", () => {
    let state = playing();
    state = { ...state, basicFood: 0, goodFood: 0 };
    const next = finishWeek(state);
    assert.equal(next.units.reduce((sum, unit) => sum + unit.count, 0), 8);
    assert.match(next.morale, /starving/i);
  });

  it("refuses supply the company does not have", () => {
    let state = openBattle(playing(), "fight", null);
    assert.equal(commitApproach(state, "We go straight up the track.", 100).ok, false);
    const spent = commitApproach(state, "We go straight up the track.", state.supply);
    assert.equal(spent.ok, true);
    if (!spent.ok) return;
    assert.equal(spent.state.supply, 0);
    assert.equal(spent.state.pendingBattle?.supplySpent, state.supply);
  });
});

describe("blackwood", () => {
  it("opens the forest on arrival and rolls retreat at five percent", () => {
    let state = must(enqueue(playing(), { kind: "move", to: "blackwood" }));
    const step = stepQueue(beginResolution(state));
    assert.equal(step.kind, "forest");
    assert.equal(retreatStartsFight(0.049), true);
    assert.equal(retreatStartsFight(0.05), false);
  });

  it("makes the leader attack a much smaller company and refuse a much larger one", () => {
    assert.equal(forceComparison(10, 20), "smaller");
    assert.equal(forceComparison(30, 20), "larger");
    assert.equal(forceComparison(18, 20), "close");
    assert.equal(settleLeaderAttack("smaller", false), true);
    assert.equal(settleLeaderAttack("larger", true), false);
    assert.equal(settleLeaderAttack("close", false), false);
    assert.equal(settleLeaderAttack("close", true), true);
  });

  it("pays, spares, or recruits after a victory", () => {
    let state = openBattle(playing(), "fight", null);
    state = must(commitApproach(state, "The bows shoot, then the file closes.", 0));
    const lines = state.units.map((unit) => ({
      unitId: unit.id,
      line2: "They have seen a fight.",
      line3: "They listen faster.",
      line4: "They are not green.",
    }));
    const fought = applyOutcome(
      state,
      {
        playerHoldsField: true,
        banditDeaths: 10,
        deaths: [],
        morale: "Shaken and proud.",
        stance: "They keep their ranks.",
        condition: "Blooded.",
        lines,
      },
      "The file held and the bows broke the rush.",
      "A longer account of the same fight, with the trees and the rush."
    );
    assert.equal(fought.result, "victory");
    assert.equal(fought.state.units[0].origin, WIKI[fought.state.units[0].type].origin);
    assert.equal(fought.state.units[0].battles.length, 1);

    const killed = must(applyAftermath(fought.state, "kill", []));
    assert.equal(killed.bandits, null);
    assert.equal(killed.rewardPurse, 30);

    const spared = must(applyAftermath(fought.state, "justice", []));
    assert.equal(spared.rewardPurse, 30);
    assert.equal(spared.bandits, null);

    const hired = must(applyAftermath(fought.state, "recruit", ["The Reed Men"]));
    assert.equal(hired.rewardPurse, 10);
    const band = hired.units.find((unit) => unit.type === "bandit");
    assert.equal(band?.count, 10);
    assert.equal(band?.origin, WIKI.bandit.origin);
    assert.match(band?.origin ?? "", /not raised/);
  });
});

describe("validator", () => {
  it("salvages deaths the company cannot have suffered", () => {
    const state = playing();
    const over = validateOutcome(state, {
      playerHoldsField: true,
      banditDeaths: 3,
      deaths: [{ unitId: state.units[0].id, count: 9 }],
      morale: "Grim.",
      stance: "They hold.",
      condition: "Hurt.",
      lines: [],
    });
    assert.equal(over.ok, true);
    if (!over.ok) return;
    assert.equal(over.value.deaths.find((row) => row.unitId === state.units[0].id)?.count, state.units[0].count);

    const unknown = validateOutcome(state, {
      playerHoldsField: true,
      banditDeaths: 3,
      deaths: [{ unitId: "nope", count: 1 }],
      morale: "Grim.",
      stance: "They hold.",
      condition: "Hurt.",
      lines: [],
    });
    assert.equal(unknown.ok, true);
    if (!unknown.ok) return;
    assert.equal(unknown.value.deaths.length, 0);

    const negative = validateOutcome(state, {
      playerHoldsField: "yes",
      banditDeaths: -1,
      deaths: [],
      morale: "Grim.",
      stance: "They hold.",
      condition: "Hurt.",
      lines: state.units.map((unit) => ({ unitId: unit.id, line2: "A", line3: "B", line4: "C" })),
    });
    assert.equal(negative.ok, true);
    if (!negative.ok) return;
    assert.equal(negative.value.banditDeaths, 0);
    assert.equal(negative.value.playerHoldsField, true);

    assert.equal(validateOutcome(state, null).ok, false);
    assert.equal(validateOutcome(state, { notes: "they fought" }).ok, false);
  });

  it("reads a report that is not labelled exactly", () => {
    const loose = parseReport(
      "The file held the track while the bows broke the rush, and by dusk the band had scattered into the trees with half their number down."
    );
    assert.ok(loose);
    assert.ok((loose?.brief.length ?? 0) > 20);

    const labelled = parseReport("The opening was ugly.\n\nBrief: The company held the track and the band broke before dusk, leaving their dead in the ferns.\n\nOpening\nThey met on the path.");
    assert.match(labelled?.brief ?? "", /held the track/);
  });
});

describe("week gates", () => {
  it("will not pass a week the company cannot feed", () => {
    let state = playing();
    state = { ...state, basicFood: 0, goodFood: 0 };
    assert.match(foodBlocksWeek(state) ?? "", /Short 10 rations/);
    state = must(enqueue(state, { kind: "buy", store: "basic", amount: 10 }));
    assert.equal(foodBlocksWeek(state), null);
    state = { ...playing(), basicFood: 0, goodFood: 0, location: "blackwood", resolveIndex: 0 };
    assert.match(foodBlocksWeek(state) ?? "", /March/);
  });

  it("hires a group as its own unit", () => {
    const start = playing();
    const plan = recruitmentPlan(start.units, "swordsmen", 5, "new");
    assert.equal(plan.fills.length, 0);
    assert.deepEqual(plan.fresh, [5]);
    let state = must(enqueue(start, { kind: "recruit", type: "swordsmen", count: 5, names: ["The Second File"], into: "new" }));
    const step = stepQueue(beginResolution(state));
    assert.equal(step.kind, "continue");
    if (step.kind !== "continue") return;
    const swords = step.state.units.filter((unit) => unit.type === "swordsmen");
    assert.equal(swords.length, 2);
    assert.deepEqual(
      swords.map((unit) => unit.count).sort((a, b) => a - b),
      [5, 5]
    );
    assert.equal(step.state.money, start.money - 25);
  });

  it("opens with a purse that can hire and eat", () => {
    assert.equal(playing().money, 100);
  });
});

describe("opening loop", () => {
  it("can fight, choose, march home, and be paid", () => {
    let state = must(enqueue(playing(), { kind: "move", to: "blackwood" }));
    const arrived = stepQueue(beginResolution(state));
    assert.equal(arrived.kind, "forest");
    if (arrived.kind !== "forest") return;
    state = must(commitApproach(openBattle(arrived.state, "fight", null), "The file holds the track.", 1));
    assert.equal(state.supply, playing().supply - 1);
    const lines = state.units.map((unit) => ({
      unitId: unit.id,
      line2: "They have been blooded.",
      line3: "They trust the file.",
      line4: "They are quicker to the hedge.",
    }));
    const fought = applyOutcome(
      state,
      {
        playerHoldsField: true,
        banditDeaths: 20,
        deaths: [{ unitId: state.units[0].id, count: 1 }],
        morale: "Proud and thin.",
        stance: "They keep the track.",
        condition: "One man down.",
        lines,
      },
      "The band broke on the file and did not come again.",
      "The bows shot into the trees and the file did not give."
    );
    assert.equal(fought.result, "victory");
    assert.equal(fought.state.banditSurvivors, 0);
    state = must(applyAftermath(fought.state, "kill", []));
    state = finishWeek(state);
    state = must(enqueue(state, { kind: "move", to: "millcross" }));
    const home = stepQueue(beginResolution(state));
    assert.equal(home.kind, "continue");
    if (home.kind !== "continue") return;
    const done = stepQueue(home.state);
    assert.equal(done.kind, "done");
    if (done.kind !== "done") return;
    state = finishWeek(done.state);
    assert.equal(state.location, "millcross");
    state = must(claimReward(state));
    assert.equal(state.rewardClaimed, true);
    assert.ok(state.money > playing().money);
  });
});

describe("year", () => {
  it("ends after week 52", () => {
    const state = finishWeek({ ...playing(), week: 52 });
    assert.equal(state.phase, "year-end");
  });
});
