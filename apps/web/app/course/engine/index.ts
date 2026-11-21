import { EXAM_BANK, EXAM_ITEM_BY_ID } from "@/app/course/content/exam-bank";
import { PLACEMENT_QUESTIONS } from "@/app/course/content/placement";
import { PROBES } from "@/app/course/content/probes";
import { VOCAB_BY_DOMAIN, VOCAB_ITEMS } from "@/app/course/content/vocab";
import { containsFrenchPhrase, frenchAnswersMatch, normalizeFrenchAnswer } from "@/app/course/engine/answers";

export {
  containsFrenchPhrase,
  examDayForKind,
  examKindAllowed,
  examKindForDay,
  frenchAnswersMatch,
  GRAMMAR_PASS_PERCENT,
  hideNpcText,
  normalizeFrenchAnswer,
  scoreVocabRecall,
  weightedExamPercent,
} from "@/app/course/engine/answers";
export type { ListeningMode } from "@/app/course/engine/answers";
import {
  VOCAB_DOMAINS,
  VOCAB_DOMAIN_LABELS,
  type CourseState,
  type ExamBankItem,
  type ProbeSpec,
  type SupportBand,
  type VocabDomain,
  type VocabItem,
  type VocabProgressRecord,
} from "@/app/course/types";
import type { PlaceId, SceneId } from "@/app/sejour/world/places";

export function addDaysIso(isoDate: string, daysToAdd: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + daysToAdd));
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenIso(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const t1 = Date.UTC(y1 || 2026, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2 || 2026, (m2 || 1) - 1, d2 || 1);
  return Math.round((t2 - t1) / 86_400_000);
}

export interface MilestoneInfo {
  week: 1 | 2 | 3 | 4;
  kind: "w1" | "w2" | "w3" | "w4";
  courseDay: 7 | 14 | 21 | 28;
  targetDate: string;
  label: string;
}

export function computeMilestones(startDate: string): MilestoneInfo[] {
  return [
    { week: 1, kind: "w1", courseDay: 7, targetDate: addDaysIso(startDate, 6), label: "Week 1 Exam: Arriving & Surviving" },
    { week: 2, kind: "w2", courseDay: 14, targetDate: addDaysIso(startDate, 13), label: "Week 2 Exam: Village & Food" },
    { week: 3, kind: "w3", courseDay: 21, targetDate: addDaysIso(startDate, 20), label: "Week 3 Exam: Making Friends" },
    { week: 4, kind: "w4", courseDay: 28, targetDate: addDaysIso(startDate, 27), label: "Week 4 Final A1 DELF Exam" },
  ];
}

export function updateStreakOnDayComplete(
  course: Pick<CourseState, "streak" | "bestStreak" | "lastCompletedDate">,
  todayIso: string,
): { streak: number; bestStreak: number; lastCompletedDate: string } {
  if (course.lastCompletedDate === todayIso) {
    return {
      streak: Math.max(1, course.streak),
      bestStreak: Math.max(1, course.bestStreak, course.streak),
      lastCompletedDate: todayIso,
    };
  }
  const diff = course.lastCompletedDate ? daysBetweenIso(course.lastCompletedDate, todayIso) : 999;
  const nextStreak = diff === 1 ? course.streak + 1 : 1;
  const nextBest = Math.max(course.bestStreak, nextStreak);
  return {
    streak: nextStreak,
    bestStreak: nextBest,
    lastCompletedDate: todayIso,
  };
}

/** Placement evaluation: tests only what this 4-week course teaches. */
export interface PlacementEvaluation {
  status: "passed" | "disqualified";
  totalCorrect: number;
  totalQuestions: number;
  scorePercent: number;
  byWeek: Record<1 | 2 | 3 | 4, { correct: number; total: number }>;
  skippedWeeks: number;
  startDay: number;
  skippedLessonDays: number[];
  initialUnlockedPlaces: PlaceId[];
  supportBand: SupportBand;
  summary: string;
}

