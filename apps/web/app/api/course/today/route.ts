import { NextRequest, NextResponse } from "next/server";
import { GRAMMAR_BY_DAY, GRAMMAR_BY_ID } from "@/app/course/content/grammar";
import { computeDomainCoverage, computeMilestones, daysBetweenIso } from "@/app/course/engine";
import { fillGrammarLesson } from "@/app/course/engine/lesson-fill";
import { planCourseDay } from "@/lib/teacher";
import { getUserFromRequest } from "@/lib/auth/session";
import { emptySave, parseSave } from "@/app/sejour/lib/save";
import { isPlace, type PlaceId } from "@/app/sejour/world/places";
import { getUserBundle, saveUserBundle, todayIsoInTz } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const bundle = await getUserBundle(user.id, user.timezone);
  const course = bundle.course;
  const day = Math.max(1, Math.min(28, course.currentDay));

  let dirty = false;
  if (!course.dayPlans[day]) {
    const planned = await planCourseDay(bundle, day);
    course.dayPlans[day] = {
      plan: planned,
      grammarDoneAt: null,
      sejourDoneAt: null,
      vocabDoneAt: null,
      examDoneAt: null,
      completedAt: null,
    };
    dirty = true;
  }

  const sejourSave = parseSave(bundle.saves.sejour?.save) ?? emptySave();
  const earnedPlaces = sejourSave.unlocked.filter((id): id is PlaceId => isPlace(id));
  const places = earnedPlaces.length ? earnedPlaces : (["boulangerie"] as PlaceId[]);
  const samePlaces =
    places.length === course.unlockedPlaces.length && places.every((place) => course.unlockedPlaces.includes(place));
  if (!samePlaces) {
    course.unlockedPlaces = places;
    dirty = true;
  }
  const earnedEvents = (["family", "sick"] as const).filter((event) => sejourSave.unlocked.includes(`event_${event}`));
  const sameEvents =
    earnedEvents.length === course.unlockedEvents.length &&
    earnedEvents.every((event) => course.unlockedEvents.includes(event));
  if (!sameEvents) {
    course.unlockedEvents = [...earnedEvents];
    dirty = true;
  }
  if (dirty) await saveUserBundle(user.id, bundle);

  const dayEntry = course.dayPlans[day]!;
  const rawLesson = GRAMMAR_BY_ID[dayEntry.plan.lessonId] ?? GRAMMAR_BY_DAY[day] ?? GRAMMAR_BY_DAY[1];
  const lesson = fillGrammarLesson(rawLesson, bundle.learnerFacts);
  const remediationLessons = dayEntry.plan.remediationLessonIds
    .map((id) => GRAMMAR_BY_ID[id])
    .filter((item) => Boolean(item))
    .map((item) => fillGrammarLesson(item!, bundle.learnerFacts));

  const todayIso = todayIsoInTz(course.timezone);
  const elapsedDays = Math.max(0, daysBetweenIso(course.startDate, todayIso));
  const expectedDay = Math.min(28, elapsedDays + 1 + course.skippedWeeks * 7);
  const behindDays = Math.max(0, expectedDay - day);
  const milestones = computeMilestones(course.startDate);
  const domainCoverage = computeDomainCoverage(bundle.vocab);

  return NextResponse.json({
    user,
    course,
    day,
    todayIso,
    behindDays,
    dayEntry,
    lesson,
    remediationLessons,
    milestones,
    domainCoverage,
    recentNotes: bundle.teacherNotes.slice(-5),
    recentErrors: bundle.errors.slice(-5),
    learnerFacts: bundle.learnerFacts,
  });
}
