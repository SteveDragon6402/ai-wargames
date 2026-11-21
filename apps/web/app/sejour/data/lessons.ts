import { CURRICULUM, type LessonSpec } from "../world/lessons";

export type Lesson = LessonSpec;

export const LESSONS: Lesson[] = CURRICULUM;

export function lessonForDay(day: number): Lesson {
  const index = (Math.max(1, day) - 1) % LESSONS.length;
  return LESSONS[index];
}
