import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  ArmyUnit,
  CharacterId,
  CharacterState,
  NpcAgentState,
  PrisonerGroup,
} from "../types";
import { army } from "./test-helpers";
import {
  createPrisonerGroup,
  describeCaptivity,
  describeHoldPrisoners,
  describePrisonerBurden,
  executePrisoners,
  groundOrphanedGroups,
  groupHolding,
  liberatePrisoners,
  markCaptive,
  movePrisoners,
  prisonerMen,
  prisonerRoster,
  prisonersAt,
  prisonersHeldBy,
  prisonersWith,
  reassignEscortedPrisoners,
  releasePrisoners,
  totalPrisonerMen,
} from "./prisoners";

const UNITS: ArmyUnit[] = [
  { house: "Tully", type: "infantry", count: 800 },
  { house: "Tully", type: "archers", count: 200 },
];

function npc(id: string, name: string, faction: "north" | "westerlands"): NpcAgentState {
  return {
    kind: "npc",
    id,
    name,
    faction,
    role: "castellan",
    armyId: null,
    holdId: "16",
    alive: true,
    notepad: "",
    mood: "",
    dispositionToward: {},
    inviteHistory: [],
    adviceGivenIds: [],
  };
}

function chars(): Record<CharacterId, CharacterState> {
  return {
    "edmure-tully": npc("edmure-tully", "Ser Edmure Tully", "north"),
    "jonos-bracken": npc("jonos-bracken", "Lord Jonos Bracken", "north"),
    "kevan-lannister": npc("kevan-lannister", "Ser Kevan Lannister", "westerlands"),
  };
}

function group(partial: Partial<PrisonerGroup> = {}): PrisonerGroup {
  return {
    id: "g1",
    captorFaction: "westerlands",
    faction: "north",
    location: { kind: "hold", holdId: "16" },
    units: UNITS.map((u) => ({ ...u })),
    characterIds: ["edmure-tully"],
    takenAtHoldId: "16",
    takenTurn: 9,
    origin: "siege",
    battleId: null,
    ...partial,
  };
}

describe("createPrisonerGroup", () => {
  it("takes men and names", () => {
    const g = createPrisonerGroup({
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "hold", holdId: "16" },
      units: UNITS,
      characterIds: ["edmure-tully"],
      takenAtHoldId: "16",
      takenTurn: 9,
      origin: "siege",
    });
    assert.ok(g);
    assert.equal(prisonerMen(g!), 1000);
    assert.deepEqual(g!.characterIds, ["edmure-tully"]);
  });

  it("takes nobody when there is nobody to take", () => {
    assert.equal(
      createPrisonerGroup({
        captorFaction: "north",
        faction: "westerlands",
        location: { kind: "hold", holdId: "23" },
        units: [{ house: "Lannister", type: "infantry", count: 0 }],
        characterIds: [],
        takenAtHoldId: "23",
        takenTurn: 3,
        origin: "battle",
      }),
      null
    );
  });

  it("can be a named man with no men at all", () => {
    const g = createPrisonerGroup({
      captorFaction: "north",
      faction: "westerlands",
      location: { kind: "army", armyId: "army-robb" },
      characterIds: ["kevan-lannister"],
      takenAtHoldId: "23",
      takenTurn: 4,
      origin: "battle",
    });
    assert.ok(g);
    assert.equal(prisonerMen(g!), 0);
  });
});

describe("finding captives", () => {
  const groups = [
    group({ id: "a", location: { kind: "hold", holdId: "16" } }),
    group({ id: "b", location: { kind: "army", armyId: "army-jaime" } }),
    group({ id: "c", captorFaction: "north", faction: "westerlands", location: { kind: "hold", holdId: "16" } }),
  ];

  it("finds groups behind a set of walls", () => {
    assert.deepEqual(prisonersAt(groups, "16").map((g) => g.id), ["a", "c"]);
  });

  it("finds groups riding with a host", () => {
    assert.deepEqual(prisonersWith(groups, "army-jaime").map((g) => g.id), ["b"]);
  });

  it("finds groups by who holds them", () => {
    assert.deepEqual(prisonersHeldBy(groups, "north").map((g) => g.id), ["c"]);
  });

  it("finds the group holding a particular man", () => {
    assert.equal(groupHolding(groups, "edmure-tully")?.id, "a");
    assert.equal(groupHolding(groups, "nobody"), null);
  });

  it("sums men across groups", () => {
    assert.equal(totalPrisonerMen(groups), 3000);
  });
});

