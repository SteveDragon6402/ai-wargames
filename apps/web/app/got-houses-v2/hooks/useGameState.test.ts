import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCasualties,
  buildRetreats,
  gameReducer,
  retreatingArmyIdsForReport,
} from "./useGameState";
import { army, battle } from "../lib/test-helpers";
import { applyRaze } from "../lib/raze";
import { garrisonHeadcount } from "../lib/hold-runtime";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { createPrisonerGroup } from "../lib/prisoners";
import { moveOrdersResolvable } from "../lib/room-sync";
import type { Audience, GameState, RetreatEntry, SplitConfig } from "../types";
import { skippedAudience } from "../lib/audience";

describe("applyCasualties", () => {
  it("never heals a unit when a row is larger than the stack", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [{ house: "Stark", type: "infantry", count: 500 }],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", faction: "north", unitType: "infantry", house: "Stark", count: 800 },
    ]);
    assert.equal(next.length, 0);
  });

  it("does not mutate the incoming army objects", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [{ house: "Stark", type: "infantry", count: 500 }],
      }),
    ];
    applyCasualties(start, [
      { armyId: "n1", faction: "north", unitType: "infantry", house: "Stark", count: 100 },
    ]);
    assert.equal(start[0].units[0].count, 500);
  });

  it("spreads a house-mismatched row across the matching type without losing remainder", () => {
    const start = [
      army({
        id: "n1",
        faction: "north",
        units: [
          { house: "Stark", type: "infantry", count: 100 },
          { house: "Umber", type: "infantry", count: 100 },
          { house: "Karstark", type: "infantry", count: 100 },
        ],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", faction: "north", unitType: "infantry", house: "Nobody", count: 1 },
    ]);
    const remaining = next[0].units.reduce((s, u) => s + u.count, 0);
    assert.equal(remaining, 299);
  });

  it("leaves an army that was not named in the casualty list untouched", () => {
    const start = [
      army({ id: "n1", faction: "north" }),
      army({
        id: "w1",
        faction: "westerlands",
        units: [{ house: "Lannister", type: "infantry", count: 800 }],
      }),
    ];
    const next = applyCasualties(start, [
      { armyId: "n1", faction: "north", unitType: "infantry", house: "Stark", count: 50 },
    ]);
    assert.equal(
      next.find((a) => a.id === "w1")?.units[0].count,
      800
    );
  });
});

describe("buildRetreats", () => {
  it("allows retreat to any adjacent hold that is not enemy-occupied", () => {
    // Winterfell (01) links include 02 (Dreadfort).
    const north = army({ id: "n1", faction: "north", holdId: "01", lastHoldId: "07" });
    const west = army({ id: "w1", faction: "westerlands", holdId: "01", lastHoldId: "08" });
    const otherWest = army({
      id: "w2",
      faction: "westerlands",
      holdId: "02",
    });
    const retreats = buildRetreats(
      ["n1"],
      [north, west, otherWest],
      [battle([north], [west], "01")]
    );
    assert.equal(retreats.length, 1);
    assert.ok(!retreats[0].validTargets.includes("02"));
    assert.ok(retreats[0].validTargets.includes("07"));
  });

  it("marks an army with no legal neighbour as having zero targets", () => {
    // White Harbor (03) only links to 08 and 01.
    const north = army({ id: "n1", faction: "north", holdId: "03" });
    const westA = army({ id: "w1", faction: "westerlands", holdId: "03" });
    const westB = army({ id: "w2", faction: "westerlands", holdId: "08" });
    const westC = army({ id: "w3", faction: "westerlands", holdId: "01" });
    const retreats = buildRetreats(
      ["n1"],
      [north, westA, westB, westC],
      [battle([north], [westA], "03")]
    );
    assert.equal(retreats[0].validTargets.length, 0);
  });
});

