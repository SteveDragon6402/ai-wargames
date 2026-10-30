import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lessonForDay } from "../data/lessons";

describe("the morning lessons", () => {
  it("starts with je and teaches the negative on day 4", () => {
    assert.equal(lessonForDay(1).id, "je");
    assert.equal(lessonForDay(4).id, "negation");
    assert.equal(lessonForDay(8).id, "je");
  });
});