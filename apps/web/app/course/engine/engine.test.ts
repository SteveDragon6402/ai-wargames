import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailyVocabSession,
  computeDomainCoverage,
  detectVocabUsedInLines,
  evaluatePlacement,
  examKindAllowed,
  getFiringProbes,
  hideNpcText,
  probeWasProduced,
  scoreGrammarAnswers,
  scoreVocabRecall,
  updateStreakOnDayComplete,
  updateVocabSrs,
  weightedExamPercent,
} from "./index";
import { dinnerAsksAboutSleep, englishHelpWords, learnerIsLost, phrasesBeforeConfusion, replyNeedsEnglish, simpleFrenchFor } from "./pace";
import { buildPracticeDeck } from "../../sejour/lib/practice-deck";
import { PROBES } from "../content/probes";
import { PLACEMENT_QUESTIONS } from "../content/placement";
import { GRAMMAR_BY_ID, GRAMMAR_LESSONS } from "../content/grammar";
import { frenchAnswerIsAlmost, frenchAnswersMatch, promptWithoutGiveaway, shuffleTiles } from "./answers";
import { fillGrammarLesson } from "./lesson-fill";
import { VOCAB_ITEMS } from "../content/vocab";
import { EXAM_BANK } from "../content/exam-bank";
import type { VocabProgressRecord } from "../types";

describe("4-week curriculum content integrity", () => {
  it("has all 28 daily grammar lessons, 300+ vocab items, 16 placement questions, and 100+ exam items", () => {
    assert.equal(GRAMMAR_LESSONS.length, 28);
    assert.ok(VOCAB_ITEMS.length >= 300);
    assert.equal(PLACEMENT_QUESTIONS.length, 16);
    assert.ok(EXAM_BANK.length >= 96);
  });
});

describe("Week 0 placement evaluation & disqualification rule", () => {
  it("starts a complete beginner on Day 1 without disqualification", () => {
    const res = evaluatePlacement({});
    assert.equal(res.totalCorrect, 0);
    assert.equal(res.skippedWeeks, 0);
    assert.equal(res.startDay, 1);
    assert.equal(res.status, "passed");
  });

  it("keeps a strong score on day 1", () => {
    const answers: Record<string, string> = {};
    for (const q of PLACEMENT_QUESTIONS) answers[q.id] = q.answer;
    const res = evaluatePlacement(answers);
    assert.equal(res.byWeek[1].correct, 4);
    assert.equal(res.skippedWeeks, 0);
    assert.equal(res.startDay, 1);
    assert.equal(res.status, "passed");
    assert.deepEqual(res.initialUnlockedPlaces, ["boulangerie"]);
  });
});