export function evaluatePlacement(
  answers: Record<string, string>,
  forceStartAnyway = false,
): PlacementEvaluation {
  const byWeek: Record<1 | 2 | 3 | 4, { correct: number; total: number }> = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
    4: { correct: 0, total: 0 },
  };

  let totalCorrect = 0;
  for (const q of PLACEMENT_QUESTIONS) {
    byWeek[q.week].total += 1;
    const given = (answers[q.id] ?? "").trim();
    if (given === q.answer) {
      byWeek[q.week].correct += 1;
      totalCorrect += 1;
    }
  }

  const totalQuestions = PLACEMENT_QUESTIONS.length || 16;
  const scorePercent = Math.round((totalCorrect / totalQuestions) * 100);

  void forceStartAnyway;
  return {
    status: "passed",
    totalCorrect,
    totalQuestions,
    scorePercent,
    byWeek,
    skippedWeeks: 0,
    startDay: 1,
    skippedLessonDays: [],
    initialUnlockedPlaces: ["boulangerie"],
    supportBand: "high",
    summary: "You start on day 1 in Saint-Aubin. The score is noted, and the days themselves are not skipped.",
  };
}

/** Vocabulary coverage & SRS (Leitner boxes 0..5) */
export function isVocabItemCovered(rec: VocabProgressRecord | undefined): boolean {
  if (!rec) return false;
  return rec.box >= 2 || rec.usedInConvo || rec.correct >= 2;
}

export interface DomainCoverageSummary {
  domain: VocabDomain;
  label: string;
  week: 1 | 2 | 3 | 4;
  totalItems: number;
  coveredItems: number;
  coreTotal: number;
  coreCovered: number;
  percent: number;
  covered: boolean;
}

export function computeDomainCoverage(vocabMap: Record<string, VocabProgressRecord>): Record<VocabDomain, DomainCoverageSummary> {
  const out = {} as Record<VocabDomain, DomainCoverageSummary>;
  for (const domain of VOCAB_DOMAINS) {
    const items = VOCAB_BY_DOMAIN[domain] ?? [];
    const totalItems = items.length;
    const coreItems = items.filter((item) => item.core);
    let coveredItems = 0;
    let coreCovered = 0;
    for (const item of items) {
      if (isVocabItemCovered(vocabMap[item.id])) {
        coveredItems += 1;
        if (item.core) coreCovered += 1;
      }
    }
    const percent = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 0;
    const covered =
      totalItems > 0 &&
      coreCovered >= Math.ceil(coreItems.length * 0.7) &&
      coveredItems >= Math.ceil(totalItems * 0.6);

    out[domain] = {
      domain,
      label: VOCAB_DOMAIN_LABELS[domain].label,
      week: VOCAB_DOMAIN_LABELS[domain].week,
      totalItems,
      coveredItems,
      coreTotal: coreItems.length,
      coreCovered,
      percent,
      covered,
    };
  }
  return out;
}

export function updateVocabSrs(
  existing: VocabProgressRecord | undefined,
  itemId: string,
  correct: boolean,
  now = new Date(),
): VocabProgressRecord {
  const prev: VocabProgressRecord = existing ?? {
    itemId,
    box: 0,
    correct: 0,
    wrong: 0,
    lastSeenAt: null,
    nextDueAt: null,
    usedInConvo: false,
  };
  const nextBox = correct ? Math.min(5, prev.box + 1) : Math.max(0, prev.box - 1);
  const intervalsDays = [0, 1, 2, 4, 7, 14];
  const addDays = intervalsDays[nextBox] ?? 1;
  const nextDue = new Date(now.getTime() + addDays * 86_400_000).toISOString();

  return {
    itemId,
    box: nextBox,
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    lastSeenAt: now.toISOString(),
    nextDueAt: nextDue,
    usedInConvo: prev.usedInConvo,
  };
}