describe("retreatingArmyIdsForReport", () => {
  const north = army({ id: "n1", faction: "north", holdId: "17" });
  const west = army({ id: "w1", faction: "westerlands", holdId: "17" });
  const garrison = army({
    id: "garrison:17",
    faction: "north",
    holdId: "17",
  });

  it("does not drive a failed storm off the tile", () => {
    const ctx = {
      ...battle([north, garrison], [west], "17"),
      engagement: "storm" as const,
      garrisonHoldId: "17",
    };
    assert.deepEqual(retreatingArmyIdsForReport(ctx, "north"), []);
    assert.deepEqual(retreatingArmyIdsForReport(ctx, "abandoned"), []);
  });

  it("still sends the defender's field host away when the gates are forced", () => {
    const relief = army({ id: "n2", faction: "north", holdId: "17" });
    const ctx = {
      ...battle([north, garrison, relief], [west], "17"),
      engagement: "storm" as const,
      garrisonHoldId: "17",
    };
    assert.deepEqual(retreatingArmyIdsForReport(ctx, "westerlands"), [
      "n1",
      "n2",
    ]);
  });

  it("still forces a field defeat off the tile", () => {
    const ctx = battle([north], [west], "17");
    assert.deepEqual(retreatingArmyIdsForReport(ctx, "westerlands"), ["n1"]);
  });
});

describe("retreat ownership", () => {
  const northArmy = INITIAL_GAME_STATE.armies.find((a) => a.faction === "north");
  const westArmy = INITIAL_GAME_STATE.armies.find((a) => a.faction === "westerlands");
  assert.ok(northArmy && westArmy);

  function retreating(chosen: Record<string, string | null>): GameState {
    const retreats: RetreatEntry[] = [
      {
        armyId: northArmy!.id,
        fromHoldId: northArmy!.holdId,
        forbiddenHoldIds: [],
        validTargets: ["02", "07"],
        chosenHoldId: chosen[northArmy!.id] ?? null,
      },
      {
        armyId: westArmy!.id,
        fromHoldId: westArmy!.holdId,
        forbiddenHoldIds: [],
        validTargets: ["20", "21"],
        chosenHoldId: chosen[westArmy!.id] ?? null,
      },
    ];
    return { ...INITIAL_GAME_STATE, phase: "retreat", retreats };
  }

  it("does not let one side choose the other's road", () => {
    const start = retreating({});
    const next = gameReducer(start, {
      type: "SET_RETREAT",
      armyId: westArmy!.id,
      toHoldId: "20",
      asFaction: "north",
    });
    assert.equal(
      next.retreats.find((r) => r.armyId === westArmy!.id)?.chosenHoldId,
      null
    );
  });

  it("lets a side choose their own road", () => {
    const start = retreating({});
    const next = gameReducer(start, {
      type: "SET_RETREAT",
      armyId: westArmy!.id,
      toHoldId: "20",
      asFaction: "westerlands",
    });
    assert.equal(
      next.retreats.find((r) => r.armyId === westArmy!.id)?.chosenHoldId,
      "20"
    );
  });

  it("pulls only the rival's picks", () => {
    const local = retreating({ [westArmy!.id]: "21" });
    const next = gameReducer(local, {
      type: "PULL_RIVAL_RETREATS",
      myFaction: "westerlands",
      retreats: retreating({ [northArmy!.id]: "07", [westArmy!.id]: "20" }).retreats,
    });
    assert.equal(
      next.retreats.find((r) => r.armyId === westArmy!.id)?.chosenHoldId,
      "21"
    );
    assert.equal(
      next.retreats.find((r) => r.armyId === northArmy!.id)?.chosenHoldId,
      "07"
    );
  });
});

