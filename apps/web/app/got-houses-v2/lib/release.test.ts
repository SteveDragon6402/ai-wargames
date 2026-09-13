import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  Army,
  CharacterId,
  CharacterState,
  HoldRuntime,
  NpcAgentState,
  Traveller,
} from "../types";
import { army, holdRuntime } from "./test-helpers";
import {
  RELEASE_RANGE,
  defaultRefuge,
  describeRelease,
  refugeOptions,
  startTravel,
  tickTravellers,
} from "./release";

function board(
  overrides: Record<string, Partial<HoldRuntime>> = {}
): Record<string, HoldRuntime> {
  const ids = [
    "01", "03", "07", "08", "16", "17", "18", "19", "20", "21", "22",
    "23", "24", "25", "26", "27", "28", "30", "31",
  ];
  const out: Record<string, HoldRuntime> = {};
  for (const id of ids) {
    out[id] = holdRuntime({
      controller: null,
      homeFaction: "riverlands" as never,
      garrison: {
        faction: null,
        units: [],
        leaders: [],
        notables: [],
        morale: "",
        tiredness: "",
        stance: "",
      },
      ...(overrides[id] ?? {}),
    });
  }
  return out;
}

function seat(faction: "north" | "westerlands"): Partial<HoldRuntime> {
  return { controller: faction, homeFaction: faction };
}

function edmure(partial: Partial<NpcAgentState> = {}): NpcAgentState {
  return {
    kind: "npc",
    id: "edmure-tully",
    name: "Ser Edmure Tully",
    faction: "north",
    role: "castellan",
    armyId: null,
    holdId: null,
    alive: true,
    captive: false,
    notepad: "",
    mood: "",
    dispositionToward: {},
    inviteHistory: [],
    adviceGivenIds: [],
    ...partial,
  };
}

function chars(c: NpcAgentState = edmure()): Record<CharacterId, CharacterState> {
  return { [c.id]: c };
}

