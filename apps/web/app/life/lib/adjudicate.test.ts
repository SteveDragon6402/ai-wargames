import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdjudication, settleAdjudication, tellAdjudication } from "./adjudicate";

describe("life adjudication", () => {
  it("takes a chance in a hundred", () => {
    assert.deepEqual(parseAdjudication({ question: "the fever takes her", chance: 40 }), {
      question: "the fever takes her",
      chance: 40,
    });
    assert.equal(parseAdjudication({ question: "the fever takes her", chance: 140 }), null);
    assert.equal(parseAdjudication({ chance: 40 }), null);
  });

  it("lets the roll decide, not the asker", () => {
    const yes = settleAdjudication("the fever takes her", 40, 37);
    assert.equal(yes.happened, true);
    const no = settleAdjudication("the fever takes her", 40, 41);
    assert.equal(no.happened, false);
    assert.equal(settleAdjudication("certain", 100, 100).happened, true);
    assert.equal(settleAdjudication("impossible", 0, 1).happened, false);
  });

  it("tells the writer the independent result", () => {
    assert.equal(
      tellAdjudication({ question: "the horse holds", chance: 15, roll: 82, happened: false }),
      "Rolled 82 against 15 in a hundred. No. It does not.",
    );
  });
});