export function buildDailyVocabSession(params: {
  day: number;
  focusDomains: VocabDomain[];
  queuedIds: string[];
  vocabMap: Record<string, VocabProgressRecord>;
  limit?: number;
}): VocabItem[] {
  const limit = params.limit ?? 14;
  const nowMs = Date.now();
  const selected: VocabItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: VocabItem | undefined) => {
    if (!item || seen.has(item.id) || selected.length >= limit) return;
    seen.add(item.id);
    selected.push(item);
  };

  // 1. Words encountered during today's Séjour session
  for (const id of params.queuedIds) {
    const found = VOCAB_ITEMS.find((v) => v.id === id);
    pushItem(found);
  }

  // 2. Due SRS reviews
  for (const item of VOCAB_ITEMS) {
    const rec = params.vocabMap[item.id];
    if (!rec || !rec.nextDueAt) continue;
    if (new Date(rec.nextDueAt).getTime() <= nowMs && rec.box < 5) {
      pushItem(item);
    }
  }

  // 3. Uncovered core items in today's focus domains
  for (const domain of params.focusDomains) {
    for (const item of VOCAB_BY_DOMAIN[domain] ?? []) {
      if (item.core && !isVocabItemCovered(params.vocabMap[item.id])) {
        pushItem(item);
      }
    }
  }

  // 4. Other items in today's focus domains or current week
  const currentWeek = Math.min(4, Math.max(1, Math.ceil(params.day / 7))) as 1 | 2 | 3 | 4;
  for (const item of VOCAB_ITEMS) {
    if (params.focusDomains.includes(item.domain) || item.week <= currentWeek) {
      if (!isVocabItemCovered(params.vocabMap[item.id])) {
        pushItem(item);
      }
    }
  }

  // 5. Fallback to any remaining items
  for (const item of VOCAB_ITEMS) {
    pushItem(item);
  }

  return selected;
}

export function detectVocabUsedInLines(playerLines: readonly string[]): string[] {
  const combined = playerLines.join(" ");
  if (!normalizeFrenchAnswer(combined)) return [];
  const matched: string[] = [];
  const items = [...VOCAB_ITEMS].sort((a, b) => b.fr.length - a.fr.length);
  for (const item of items) {
    if (containsFrenchPhrase(combined, item.fr)) matched.push(item.id);
  }
  return matched;
}

/** A probe counts only after the learner produces the language it was aiming at. */
export function probeWasProduced(probe: ProbeSpec, playerLines: readonly string[]): boolean {
  const said = playerLines.join(" ");
  if (!normalizeFrenchAnswer(said)) return false;
  if (probe.expect) {
    try {
      if (new RegExp(probe.expect, "i").test(said)) return true;
    } catch {
      return false;
    }
  }
  if (probe.unlessDomain) {
    const ids = new Set(detectVocabUsedInLines(playerLines));
    return VOCAB_ITEMS.some((item) => item.domain === probe.unlessDomain && ids.has(item.id));
  }
  return false;
}

export function satisfiedProbeIds(params: {
  day: number;
  scene: SceneId;
  role?: string;
  slot?: number;
  playerLines: readonly string[];
  domainCoverage: Record<VocabDomain, DomainCoverageSummary>;
  lessonsCompleted: readonly string[];
  alreadyFiredProbeIds?: readonly string[];
}): string[] {
  return getFiringProbes(params)
    .filter((probe) => probeWasProduced(probe, params.playerLines))
    .map((probe) => probe.id);
}

export interface GrammarScore {
  correct: number;
  total: number;
  scorePercent: number;
  passed: boolean;
  mistakes: { prompt: string; said: string; correct: string }[];
}

export function scoreGrammarAnswers(
  exercises: readonly { id: string; prompt: string; answer: string; accept?: string[] }[],
  answers: Record<string, string>,
  passPercent = 70,
): GrammarScore {
  const mistakes: GrammarScore["mistakes"] = [];
  let correct = 0;
  for (const exercise of exercises) {
    const said = answers[exercise.id] ?? "";
    if (frenchAnswersMatch(said, exercise.answer, exercise.accept ?? [])) {
      correct += 1;
    } else {
      mistakes.push({
        prompt: exercise.prompt,
        said: said.trim().slice(0, 160),
        correct: exercise.answer,
      });
    }
  }
  const total = exercises.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, scorePercent, passed: scorePercent >= passPercent, mistakes };
}

/**
 * Deterministic Conversation Probe Engine:
 * If a vocab domain or grammar topic hasn't been covered yet and the player enters a matching scene
 * within the probe's day window, inject the probe's prompt into the target NPC!
 */
