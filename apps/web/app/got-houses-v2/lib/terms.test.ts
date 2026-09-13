import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SeatFates, SurrenderTerms } from "../types";
import {
  asSeatFates,
  compareToPromise,
  describeTerms,
  defaultFates,
  fatesOf,
  normalizeTerms,
  personSeverity,
  townSeverity,
} from "./terms";

function terms(partial: Partial<SurrenderTerms> = {}): SurrenderTerms {
  return {
    offeredBy: "north",
    garrison: "let_go",
    leaders: "let_go",
    town: "occupy",
    note: "",
    offeredTurn: 1,
    expiresTurn: 3,
    status: "offered",
    ...partial,
  };
}

function fates(partial: Partial<SeatFates> = {}): SeatFates {
  return { ...defaultFates(), ...partial };
}

describe("severity ordering", () => {
  it("ranks people let_go < prisoner < execute", () => {
    assert.ok(personSeverity("let_go") < personSeverity("prisoner"));
    assert.ok(personSeverity("prisoner") < personSeverity("execute"));
  });

  it("ranks towns occupy < raze", () => {
    assert.ok(townSeverity("occupy") < townSeverity("raze"));
  });
});

describe("normalizeTerms migration", () => {
  it("maps an old spared garrison to letting them walk", () => {
    const out = normalizeTerms({
      offeredBy: "north",
      garrisonSpared: true,
      leadersSpared: true,
      note: "Open the gates.",
      offeredTurn: 4,
      expiresTurn: 6,
      status: "offered",
    });
    assert.equal(out?.garrison, "let_go");
    assert.equal(out?.leaders, "let_go");
  });

  it("maps an old unspared garrison to chains, never to execution", () => {
    const out = normalizeTerms({
      offeredBy: "westerlands",
      garrisonSpared: false,
      leadersSpared: false,
      note: "",
      offeredTurn: 1,
      expiresTurn: 3,
      status: "accepted",
    });
    assert.equal(out?.garrison, "prisoner");
    assert.equal(out?.leaders, "prisoner");
    assert.notEqual(out?.garrison, "execute");
  });

  it("defaults the town axis to occupy, which is all the old game could do", () => {
    const out = normalizeTerms({
      offeredBy: "north",
      garrisonSpared: true,
      leadersSpared: false,
      note: "",
      offeredTurn: 1,
      expiresTurn: 3,
      status: "offered",
    });
    assert.equal(out?.town, "occupy");
  });

  it("passes through new-shape terms untouched", () => {
    const out = normalizeTerms(
      terms({ garrison: "execute", leaders: "prisoner", town: "raze" })
    );
    assert.equal(out?.garrison, "execute");
    assert.equal(out?.leaders, "prisoner");
    assert.equal(out?.town, "raze");
  });

  it("preserves a status it recognises and repairs one it does not", () => {
    assert.equal(normalizeTerms(terms({ status: "lapsed" }))?.status, "lapsed");
    assert.equal(
      normalizeTerms({ ...terms(), status: "nonsense" })?.status,
      "offered"
    );
  });

  it("rejects junk", () => {
    assert.equal(normalizeTerms(null), null);
    assert.equal(normalizeTerms({}), null);
    assert.equal(normalizeTerms({ offeredBy: "dorne" }), null);
  });

  it("keeps a prisoner-release clause", () => {
    const out = normalizeTerms(terms({ releasePrisonerIds: ["p1", "p2"] }));
    assert.deepEqual(out?.releasePrisonerIds, ["p1", "p2"]);
  });
});

describe("compareToPromise", () => {
  it("finds no breach when nothing was promised", () => {
    const c = compareToPromise(null, fates({ garrison: "execute" }));
    assert.equal(c.brokeWord, false);
  });

  it("finds no breach when the taker did exactly as promised", () => {
    const promised = fates({ garrison: "prisoner", leaders: "prisoner" });
    const c = compareToPromise(promised, { ...promised });
    assert.equal(c.brokeWord, false);
    assert.deepEqual(c.brokenAxes, []);
  });

  it("counts going harder than promised as breaking the word", () => {
    const c = compareToPromise(
      fates({ garrison: "let_go" }),
      fates({ garrison: "execute" })
    );
    assert.equal(c.brokeWord, true);
    assert.deepEqual(c.brokenAxes, ["garrison"]);
    assert.match(c.detail, /garrison/);
  });

  it("does not count mercy as a breach", () => {
    const c = compareToPromise(
      fates({ garrison: "execute", leaders: "execute", town: "raze" }),
      fates({ garrison: "let_go", leaders: "let_go", town: "occupy" })
    );
    assert.equal(c.brokeWord, false);
  });

  it("catches a breach on every axis at once", () => {
    const c = compareToPromise(
      fates({ garrison: "let_go", leaders: "let_go", town: "occupy" }),
      fates({ garrison: "prisoner", leaders: "execute", town: "raze" })
    );
    assert.deepEqual(c.brokenAxes, ["garrison", "leaders", "town"]);
    assert.match(c.detail, /burned/);
  });

  it("catches burning a seat that was promised quarter", () => {
    const c = compareToPromise(
      fates({ town: "occupy" }),
      fates({ town: "raze" })
    );
    assert.deepEqual(c.brokenAxes, ["town"]);
  });
});

describe("describeTerms", () => {
  it("says all three axes in one line", () => {
    const line = describeTerms(
      terms({ garrison: "let_go", leaders: "execute", town: "raze" })
    );
    assert.match(line, /marches out alive/);
    assert.match(line, /executed/);
    assert.match(line, /burned/);
  });
});

describe("asSeatFates", () => {
  it("repairs junk into a usable promise", () => {
    const f = asSeatFates({ garrison: "nonsense", town: "raze" });
    assert.equal(f.garrison, "prisoner");
    assert.equal(f.town, "raze");
  });
});

describe("fatesOf", () => {
  it("lifts the three axes off a terms record", () => {
    assert.deepEqual(fatesOf(terms({ garrison: "execute" })), {
      garrison: "execute",
      leaders: "let_go",
      town: "occupy",
    });
  });
});
