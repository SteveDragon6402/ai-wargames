import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStage, portraitError, readingAt, thinStage } from "./chronicle";
import { lifeContext, questionAt } from "./path";
import type { Answer } from "./types";

function answers(count: number): Answer[] {
  const prior: Answer[] = [];
  for (let index = 0; index < count; index += 1) {
    const question = questionAt(index, prior);
    const option = index === 0 ? question.options[0] : question.options.find((item) => item.points === 3)!;
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
    charts: [
      {
        title: "Miles from the croft",
        unit: "miles",
        why: "She walked the lane to the mill and back, and nowhere else.",
        kind: "running",
        points: across(290, 302),
      },
    ],
  };
}

function across(start: number, end: number) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    year: start + Math.round(((end - start) * index) / 7),
    value: 10 + index * 40,
    note: index === 0 ? "She had not yet left the yard." : "The mill road, and back before dark.",
  }));
}

describe("life chronicle", () => {
  it("accepts a sitting and rejects a short chart", () => {
    assert.equal(parseStage({ heading: "Early" }, "childhood", 290, "Arya"), null);
    const parsed = parseStage(fullStage(), "childhood", 290, "Arya");
    assert.equal(parsed?.name, "Arya");
    assert.equal(parsed?.stage.id, "childhood");
    assert.equal(parsed?.stage.imagePrompts.length, 2);
    assert.equal(parsed?.stage.charts.length, 1);
    assert.equal(parsed?.stage.charts[0]?.unit, "miles");
    assert.equal(parsed?.ended, false);
    assert.equal(parsed?.thin, false);
    assert.equal(parsed?.dice.length, 0);
  });

  it("allows a sitting with no chart", () => {
    const parsed = parseStage({ ...fullStage(), charts: [] }, "childhood", 290, "Arya");
    assert.equal(parsed?.stage.charts.length, 0);
  });

  it("keeps a sitting when a third chart is extra, and fills a missing note", () => {
    const extra = fullStage().charts[0];
    const parsed = parseStage({ ...fullStage(), charts: extra ? [extra, extra, extra] : [] }, "childhood", 290, "Arya");
    assert.equal(parsed?.stage.charts.length, 2);
    const broken = fullStage();
    if (broken.charts[0]) broken.charts[0] = { ...broken.charts[0], points: across(290, 302).map(({ year, value }) => ({ year, value, note: "" })) };
    const filled = parseStage(broken, "childhood", 290, "Arya");
    assert.equal(filled?.stage.charts[0]?.points[0]?.note, "That year.");
  });

  it("reads a year between two marks", () => {
    const points = across(290, 297);
    const mid = readingAt(points, 291);
    assert.equal(mid.year, 291);
    assert.ok(mid.value > points[0]!.value);
    assert.ok(mid.note.length > 0);
  });

  it("keeps a thin sitting inside the chart bounds", () => {
    const thin = thinStage(lifeContext(answers(5)), "childhood", "");
    assert.equal(thin.thin, true);
    assert.equal(thin.name, "Unnamed");
    assert.equal(thin.stage.charts.length, 0);
  });

  it("marks death in the last sitting", () => {
    const parsed = parseStage({ ...fullStage(), died: true, diedYear: 318, toYear: 318 }, "age", 290, "Wynna");
    assert.equal(parsed?.ended, true);
    assert.equal(parsed?.died, 318);
  });

  it("writes a childhood from the era and four priced choices", () => {
    const context = lifeContext(answers(5));
    assert.equal(context.choices.length, 5);
    assert.equal(context.choices[0].points, 0);
    assert.equal(context.choices[1].prompt, "Where were you born?");
    assert.match(context.choices[4].prompt, /which line/i);
  });

  it("rejects portrait lines that break the word cap", () => {
    assert.equal(
      portraitError({ name: "", portrait: "a northern child", want: "quiet", hate: "the cold", love: "a sibling" }),
      null,
    );
    assert.ok(portraitError({ name: "", portrait: "", want: "quiet", hate: "the cold", love: "a sibling" }));
  });
});
