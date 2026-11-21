import { NextRequest, NextResponse } from "next/server";
import { PLACEMENT_QUESTIONS } from "@/app/course/content/placement";
import { evaluatePlacement } from "@/app/course/engine";
import { emptySave, parseSave } from "@/app/sejour/lib/save";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle, todayIsoInTz } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const bundle = await getUserBundle(user.id, user.timezone);
  return NextResponse.json({
    questions: PLACEMENT_QUESTIONS,
    course: bundle.course,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: { answers?: Record<string, string>; forceStartAnyway?: boolean; resetToPending?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  const bundle = await getUserBundle(user.id, user.timezone);

  if (body.resetToPending) {
    bundle.course.placementStatus = "pending";
    bundle.course.placementScore = null;
    await saveUserBundle(user.id, bundle);
    return NextResponse.json({ ok: true, course: bundle.course });
  }

  const answers = body.answers ?? {};
  const evaluation = evaluatePlacement(answers, Boolean(body.forceStartAnyway));
  const nowIso = new Date().toISOString();

  const fresh = bundle.course.currentDay <= 1 && bundle.course.lessonsCompleted.length === 0;
  bundle.course.placementScore = evaluation.scorePercent;
  bundle.course.placementStatus = "passed";
  bundle.course.skippedWeeks = 0;
  if (fresh) {
    bundle.course.startDate = todayIsoInTz(user.timezone);
    bundle.course.currentDay = 1;
    bundle.course.supportBand = "high";
    bundle.course.unlockedPlaces = ["boulangerie"];
  }

  if (fresh) {
    bundle.course.lessonsCompleted = [];
    bundle.course.dayPlans = {};
    const sejourSave = parseSave(bundle.saves.sejour?.save) ?? emptySave();
    sejourSave.day = 0;
    sejourSave.teacherUnlocked = ["boulangerie"];
    sejourSave.unlocked = ["boulangerie"];
    sejourSave.offered = ["boulangerie"];
    bundle.saves.sejour = { save: sejourSave, updatedAt: nowIso };
  }

  bundle.exams.push({
    id: `exam_placement_${Date.now()}`,
    kind: "placement",
    itemIds: PLACEMENT_QUESTIONS.map((q) => q.id),
    answers,
    scores: {
      overall: evaluation.scorePercent,
      bySection: { language: evaluation.scorePercent },
      feedback: evaluation.summary,
    },
    startedAt: nowIso,
    finishedAt: nowIso,
  });

  bundle.teacherNotes.push({
    id: `note_placement_${Date.now()}`,
    day: evaluation.startDay,
    kind: "exam_review",
    body: `Week 0 Placement Check: ${evaluation.totalCorrect}/${evaluation.totalQuestions} (${evaluation.scorePercent}%). Status: ${evaluation.status}. ${evaluation.summary}`,
    createdAt: nowIso,
  });

  await saveUserBundle(user.id, bundle);

  return NextResponse.json({
    ok: true,
    evaluation,
    course: bundle.course,
  });
}
