"use client";

import { useEffect, useState } from "react";
import type { PlacementQuestion } from "@/app/course/types";
import type { PlacementEvaluation } from "@/app/course/engine";
import { hear } from "@/app/sejour/lib/voice";

export default function PlacementPage() {
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlacementEvaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/course/placement")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.questions) setQuestions(data.questions);
      })
      .finally(() => setLoading(false));
  }, []);

  async function submitPlacement(overrideAnswers?: Record<string, string>, forceStartAnyway = false) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/course/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: overrideAnswers ?? answers,
          forceStartAnyway,
        }),
      });
      const data = await res.json();
      if (data?.evaluation) {
        setResult(data.evaluation);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleResit() {
    setAnswers({});
    setIdx(0);
    setResult(null);
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] px-8 py-6 text-center">
          Loading Week 0 Placement Check…
        </div>
      </main>
    );
  }

  if (result) {
    const disqualified = result.status === "disqualified";
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl">
          {disqualified ? (
            <>
              <div className="inline-block rounded-full bg-purple-900 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-purple-50">
                Disqualified · Too Advanced for A1
              </div>
              <h1 className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
                Tu parles déjà français ! ({result.totalCorrect} / {result.totalQuestions})
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4a3b2a]">
                {result.summary}
              </p>
              <div className="mt-4 rounded-xl border border-purple-900/20 bg-purple-50 p-4 text-xs text-purple-950 space-y-1">
                <div className="font-bold">Your breakdown by curriculum week:</div>
                <div>Week 1 (Greetings, un/une, je voudrais, numbers 1–20): {result.byWeek[1].correct} / {result.byWeek[1].total}</div>
                <div>Week 2 (Partitives, -er verbs, negation, venir de): {result.byWeek[2].correct} / {result.byWeek[2].total}</div>
                <div>Week 3 (Aller, faire, questions, possessives, modals): {result.byWeek[3].correct} / {result.byWeek[3].total}</div>
                <div>Week 4 (Futur proche, passé composé, health, dining): {result.byWeek[4].correct} / {result.byWeek[4].total}</div>
              </div>
              <p className="mt-4 text-xs text-[#6e563a]">
                Want to play anyway? We never hard-block you — you can re-sit the exam and pretend to know less, or start straight from Week 1.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResit}
                  className="rounded-xl bg-[#231b12] px-5 py-3 text-sm font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
                >
                  🔄 Re-sit Exam (Pretend to know less)
                </button>
                <button
                  type="button"
                  onClick={() => submitPlacement({}, true)}
                  className="rounded-xl border border-[#3c2d1e]/30 bg-white px-4 py-3 text-sm font-bold text-[#231b12] hover:bg-[#f3ead8]"
                >
                  Start from Day 1 Anyway →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-block rounded-full bg-emerald-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-50">
                Placement Complete
              </div>
              <h1 className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
                You start on day 1.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[#4a3b2a]">{result.summary}</p>
              <a
                href="/home"
                className="mt-8 block w-full rounded-xl bg-[#231b12] px-5 py-4 text-center text-lg font-bold text-[#fbf7ee]"
              >
                Start day {result.startDay}
              </a>
            </>
          )}
        </div>
      </main>
    );
  }

  const q = questions[idx];
  if (!q) return null;
  const selected = answers[q.id] ?? "";

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl">
        <p className="text-sm tabular-nums text-[#6e563a]">{idx + 1} of {questions.length}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7dcc8]" aria-hidden="true">
          <div className="h-full bg-[#2f6b45]" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>

        <div className="mt-8">
          <h2 className="font-serif text-3xl font-bold leading-tight text-[#231b12]">{q.prompt}</h2>

          {q.audioFr && (
            <button
              type="button"
              onClick={() => hear("rousseau", q.audioFr!)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#3c2d1e]/30 bg-[#efe6d4] px-4 py-2 text-sm font-bold text-[#231b12] hover:bg-[#e4d6be]"
            >
              🔊 Listen to French Audio
            </button>
          )}

          <div className="mt-4 space-y-2.5">
            {q.options.map((opt) => {
              const active = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = { ...answers, [q.id]: opt };
                    setAnswers(next);
                    if (idx + 1 < questions.length) setIdx((i) => i + 1);
                    else void submitPlacement(next);
                  }}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? "border-[#231b12] bg-[#231b12] text-[#fbf7ee]"
                      : "border-[#3c2d1e]/20 bg-white text-[#231b12] hover:bg-[#f4ecdc]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void submitPlacement({}, true)}
          className="mt-8 text-sm font-semibold text-[#6e563a] underline"
        >
          I&apos;m starting from the beginning
        </button>
      </div>
    </main>
  );
}
