import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Army, ArmyUnit, HoldRuntime } from "../types";
import { army, holdRuntime } from "./test-helpers";
import {
  DISPERSE_ARRIVAL_RATE,
  DISPERSE_RADIUS,
  allocationUnits,
  describeDispersal,
  disperseGarrison,
  disperseTargets,
} from "./disperse";

const GARRISON: ArmyUnit[] = [
  { house: "Tully", type: "infantry", count: 700 },
  { house: "Tully", type: "archers", count: 300 },
];

/**
 * Riverrun (16) is one step from 25, 22, 19, 21 and 17; two from 23, 28, 18
 * and 08; three from 27, 26, 24, 30, 20, 07, 03 and 01.
 */
function board(
  overrides: Record<string, Partial<HoldRuntime>> = {}
): Record<string, HoldRuntime> {
  const ids = [
    "01", "03", "07", "08", "16", "17", "18", "19", "20", "21", "22",
    "23", "24", "25", "26", "27", "28", "30",
  ];
  const out: Record<string, HoldRuntime> = {};
  for (const id of ids) {
    out[id] = holdRuntime({
      controller: null,
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

function northSeat(men = 0): Partial<HoldRuntime> {
  return {
    controller: "north",
    garrison: {
      faction: "north",
      units: men > 0 ? [{ house: "Stark", type: "infantry", count: men }] : [],
      leaders: [],
      notables: [],
      morale: "",
      tiredness: "",
      stance: "",
    },
  };
}

describe("disperseTargets", () => {
  it("finds friendly seats and hosts within three spaces", () => {
    const holdStates = board({
      "17": northSeat(100),
      "23": northSeat(100),
      "30": northSeat(100),
    });
    const armies: Army[] = [
      army({ id: "army-robb", faction: "north", holdId: "21" }),
    ];
    const targets = disperseTargets("16", "north", armies, holdStates);
    const ids = targets.map((t) => `${t.kind}:${t.id}`);
    assert.ok(ids.includes("hold:17"));
    assert.ok(ids.includes("army-robb".replace(/^/, "army:")));
    assert.ok(ids.includes("hold:23"));
    assert.ok(ids.includes("hold:30"));
  });

  it("will not reach past three spaces", () => {
    // 31 (Dragonstone) is four from Riverrun via 17-18-30-31.
    const holdStates = { ...board(), "31": holdRuntime(northSeat(100)) };
    const targets = disperseTargets("16", "north", [], holdStates);
    assert.equal(targets.some((t) => t.holdId === "31"), false);
  });

  it("gives each hold its true distance", () => {
    const holdStates = board({ "17": northSeat(100), "23": northSeat(100) });
    const targets = disperseTargets("16", "north", [], holdStates);
    assert.equal(targets.find((t) => t.id === "17")?.distance, 1);
    assert.equal(targets.find((t) => t.id === "23")?.distance, 2);
  });

  it("excludes the seat they are walking out of", () => {
    const holdStates = board({ "16": northSeat(100) });
    const targets = disperseTargets("16", "north", [], holdStates);
    assert.equal(targets.some((t) => t.holdId === "16"), false);
  });

  it("excludes enemy-occupied seats and anywhere an enemy host stands", () => {
    const holdStates = board({
      "17": northSeat(100),
      "21": { controller: "westerlands" },
    });
    const armies: Army[] = [
      army({ id: "army-tywin", faction: "westerlands", holdId: "17" }),
    ];
    const targets = disperseTargets("16", "north", armies, holdStates);
    // 17 is friendly-controlled but an enemy host is sitting on it.
    assert.equal(targets.some((t) => t.holdId === "17"), false);
    assert.equal(targets.some((t) => t.holdId === "21"), false);
  });

  it("excludes a razed seat — there is nothing left to garrison", () => {
    const holdStates = board({ "17": { ...northSeat(100), razed: true } });
    const targets = disperseTargets("16", "north", [], holdStates);
    assert.equal(targets.some((t) => t.holdId === "17"), false);
  });

  it("excludes a seat that is already full", () => {
    // The Twins cap at 2,400.
    const holdStates = board({ "17": northSeat(2400) });
    const targets = disperseTargets("16", "north", [], holdStates);
    assert.equal(targets.some((t) => t.holdId === "17"), false);
  });
});

describe("disperseGarrison", () => {
  const holdStates = board({ "17": northSeat(100), "23": northSeat(100) });
  const armies: Army[] = [
    army({ id: "army-robb", faction: "north", holdId: "21" }),
  ];

  it("sends only half the men onward — the rest go home", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    assert.equal(out.arrived + out.meltedAway, 1000);
    assert.equal(out.arrived, 1000 * DISPERSE_ARRIVAL_RATE);
    assert.equal(out.meltedAway, 500);
  });

  it("evaporates entirely when there is nowhere in range to go", () => {
    const out = disperseGarrison(GARRISON, "16", "north", [], board());
    assert.deepEqual(out.allocations, []);
    assert.equal(out.arrived, 0);
    assert.equal(out.meltedAway, 1000);
  });

  it("favours the near over the far", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    const near = out.allocations.find((a) => a.distance === 1);
    const far = out.allocations.find((a) => a.distance === 2);
    assert.ok(near && far);
    assert.ok(
      near!.men > far!.men,
      `near ${near!.men} should beat far ${far!.men}`
    );
  });

  it("spreads the men out rather than dumping them in one place", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    assert.ok(out.allocations.length >= 2);
  });

  it("produces trickles — dispersal is not a reinforcement scheme", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    // Nothing anywhere near the original thousand.
    for (const a of out.allocations) {
      assert.ok(a.men < 400, `${a.id} got ${a.men}`);
    }
  });

  it("lands identically on every client — no RNG anywhere", () => {
    const a = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    const b = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    assert.deepEqual(a, b);
  });

  it("never invents or loses a man", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    const placed = out.allocations.reduce((s, x) => s + x.men, 0);
    assert.equal(placed, out.arrived);
    assert.equal(out.arrived + out.meltedAway, 1000);
  });

  it("does not overfill a castle", () => {
    // Only Stokeworth-sized room left anywhere near.
    const tight = board({ "17": northSeat(2380) }); // cap 2400, room for 20
    const out = disperseGarrison(GARRISON, "16", "north", [], tight);
    const twins = out.allocations.find((a) => a.id === "17");
    assert.ok(!twins || twins.men <= 20);
    assert.equal(out.arrived + out.meltedAway, 1000);
  });

  it("takes nobody nowhere", () => {
    const out = disperseGarrison([], "16", "north", armies, holdStates);
    assert.equal(out.arrived, 0);
    assert.deepEqual(out.allocations, []);
  });

  it("respects the documented radius", () => {
    assert.equal(DISPERSE_RADIUS, 3);
  });
});