describe("refugeOptions", () => {
  it("offers his own side's seats within range", () => {
    const holdStates = board({ "17": seat("north"), "22": seat("north") });
    const options = refugeOptions("16", "north", holdStates, []);
    const ids = options.map((o) => o.holdId);
    assert.ok(ids.includes("17"));
    assert.ok(ids.includes("22"));
  });

  it("offers a friendly host camped nearby", () => {
    const holdStates = board();
    const armies: Army[] = [
      army({ id: "army-robb", faction: "north", holdId: "21", name: "Robb's Host" }),
    ];
    const options = refugeOptions("16", "north", holdStates, armies);
    const camp = options.find((o) => o.holdId === "21");
    assert.ok(camp);
    assert.equal(camp!.kind, "friendly_host");
    assert.match(camp!.note, /Robb's Host is camped/);
  });

  it("will not offer a seat with an enemy host sitting on it", () => {
    const holdStates = board({ "17": seat("north") });
    const armies: Army[] = [
      army({ id: "army-tywin", faction: "westerlands", holdId: "17" }),
    ];
    const options = refugeOptions("16", "north", holdStates, armies);
    assert.equal(options.some((o) => o.holdId === "17"), false);
  });

  it("will not offer an enemy-held seat", () => {
    const holdStates = board({ "17": seat("westerlands") });
    const options = refugeOptions("16", "north", holdStates, []);
    assert.equal(options.some((o) => o.holdId === "17"), false);
  });

  it("stays within range", () => {
    const holdStates = board({ "31": seat("north") });
    const options = refugeOptions("16", "north", holdStates, []);
    // Dragonstone is four spaces from Riverrun.
    assert.equal(options.some((o) => o.holdId === "31"), false);
    assert.ok(options.every((o) => o.distance <= RELEASE_RANGE));
  });

  it("flags a refuge that is besieged or burned, without hiding it", () => {
    const holdStates = board({
      "17": {
        ...seat("north"),
        siege: { besiegerFaction: "westerlands", turns: 4, armyIds: ["army-tywin"] },
      },
      "22": { ...seat("north"), razed: true },
    });
    const options = refugeOptions("16", "north", holdStates, []);
    const twins = options.find((o) => o.holdId === "17")!;
    const raventree = options.find((o) => o.holdId === "22")!;
    assert.equal(twins.underSiege, true);
    assert.match(twins.note, /under siege/);
    assert.equal(raventree.razed, true);
    assert.match(raventree.note, /burned ruin/);
  });
});

describe("defaultRefuge", () => {
  it("prefers a quiet seat of his own side", () => {
    const holdStates = board({
      "17": {
        ...seat("north"),
        siege: { besiegerFaction: "westerlands", turns: 2, armyIds: [] },
      },
      "22": seat("north"),
    });
    assert.equal(defaultRefuge("16", "north", holdStates, []), "22");
  });

  it("finds somewhere even when nothing is in range", () => {
    // Only a seat far out of range exists — he still gets there eventually.
    const holdStates = board({ "31": seat("north") });
    assert.equal(defaultRefuge("16", "north", holdStates, []), "31");
  });
});

describe("startTravel", () => {
  it("takes one turn per space", () => {
    // Riverrun to Casterly Rock is two spaces via the Golden Tooth.
    const t = startTravel("edmure-tully", "16", "23", 10);
    assert.equal(t.arrivesTurn, 12);
  });

  it("never arrives the same turn he is freed", () => {
    const t = startTravel("edmure-tully", "16", "16", 10);
    assert.ok(t.arrivesTurn > 10);
  });
});

describe("tickTravellers", () => {
  const holdStates = board({ "22": seat("north"), "17": seat("north") });

  function traveller(partial: Partial<Traveller> = {}): Traveller {
    return {
      characterId: "edmure-tully",
      fromHoldId: "16",
      destHoldId: "22",
      arrivesTurn: 12,
      ...partial,
    };
  }

  it("leaves a man on the road until his turn comes", () => {
    const out = tickTravellers([traveller()], 11, holdStates, [], chars());
    assert.equal(out.travellers.length, 1);
    assert.equal(out.arrivals.length, 0);
    assert.equal(out.characters["edmure-tully"].kind === "npc" ? (out.characters["edmure-tully"] as NpcAgentState).holdId : "x", null);
  });

  it("walks him through the gate when it does", () => {
    const out = tickTravellers([traveller()], 12, holdStates, [], chars());
    assert.equal(out.travellers.length, 0);
    assert.deepEqual(out.arrivals.map((a) => a.holdId), ["22"]);
    const c = out.characters["edmure-tully"] as NpcAgentState;
    assert.equal(c.holdId, "22");
    assert.equal(c.captive, false);
    assert.equal(c.alive, true);
  });

  it("always brings a released leader back — no vanishing, no fate roll", () => {
    let travellers = [traveller()];
    let characters = chars();
    for (let turn = 10; turn <= 12; turn++) {
      const out = tickTravellers(travellers, turn, holdStates, [], characters);
      travellers = out.travellers;
      characters = out.characters;
    }
    const c = characters["edmure-tully"] as NpcAgentState;
    assert.equal(c.alive, true);
    assert.equal(c.holdId, "22");
  });

  it("leaves him remembering his captivity", () => {
    const out = tickTravellers([traveller()], 12, holdStates, [], chars());
    const c = out.characters["edmure-tully"] as NpcAgentState;
    assert.match(c.notepad, /released at Riverrun/);
    assert.match(c.notepad, /I remember who held me/);
  });

  it("re-routes when his refuge falls to the enemy while he walks", () => {
    const hostile = board({
      "22": seat("westerlands"),
      "17": seat("north"),
    });
    const out = tickTravellers([traveller()], 11, hostile, [], chars());
    assert.equal(out.rerouted.length, 1);
    assert.equal(out.rerouted[0].toHoldId, "17");
    assert.equal(out.travellers[0].destHoldId, "17");
    assert.equal(out.arrivals.length, 0);
  });

  it("re-routes when an enemy host is camped on his refuge", () => {
    const armies: Army[] = [
      army({ id: "army-tywin", faction: "westerlands", holdId: "22" }),
    ];
    const out = tickTravellers([traveller()], 11, holdStates, armies, chars());
    assert.equal(out.rerouted.length, 1);
    assert.equal(out.rerouted[0].toHoldId, "17");
  });

  it("keeps walking when there is nowhere better to go", () => {
    const nowhere = board({ "22": seat("westerlands") });
    const out = tickTravellers([traveller()], 11, nowhere, [], chars());
    assert.equal(out.rerouted.length, 0);
    assert.equal(out.travellers.length, 1);
  });

  it("drops a man who died or was retaken on the road", () => {
    const dead = tickTravellers(
      [traveller()],
      12,
      holdStates,
      [],
      chars(edmure({ alive: false }))
    );
    assert.equal(dead.travellers.length, 0);
    assert.equal(dead.arrivals.length, 0);

    const retaken = tickTravellers(
      [traveller()],
      12,
      holdStates,
      [],
      chars(edmure({ captive: true }))
    );
    assert.equal(retaken.travellers.length, 0);
    assert.equal(retaken.arrivals.length, 0);
  });

  it("handles an empty queue", () => {
    const out = tickTravellers(undefined, 5, holdStates, [], chars());
    assert.deepEqual(out.travellers, []);
    assert.deepEqual(out.arrivals, []);
  });
});

describe("describeRelease", () => {
  it("names the seat he left and the one he is making for", () => {
    const text = describeRelease("Ser Edmure Tully", "16", "22", 12);
    assert.match(text, /released at Riverrun/);
    assert.match(text, /Raventree Hall/);
    assert.match(text, /turn 12/);
  });
});
