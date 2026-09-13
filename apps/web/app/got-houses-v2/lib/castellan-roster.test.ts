import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CASTELLAN_BY_HOLD,
  CASTELLAN_SEEDS,
  castellanSeedForHold,
  garrisonRosterForHold,
} from "../data/castellans";
import { HOLDS } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import { buildInitialCharacters } from "../data/characters";
import { buildInitialHoldStates, isGarrisonable } from "./hold-runtime";
import { isPersistentCastellan, isHumanNegotiator } from "./castellan";

/** Seats that open the game as empty ruins with no household to speak for. */
const UNMANNED_RUINS = ["08", "18"];

describe("castellan roster", () => {
  it("has somebody in every seat that has a household", () => {
    const missing = HOLDS.filter((h) => {
      const seed = getCastleSeed(h.id);
      if (!isGarrisonable(seed)) return false;
      if (UNMANNED_RUINS.includes(h.id)) return false;
      return !castellanSeedForHold(h.id);
    }).map((h) => `${h.id} ${h.name}`);
    assert.deepEqual(missing, []);
  });

  it("leaves the empty ruins empty — there is nobody to appoint yet", () => {
    for (const id of UNMANNED_RUINS) {
      assert.equal(castellanSeedForHold(id), null);
    }
  });

  it("gives each seat exactly one voice for its walls", () => {
    const byHold = new Map<string, number>();
    for (const s of CASTELLAN_SEEDS) {
      if (s.role !== "castellan") continue;
      byHold.set(s.holdId, (byHold.get(s.holdId) ?? 0) + 1);
    }
    for (const [holdId, n] of byHold) {
      assert.equal(n, 1, `${holdId} has ${n} castellans`);
    }
    assert.equal(CASTELLAN_BY_HOLD.size, byHold.size);
  });

  it("uses unique ids and names", () => {
    const ids = new Set(CASTELLAN_SEEDS.map((s) => s.id));
    const names = new Set(CASTELLAN_SEEDS.map((s) => s.name));
    assert.equal(ids.size, CASTELLAN_SEEDS.length);
    assert.equal(names.size, CASTELLAN_SEEDS.length);
  });

  it("posts every castellan to a real hold", () => {
    const holdIds = new Set(HOLDS.map((h) => h.id));
    for (const s of CASTELLAN_SEEDS) {
      assert.ok(holdIds.has(s.holdId), `${s.name} posted to ${s.holdId}`);
    }
  });

  it("seats the named characters the plan calls for", () => {
    assert.equal(castellanSeedForHold("30")?.name, "Joffrey Baratheon");
    assert.equal(castellanSeedForHold("23")?.name, "Ser Kevan Lannister");
    assert.equal(castellanSeedForHold("16")?.name, "Ser Edmure Tully");
    assert.equal(castellanSeedForHold("17")?.name, "Walder Frey");
  });

  it("puts Cersei in King's Landing as a garrison notable, not its castellan", () => {
    const roster = garrisonRosterForHold("30");
    assert.ok(roster.notables.some((n) => n.name === "Cersei Lannister"));
    assert.ok(roster.leaders.some((l) => l.name === "Joffrey Baratheon"));
  });
});

describe("castellans in the initial board", () => {
  const characters = buildInitialCharacters();
  const holdStates = buildInitialHoldStates();

  it("makes every castellan a real, persistent character", () => {
    for (const s of CASTELLAN_SEEDS) {
      const c = characters[s.id];
      assert.ok(c, `${s.name} missing from characters`);
      assert.equal(c.kind, "npc");
      assert.ok(isPersistentCastellan(c) || s.role === "notable");
      if (c.kind === "npc") {
        assert.equal(c.ephemeral, undefined);
        assert.equal(c.holdId, s.holdId);
        assert.equal(c.armyId, null);
      }
    }
  });

  it("links each seat to its castellan", () => {
    assert.equal(holdStates["16"].castellanId, "edmure-tully");
    assert.equal(holdStates["23"].castellanId, "kevan-lannister");
    assert.equal(holdStates["30"].castellanId, "joffrey-baratheon");
  });

  it("puts them on the garrison roster so the card shows who is inside", () => {
    assert.ok(
      holdStates["16"].garrison.leaders.some((l) => l.name === "Ser Edmure Tully")
    );
  });

  it("takes Kevan out of Tywin's host", () => {
    const kevan = characters["kevan-lannister"];
    assert.equal(kevan.kind === "npc" ? kevan.armyId : "x", null);
    assert.equal(kevan.kind === "npc" ? kevan.holdId : "x", "23");
  });

  it("puts castellans on the side whose country they sit in", () => {
    assert.equal(characters["edmure-tully"].faction, "north");
    assert.equal(characters["kevan-lannister"].faction, "westerlands");
    assert.equal(characters["joffrey-baratheon"].faction, "westerlands");
  });

  it("leaves the empty ruins without a castellan", () => {
    for (const id of UNMANNED_RUINS) {
      assert.equal(holdStates[id].castellanId, null);
    }
  });

  it("opens every seat unrazed", () => {
    for (const hs of Object.values(holdStates)) {
      assert.equal(hs.razed, false);
      assert.equal(hs.razeInProgress, null);
    }
  });
});

describe("a captive cannot answer for his own walls", () => {
  it("refuses a man in a cell as negotiator", () => {
    const characters = buildInitialCharacters();
    const edmure = characters["edmure-tully"];
    assert.equal(isHumanNegotiator(edmure), true);
    assert.equal(
      isHumanNegotiator({ ...edmure, captive: true } as typeof edmure),
      false
    );
  });
});