describe("deterministic conversation probes & SRS vocabulary tracking", () => {
  it("injects the origin probe at Speed Friending Partner #2 on Day 5 when countries_nationality is uncovered", () => {
    const vocabMap: Record<string, VocabProgressRecord> = {};
    const domainCoverage = computeDomainCoverage(vocabMap);
    const probes = getFiringProbes({
      day: 5,
      scene: "speedfriending",
      slot: 2,
      domainCoverage,
      lessonsCompleted: [],
    });
    assert.equal(probes.length, 1);
    assert.equal(probes[0]?.id, "sf_origin");
    assert.ok(probes[0]?.note.includes("Tu viens d'où"));
  });

  it("suppresses the origin probe once countries_nationality vocabulary is covered", () => {
    const vocabMap: Record<string, VocabProgressRecord> = {};
    for (const v of VOCAB_ITEMS.filter((item) => item.domain === "countries_nationality")) {
      vocabMap[v.id] = updateVocabSrs(vocabMap[v.id], v.id, true);
      vocabMap[v.id] = updateVocabSrs(vocabMap[v.id], v.id, true);
    }
    const domainCoverage = computeDomainCoverage(vocabMap);
    assert.equal(domainCoverage.countries_nationality.covered, true);
    const probes = getFiringProbes({
      day: 5,
      scene: "speedfriending",
      slot: 2,
      domainCoverage,
      lessonsCompleted: [],
    });
    assert.notEqual(probes[0]?.id, "sf_origin");
  });

  it("detects vocabulary used in conversation and updates streak on day completion", () => {
    const detected = detectVocabUsedInLines(["Bonjour Madame, je voudrais une baguette et un croissant s'il vous plaît"]);
    assert.ok(detected.length >= 2);

    const deck = buildDailyVocabSession({
      day: 1,
      focusDomains: ["greetings_politeness", "bakery_cafe"],
      queuedIds: [],
      vocabMap: {},
      limit: 12,
    });
    assert.equal(deck.length, 12);

    const s1 = updateStreakOnDayComplete({ streak: 0, bestStreak: 0, lastCompletedDate: null }, "2026-11-14");
    assert.equal(s1.streak, 1);
    const s2 = updateStreakOnDayComplete(s1, "2026-11-15");
    assert.equal(s2.streak, 2);
    assert.equal(s2.bestStreak, 2);
  });

  it("credits a French word only on its own boundaries, never an English gloss", () => {
    const pain = VOCAB_ITEMS.find((item) => item.id === "bc_pain");
    assert.ok(pain);
    assert.equal(scoreVocabRecall(pain!, "bread"), false);
    assert.equal(scoreVocabRecall(pain!, "pain"), true);
    assert.equal(scoreVocabRecall(pain!, "le pain"), true);
    const copain = detectVocabUsedInLines(["Je vois mon copain à la campagne"]);
    assert.equal(copain.includes("bc_pain"), false);
    const bread = detectVocabUsedInLines(["Je voudrais du pain"]);
    assert.equal(bread.includes("bc_pain"), true);
  });

  it("keeps a grammar lesson open under 70 percent and weights an exam by item", () => {
    const exercises = Array.from({ length: 10 }, (_, index) => ({
      id: `ex_${index}`,
      prompt: "Say it",
      answer: "bonjour",
    }));
    const six = Object.fromEntries(exercises.slice(0, 6).map((item) => [item.id, "bonjour"]));
    const seven = Object.fromEntries(exercises.slice(0, 7).map((item) => [item.id, "bonjour"]));
    assert.equal(scoreGrammarAnswers(exercises, six).passed, false);
    assert.equal(scoreGrammarAnswers(exercises, seven).passed, true);
    const weighted = weightedExamPercent([
      { points: 4, max: 4 },
      { points: 0, max: 1 },
    ]);
    assert.equal(weighted, 80);
    assert.notEqual(weighted, Math.round((100 + 0) / 2));
    assert.equal(examKindAllowed(3, "w1", false), false);
    assert.equal(examKindAllowed(7, "w1", false), true);
    assert.equal(examKindAllowed(8, "w1", false), false);
    assert.equal(examKindAllowed(8, "w1", true), true);
  });

  it("starts in reading and hides only familiar talk, and only retires a probe the learner produced", () => {
    assert.equal(hideNpcText(1, "host", "auto"), false);
    assert.equal(hideNpcText(8, "host", "auto"), true);
    assert.equal(hideNpcText(8, "meal", "auto"), false);
    assert.equal(hideNpcText(8, "homemeal", "auto"), false);
    assert.equal(hideNpcText(3, "boulangerie", "auto", 1), false);
    assert.equal(hideNpcText(3, "boulangerie", "auto", 2), true);
    assert.equal(hideNpcText(15, "pharmacie", "auto", 0), false);
    assert.equal(hideNpcText(15, "cinema", "auto", 4), false);
    assert.equal(hideNpcText(1, "host", "off"), false);
    assert.equal(hideNpcText(3, "epicerie", "on", 0), true);

    const avoir = PROBES.find((probe) => probe.id === "host_avoir_hunger_age");
    const bakery = PROBES.find((probe) => probe.id === "bakery_pastry_choice");
    assert.ok(avoir && bakery);
    assert.equal(probeWasProduced(avoir!, ["hello"]), false);
    assert.equal(probeWasProduced(avoir!, ["J'ai faim"]), true);
    assert.equal(probeWasProduced(bakery!, ["mon copain"]), false);
    assert.equal(probeWasProduced(bakery!, ["Je voudrais du pain"]), true);
  });

  it("hears a request to slow down and keeps the French that came just before it", () => {
    assert.equal(learnerIsLost("I don't understand"), true);
    assert.equal(learnerIsLost("Je ne comprends pas"), true);
    assert.equal(learnerIsLost("Bonjour madame"), false);
    const phrases = phrasesBeforeConfusion([
      { role: "them", text: "Dites-moi, ça va ce matin ?" },
      { role: "you", text: "I don't understand" },
    ]);
    assert.equal(phrases[0]?.fr.includes("ça va"), true);
  });

  it("keeps day-1 English on a short French line and notices a French-only reply", () => {
    assert.equal(simpleFrenchFor("I don't understand all that"), "Je ne comprends pas.");
    assert.equal(simpleFrenchFor("Bonjour madame"), null);
    assert.equal(replyNeedsEnglish("Vous avez bien dormi ? Le lit est confortable."), true);
    assert.equal(replyNeedsEnglish("Don't worry. That means hello. Say: bonjour."), false);
    assert.equal(englishHelpWords("Bonjour ! Qu'est-ce qui vous ferait plaisir ?"), 0);
    assert.equal(englishHelpWords("You want the baguette?"), 2);
    assert.equal(dinnerAsksAboutSleep("Vous avez bien dormi ?"), true);
    assert.equal(dinnerAsksAboutSleep("Le pain est chaud. Comment était la journée ?"), false);
  });
});

