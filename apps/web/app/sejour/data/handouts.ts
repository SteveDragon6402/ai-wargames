import { GRAMMAR_BY_DAY, GRAMMAR_BY_ID, GRAMMAR_LESSONS } from "@/app/course/content/grammar";
import type { Gap } from "../lib/save";
import type { LessonSpec } from "../world/lessons";

export interface Handout {
  id: string;
  title: string;
  body: string;
}

/** The 28-day grammar course is the only syllabus the coach and the reviewer name. */
export const HANDOUTS: Handout[] = GRAMMAR_LESSONS.map((lesson) => ({
  id: lesson.id,
  title: lesson.title,
  body: `${lesson.subtitle}. ${lesson.useItPrompt}`,
}));

export const HANDOUT_IDS = HANDOUTS.map((handout) => handout.id);

export const HANDOUT_BY_ID: Record<string, Handout> = Object.fromEntries(HANDOUTS.map((handout) => [handout.id, handout]));

export function villageLessonFromGrammar(day: number): LessonSpec {
  const lesson = GRAMMAR_BY_DAY[Math.max(1, Math.min(28, day))] ?? GRAMMAR_LESSONS[0];
  return {
    id: lesson.id,
    level: lesson.week,
    title: lesson.title,
    offer: lesson.subtitle,
    teach: `${lesson.explanation[0] ?? lesson.subtitle} ${lesson.useItPrompt}`,
    examples: lesson.examples.slice(0, 2),
    skills: lesson.skills,
  };
}

export function villageLessonById(id: string): LessonSpec | null {
  const lesson = GRAMMAR_BY_ID[id];
  if (!lesson) return null;
  return villageLessonFromGrammar(lesson.day);
}

/** A short brief so Madame teaches today's course lesson, not a second syllabus. */
export function levelBrief(mastered: readonly string[], gaps: readonly Gap[], courseDay = 1): string {
  const today = villageLessonFromGrammar(courseDay);
  const known = mastered.length
    ? `They already manage these course lessons: ${mastered.join(", ")}. Do not reteach those unless they ask.`
    : "You do not know their level yet. Ask, lightly, whether they have spoken French, and listen.";
  const waiting = gaps.length
    ? `Open gaps, and only these course lessons: ${gaps.map((gap) => `${gap.id} (${gap.note})`).join("; ")}.`
    : "No gaps are open. Do not bring up an old mistake as if it were still waiting.";
  return `${known} ${waiting} Today's lesson is ${today.id}: ${today.title}. ${today.teach} Vous is for you, for Gérard, for Martine at the bakery, for the pharmacist, for waiters at L'Auberge, and anyone older. Tu is only for a young person who has already used tu.`;
}