describe("razed seats cannot be garrisoned", () => {
  const host = army({
    id: "army-robb",
    faction: "north",
    holdId: "16",
    units: [{ house: "Stark", type: "infantry", count: 500 }],
  });

  function razedState(): GameState {
    const baseHs = INITIAL_GAME_STATE.holdStates["16"];
    const razed = applyRaze("16", baseHs, "north");
    return {
      ...INITIAL_GAME_STATE,
      holdStates: { ...INITIAL_GAME_STATE.holdStates, "16": razed },
      armies: [host],
      selectedHoldId: "16",
      selectedArmyIds: [host.id],
    };
  }

  it("does not open the garrison panel", () => {
    const next = gameReducer(razedState(), {
      type: "OPEN_GARRISON_PANEL",
      holdId: "16",
      mode: "deposit",
      armyId: host.id,
    });
    assert.equal(next.garrisonPanel, null);
  });

  it("rejects posting men onto the ruin", () => {
    const next = gameReducer(razedState(), {
      type: "GARRISON_TRANSFER",
      transfer: {
        holdId: "16",
        armyId: host.id,
        mode: "deposit",
        units: [{ house: "Stark", type: "infantry", count: 100 }],
        leaderNames: [],
        notableNames: [],
      },
    });
    assert.equal(garrisonHeadcount(next.holdStates["16"].garrison), 0);
    assert.equal(
      next.armies.find((a) => a.id === host.id)?.units[0]?.count,
      500
    );
  });
});

const JAIME_SPLIT: SplitConfig = {
  sourceArmyId: "army-jaime",
  army1: {
    units: [{ house: "Lannister", type: "cavalry", count: 1500 }],
    leaderNames: ["Jaime Lannister"],
    notableNames: ["Bronn"],
  },
  army2: {
    units: [
      { house: "Lannister", type: "infantry", count: 2000 },
      { house: "Lannister", type: "archers", count: 500 },
    ],
    leaderNames: [],
    notableNames: ["Ser Ilyn Payne", "Ser Balon Swann"],
  },
};

