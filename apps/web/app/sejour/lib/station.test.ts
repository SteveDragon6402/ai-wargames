import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allGone, announcement, boardFor, gate, tickBoard, trainOn } from "./station";

describe("the branch line", () => {
  it("puts the destination on a platform that is still running", () => {
    const board = boardFor(3, "market");
    const right = board.find((departure) => departure.stopId === "market");
    assert.ok(right);
    assert.equal(trainOn(board, right.platform)?.stopId, "market");
    assert.equal(new Set(board.map((departure) => departure.platform)).size, 3);
  });

  it("announces every train in French", () => {
    const said = announcement(boardFor(1, "hall"));
    assert.match(said, /Halle/);
    assert.match(said, /voie/);
    assert.doesNotMatch(said, /\d/);
  });

  it("opens a platform only in the five minutes before the train", () => {
    const board = boardFor(1, "market");
    const yours = board.find((departure) => departure.stopId === "market");
    assert.equal(gate(yours), "early");
    assert.equal(gate({ stopId: "market", platform: 1, minutes: 5 }), "open");
    assert.equal(gate({ stopId: "market", platform: 1, minutes: 1 }), "open");
    assert.equal(gate({ stopId: "market", platform: 1, minutes: 0 }), "gone");
    const later = tickBoard(board, 2);
    assert.equal(gate(later.find((departure) => departure.stopId === "market")), "open");
    assert.equal(allGone(tickBoard(board, 20)), true);
  });
});
