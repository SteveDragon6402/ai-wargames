"use client";

import { useEffect, useState } from "react";
import type { CourseState, DayPlan, GrammarLesson } from "@/app/course/types";

interface TodayPayload {
  user: { name: string };
  course: CourseState;
  day: number;
  dayEntry: {
    plan: DayPlan;
    grammarDoneAt: string | null;
    sejourDoneAt: string | null;
    examDoneAt: string | null;
  };
  lesson: GrammarLesson;
}

export default function CourseHubPage() {
  const [data, setData] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/course/today")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return null;
        }
        if (!res.ok) throw new Error("The day could not be loaded.");
        return res.json();
      })
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "The day could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5efe2] text-[#231b12]">
        <p className="font-serif text-2xl">Morning in Saint-Aubin…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f5efe2] p-6 text-[#231b12]">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-3xl">{error || "The day could not be loaded."}</h1>
          <a href="/" className="mt-6 inline-block font-semibold underline">Back</a>
        </div>
      </main>
    );
  }

  const { course, day, dayEntry } = data;
  const grammarDone = Boolean(dayEntry.grammarDoneAt);
  const villageDone = Boolean(dayEntry.sejourDoneAt);
  const examToday = day % 7 === 0;
  const examOpen = examToday && grammarDone && villageDone && !dayEntry.examDoneAt;
  let href = "/sejour";
  let label = "Start the day";
  let line = "Breakfast with Madame Rousseau";
  if (grammarDone && !villageDone) {
    href = "/sejour";
    label = "Back to the day";
    line = "The lesson is done. The outing is still ahead.";
  } else if (examOpen) {
    href = `/course/exam?kind=w${day / 7}`;
    label = "Sit the week exam";
    line = "One paper for the week you just lived.";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5efe2] px-6 text-[#231b12]">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8b5e34]">Day {day} of 28</p>
        <h1 className="mt-4 text-balance font-serif text-4xl font-bold leading-tight sm:text-5xl">
          {line.replace(/\s*\([^)]*\)\s*$/, "")}
        </h1>
        {/\([^)]*\)\s*$/.test(line) ? (
          <p className="mt-2 text-balance text-lg text-[#6e563a]">{line.match(/\([^)]*\)\s*$/)?.[0]}</p>
        ) : null}
        {course.streak > 0 ? (
          <p className="mt-4 text-[15px] tabular-nums text-[#6e563a]">{course.streak} {course.streak === 1 ? "day" : "days"} in a row</p>
        ) : (
          <p className="mt-4 text-[15px] text-[#6e563a]">Morning, one lesson, then the village. About half an hour.</p>
        )}
        <button
          type="button"
          onClick={() => {
            window.location.href = href;
          }}
          className="mt-12 w-full rounded-xl bg-[#231b12] px-6 py-4 text-lg font-bold text-[#fbf7ee]"
        >
          {label}
        </button>
      </div>
    </main>
  );
}