describe("guest West split in a two-browser room", () => {
  it("marches both halves after the host pulls the new hosts", () => {
    let guest: GameState = {
      ...INITIAL_GAME_STATE,
      activeFaction: "westerlands",
    };
    guest = gameReducer(guest, { type: "SPLIT_ARMY", config: JAIME_SPLIT });
    const kids = guest.armies.filter(
      (a) => a.faction === "westerlands" && a.holdId === "16"
    );
    assert.equal(kids.length, 2);
    const [a1, a2] = kids;

    guest = gameReducer(
      {
        ...guest,
        selectedArmyIds: [a1.id],
        moveMode: { active: true, validTargets: ["21"] },
      },
      { type: "QUEUE_MOVE", toHoldId: "21" }
    );
    guest = gameReducer(
      {
        ...guest,
        selectedArmyIds: [a2.id],
        moveMode: { active: true, validTargets: ["17"] },
      },
      { type: "QUEUE_MOVE", toHoldId: "17" }
    );
    guest = gameReducer(guest, {
      type: "SUBMIT_FACTION",
      faction: "westerlands",
      deferAdjudicate: true,
    });

    const host: GameState = { ...INITIAL_GAME_STATE, activeFaction: "north" };
    let hostBoard = gameReducer(host, {
      type: "PULL_RIVAL_ORDERS",
      faction: "north",
      north: host.north,
      westerlands: guest.westerlands,
      armies: guest.armies,
      characters: guest.characters,
      holdStates: guest.holdStates,
      prisoners: guest.prisoners,
    });
    assert.ok(hostBoard.armies.some((a) => a.id === a1.id));
    assert.ok(!hostBoard.armies.some((a) => a.id === "army-jaime"));
    assert.equal(moveOrdersResolvable(hostBoard), true);

    hostBoard = gameReducer(hostBoard, {
      type: "SUBMIT_FACTION",
      faction: "north",
      deferAdjudicate: true,
    });
    hostBoard = gameReducer(hostBoard, { type: "ADJUDICATE_MOVES" });
    assert.equal(hostBoard.armies.find((a) => a.id === a1.id)?.holdId, "21");
    assert.equal(hostBoard.armies.find((a) => a.id === a2.id)?.holdId, "17");
  });

  it("moves escorted prisoners onto the first half and drops the parent order", () => {
    const group = createPrisonerGroup({
      captorFaction: "westerlands",
      faction: "north",
      location: { kind: "army", armyId: "army-jaime" },
      units: [{ house: "Tully", type: "infantry", count: 40 }],
      characterIds: [],
      takenAtHoldId: "21",
      takenTurn: 1,
      origin: "battle",
    });
    assert.ok(group);

    let state: GameState = {
      ...INITIAL_GAME_STATE,
      activeFaction: "westerlands",
      prisoners: [group],
      westerlands: {
        ...INITIAL_GAME_STATE.westerlands,
        orders: [{ armyId: "army-jaime", fromHoldId: "16", toHoldId: "21" }],
      },
    };
    state = gameReducer(state, { type: "SPLIT_ARMY", config: JAIME_SPLIT });
    const loc = (state.prisoners ?? [])[0]?.location;
    assert.equal(loc?.kind, "army");
    if (loc?.kind === "army") {
      assert.notEqual(loc.armyId, "army-jaime");
      assert.ok(state.armies.some((a) => a.id === loc.armyId));
    }
    assert.equal(
      state.westerlands.orders.some((o) => o.armyId === "army-jaime"),
      false
    );
  });

  it("hydrates a sparse resolving snapshot without dropping arrays", () => {
    const sparse = {
      turn: 1,
      phase: "resolving",
      north: INITIAL_GAME_STATE.north,
      westerlands: INITIAL_GAME_STATE.westerlands,
    } as GameState;
    const next = gameReducer(
      { ...INITIAL_GAME_STATE, activeFaction: "westerlands" },
      { type: "HYDRATE_REMOTE", state: sparse }
    );
    assert.ok(Array.isArray(next.pendingBattles));
    assert.ok(Array.isArray(next.pendingRenames));
    assert.ok(Array.isArray(next.armies));
    assert.ok(Array.isArray(next.battleReports));
    assert.equal(next.activeFaction, "westerlands");
  });
});

describe("the map is how you march", () => {
  it("lights neighbour seats when a field host is selected", () => {
    const next = gameReducer(INITIAL_GAME_STATE, {
      type: "SELECT_ARMY",
      armyId: "army-robb",
      shift: false,
    });
    assert.equal(next.moveMode.active, true);
    assert.ok(next.moveMode.validTargets.includes("07"));
    assert.ok(!next.moveMode.validTargets.includes("08"));
    assert.deepEqual(next.selectedArmyIds, ["army-robb"]);
  });

  it("keeps the host selected after a march is queued", () => {
    let s = gameReducer(INITIAL_GAME_STATE, {
      type: "SELECT_ARMY",
      armyId: "army-robb",
      shift: false,
    });
    s = gameReducer(s, { type: "QUEUE_MOVE", toHoldId: "07" });
    assert.deepEqual(s.selectedArmyIds, ["army-robb"]);
    assert.equal(s.north.orders[0]?.toHoldId, "07");
    assert.equal(s.moveMode.active, true);
  });

  it("stops lighting neighbours when the host is told to rest", () => {
    let s = gameReducer(INITIAL_GAME_STATE, {
      type: "SELECT_ARMY",
      armyId: "army-robb",
      shift: false,
    });
    s = gameReducer(s, {
      type: "SET_STANCE_ORDER",
      armyId: "army-robb",
      order: "rest",
    });
    assert.equal(s.moveMode.active, false);
    assert.equal(s.north.stanceOrders["army-robb"], "rest");
  });
});

