"use client";

import { useEffect, useRef, useState } from "react";
import type { GrammarExercise, GrammarLesson } from "@/app/course/types";
import { hear } from "@/app/sejour/lib/voice";

function normalizeAnswer(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

export default function GrammarLessonPage() {
  const [lesson, setLesson] = useState<GrammarLesson | null>(null);
  const [remediation, setRemediation] = useState<GrammarExercise[]>([]);
  const [teacherSummary, setTeacherSummary] = useState("");
  const [courseDay, setCourseDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<"study" | "practice" | "done" | "retry">("practice");
  const [exIdx, setExIdx] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [tileWords, setTileWords] = useState<string[]>([]);
  const [checked, setChecked] = useState<null | { correct: boolean; explanation: string }>(null);
  const [result, setResult] = useState<null | { passed: boolean; scorePercent: number; correct: number; total: number; passPercent: number }>(null);
  const [finishError, setFinishError] = useState("");
  const answersRef = useRef<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/course/today")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.lesson) {
          setLesson(data.lesson);
          const remLessons: GrammarLesson[] = data.remediationLessons ?? [];
          setRemediation(remLessons.flatMap((l) => l.exercises.slice(0, 2)));
          setTeacherSummary(data.dayEntry?.plan?.personalIntro ?? "");
          setCourseDay(data.day ?? 1);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !lesson) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] px-8 py-6 text-center">
          Loading today&apos;s grammar lesson…
        </div>
      </main>
    );
  }

  const allExercises: GrammarExercise[] = [...lesson.exercises, ...remediation];
  const currentEx = allExercises[exIdx];

  function checkCurrentAnswer() {
    if (!currentEx) return;
    const rawCandidate = currentEx.kind === "tiles" ? tileWords.join(" ") : userInput;
    const candidate = normalizeAnswer(rawCandidate);
    const validTargets = [currentEx.answer, ...(currentEx.accept ?? [])].map(normalizeAnswer);
    answersRef.current[currentEx.id] = rawCandidate;
    const isCorrect = validTargets.includes(candidate);
    setChecked({
      correct: isCorrect,
      explanation: currentEx.explanation,
    });
  }

  async function nextExercise() {
    if (!lesson) return;
    setChecked(null);
    setUserInput("");
    setTileWords([]);
    if (exIdx + 1 < allExercises.length) {
      setExIdx((i) => i + 1);
    } else {
      setFinishError("");
      const res = await fetch("/api/course/grammar/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, answers: answersRef.current }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setFinishError(data?.error || "The lesson could not be saved. Try again.");
        setStep("retry");
        return;
      }
      setResult(data);
      setStep(data.passed ? "done" : "retry");
    }
  }

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] pb-16">
      <header className="px-6 py-5">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8b5e34]">Day {courseDay}</p>
          <a href="/home" className="text-sm font-semibold text-[#6e563a] underline">Leave</a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pt-6">
        {step === "study" && (
          <div className="space-y-6 rounded-2xl border-2 border-[#3c2d1e]/20 bg-[#fbf7ee] p-6 shadow-md">
            {teacherSummary && (
              <div className="rounded-xl border border-amber-800/30 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Teacher&apos;s Note for Today
                </div>
                <p className="mt-1">{teacherSummary}</p>
              </div>
            )}

            <div>
              <h2 className="font-serif text-2xl font-bold text-[#231b12]">{lesson.title}</h2>
              <p className="text-sm text-[#6e563a]">{lesson.subtitle}</p>
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#33271a]">
                {lesson.explanation.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>

            {/* Key Points Table */}
            <div className="rounded-xl border border-[#3c2d1e]/20 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                Key Forms &amp; Patterns (Click 🔊 to hear)
              </h3>
              <div className="mt-3 divide-y divide-[#3c2d1e]/10">
                {lesson.keyPoints.map((kp, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => hear("rousseau", kp.fr)}
                        className="rounded-lg border border-[#3c2d1e]/20 bg-[#f4ecdc] px-2.5 py-1 text-xs font-bold hover:bg-[#e5d8c0]"
                      >
                        🔊
                      </button>
                      <div>
                        <div className="font-bold text-[#231b12]">{kp.fr}</div>
                        <div className="text-xs text-[#5c4934]">{kp.en}</div>
                      </div>
                    </div>
                    {kp.note && (
                      <span className="rounded bg-[#f4ecdc] px-2.5 py-1 text-xs text-[#5c4934]">
                        {kp.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Spoken Village Examples */}
            <div className="rounded-xl border border-[#3c2d1e]/20 bg-[#f4ecdc]/70 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                How You&apos;ll Hear It in Saint-Aubin
              </h3>
              <div className="mt-3 space-y-2.5">
                {lesson.examples.map((ex, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white p-3">
                    <button
                      type="button"
                      onClick={() => hear("rousseau", ex.fr)}
                      className="mt-0.5 rounded-lg border border-[#3c2d1e]/20 bg-[#efe6d4] px-2.5 py-1 text-xs font-bold hover:bg-[#e2d3b9]"
                    >
                      🔊
                    </button>
                    <div>
                      <div className="text-sm font-bold text-[#231b12]">{ex.fr}</div>
                      <div className="text-xs text-[#5c4934]">{ex.en}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-800/30 bg-emerald-50 p-4 text-xs text-emerald-950">
              <strong>Today&apos;s Village Mission:</strong> {lesson.useItPrompt}
            </div>

            <button
              type="button"
              onClick={() => setStep("practice")}
              className="w-full rounded-xl bg-[#231b12] px-6 py-3.5 text-base font-bold text-[#fbf7ee] hover:bg-[#3a2d1f] transition"
            >
              Start Interactive Exercises ({allExercises.length} questions) →
            </button>
          </div>
        )}

        {step === "practice" && currentEx && (
          <div className="rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-6 shadow-md">
            <div className="flex items-center justify-between text-sm text-[#6e563a]">
              <span className="tabular-nums">{exIdx + 1} of {allExercises.length}</span>
              {!checked ? (
                <button type="button" onClick={() => setStep("study")} className="underline">
                  How this works
                </button>
              ) : (
                <span />
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7dcc8]" aria-hidden="true">
              <div
                className="h-full bg-[#2f6b45] transition-[width] duration-300"
                style={{ width: `${(exIdx / Math.max(1, allExercises.length)) * 100}%` }}
              />
            </div>

            <h2 className="mt-8 font-serif text-3xl font-bold leading-tight text-[#231b12]">{currentEx.prompt}</h2>

            {currentEx.audioFr && (
              <button
                type="button"
                onClick={() => hear("rousseau", currentEx.audioFr!)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#3c2d1e]/30 bg-[#efe6d4] px-4 py-2 text-sm font-bold text-[#231b12] hover:bg-[#e3d4bb]"
              >
                Hear it
              </button>
            )}

            {/* MCQ or Listen with options */}
            {(currentEx.kind === "mcq" || currentEx.kind === "listen") && currentEx.options && (
              <div className="mt-4 space-y-3">
                {currentEx.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={checked !== null}
                    onClick={() => setUserInput(opt)}
                    className={`min-h-12 w-full rounded-xl px-4 py-3 text-left text-base font-semibold transition ${
                      checked
                        ? userInput === opt
                          ? "border-2 border-[#2f6b45] bg-[#e7f3ec] text-[#1b3825]"
                          : "border-2 border-transparent bg-transparent font-medium text-[#8a7760]"
                        : userInput === opt
                          ? "border-2 border-[#231b12] bg-[#231b12] text-[#fbf7ee]"
                          : "border-2 border-[#3c2d1e]/20 bg-white text-[#231b12] hover:bg-[#f4ecdc]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Gap-fill or Translate */}
            {(currentEx.kind === "gap" || currentEx.kind === "translate") && (
              <div className="mt-4">
                <input
                  type="text"
                  disabled={checked !== null}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !checked && userInput.trim()) {
                      checkCurrentAnswer();
                    }
                  }}
                  placeholder="Type your French answer here…"
                  className="w-full rounded-xl border-2 border-[#3c2d1e]/30 bg-white px-4 py-3 text-base text-[#231b12]"
                />
              </div>
            )}

            {/* Word Tiles */}
            {currentEx.kind === "tiles" && currentEx.options && (
              <div className="mt-4 space-y-3">
                <div className="min-h-[52px] rounded-xl border-2 border-dashed border-[#3c2d1e]/30 bg-white p-3 flex flex-wrap gap-2">
                  {tileWords.length === 0 ? (
                    <span className="text-xs text-[#7a6248]">Click words below in order…</span>
                  ) : (
                    tileWords.map((w, i) => (
                      <button
                        key={`${w}-${i}`}
                        type="button"
                        disabled={checked !== null}
                        onClick={() => setTileWords((prev) => prev.filter((_, idx) => idx !== i))}
                        className="rounded-lg bg-[#231b12] px-3 py-1.5 text-sm font-bold text-[#fbf7ee]"
                      >
                        {w}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentEx.options.map((w, i) => (
                    <button
                      key={`${w}-opt-${i}`}
                      type="button"
                      disabled={checked !== null}
                      onClick={() => setTileWords((prev) => [...prev, w])}
                      className="rounded-lg border border-[#3c2d1e]/30 bg-[#efe6d4] px-3 py-1.5 text-sm font-bold text-[#231b12] hover:bg-[#e2d3b9]"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {checked && (
              <div
                className={`mt-5 rounded-xl border-2 p-4 text-sm ${
                  checked.correct
                    ? "border-emerald-700/40 bg-emerald-50 text-emerald-950"
                    : "border-amber-800/40 bg-amber-50 text-amber-950"
                }`}
              >
                <div className="font-bold">
                  {checked.correct ? "Correct." : `The answer is « ${currentEx.answer} ».`}
                </div>
                <p className="mt-1 text-xs">{checked.explanation}</p>
              </div>
            )}

            <div className="mt-6">
              {!checked ? (
                <button
                  type="button"
                  onClick={checkCurrentAnswer}
                  className="w-full rounded-xl bg-[#231b12] px-6 py-4 text-lg font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
                >
                  Check
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextExercise}
                  className="w-full rounded-xl bg-[#2f6b45] px-6 py-4 text-lg font-bold text-white hover:bg-[#245636]"
                >
                  Next question
                </button>
              )}
            </div>
          </div>
        )}

        {step === "retry" && (
          <div className="rounded-2xl border-2 border-amber-800/40 bg-[#fbf7ee] p-7 text-center shadow-lg">
            <div className="inline-block rounded-full bg-amber-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Not yet
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
              {result
                ? `${result.scorePercent}% — the bar is ${result.passPercent}% (${result.correct}/${result.total}).`
                : finishError || "Try the exercises again."}
            </h2>
            <p className="mt-2 text-sm text-[#4a3b2a]">
              The morning lesson stays open until you clear the bar. The village will keep asking for this grammar until then.
            </p>
            <button
              type="button"
              className="mt-6 rounded-xl bg-[#231b12] px-6 py-3.5 text-base font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
              onClick={() => {
                answersRef.current = {};
                setExIdx(0);
                setUserInput("");
                setTileWords([]);
                setChecked(null);
                setResult(null);
                setFinishError("");
                setStep("practice");
              }}
            >
              Try the exercises again
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl border-2 border-emerald-800/40 bg-[#fbf7ee] p-7 text-center shadow-lg">
            <h2 className="font-serif text-4xl font-bold text-[#231b12]">The lesson is done.</h2>
            <p className="mt-3 text-[15px] text-[#4a3b2a]">{lesson.useItPrompt}</p>
            <a
              href="/sejour"
              className="mt-8 block w-full rounded-xl bg-[#231b12] px-6 py-4 text-lg font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
            >
              Head out
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
