import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChronicle, portraitError, readCharts, readLife, thinChronicle } from "./chronicle";
import { lifeContext, questionAt } from "./path";
import type { Answer } from "./types";

function answers(): Answer[] {
  const prior: Answer[] = [];
  for (let index = 0; index < 7; index += 1) {
    const question = questionAt(index, prior);
    const option = question.options.find((item) => item.points === 3)!;
    prior.push({ questionId: question.id, optionId: option.id });
  }
  return prior;
}

describe("life chronicle", () => {
  it("rejects a short chart and accepts a full record", () => {
    assert.equal(parseChronicle({ chapters: [] }, ""), null);
    const thin = thinChronicle(lifeContext(answers()), "Arya");
    const parsed = parseChronicle(
      {
        ...thin,
        name: "Someone else",
        chapters: thin.chapters.map((chapter) => ({ ...chapter, imagePrompt: "A hall in winter." })),
        dice: [
          { die: "d20", result: 11, used: "A middling fortune." },
          { die: "d12", result: 6, used: "Half a natural span." },
          { die: "d6", result: 2, used: "The work was lost." },
        ],
      },
      "Arya",
    );
    assert.equal(parsed?.name, "Arya");
    assert.equal(parsed?.chapters.length, 3);
    assert.equal(parsed?.fortune.points.length, 8);
    assert.equal(parsed?.thin, false);
  });

  it("keeps the thin record inside the chart bounds", () => {
    const thin = thinChronicle(lifeContext(answers()), "");
    assert.equal(thin.thin, true);
    assert.equal(thin.name, "Unnamed");
    assert.ok(thin.fortune.points.length >= 8);
    assert.ok(thin.memory.points.length <= 12);
    assert.equal(thin.memory.points.at(-1)?.value, 0);
    assert.ok(thin.memory.points.at(-1)!.year > thin.died);
  });

  it("keeps a written life when the charts are missing", () => {
    const story = readLife(
      {
        name: "Wynna",
        chapters: [
          { id: "late", heading: "After", text: "The name outlived the winter.", imagePrompt: "A frozen lane." },
          { id: "early", heading: "Early", text: "She was born to a croft.", imagePrompt: "A croft." },
          { id: "middle", heading: "Middle", text: "The war reached the lane.", imagePrompt: "A lane." },
        ],
      },
      "",
      290,
    );
    assert.equal(story?.name, "Wynna");
    assert.deepEqual(story?.chapters.map((chapter) => chapter.id), ["early", "middle", "late"]);
    assert.equal(story?.born, 290);
    assert.equal(readCharts({ chapters: [] }), null);
  });

  it("rejects portrait lines that break the word cap", () => {
    assert.equal(
      portraitError({ name: "", portrait: "a northern child", want: "quiet", hate: "the cold", love: "a sibling" }),
      null,
    );
    assert.ok(portraitError({ name: "", portrait: "", want: "quiet", hate: "the cold", love: "a sibling" }));
    assert.ok(
      portraitError({
        name: "",
        portrait: "a child",
        want: "one two three four five six seven eight nine ten eleven",
        hate: "cold",
        love: "home",
      }),
    );
  });
});