function voicedAudience(
  faction: "north" | "westerlands",
  extra: Partial<Audience> = {}
): Audience {
  const speakerId = faction === "north" ? "roose-bolton" : "addam-marbrand";
  const addresseeId = faction === "north" ? "robb-stark" : "tywin-lannister";
  return {
    id: `aud-${faction}-1-${speakerId}`,
    turn: 1,
    faction,
    speakerId,
    addresseeId,
    kind: "prisoners_fate",
    situation: "Captives from the last fight.",
    whyNow: "The column is slowed.",
    text: "My lord, the captives are a weight. What is your word?",
    options: [
      { id: "keep", label: "Keep them under guard" },
      { id: "free", label: "Turn them loose" },
      { id: "hang", label: "Hang a few as a lesson" },
    ],
    answer: null,
    narration: null,
    effects: null,
    effectsApplied: false,
    skipped: false,
    ...extra,
  };
}

function counselState(
  audiences: Audience[],
  activeFaction: "north" | "westerlands" = "north"
): GameState {
  return {
    ...INITIAL_GAME_STATE,
    phase: "counsel",
    turn: 1,
    activeFaction,
    mapStatus: "resolved",
    audiences,
  };
}

describe("counsel answers", () => {
  it("does not let the host answer for the West", () => {
    const start = counselState(
      [voicedAudience("north"), voicedAudience("westerlands")],
      "north"
    );
    const next = gameReducer(start, {
      type: "SET_AUDIENCE_ANSWER",
      audienceId: voicedAudience("westerlands").id,
      answer: { optionId: "keep", freeText: null },
      asFaction: "north",
    });
    assert.equal(
      (next.audiences ?? []).find((a) => a.faction === "westerlands")?.answer,
      null
    );
  });

  it("does not let the guest answer for the North", () => {
    const start = counselState(
      [voicedAudience("north"), voicedAudience("westerlands")],
      "westerlands"
    );
    const next = gameReducer(start, {
      type: "SET_AUDIENCE_ANSWER",
      audienceId: voicedAudience("north").id,
      answer: { optionId: "keep", freeText: null },
      asFaction: "westerlands",
    });
    assert.equal(
      (next.audiences ?? []).find((a) => a.faction === "north")?.answer,
      null
    );
  });

  it("lets a side answer their own dilemma", () => {
    const start = counselState(
      [voicedAudience("north"), voicedAudience("westerlands")],
      "westerlands"
    );
    const next = gameReducer(start, {
      type: "SET_AUDIENCE_ANSWER",
      audienceId: voicedAudience("westerlands").id,
      answer: { optionId: "free", freeText: null },
      asFaction: "westerlands",
    });
    assert.equal(
      (next.audiences ?? []).find((a) => a.faction === "westerlands")?.answer?.optionId,
      "free"
    );
  });

  it("pulls only the rival's counsel answer", () => {
    const north = voicedAudience("north", {
      answer: { optionId: "keep", freeText: null },
    });
    const west = voicedAudience("westerlands");
    const next = gameReducer(counselState([north, west], "north"), {
      type: "PULL_RIVAL_AUDIENCE_ANSWERS",
      myFaction: "north",
      audiences: [
        { ...north, answer: { optionId: "hang", freeText: null } },
        { ...west, answer: { optionId: "free", freeText: null } },
      ],
    });
    assert.equal(
      (next.audiences ?? []).find((a) => a.faction === "north")?.answer?.optionId,
      "keep"
    );
    assert.equal(
      (next.audiences ?? []).find((a) => a.faction === "westerlands")?.answer?.optionId,
      "free"
    );
  });

  it("rejects a free answer over forty words", () => {
    const start = counselState([voicedAudience("north")], "north");
    const next = gameReducer(start, {
      type: "SET_AUDIENCE_ANSWER",
      audienceId: voicedAudience("north").id,
      answer: {
        optionId: null,
        freeText: Array.from({ length: 41 }, () => "word").join(" "),
      },
      asFaction: "north",
    });
    assert.equal((next.audiences ?? [])[0]?.answer, null);
  });

  it("does not queue marches during counsel", () => {
    const start: GameState = {
      ...counselState([voicedAudience("north")], "north"),
      selectedArmyIds: ["army-robb"],
    };
    const next = gameReducer(start, { type: "BEGIN_MOVE" });
    assert.equal(next.moveMode.active, false);
    const queued = gameReducer(
      { ...start, moveMode: { active: true, validTargets: ["07"] } },
      { type: "QUEUE_MOVE", toHoldId: "07" }
    );
    assert.equal(queued.north.orders.length, start.north.orders.length);
  });

  it("skips a failed side and still advances to planning", () => {
    const start = counselState(
      [
        skippedAudience("north", 1, "propose failed"),
        skippedAudience("westerlands", 1, "propose failed"),
      ],
      "north"
    );
    const next = gameReducer(start, { type: "FINISH_COUNSEL" });
    assert.equal(next.phase, "planning");
    assert.equal(next.turn, 2);
  });

  it("does not finish while the map is still being settled", () => {
    const start: GameState = {
      ...counselState(
        [
          skippedAudience("north", 1, "propose failed"),
          skippedAudience("westerlands", 1, "propose failed"),
        ],
        "north"
      ),
      mapStatus: "resolving",
    };
    const next = gameReducer(start, { type: "FINISH_COUNSEL" });
    assert.equal(next.phase, "counsel");
  });

  it("does not finish while a side still owes an answer", () => {
    const start = counselState(
      [
        skippedAudience("north", 1, "propose failed"),
        voicedAudience("westerlands"),
      ],
      "north"
    );
    const next = gameReducer(start, { type: "FINISH_COUNSEL" });
    assert.equal(next.phase, "counsel");
    assert.equal(next.turn, 1);
  });

  it("opens counsel as soon as both sides lock", () => {
    let s = gameReducer(INITIAL_GAME_STATE, {
      type: "SUBMIT_FACTION",
      faction: "north",
    });
    s = gameReducer(s, { type: "SUBMIT_FACTION", faction: "westerlands" });
    assert.equal(s.phase, "counsel");
    assert.equal(s.mapStatus ?? "idle", "idle");
  });

  it("preloads a dilemma during planning", () => {
    const audience = voicedAudience("north");
    const next = gameReducer(INITIAL_GAME_STATE, {
      type: "APPLY_AUDIENCE_PROPOSAL",
      audience: { ...audience, text: "", options: [] },
    });
    assert.equal(next.phase, "planning");
    assert.equal((next.audiences ?? [])[0]?.speakerId, "roose-bolton");
  });

  it("records a counsel_given deed after a chosen option", () => {
    const audience = voicedAudience("north", {
      answer: { optionId: "keep", freeText: null },
    });
    const start = counselState(
      [audience, skippedAudience("westerlands", 1, "propose failed")],
      "north"
    );
    const next = gameReducer(start, {
      type: "APPLY_AUDIENCE_OUTCOME",
      audienceId: audience.id,
      narration: "The captives stay under guard.",
      effects: {
        armyUpdates: [
          {
            armyId: "army-robb",
            tiredness: "Weary of herding captives.",
            morale: "Grim but obedient.",
            stance: "Holding the column together.",
          },
        ],
        garrisonUpdates: [],
        prisonerActs: [],
        forageHolds: [],
        deedSummary: "Robb heard Roose after the last march.",
        deedDetail: "Roose put the captives to Robb. He kept them.",
      },
    });
    const deed = (next.deeds ?? []).find((d) => d.kind === "counsel_given");
    assert.ok(deed);
    assert.match(deed!.summary, /Roose|Robb|heard/);
    const robb = next.armies.find((a) => a.id === "army-robb");
    assert.equal(robb?.morale, "Grim but obedient.");
    assert.equal(
      (next.audiences ?? []).find((a) => a.id === audience.id)?.effectsApplied,
      true
    );
  });
});
