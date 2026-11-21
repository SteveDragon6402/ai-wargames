import { NextRequest, NextResponse } from "next/server";
import { isFrenchUtterance } from "@/app/epicerie/lib/french";
import { examKindForDay, updateStreakOnDayComplete } from "@/app/course/engine";
import { planCourseDay } from "@/lib/teacher";
import { getUserFromRequest } from "@/lib/auth/session";
import { getUserBundle, saveUserBundle, todayIsoInTz } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    day?: number;
    queuedVocabIds?: string[];
    playerLines?: string[];
  };
  const bundle = await getUserBundle(user.id, user.timezone);
  const day = body.day ?? bundle.course.currentDay;
  const playerLines = (Array.isArray(body.playerLines) ? body.playerLines : []).filter(
    (line): line is string => typeof line === "string" && isFrenchUtterance(line),
  );
  const alreadySpoke = bundle.interactions.some((item) => item.day === day && (item.vocabUsed?.length ?? 0) > 0);
  if (playerLines.length === 0 && !alreadySpoke) {
    return NextResponse.json(
      { error: "Say something in French in the village before this day can count." },
      { status: 409 },
    );
  }

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
  const now = new Date().toISOString();
  entry.sejourDoneAt = now;
  const previousStreak = bundle.course.streak;
  let closed = false;
  if (entry.grammarDoneAt) {
    const todayIso = todayIsoInTz(bundle.course.timezone);
    const streakUpdate = updateStreakOnDayComplete(bundle.course, todayIso);
    bundle.course.streak = streakUpdate.streak;
    bundle.course.bestStreak = streakUpdate.bestStreak;
    bundle.course.lastCompletedDate = streakUpdate.lastCompletedDate;
    const examToday = examKindForDay(day);
    if (!examToday && !entry.completedAt && bundle.course.currentDay === day && day < 28) {
      entry.completedAt = now;
      bundle.course.currentDay += 1;
    }
    if (!examToday && !entry.completedAt && day >= 28) entry.completedAt = now;
    closed = true;
  }

  if (Array.isArray(body.queuedVocabIds)) {
    for (const id of body.queuedVocabIds) {
      if (typeof id === "string" && !bundle.course.queuedDayVocabIds.includes(id)) {
        bundle.course.queuedDayVocabIds.push(id);
      }
    }
  }

  await saveUserBundle(user.id, bundle);
  return NextResponse.json({
    ok: true,
    closed,
    needsGrammar: !entry.grammarDoneAt,
    streak: bundle.course.streak,
    previousStreak,
    examReady: Boolean(examKindForDay(day)) && Boolean(entry.grammarDoneAt),
    dayEntry: entry,
    course: bundle.course,
  });
}