describe("daily practice deck", () => {
  it("starts with more French-to-English and puts review lines into say-it-in-French", () => {
    const deck = buildPracticeDeck(1, [{ fr: "Je ne comprends pas.", en: "I don't understand" }]);
    const from = deck.filter((card) => card.direction === "from").length;
    const to = deck.filter((card) => card.direction === "to").length;
    assert.ok(from >= to);
    const drilled = deck.find((card) => card.fr === "Je ne comprends pas.");
    assert.equal(drilled?.direction, "to");
    const later = buildPracticeDeck(21, []);
    const laterTo = later.filter((card) => card.direction === "to").length;
    const laterFrom = later.filter((card) => card.direction === "from").length;
    assert.ok(laterTo >= laterFrom);
  });
});

describe("grammar answers", () => {
  it("treats a missing accent as the right answer", () => {
    assert.equal(
      frenchAnswersMatch("Bonjour Madame, je suis pret", "Bonjour Madame, je suis prêt."),
      true,
    );
    assert.equal(
      frenchAnswerIsAlmost("Bonjour Madame, je suis pret", "Bonjour Madame, je suis prêt."),
      false,
    );
  });

  it("accepts Merci when the stored line is Merci.", () => {
    assert.equal(frenchAnswersMatch("Merci", "Merci."), true);
    assert.equal(frenchAnswersMatch("Merci.", "Merci"), true);
    assert.equal(frenchAnswerIsAlmost("Merci", "Merci."), false);
  });

  it("takes the French answer out of a prompt that already translated it", () => {
    const enchanté = promptWithoutGiveaway(
      "Enchanté means nice to meet you. You just heard it. Someone tells you their name. What do you say?",
      "Enchanté",
    );
    assert.equal(enchanté.toLowerCase().includes("enchante"), false);
    assert.equal(enchanté.includes("What do you say?"), true);
    const hinted = promptWithoutGiveaway(
      "Say that you learned a lot. Hint: J'ai beaucoup appris means I learned a lot.",
      "J'ai beaucoup appris.",
    );
    assert.equal(hinted, "Say that you learned a lot.");
  });

  it("calls a one-letter miss Almost", () => {
    assert.equal(frenchAnswerIsAlmost("je m'apele", "je m'appelle"), true);
    assert.equal(frenchAnswerIsAlmost("m'apele", "m'appelle"), true);
    assert.equal(frenchAnswerIsAlmost("je m'apele", "m'appelle"), true);
    assert.equal(frenchAnswersMatch("je m'apele", "je m'appelle"), false);
    assert.equal(frenchAnswerIsAlmost("au revoir", "Enchanté"), false);
  });

  it("jumbles tile order and fills être from the learner's name", () => {
    const lesson = fillGrammarLesson(GRAMMAR_BY_ID.w1d1_greetings_etre, {
      name: { key: "name", value: "Aryan", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    const tiles = lesson.exercises.find((exercise) => exercise.kind === "tiles");
    assert.ok(tiles);
    assert.equal(tiles.answer.includes("Aryan"), true);
    assert.equal(JSON.stringify(lesson).includes("{{"), false);
    const shown = shuffleTiles(tiles.options ?? [], tiles.id);
    assert.notDeepEqual(shown, tiles.options);
    assert.deepEqual([...shown].sort(), [...(tiles.options ?? [])].sort());
    const ready = lesson.exercises.find((exercise) => exercise.id === "w1d1_ex7");
    assert.equal(ready?.prompt.includes("ready"), true);
    assert.equal(ready?.prompt.toLowerCase().includes("prêt"), true);
  });
});