describe("moving captives", () => {
  it("hands a group to a host and sets it back down again", () => {
    let groups = [group()];
    groups = movePrisoners(groups, "g1", { kind: "army", armyId: "army-jaime" });
    assert.deepEqual(groups[0].location, { kind: "army", armyId: "army-jaime" });
    groups = movePrisoners(groups, "g1", { kind: "hold", holdId: "18" });
    assert.deepEqual(groups[0].location, { kind: "hold", holdId: "18" });
  });

  it("is a card, never a merge — the escort's own units are untouched", () => {
    const host = army({ id: "army-jaime", faction: "westerlands" });
    const groups = movePrisoners([group()], "g1", {
      kind: "army",
      armyId: "army-jaime",
    });
    assert.equal(host.units.reduce((s, u) => s + u.count, 0), 1000);
    assert.equal(prisonerMen(groups[0]), 1000);
  });
});

describe("release and execution", () => {
  it("frees a named captive without killing him", () => {
    const c = markCaptive(chars(), ["edmure-tully"]);
    assert.equal((c["edmure-tully"] as NpcAgentState).captive, true);
    const freed = releasePrisoners(c, group());
    const edmure = freed["edmure-tully"] as NpcAgentState;
    assert.equal(edmure.captive, false);
    assert.equal(edmure.alive, true);
    // He is on the road, not in a host or a castle yet.
    assert.equal(edmure.armyId, null);
    assert.equal(edmure.holdId, null);
  });

  it("kills a named captive and clears the captive flag with him", () => {
    const c = markCaptive(chars(), ["edmure-tully"]);
    const dead = executePrisoners(c, group());
    const edmure = dead["edmure-tully"] as NpcAgentState;
    assert.equal(edmure.alive, false);
    assert.equal(edmure.captive, false);
  });

  it("takes a man off his host and his walls when he is taken", () => {
    const c = markCaptive(chars(), ["edmure-tully"]);
    const edmure = c["edmure-tully"] as NpcAgentState;
    assert.equal(edmure.armyId, null);
    assert.equal(edmure.holdId, null);
  });
});

describe("liberation", () => {
  it("frees your own men when their escort is beaten", () => {
    // The West was dragging Edmure around; the North catches them.
    const held = group({
      id: "g1",
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "army", armyId: "army-jaime" },
    });
    const c = markCaptive(chars(), ["edmure-tully"]);
    const out = liberatePrisoners([held], ["g1"], "north", c, "army-robb");

    assert.equal(out.liberated.length, 1);
    assert.equal(out.prisoners.length, 0);
    assert.equal(out.freedMen, 1000);
    assert.deepEqual(out.freedCharacterIds, ["edmure-tully"]);
    const edmure = out.characters["edmure-tully"] as NpcAgentState;
    assert.equal(edmure.captive, false);
    // He falls in with the host that opened the door.
    assert.equal(edmure.armyId, "army-robb");
  });

  it("frees your own men when a city holding them is retaken", () => {
    const held = group({
      id: "g1",
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "hold", holdId: "16" },
    });
    const c = markCaptive(chars(), ["edmure-tully"]);
    const out = liberatePrisoners([held], ["g1"], "north", c, "army-robb");
    assert.equal(out.freedMen, 1000);
    assert.equal(out.prisoners.length, 0);
  });

  it("does not free the enemy's own captives — those change hands instead", () => {
    // Northern host takes a city where the West was holding Westerlands men?
    // Nonsense: a group of your own men held by yourself is not liberation.
    const ownSideGroup = group({
      id: "g1",
      captorFaction: "north",
      faction: "north",
      location: { kind: "hold", holdId: "16" },
    });
    const out = liberatePrisoners([ownSideGroup], ["g1"], "north", chars(), "army-robb");
    assert.equal(out.liberated.length, 0);
    assert.equal(out.prisoners.length, 1);
  });

  it("leaves enemy captives of the other side alone", () => {
    const westMen = group({
      id: "g1",
      captorFaction: "north",
      faction: "westerlands",
      location: { kind: "hold", holdId: "16" },
    });
    const out = liberatePrisoners([westMen], ["g1"], "north", chars(), "army-robb");
    assert.equal(out.liberated.length, 0);
    assert.equal(out.prisoners.length, 1);
  });

  it("leaves freed men unattached when there is no host to join", () => {
    const held = group({ location: { kind: "hold", holdId: "16" } });
    const c = markCaptive(chars(), ["edmure-tully"]);
    const out = liberatePrisoners([held], ["g1"], "north", c, null);
    assert.equal((out.characters["edmure-tully"] as NpcAgentState).armyId, null);
    assert.equal((out.characters["edmure-tully"] as NpcAgentState).captive, false);
  });
});

