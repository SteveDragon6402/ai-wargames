import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Deed, DeedKind } from "../types";
import {
  DEEDS_CAP,
  describeCircumstances,
  emptyCircumstances,
  executedByFaction,
  recordDeed,
  recordDeeds,
  reputationOf,
  reputationSummary,
  searchDeeds,
} from "./deeds";
import type { DeedInput } from "./deeds";

function deedInput(partial: Partial<DeedInput> = {}): DeedInput {
  return {
    turn: 5,
    kind: "garrison_let_go",
    actorFaction: "north",
    victimFaction: "westerlands",
    holdId: "16",
    characterIds: [],
    characterNames: [],
    menAffected: 0,
    circumstances: emptyCircumstances(),
    ...partial,
  };
}

function ledger(inputs: DeedInput[]): Deed[] {
  return recordDeeds(undefined, inputs).deeds;
}

describe("recordDeed", () => {
  it("composes a summary and detail when the caller gives none", () => {
    const { deed } = recordDeed(undefined, deedInput({ menAffected: 900 }));
    assert.match(deed.summary, /the North/);
    assert.match(deed.summary, /Riverrun/);
    assert.match(deed.summary, /900/);
    assert.ok(deed.detail.length > deed.summary.length);
  });

  it("keeps a caller's own prose", () => {
    const { deed } = recordDeed(
      undefined,
      deedInput({ summary: "Mine", detail: "Also mine." })
    );
    assert.equal(deed.summary, "Mine");
    assert.equal(deed.detail, "Also mine.");
  });

  it("flags a broken word in the summary", () => {
    const { deed } = recordDeed(
      undefined,
      deedInput({
        kind: "garrison_executed",
        circumstances: emptyCircumstances({ brokeWord: true }),
      })
    );
    assert.match(deed.summary, /word broken/);
  });

  it("gives every deed its own id", () => {
    const { deeds } = recordDeeds(undefined, [deedInput(), deedInput()]);
    assert.notEqual(deeds[0].id, deeds[1].id);
  });

  it("caps the ledger", () => {
    const many = Array.from({ length: DEEDS_CAP + 25 }, (_, i) =>
      deedInput({ turn: i })
    );
    const { deeds } = recordDeeds(undefined, many);
    assert.equal(deeds.length, DEEDS_CAP);
    // The cap drops the oldest, not the newest.
    assert.equal(deeds[deeds.length - 1].turn, DEEDS_CAP + 24);
  });
});

