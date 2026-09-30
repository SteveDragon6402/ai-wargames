import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chipsFor, lifeContext, questionAt, wordCount } from "./path";
import type { Answer, EraId, Option, Question, StationId } from "./types";

const ERAS: EraId[] = ["robert", "conciliator", "blackfyre", "dance", "fivekings"];
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
      for (let index = 3; index < 7; index += 1) {
        for (let left = 0; left < STATIONS.length; left += 1) {
          for (let right = left + 1; right < STATIONS.length; right += 1) {
            assert.notEqual(byStation[STATIONS[left]][index].id, byStation[STATIONS[right]][index].id);
          }
        }
      }
      assert.equal(byStation.great[2].prompt, "Who are you?");
      assert.equal(byStation.great[3].prompt, "What is your background?");
    }
  });

  it("asks a great house who they are, and does not ask who holds them", () => {
    const banned = /who holds you|foster|what did you become|which castle|profession/i;
    for (const era of ERAS) {
      const { questions } = trace(era, "great", (question, index) => pick(question, index, era, "great"));
      const text = questions
        .flatMap((question) => [question.prompt, ...question.options.map((option) => option.label)])
        .join("\n");
      assert.match(text, /\bheir\b/i);
      assert.match(text, /\bbastard\b/i);
      assert.doesNotMatch(text, banned);
    }
  });

  it("changes the great houses with the era", () => {
    const blood = (era: EraId) => {
      const born = questionAt(0, []);
      const station = questionAt(1, [{ questionId: born.id, optionId: era }]);
      const who = questionAt(2, [
        { questionId: born.id, optionId: era },
        { questionId: station.id, optionId: "great" },
      ]);
      return questionAt(3, [
        { questionId: born.id, optionId: era },
        { questionId: station.id, optionId: "great" },
        { questionId: who.id, optionId: "heir" },
      ]).options.map((option) => option.id);
    };
    const points = (era: EraId, id: string) => {
      const born = questionAt(0, []);
      const station = questionAt(1, [{ questionId: born.id, optionId: era }]);
      const who = questionAt(2, [
        { questionId: born.id, optionId: era },
        { questionId: station.id, optionId: "great" },
      ]);
      return questionAt(3, [
        { questionId: born.id, optionId: era },
        { questionId: station.id, optionId: "great" },
        { questionId: who.id, optionId: "heir" },
      ]).options.find((option) => option.id === id)?.points;
    };
    assert.ok(blood("fivekings").includes("martell"));
    assert.equal(points("fivekings", "lannister"), 5);
    assert.equal(points("fivekings", "stark"), 1);
    assert.equal(points("dance", "targaryen"), 5);
    assert.equal(points("dance", "velaryon"), 4);
    assert.equal(points("dance", "hightower"), 3);
    assert.equal(points("dance", "lannister"), 1);
    assert.equal(points("blackfyre", "targaryen"), 5);
    assert.equal(points("blackfyre", "martell"), 4);
    assert.equal(points("blackfyre", "tyrell"), 2);
    assert.equal(points("blackfyre", "blackfyre"), 1);
    assert.equal(points("robert", "baratheon"), 5);
    assert.equal(points("robert", "targaryen"), 1);
    assert.ok(blood("robert").includes("arryn"));
    assert.equal(points("conciliator", "targaryen"), 5);
    assert.ok(!blood("conciliator").includes("gardener"));
  });

  it("prices birth and station by standing", () => {
    const born = questionAt(0, []);
    assert.equal(born.options.find((option) => option.id === "conciliator")?.points, 5);
    assert.equal(born.options.find((option) => option.id === "blackfyre")?.points, 4);
    assert.equal(born.options.find((option) => option.id === "robert")?.points, 3);
    assert.equal(born.options.find((option) => option.id === "dance")?.points, 2);
    assert.equal(born.options.find((option) => option.id === "fivekings")?.points, 1);
    const station = questionAt(1, [{ questionId: "born", optionId: "fivekings" }]);
    assert.equal(station.options.find((option) => option.id === "great")?.points, 5);
    assert.equal(station.options.find((option) => option.id === "lesser")?.points, 4);
    assert.equal(station.options.find((option) => option.id === "knight")?.points, 3);
    assert.equal(station.options.find((option) => option.id === "trade")?.points, 2);
    assert.equal(station.options.find((option) => option.id === "smallfolk")?.points, 1);
  });

  it("runs a house bent from the words down to the twist", () => {
    const born = questionAt(0, []);
    const station = questionAt(1, [{ questionId: born.id, optionId: "fivekings" }]);
    const who = questionAt(2, [
      { questionId: born.id, optionId: "fivekings" },
      { questionId: station.id, optionId: "great" },
    ]);
    const prior = [
      { questionId: born.id, optionId: "fivekings" },
      { questionId: station.id, optionId: "great" },
      { questionId: who.id, optionId: "heir" },
    ];
    const blood = questionAt(3, prior);
    const raised = questionAt(4, [...prior, { questionId: blood.id, optionId: "lannister" }]);
    const held = questionAt(5, [
      ...prior,
      { questionId: blood.id, optionId: "lannister" },
      { questionId: raised.id, optionId: "rule" },
    ]);
    const bent = questionAt(6, [
      ...prior,
      { questionId: blood.id, optionId: "lannister" },
      { questionId: raised.id, optionId: "rule" },
      { questionId: held.id, optionId: held.options[0].id },
    ]);
    assert.equal(bent.options.find((option) => option.points === 5)?.label, "Hear Me Roar");
    assert.equal(bent.options.find((option) => option.points === 4)?.label, "A Lannister always pays his debts");
    assert.equal(bent.options.find((option) => option.points === 1)?.label, "Power above all");
  });

  it("lets the raising decide the thing you own", () => {
    function held(station: StationId, raisedId: string) {
      const born = questionAt(0, []);
      const stationQuestion = questionAt(1, [{ questionId: born.id, optionId: "fivekings" }]);
      const origin = questionAt(2, [
        { questionId: born.id, optionId: "fivekings" },
        { questionId: stationQuestion.id, optionId: station },
      ]);
      const answers: Answer[] = [
        { questionId: born.id, optionId: "fivekings" },
        { questionId: stationQuestion.id, optionId: station },
        { questionId: origin.id, optionId: origin.options[0].id },
      ];
      const third = questionAt(3, answers);
      answers.push({ questionId: third.id, optionId: third.options[0].id });
      const fourth = questionAt(4, answers);
      const raisedOption = fourth.options.find((option) => option.id === raisedId) ?? fourth.options[0];
      answers.push({ questionId: fourth.id, optionId: raisedOption.id });
      return questionAt(5, answers);
    }
    const sword = held("great", "sword");
    assert.match(sword.prompt, /weapon/i);
    assert.equal(sword.options.find((option) => option.points === 5)?.label, "A Valyrian steel sword");
    assert.equal(sword.options.find((option) => option.points === 4)?.label, "A very fine sword, and armor to match");
    const lesserSword = held("lesser", "sword");
    assert.equal(lesserSword.options.find((option) => option.points === 5)?.label, "A Valyrian steel sword");
    const rule = held("great", "rule");
    assert.equal(rule.options.find((option) => option.points === 5)?.label, "Dragon eggs");
    const coin = held("great", "coin");
    assert.match(coin.prompt, /rich/i);
    const study = held("great", "study");
    assert.match(study.prompt, /study/i);
    assert.equal(study.options.find((option) => option.points === 5)?.label, "A glass candle");
    const shop = held("trade", "own");
    assert.doesNotMatch(shop.prompt, /bent/i);
    assert.match(shop.prompt, /shop/i);
    for (const station of STATIONS) {
      const text = held(station, "sword").prompt + held(station, station === "trade" ? "own" : "no-such");
      assert.doesNotMatch(text, /what can you already do/i);
    }
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
