import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStage, portraitError, thinStage } from "./chronicle";
import { lifeContext, questionAt } from "./path";
import type { Answer } from "./types";

function answers(count: number): Answer[] {
  const prior: Answer[] = [];
  for (let index = 0; index < count; index += 1) {
    const question = questionAt(index, prior);
    const option = question.options.find((item) => item.points === 3)!;
    prior.push({ questionId: question.id, optionId: option.id });
  }
  return prior;
}

function fullStage() {
  return {
    name: "Wynna",
    knownAs: "Wynna of the croft",
    nickname: "Wynna",
    heading: "The first winters",
    text: "She learned the lane before she learned her letters.",
    imagePrompts: ["A child on a frozen lane.", "A croft in snow."],
    born: 290,
    fromYear: 290,
    toYear: 302,
    died: false,
    diedYear: null,
    dice: [{ die: "d20", result: 11, used: "A middling fortune." }],
    fortune: { label: "Bread", points: across(290, 302) },
    memory: { label: "The lane", points: across(290, 302) },
    work: { title: "The croft", note: "Hands, and a roof.", series: [{ name: "Stores", points: across(290, 302) }] },
  };
}

function across(start: number, end: number) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    year: start + Math.round(((end - start) * index) / 7),
    value: 10 + index,
  }));
}

describe("life chronicle", () => {
  it("accepts a sitting and rejects a short chart", () => {
    assert.equal(parseStage({ heading: "Early" }, "childhood", 290, "Arya"), null);
    const parsed = parseStage(fullStage(), "childhood", 290, "Arya");
    assert.equal(parsed?.name, "Arya");
    assert.equal(parsed?.stage.id, "childhood");
    assert.equal(parsed?.stage.imagePrompts.length, 2);
    assert.equal(parsed?.ended, false);
    assert.equal(parsed?.thin, false);
  });

  it("keeps a thin sitting inside the chart bounds", () => {
    const thin = thinStage(lifeContext(answers(4)), "childhood", "");
    assert.equal(thin.thin, true);
    assert.equal(thin.name, "Unnamed");
    assert.ok(thin.stage.fortune.points.length >= 4);
    assert.ok(thin.stage.memory.points.length <= 12);
  });

  it("marks death in the last sitting", () => {
    const parsed = parseStage({ ...fullStage(), died: true, diedYear: 318, toYear: 318 }, "age", 290, "Wynna");
    assert.equal(parsed?.ended, true);
    assert.equal(parsed?.died, 318);
  });

  it("writes a childhood from four choices", () => {
    const context = lifeContext(answers(4));
    assert.equal(context.choices.length, 4);
    assert.equal(context.choices[2].prompt, "Who are you?");
    assert.equal(context.choices[3].prompt, "What is your background?");
  });

  it("rejects portrait lines that break the word cap", () => {
    assert.equal(
      portraitError({ name: "", portrait: "a northern child", want: "quiet", hate: "the cold", love: "a sibling" }),
      null,
    );
    assert.ok(portraitError({ name: "", portrait: "", want: "quiet", hate: "the cold", love: "a sibling" }));
  });
});
