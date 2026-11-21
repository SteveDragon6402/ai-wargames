import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRICULUM, nextLesson } from "../world/lessons";

describe("the morning lessons", () => {
  it("starts with je and moves on when skipped or completed", () => {
    const first = nextLesson({
      assessments: [],
      visits: {},
      eventsDone: [],
      lessonsDone: [],
      lessonsSkipped: [],
      gaps: [],
    });
    assert.equal(first.id, "je");

    const afterSkip = nextLesson({
      assessments: [],
      visits: {},
      eventsDone: [],
      lessonsDone: [],
      lessonsSkipped: ["je"],
      gaps: [],
    });
    assert.notEqual(afterSkip.id, "je");

    const afterDone = nextLesson({
      assessments: [],
      visits: {},
      eventsDone: [],
      lessonsDone: ["je", "please"],
      lessonsSkipped: ["articles"],
      gaps: [],
    });
    assert.equal(afterDone.id, "voudrais");
  });

  it("prioritizes open gaps and weak skills from recent assessments", () => {
    assert.equal(CURRICULUM.length, 15);
    const gapPick = nextLesson({
      assessments: [],
      visits: {},
      eventsDone: [],
      lessonsDone: ["je"],
      lessonsSkipped: [],
      gaps: [{ id: "negation", note: "needed ne...pas" }],
    });
    assert.equal(gapPick.id, "negation");

    const weakNumbers = nextLesson({
      assessments: [{ scene: "boulangerie", day: 1, ratings: { ordering: 3, numbers: 1, register: 3 } }],
      visits: {},
      eventsDone: [],
      lessonsDone: ["je", "please", "articles", "voudrais"],
      lessonsSkipped: [],
      gaps: [],
    });
    assert.equal(weakNumbers.id, "numbers");
  });
});
