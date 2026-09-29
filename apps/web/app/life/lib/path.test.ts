import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chipsFor, lifeContext, questionAt, wordCount } from "./path";
import type { Answer, EraId, Option, Question, StationId } from "./types";

const ERAS: EraId[] = ["robert", "heroes", "blackfyre", "dance", "fivekings"];
const STATIONS: StationId[] = ["knight", "lesser", "great", "trade", "smallfolk"];

function pricesOk(question: Question) {
  assert.deepEqual(
    question.options.map((option) => option.points).sort((a, b) => a - b),
    [1, 2, 3, 4, 5],
  );
  assert.equal(new Set(question.options.map((option) => option.id)).size, 5);
}

function pick(question: Question, index: number, era: EraId, station: StationId): Option {
  if (index === 0) return question.options.find((option) => option.id === era)!;
  if (index === 1) return question.options.find((option) => option.id === station)!;
  return question.options[0];
}

function trace(era: EraId, station: StationId, choose: (question: Question, index: number) => Option) {
  const answers: Answer[] = [];
  const questions: Question[] = [];
  for (let index = 0; index < 7; index += 1) {
    const question = questionAt(index, answers);
    pricesOk(question);
    const again = questionAt(index, answers);
    assert.deepEqual(again, question);
    questions.push(question);
    const option = choose(question, index);
    answers.push({ questionId: question.id, optionId: option.id });
  }
  return { answers, questions };
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

describe("life path", () => {
  it("prices every question on every route", () => {
    for (const era of ERAS) {
      for (const station of STATIONS) {
        const { questions } = trace(era, station, (question, index) => pick(question, index, era, station));
        const prompts = new Set(questions.map((question) => question.prompt));
        assert.equal(prompts.size, 7);
      }
    }
  });

  it("scores seven, twenty-one, or thirty-five from the cheap, middle, and dear choices", () => {
    function total(points: 1 | 3 | 5) {
      const answers: Answer[] = [];
      for (let index = 0; index < 7; index += 1) {
        const question = questionAt(index, answers);
        const option = question.options.find((item) => item.points === points);
        assert.ok(option);
        answers.push({ questionId: question.id, optionId: option.id });
      }
      return lifeContext(answers).total;
    }
    assert.equal(total(1), 7);
    assert.equal(total(3), 21);
    assert.equal(total(5), 35);
  });

  it("asks different questions once the station splits", () => {
    for (const era of ERAS) {
      const byStation = Object.fromEntries(
        STATIONS.map((station) => [
          station,
          trace(era, station, (question, index) => pick(question, index, era, station)).questions,
        ]),
      ) as Record<StationId, Question[]>;
      for (let index = 2; index < 7; index += 1) {
        for (let left = 0; left < STATIONS.length; left += 1) {
          for (let right = left + 1; right < STATIONS.length; right += 1) {
            assert.notEqual(byStation[STATIONS[left]][index].prompt, byStation[STATIONS[right]][index].prompt);
          }
        }
      }
    }
  });

  it("does not ask a great house for a castle, a place in the line, or a profession", () => {
    const banned = /\b(heir|bastard|firstborn|secondborn|spare|profession|castle)\b|what did you become|where do you live|which castle/i;
    for (const era of ERAS) {
      const { questions } = trace(era, "great", (question, index) => pick(question, index, era, "great"));
      for (const question of questions) {
        const text = [question.prompt, ...question.options.map((option) => option.label)].join("\n");
        assert.doesNotMatch(text, banned);
      }
    }
  });

  it("changes the great houses with the era", () => {
    const blood = (era: EraId) => {
      const born = questionAt(0, []);
      const station = questionAt(1, [{ questionId: born.id, optionId: era }]);
      return questionAt(2, [
        { questionId: born.id, optionId: era },
        { questionId: station.id, optionId: "great" },
      ]).options.map((option) => option.id);
    };
    assert.ok(blood("fivekings").includes("martell"));
    assert.ok(!blood("robert").includes("martell"));
    assert.ok(blood("robert").includes("arryn"));
    assert.ok(blood("heroes").includes("gardener"));
  });

  it("prices the opening by danger and room, not by recency or rank", () => {
    const born = questionAt(0, []);
    assert.equal(born.options.find((option) => option.id === "robert")?.points, 5);
    assert.equal(born.options.find((option) => option.id === "fivekings")?.points, 1);
    const station = questionAt(1, [{ questionId: "born", optionId: "fivekings" }]);
    assert.equal(station.options.find((option) => option.id === "knight")?.points, 5);
    assert.equal(station.options.find((option) => option.id === "smallfolk")?.points, 1);
    assert.equal(station.options.find((option) => option.id === "great")?.points, 3);
  });

  it("stays deterministic across random paths", () => {
    const random = mulberry32(7);
    for (let n = 0; n < 30; n += 1) {
      const era = ERAS[Math.floor(random() * ERAS.length)];
      const station = STATIONS[Math.floor(random() * STATIONS.length)];
      const { answers } = trace(era, station, (question, index) => {
        if (index === 0) return question.options.find((option) => option.id === era)!;
        if (index === 1) return question.options.find((option) => option.id === station)!;
        return question.options[Math.floor(random() * question.options.length)];
      });
      const again = lifeContext(answers);
      assert.equal(again.choices.length, 7);
      assert.deepEqual(lifeContext(answers), again);
    }
  });

  it("offers five free chips and counts words", () => {
    const { answers } = trace("dance", "knight", (question, index) => pick(question, index, "dance", "knight"));
    const chips = chipsFor(answers);
    assert.equal(chips.want.length, 5);
    assert.equal(chips.hate.length, 5);
    assert.equal(chips.love.length, 5);
    for (const line of [...chips.want, ...chips.hate, ...chips.love]) {
      assert.ok(wordCount(line) <= 10);
    }
    assert.equal(wordCount("  a person  who left "), 4);
    assert.equal(wordCount("   "), 0);
  });
});