describe("an escort that is destroyed", () => {
  it("hands its captives to the victor", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "army-jaime" } }),
    ];
    const out = reassignEscortedPrisoners(
      groups,
      "army-jaime",
      "north",
      "army-robb",
      "16"
    );
    assert.equal(out[0].captorFaction, "north");
    assert.deepEqual(out[0].location, { kind: "army", armyId: "army-robb" });
  });

  it("sets them down at the seat when the victor has no host to take them", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "army-jaime" } }),
    ];
    const out = reassignEscortedPrisoners(groups, "army-jaime", "north", null, "16");
    assert.deepEqual(out[0].location, { kind: "hold", holdId: "16" });
  });
});

describe("groundOrphanedGroups", () => {
  it("sets captives down when their escort is gone", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "ghost" } }),
    ];
    const out = groundOrphanedGroups(groups, [], () => "16");
    assert.deepEqual(out[0].location, { kind: "hold", holdId: "16" });
  });

  it("drops them entirely when there is nowhere to put them", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "ghost" } }),
    ];
    assert.deepEqual(groundOrphanedGroups(groups, [], () => null), []);
  });

  it("leaves groups with a live escort alone", () => {
    const host = army({ id: "army-jaime", faction: "westerlands" });
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "army-jaime" } }),
    ];
    const out = groundOrphanedGroups(groups, [host], () => "16");
    assert.deepEqual(out[0].location, { kind: "army", armyId: "army-jaime" });
  });
});

describe("describing the burden", () => {
  const armies = [
    army({ id: "army-jaime", faction: "westerlands", name: "Jaime's Vanguard", holdId: "18" }),
  ];

  it("states the captives as a fact, with no guidance attached", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "army-jaime" } }),
    ];
    const text = describePrisonerBurden(groups, "army-jaime", chars());
    assert.ok(text);
    assert.match(text!, /1,000 captives/);
    assert.match(text!, /Edmure/);
    assert.match(text!, /Riverrun/);
    // No instruction to the model about what it costs.
    assert.doesNotMatch(text!, /penalty|slower|weaker|should/i);
  });

  it("says nothing for a host carrying nobody", () => {
    assert.equal(describePrisonerBurden([], "army-jaime", chars()), null);
  });

  it("describes a castle full of captives", () => {
    const text = describeHoldPrisoners([group()], "16", chars());
    assert.match(text!, /1,000 captives in the cells/);
    assert.match(text!, /Edmure/);
  });

  it("locates a group by its escort, not by its own position", () => {
    const groups = [
      group({ id: "g1", location: { kind: "army", armyId: "army-jaime" } }),
    ];
    const roster = prisonerRoster(groups, chars(), armies, "westerlands");
    assert.match(roster[0].whereabouts, /Jaime's Vanguard/);
    assert.match(roster[0].whereabouts, /Harrenhal/);
  });
});

describe("describeCaptivity", () => {
  it("gives a straight answer about a man in a cell", () => {
    const text = describeCaptivity([group()], "edmure-tully", []);
    assert.ok(text);
    assert.match(text!, /Held prisoner by the Westerlands since turn 9/);
    assert.match(text!, /Riverrun/);
  });

  it("says nothing about a man who is not held", () => {
    assert.equal(describeCaptivity([group()], "kevan-lannister", []), null);
  });
});
