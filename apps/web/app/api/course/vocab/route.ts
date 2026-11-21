import { NextRequest, NextResponse } from "next/server";
import { VOCAB_ITEMS } from "@/app/course/content/vocab";
import {
  buildDailyVocabSession,
  computeDomainCoverage,
  scoreVocabRecall,
  updateStreakOnDayComplete,
  updateVocabSrs,
} from "@/app/course/engine";
import { planCourseDay } from "@/lib/teacher";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle, todayIsoInTz } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const bundle = await getUserBundle(user.id, user.timezone);
  const day = bundle.course.currentDay;
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
    await saveUserBundle(user.id, bundle);
  }

  const entry = bundle.course.dayPlans[day]!;
  const lockedReason = !entry.grammarDoneAt
    ? "Finish today's grammar lesson before the evening recall."
    : !entry.sejourDoneAt
      ? "Spend the day in Saint-Aubin and say something in French before the evening recall."
      : "";
  const items = buildDailyVocabSession({
    day,
    focusDomains: entry.plan.vocabFocusDomains,
    queuedIds: bundle.course.queuedDayVocabIds,
    vocabMap: bundle.vocab,
    limit: 12,
  });

  const domainCoverage = computeDomainCoverage(bundle.vocab);
  return NextResponse.json({
    day,
    locked: Boolean(lockedReason),
    reason: lockedReason,
    items: lockedReason ? [] : items,
    vocabProgress: bundle.vocab,
    domainCoverage,
    focusDomains: entry.plan.vocabFocusDomains,
    examDue: entry.plan.examDue ?? null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: {
    answers?: { itemId?: string; typed?: string }[];
    completeSession?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const bundle = await getUserBundle(user.id, user.timezone);
  const day = bundle.course.currentDay;
  const now = new Date();
  const nowIso = now.toISOString();

  const graded: { itemId: string; correct: boolean; expected: string }[] = [];
  if (Array.isArray(body.answers)) {
    for (const attempt of body.answers) {
      if (!attempt?.itemId || typeof attempt.typed !== "string") continue;
      const item = VOCAB_ITEMS.find((candidate) => candidate.id === attempt.itemId);
      if (!item) continue;
      const correct = scoreVocabRecall(item, attempt.typed);
      bundle.vocab[item.id] = updateVocabSrs(bundle.vocab[item.id], item.id, correct, now);
      graded.push({ itemId: item.id, correct, expected: item.fr });
    }
  }

  if (body.completeSession) {
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
    const entry = bundle.course.dayPlans[day]!;
    if (!entry.grammarDoneAt || !entry.sejourDoneAt) {
      await saveUserBundle(user.id, bundle);
      return NextResponse.json(
        {
          ok: false,
          completed: false,
          reason: !entry.grammarDoneAt
            ? "The grammar lesson is still open. Pass it before this day can close."
            : "The village day is still open. Talk with someone in Saint-Aubin before this day can close.",
          results: graded,
          course: bundle.course,
        },
        { status: 409 },
      );
    }
    if (graded.length === 0) {
      await saveUserBundle(user.id, bundle);
      return NextResponse.json(
        { ok: false, completed: false, reason: "Type the French for the words in this session first.", course: bundle.course },
        { status: 409 },
      );
    }
    entry.vocabDoneAt = nowIso;
    bundle.course.queuedDayVocabIds = [];

    const todayIso = todayIsoInTz(bundle.course.timezone);
    const streakUpdate = updateStreakOnDayComplete(bundle.course, todayIso);
    bundle.course.streak = streakUpdate.streak;
    bundle.course.bestStreak = streakUpdate.bestStreak;
    bundle.course.lastCompletedDate = streakUpdate.lastCompletedDate;

    const coverage = computeDomainCoverage(bundle.vocab);
    const coveredCount = Object.values(coverage).filter((c) => c.covered).length;

    bundle.teacherNotes.push({
      id: `note_eod_${Date.now()}`,
      day,
      kind: "daily_summary",
      body: `Finished Day ${day} Vocab & Recall session. Domains covered so far: ${coveredCount}/15. Current streak: ${bundle.course.streak} day(s).`,
      createdAt: nowIso,
    });

    // If today is not an exam day (or the exam is already done), mark the day complete and advance to next day
    const examDue = entry.plan.examDue;
    if (bundle.course.currentDay === day && (!examDue || entry.examDoneAt) && !entry.completedAt) {
      entry.completedAt = nowIso;
      if (bundle.course.currentDay < 28) {
        bundle.course.currentDay += 1;
      }
    }
  }

  await saveUserBundle(user.id, bundle);
  return NextResponse.json({
    ok: true,
    completed: Boolean(bundle.course.dayPlans[day]?.vocabDoneAt),
    advanced: bundle.course.currentDay !== day,
    results: graded,
    course: bundle.course,
    domainCoverage: computeDomainCoverage(bundle.vocab),
  });
}