describe("allocationUnits", () => {
  it("keeps the released garrison's own house and mix", () => {
    const units = allocationUnits(GARRISON, 100);
    assert.equal(units.reduce((s, u) => s + u.count, 0), 100);
    assert.ok(units.every((u) => u.house === "Tully"));
    const infantry = units.find((u) => u.type === "infantry")!;
    const archers = units.find((u) => u.type === "archers")!;
    assert.equal(infantry.count, 70);
    assert.equal(archers.count, 30);
  });

  it("never loses a man to rounding", () => {
    for (const men of [1, 3, 7, 13, 97, 333]) {
      const units = allocationUnits(GARRISON, men);
      assert.equal(units.reduce((s, u) => s + u.count, 0), men, `men=${men}`);
    }
  });

  it("returns nothing for nobody", () => {
    assert.deepEqual(allocationUnits(GARRISON, 0), []);
    assert.deepEqual(allocationUnits([], 50), []);
  });
});

describe("describeDispersal", () => {
  const holdStates = board({ "17": northSeat(100) });
  const armies: Army[] = [
    army({ id: "army-robb", faction: "north", holdId: "21", name: "Robb's Host" }),
  ];

  it("names where the men went", () => {
    const out = disperseGarrison(GARRISON, "16", "north", armies, holdStates);
    const text = describeDispersal(out, holdStates, armies);
    assert.match(text, /scattered/);
    assert.match(text, /went home/);
  });

  it("says plainly when they simply went home", () => {
    const out = disperseGarrison(GARRISON, "16", "north", [], board());
    const text = describeDispersal(out, board(), []);
    assert.match(text, /1,000 men went home/);
  });
});