describe("searchDeeds", () => {
  const deeds = ledger([
    deedInput({ turn: 2, kind: "town_occupied", holdId: "16", actorFaction: "north" }),
    deedInput({
      turn: 4,
      kind: "leaders_executed",
      holdId: "21",
      actorFaction: "north",
      characterNames: ["Lord Jonos Bracken"],
      characterIds: ["jonos-bracken"],
    }),
    deedInput({ turn: 6, kind: "town_razed", holdId: "17", actorFaction: "westerlands" }),
  ]);

  it("filters by who did it", () => {
    assert.equal(searchDeeds(deeds, { faction: "westerlands" }).length, 1);
    assert.equal(searchDeeds(deeds, { faction: "north" }).length, 2);
  });

  it("filters by seat", () => {
    const hits = searchDeeds(deeds, { holdId: "21" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, "leaders_executed");
  });

  it("filters by kind", () => {
    assert.equal(searchDeeds(deeds, { kind: "town_razed" }).length, 1);
  });

  it("finds a man by a fragment of his name", () => {
    const hits = searchDeeds(deeds, { characterName: "bracken" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].turn, 4);
  });

  it("filters by turn", () => {
    assert.equal(searchDeeds(deeds, { sinceTurn: 4 }).length, 2);
  });

  it("searches free text across the prose", () => {
    assert.ok(searchDeeds(deeds, { query: "razed" }).length >= 1);
  });

  it("survives an empty ledger", () => {
    assert.deepEqual(searchDeeds(undefined, { faction: "north" }), []);
  });
});

describe("names survive the character record", () => {
  it("keeps a name after the character itself is gone", () => {
    // Ephemeral castellans get deleted outright, so the ledger cannot rely on
    // looking an id back up later.
    const deeds = ledger([
      deedInput({
        kind: "leaders_executed",
        characterIds: ["castellan-16-ephemeral"],
        characterNames: ["Ser Desmond Grell"],
      }),
    ]);
    const characters: Record<string, unknown> = {}; // he no longer exists
    assert.equal(Object.keys(characters).length, 0);
    assert.deepEqual(searchDeeds(deeds, { characterName: "desmond" })[0].characterNames, [
      "Ser Desmond Grell",
    ]);
  });
});

describe("reputationOf", () => {
  const deeds = ledger([
    deedInput({ kind: "garrison_let_go", actorFaction: "north" }),
    deedInput({ kind: "garrison_executed", actorFaction: "north", menAffected: 400 }),
    deedInput({
      kind: "leaders_executed",
      actorFaction: "north",
      menAffected: 3,
      circumstances: emptyCircumstances({
        promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
        chosen: { garrison: "let_go", leaders: "execute", town: "occupy" },
        brokeWord: true,
      }),
    }),
    deedInput({
      kind: "town_occupied",
      actorFaction: "north",
      circumstances: emptyCircumstances({
        promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
        chosen: { garrison: "let_go", leaders: "let_go", town: "occupy" },
      }),
    }),
    deedInput({ kind: "town_razed", actorFaction: "westerlands" }),
  ]);

  it("counts each faction's own acts only", () => {
    const north = reputationOf(deeds, "north");
    assert.equal(north.townsRazed, 0);
    assert.equal(reputationOf(deeds, "westerlands").townsRazed, 1);
  });

  it("tallies mercy and cruelty apart", () => {
    const north = reputationOf(deeds, "north");
    assert.equal(north.garrisonsLetGo, 1);
    assert.equal(north.garrisonsExecuted, 1);
    assert.equal(north.leadersExecuted, 1);
  });

  it("counts kept and broken words", () => {
    const north = reputationOf(deeds, "north");
    assert.equal(north.wordBroken, 1);
    assert.equal(north.wordKept, 1);
  });

  it("sums the men killed after they laid down arms", () => {
    assert.equal(reputationOf(deeds, "north").menExecuted, 403);
  });

  it("surfaces the worst of it for quoting", () => {
    const north = reputationOf(deeds, "north");
    assert.ok(north.notorious.length > 0);
    assert.ok(
      north.notorious.every(
        (d) =>
          d.circumstances.brokeWord ||
          ["garrison_executed", "leaders_executed", "prisoners_executed", "town_razed"].includes(
            d.kind as DeedKind
          )
      )
    );
  });
});

describe("reputationSummary", () => {
  it("says plainly that nothing is known yet", () => {
    const text = reputationSummary([], "north");
    assert.match(text, /no seats/);
  });

  it("names a broken word without telling the reader what to conclude", () => {
    const deeds = ledger([
      deedInput({
        kind: "garrison_executed",
        actorFaction: "north",
        holdId: "21",
        menAffected: 350,
        circumstances: emptyCircumstances({
          surrendered: true,
          surrenderedQuickly: true,
          promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
          chosen: { garrison: "execute", leaders: "let_go", town: "occupy" },
          brokeWord: true,
        }),
      }),
    ]);
    const text = reputationSummary(deeds, "north");
    assert.match(text, /BROKEN their word/);
    assert.match(text, /350/);
    // No verdict handed to the model.
    assert.doesNotMatch(text, /you should|do not trust|refuse/i);
  });

  it("credits a side that has kept every bargain", () => {
    const deeds = ledger([
      deedInput({
        kind: "garrison_let_go",
        actorFaction: "westerlands",
        circumstances: emptyCircumstances({
          promised: { garrison: "let_go", leaders: "let_go", town: "occupy" },
          chosen: { garrison: "let_go", leaders: "let_go", town: "occupy" },
        }),
      }),
    ]);
    const text = reputationSummary(deeds, "westerlands");
    assert.match(text, /broken none/);
  });
});

describe("describeCircumstances", () => {
  it("distinguishes a long stubborn siege from an immediate yield", () => {
    const stubborn = describeCircumstances(
      emptyCircumstances({
        siegeTurns: 30,
        surrendered: false,
        stormed: true,
        timesTermsOffered: 3,
        timesTermsRefused: 3,
      })
    );
    assert.match(stubborn, /30 turns/);
    assert.match(stubborn, /refused 3 times/);

    const quick = describeCircumstances(
      emptyCircumstances({
        siegeTurns: 1,
        surrendered: true,
        surrenderedQuickly: true,
      })
    );
    assert.match(quick, /almost at once/);
    assert.doesNotMatch(quick, /30/);
  });

  it("mentions starvation and the odds when they are known", () => {
    const text = describeCircumstances(
      emptyCircumstances({ starving: true, garrisonMen: 200, besiegerMen: 4000 })
    );
    assert.match(text, /starving/);
    assert.match(text, /200/);
    assert.match(text, /4,000/);
  });

  it("says nothing at all when nothing is known", () => {
    assert.equal(describeCircumstances(emptyCircumstances()), "");
  });
});

describe("executedByFaction", () => {
  it("lists the men a side killed after they had yielded", () => {
    const deeds = ledger([
      deedInput({
        kind: "leaders_executed",
        actorFaction: "north",
        holdId: "21",
        characterIds: ["jonos-bracken"],
        characterNames: ["Lord Jonos Bracken"],
      }),
      deedInput({ kind: "garrison_let_go", actorFaction: "north" }),
    ]);
    const dead = executedByFaction(deeds, "north");
    assert.equal(dead.length, 1);
    assert.equal(dead[0].name, "Lord Jonos Bracken");
    assert.equal(dead[0].holdId, "21");
  });
});
