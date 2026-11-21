import { NextRequest, NextResponse } from "next/server";
import { EXAM_ITEM_BY_ID } from "@/app/course/content/exam-bank";
import type { ExamSection } from "@/app/course/types";
import { examKindAllowed, examKindForDay, normalizeFrenchAnswer, weightedExamPercent } from "@/app/course/engine";
import { teacherGradeWriting, teacherSelectWeeklyExam } from "@/lib/teacher";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const bundle = await getUserBundle(user.id, user.timezone);
  const weekNum = Math.min(4, Math.max(1, Math.ceil(bundle.course.currentDay / 7)));
  const due = examKindForDay(bundle.course.currentDay);
  const rawKind = req.nextUrl.searchParams.get("kind");
  const kind: "w1" | "w2" | "w3" | "w4" =
    rawKind === "w1" || rawKind === "w2" || rawKind === "w3" || rawKind === "w4" ? rawKind : due ?? "w1";
  const hasAttempt = bundle.exams.some((attempt) => attempt.kind === kind);
  if (!examKindAllowed(bundle.course.currentDay, kind, hasAttempt)) {
    return NextResponse.json(
      {
        error: due
          ? `Today is the ${due.toUpperCase()} exam.`
          : `The weekly exam opens on day ${weekNum * 7}.`,
        kind: due,
        locked: true,
      },
      { status: 403 },
    );
  }

  const entry = bundle.course.dayPlans[bundle.course.currentDay];
  if (bundle.course.currentDay === (kind === "w1" ? 7 : kind === "w2" ? 14 : kind === "w3" ? 21 : 28)) {
    if (!entry?.grammarDoneAt || !entry.sejourDoneAt) {
      return NextResponse.json(
        {
          error: "Finish the morning lesson and the village day before sitting the exam.",
          locked: true,
          kind,
        },
        { status: 403 },
      );
    }
  }

  const items = await teacherSelectWeeklyExam(bundle, kind);
  return NextResponse.json({ kind, week: weekNum, items });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: {
    kind?: "w1" | "w2" | "w3" | "w4";
    itemIds?: string[];
    answers?: Record<string, string>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  const bundle = await getUserBundle(user.id, user.timezone);
  const kind = body.kind ?? "w1";
  const hasAttempt = bundle.exams.some((attempt) => attempt.kind === kind);
  if (!examKindAllowed(bundle.course.currentDay, kind, hasAttempt)) {
    return NextResponse.json({ error: "This exam is not open today." }, { status: 403 });
  }
  const examDay = kind === "w1" ? 7 : kind === "w2" ? 14 : kind === "w3" ? 21 : 28;
  const entryForGate = bundle.course.dayPlans[examDay] ?? bundle.course.dayPlans[bundle.course.currentDay];
  if (
    bundle.course.currentDay === examDay &&
    (!entryForGate?.grammarDoneAt || !entryForGate.sejourDoneAt)
  ) {
    return NextResponse.json(
      { error: "Finish the morning lesson and the village day before sitting the exam." },
      { status: 403 },
    );
  }
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  const answers = body.answers ?? {};

  const sectionTotals: Record<ExamSection, { earned: number; max: number }> = {
    listening: { earned: 0, max: 0 },
    reading: { earned: 0, max: 0 },
    language: { earned: 0, max: 0 },
    writing: { earned: 0, max: 0 },
  };
  const writingFeedbacks: string[] = [];

  for (const id of itemIds) {
    const item = EXAM_ITEM_BY_ID[id];
    if (!item) continue;
    const given = (answers[id] ?? "").trim();

    if (item.section === "writing") {
      sectionTotals.writing.max += 100;
      const graded = await teacherGradeWriting({
        prompt: item.prompt,
        rubric: item.rubric ?? ["Clear A1 French message"],
        answer: given,
      });
      sectionTotals.writing.earned += graded.scorePercent;
      writingFeedbacks.push(graded.feedback);
    } else {
      sectionTotals[item.section].max += 1;
      const isCorrect =
        given === item.answer ||
        (item.answer ? normalizeFrenchAnswer(given) === normalizeFrenchAnswer(item.answer) : false);
      if (isCorrect) {
        sectionTotals[item.section].earned += 1;
      } else if (given) {
        bundle.errors.push({
          id: `err_exam_${Date.now()}_${id}`,
          day: bundle.course.currentDay,
          topic: item.topics[0] ?? item.section,
          said: given.slice(0, 120),
          correct: (item.answer ?? "").slice(0, 120),
          source: `exam_${kind}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  const bySection: Partial<Record<ExamSection, number>> = {};
  let earnedPoints = 0;
  let maxPoints = 0;
  for (const sec of ["listening", "reading", "language", "writing"] as const) {
    const t = sectionTotals[sec];
    if (t.max > 0) {
      bySection[sec] = Math.round((t.earned / t.max) * 100);
      if (sec === "writing") {
        const writingItems = itemIds.filter((id) => EXAM_ITEM_BY_ID[id]?.section === "writing").length;
        earnedPoints += t.earned / 100;
        maxPoints += writingItems;
      } else {
        earnedPoints += t.earned;
        maxPoints += t.max;
      }
    }
  }
  const overall = weightedExamPercent([{ points: earnedPoints, max: maxPoints }]);

  // Exam results adjust how the student performs / how NPCs support them
  const bands = ["high", "medium", "low"] as const;
  const bandIndex = bands.indexOf(bundle.course.supportBand);
  if (overall >= 80 && bandIndex >= 0 && bandIndex < bands.length - 1) {
    bundle.course.supportBand = bands[bandIndex + 1];
  } else if (overall < 55) {
    bundle.course.supportBand = "high";
  }

  const nowIso = new Date().toISOString();
  const feedback =
    writingFeedbacks.join(" ") ||
    (overall >= 75
      ? "Bravo ! Strong performance across the paper. Tomorrow's French stays at the same kind of pace, with a little less English if you were already comfortable."
      : overall >= 50
        ? "Solid A1 progress! Your teacher has noted a few grammar areas to reinforce in next week's lessons."
        : "Keep going! Your teacher has scheduled targeted grammar & vocabulary review for the coming days and kept extra English support turned on.");

  const attempt = {
    id: `exam_${kind}_${Date.now()}`,
    kind,
    itemIds,
    answers,
    scores: {
      overall,
      bySection,
      feedback,
    },
    startedAt: nowIso,
    finishedAt: nowIso,
  };
  bundle.exams.push(attempt);

  bundle.teacherNotes.push({
    id: `note_exam_${Date.now()}`,
    day: bundle.course.currentDay,
    kind: "exam_review",
    body: `Weekly Exam ${kind.toUpperCase()} completed: ${overall}% overall (Listening ${bySection.listening ?? 0}%, Reading ${bySection.reading ?? 0}%, Language ${bySection.language ?? 0}%, Writing ${bySection.writing ?? 0}%). Support band adjusted to '${bundle.course.supportBand}'.`,
    createdAt: nowIso,
  });

  const entry = bundle.course.dayPlans[examDay];
  if (entry && bundle.course.currentDay === examDay) {
    entry.examDoneAt = nowIso;
    if (entry.grammarDoneAt && entry.sejourDoneAt && !entry.completedAt) {
      entry.completedAt = nowIso;
      if (bundle.course.currentDay < 28) {
        bundle.course.currentDay += 1;
      }
    }
  }

  await saveUserBundle(user.id, bundle);

  return NextResponse.json({
    ok: true,
    attempt,
    course: bundle.course,
  });
}
