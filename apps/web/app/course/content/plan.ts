import type { PlaceId } from "@/app/sejour/world/places";
import type { DayPlan, VocabDomain } from "../types";
import { GRAMMAR_BY_DAY, GRAMMAR_LESSONS } from "./grammar";

export interface CurriculumDayTemplate {
  day: number;
  week: 1 | 2 | 3 | 4;
  grammarLessonId: string;
  grammarTitle: string;
  targetDomains: VocabDomain[];
  unlockedPlaces: PlaceId[];
  unlockedEvents: ("family" | "sick")[];
  examWeek?: 1 | 2 | 3 | 4;
  defaultFocusNote: string;
}

const PLACES_BY_DAY: Record<number, PlaceId[]> = {
  1: ["boulangerie"],
  2: ["boulangerie", "epicerie"],
  3: ["boulangerie", "epicerie", "speedfriending"],
  5: ["boulangerie", "epicerie", "speedfriending", "bistro"],
  8: ["boulangerie", "epicerie", "speedfriending", "bistro", "supermarche"],
  11: ["boulangerie", "epicerie", "speedfriending", "bistro", "supermarche", "auberge"],
};

function cumulativePlacesForDay(day: number): PlaceId[] {
  let current: PlaceId[] = ["boulangerie"];
  for (let d = 1; d <= day; d++) {
    if (PLACES_BY_DAY[d]) {
      current = PLACES_BY_DAY[d];
    }
  }
  return [...current];
}

function cumulativeEventsForDay(day: number): ("family" | "sick")[] {
  const out: ("family" | "sick")[] = [];
  if (day >= 18) out.push("family");
  if (day >= 25) out.push("sick");
  return out;
}

export const DEFAULT_CURRICULUM_PLAN: CurriculumDayTemplate[] = Array.from(
  { length: 28 },
  (_, idx) => {
    const day = idx + 1;
    const week = (Math.ceil(day / 7) as 1 | 2 | 3 | 4);
    const lesson = GRAMMAR_BY_DAY[day] ?? GRAMMAR_LESSONS[0];
    const examWeek = day % 7 === 0 ? ((day / 7) as 1 | 2 | 3 | 4) : undefined;
    return {
      day,
      week,
      grammarLessonId: lesson.id,
      grammarTitle: lesson.title,
      targetDomains: lesson.domains,
      unlockedPlaces: cumulativePlacesForDay(day),
      unlockedEvents: cumulativeEventsForDay(day),
      examWeek,
      defaultFocusNote: lesson.useItPrompt,
    };
  },
);

export const WEEK_LESSON_POOLS: Record<1 | 2 | 3 | 4, string[]> = {
  1: GRAMMAR_LESSONS.filter((l) => l.week === 1).map((l) => l.id),
  2: GRAMMAR_LESSONS.filter((l) => l.week === 2).map((l) => l.id),
  3: GRAMMAR_LESSONS.filter((l) => l.week === 3).map((l) => l.id),
  4: GRAMMAR_LESSONS.filter((l) => l.week === 4).map((l) => l.id),
};

export function getDefaultDayPlan(day: number): DayPlan {
  const clamped = Math.max(1, Math.min(28, day));
  const tpl = DEFAULT_CURRICULUM_PLAN[clamped - 1];
  const examDue =
    tpl.examWeek === 1
      ? "w1"
      : tpl.examWeek === 2
      ? "w2"
      : tpl.examWeek === 3
      ? "w3"
      : tpl.examWeek === 4
      ? "w4"
      : null;

  return {
    day: clamped,
    week: tpl.week,
    lessonId: tpl.grammarLessonId,
    remediationLessonIds: [],
    personalIntro: tpl.defaultFocusNote,
    unlockedPlaces: [...tpl.unlockedPlaces],
    unlockedEvents: [...tpl.unlockedEvents],
    conversationNotes: [],
    vocabFocusDomains: [...tpl.targetDomains],
    examDue,
  };
}
