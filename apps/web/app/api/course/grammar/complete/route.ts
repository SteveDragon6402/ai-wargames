import { NextRequest, NextResponse } from "next/server";
import { GRAMMAR_BY_DAY, GRAMMAR_BY_ID } from "@/app/course/content/grammar";
import { GRAMMAR_PASS_PERCENT, scoreGrammarAnswers } from "@/app/course/engine";
import { planCourseDay } from "@/lib/teacher";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: {
    day?: number;
    lessonId?: string;
    answers?: Record<string, string>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const bundle = await getUserBundle(user.id, user.timezone);
  const day = body.day ?? bundle.course.currentDay;
  if (!bundle.course.dayPlans[day]) {
    const planned = await planCourseDay(bundle, day);
    bundle.course.dayPlans[day] = {
      plan: planned,
      grammarDoneAt: null,
      sejourDoneAt: null,
      vocabDoneAt: null,
      examDoneAt: null,
      completedAt: null,
    };
  }

  const now = new Date().toISOString();
  const entry = bundle.course.dayPlans[day]!;
  const lessonId = body.lessonId || entry.plan.lessonId || GRAMMAR_BY_DAY[day]?.id || "w1d1_greetings_etre";
  const lesson = GRAMMAR_BY_ID[lessonId] ?? GRAMMAR_BY_DAY[day];
  const remediation = entry.plan.remediationLessonIds
    .map((id) => GRAMMAR_BY_ID[id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .flatMap((item) => item.exercises.slice(0, 2));
  const exercises = [...(lesson?.exercises ?? []), ...remediation];
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const scored = scoreGrammarAnswers(exercises, answers, GRAMMAR_PASS_PERCENT);

  if (scored.passed) {
    entry.grammarDoneAt = now;
    if (lesson && !bundle.course.lessonsCompleted.includes(lesson.id)) {
      bundle.course.lessonsCompleted.push(lesson.id);
    }
  }

  for (const mistake of scored.mistakes.filter((item) => item.said).slice(0, 8)) {
    bundle.errors.push({
      id: `err_gram_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      day,
      topic: lesson?.title || lessonId,
      said: mistake.said,
      correct: mistake.correct.slice(0, 160),
      source: "grammar_lesson",
      createdAt: now,
    });
  }

  bundle.teacherNotes.push({
    id: `note_gram_${Date.now()}`,
    day,
    kind: "scribe",
    body: scored.passed
      ? `Passed Day ${day} grammar (${lesson?.title ?? lessonId}) at ${scored.scorePercent}%.`
      : `Day ${day} grammar (${lesson?.title ?? lessonId}) scored ${scored.scorePercent}%, under the ${GRAMMAR_PASS_PERCENT}% bar. The lesson stays open so it can come up again in the village.`,
    createdAt: now,
  });

  await saveUserBundle(user.id, bundle);
  return NextResponse.json({
    ok: true,
    passed: scored.passed,
    scorePercent: scored.scorePercent,
    correct: scored.correct,
    total: scored.total,
    passPercent: GRAMMAR_PASS_PERCENT,
    dayEntry: entry,
    course: bundle.course,
  });
}