export function getFiringProbes(params: {
  day: number;
  scene: SceneId;
  role?: string;
  slot?: number; // 1, 2, or 3 in speedfriending
  domainCoverage: Record<VocabDomain, DomainCoverageSummary>;
  lessonsCompleted: readonly string[];
  alreadyFiredProbeIds?: readonly string[];
}): ProbeSpec[] {
  const firedSet = new Set(params.alreadyFiredProbeIds ?? []);
  const matches: ProbeSpec[] = [];

  for (const probe of PROBES) {
    if (firedSet.has(probe.id)) continue;
    if (probe.scene !== params.scene) continue;
    if (params.day < probe.days[0] || params.day > probe.days[1]) continue;

    if (probe.targetSlot !== undefined && params.slot !== undefined && probe.targetSlot !== params.slot) {
      continue;
    }
    if (probe.targetRole && params.role && probe.targetRole !== params.role) {
      continue;
    }

    let shouldFire = false;
    if (probe.unlessDomain) {
      const cov = params.domainCoverage[probe.unlessDomain];
      if (!cov || !cov.covered) shouldFire = true;
    }
    if (probe.unlessGrammar) {
      if (!params.lessonsCompleted.includes(probe.unlessGrammar)) shouldFire = true;
    }

    if (shouldFire) {
      matches.push(probe);
    }
  }

  // At most 1 deterministic probe per conversation so the NPC stays natural
  return matches.slice(0, 1);
}

/** Weekly Exam selection & validation from the pre-made A1 bank */
export function selectExamItemsDeterministically(
  kind: "w1" | "w2" | "w3" | "w4",
  weakDomains: readonly VocabDomain[] = [],
  previousItemIds: readonly string[] = [],
): ExamBankItem[] {
  const maxWeek = kind === "w1" ? 1 : kind === "w2" ? 2 : kind === "w3" ? 3 : 4;
  const quotas =
    kind === "w4"
      ? { listening: 5, reading: 5, language: 8, writing: 2 }
      : { listening: 4, reading: 4, language: 6, writing: 1 };

  const used = new Set(previousItemIds);
  const weakSet = new Set(weakDomains);

  const pool = EXAM_BANK.filter((item) => item.week <= maxWeek);
  const sortedPool = [...pool].sort((a, b) => {
    const aUnused = used.has(a.id) ? 0 : 1;
    const bUnused = used.has(b.id) ? 0 : 1;
    if (aUnused !== bUnused) return bUnused - aUnused;

    const aCurrentWeek = a.week === maxWeek ? 1 : 0;
    const bCurrentWeek = b.week === maxWeek ? 1 : 0;
    if (aCurrentWeek !== bCurrentWeek) return bCurrentWeek - aCurrentWeek;

    const aWeak = a.domains.some((d) => weakSet.has(d)) ? 1 : 0;
    const bWeak = b.domains.some((d) => weakSet.has(d)) ? 1 : 0;
    return bWeak - aWeak;
  });

  const out: ExamBankItem[] = [];
  for (const section of ["listening", "reading", "language", "writing"] as const) {
    const needed = quotas[section];
    const sectionItems = sortedPool.filter((i) => i.section === section).slice(0, needed);
    out.push(...sectionItems);
  }
  return out;
}

export function validateTeacherExamSelection(
  candidateIds: readonly string[],
  kind: "w1" | "w2" | "w3" | "w4",
  weakDomains: readonly VocabDomain[] = [],
  previousItemIds: readonly string[] = [],
): ExamBankItem[] {
  const maxWeek = kind === "w1" ? 1 : kind === "w2" ? 2 : kind === "w3" ? 3 : 4;
  const validItems: ExamBankItem[] = [];
  const seen = new Set<string>();

  for (const id of candidateIds) {
    if (seen.has(id)) continue;
    const item = EXAM_ITEM_BY_ID[id];
    if (!item || item.week > maxWeek) continue;
    seen.add(id);
    validItems.push(item);
  }

  // If the LLM didn't return enough valid items across all sections, fill/fallback deterministically
  const fallback = selectExamItemsDeterministically(kind, weakDomains, previousItemIds);
  if (validItems.length < 10) return fallback;

  for (const fb of fallback) {
    if (validItems.length >= fallback.length) break;
    if (!seen.has(fb.id)) {
      seen.add(fb.id);
      validItems.push(fb);
    }
  }
  return validItems;
}
