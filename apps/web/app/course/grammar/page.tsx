"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GrammarExercise, GrammarLesson } from "@/app/course/types";
import { frenchAnswerIsAlmost, frenchAnswersMatch, promptWithoutGiveaway, shuffleTiles } from "@/app/course/engine/answers";
import { hear, stopHearing } from "@/app/sejour/lib/voice";

type Verdict = { correct: boolean; almost: boolean; explanation: string };

function playSuccess() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.07;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.22);
  });
  window.setTimeout(() => void ctx.close(), 900);
}

function sentenceToHear(text: string): string | null {
  const line = text.trim();
  if (line.split(/\s+/).length < 3) return null;
  return line;
}

function promptSentence(prompt: string): string | null {
  const quoted = prompt.match(/«\s*([^»]+)»/)?.[1]?.trim() ?? "";
  if (!quoted || quoted.includes("_")) return null;
  return sentenceToHear(quoted);
}

export default function GrammarLessonPage() {
  const [lesson, setLesson] = useState<GrammarLesson | null>(null);
  const [remediation, setRemediation] = useState<GrammarExercise[]>([]);
  const [teacherSummary, setTeacherSummary] = useState("");
  const [courseDay, setCourseDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<"study" | "practice" | "done" | "retry">("study");
  const [exIdx, setExIdx] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [tileWords, setTileWords] = useState<string[]>([]);
  const [used, setUsed] = useState<number[]>([]);
  const [builtFor, setBuiltFor] = useState("");
  const [checked, setChecked] = useState<Verdict | null>(null);
  const [result, setResult] = useState<null | { passed: boolean; scorePercent: number; correct: number; total: number; passPercent: number }>(null);
  const [finishError, setFinishError] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [examplesShown, setExamplesShown] = useState(0);
  const [teaching, setTeaching] = useState(false);
  const [taught, setTaught] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const answersRef = useRef<Record<string, string>>({});
  const teachRun = useRef(0);
  const [misses, setMisses] = useState(0);

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
    return () => {
      teachRun.current += 1;
      stopHearing();
    };
  }, []);

  const allExercises: GrammarExercise[] = lesson
    ? [...lesson.exercises, ...remediation].flatMap((exercise) => {
        const prompt = promptWithoutGiveaway(exercise.prompt, exercise.answer);
        return prompt ? [{ ...exercise, prompt }] : [];
      })
    : [];
  const currentEx = allExercises[exIdx];

  const bank = useMemo(() => {
    if (!currentEx?.options) return [] as string[];
    if (currentEx.kind === "tiles" || currentEx.kind === "mcq" || currentEx.kind === "listen") {
      return shuffleTiles(currentEx.options, currentEx.id);
    }
    return [...currentEx.options];
  }, [currentEx?.id, currentEx?.kind, currentEx?.options]);

  if (currentEx && builtFor !== currentEx.id) {
    setBuiltFor(currentEx.id);
    setTileWords([]);
    setUsed([]);
  }

  useEffect(() => {
    if (step !== "practice" || !currentEx) return;
    const line = currentEx.audioFr || promptSentence(currentEx.prompt);
    if (!line) return;
    void hear("rousseau", line);
  }, [step, currentEx?.id]);

  async function teach() {
    if (!lesson || teaching) return;
    const mine = ++teachRun.current;
    setTeaching(true);
    setVoiceNote("");
    setRevealed(0);
    setExamplesShown(0);
    const intro = await hear("rousseau", "Voici les formes.");
    if (mine !== teachRun.current) return;
    if (intro) {
      setVoiceNote(intro);
      setRevealed(lesson.keyPoints.length);
      setExamplesShown(lesson.examples.length);
      setTaught(true);
      setTeaching(false);
      return;
    }
    for (let i = 0; i < lesson.keyPoints.length; i++) {
      setRevealed(i + 1);
      const err = await hear("rousseau", lesson.keyPoints[i].fr);
      if (mine !== teachRun.current) return;
      if (err) {
        setVoiceNote(err);
        setRevealed(lesson.keyPoints.length);
        setExamplesShown(lesson.examples.length);
        setTaught(true);
        setTeaching(false);
        return;
      }
    }
    for (let i = 0; i < lesson.examples.length; i++) {
      setExamplesShown(i + 1);
      const err = await hear("rousseau", lesson.examples[i].fr);
      if (mine !== teachRun.current) return;
      if (err) {
        setVoiceNote(err);
        setExamplesShown(lesson.examples.length);
        break;
      }
    }
    setTaught(true);
    setTeaching(false);
  }

  function judge(raw: string) {
    if (!currentEx) return;
    const accept = currentEx.accept ?? [];
    const correct = frenchAnswersMatch(raw, currentEx.answer, accept);
    const almost = !correct && frenchAnswerIsAlmost(raw, currentEx.answer, accept);
    if (correct) {
      answersRef.current[currentEx.id] = raw;
      setChecked({ correct: true, almost: false, explanation: currentEx.explanation });
      playSuccess();
      const spoken = sentenceToHear(currentEx.answer);
      if (spoken && spoken !== currentEx.audioFr) void hear("rousseau", spoken);
      return;
    }
    const nextMisses = misses + 1;
    setMisses(nextMisses);
    if (nextMisses >= 2) {
      answersRef.current[currentEx.id] = raw;
      setChecked({ correct: false, almost: false, explanation: currentEx.explanation });
      return;
    }
    if (almost) {
      setChecked({ correct: false, almost: true, explanation: "Almost. One letter is off. Try once more." });
      return;
    }
    answersRef.current[currentEx.id] = raw;
    setChecked({
      correct: false,
      almost: false,
      explanation: currentEx.explanation,
    });
  }

  function checkCurrentAnswer() {
    if (!currentEx) return;
    const raw = currentEx.kind === "tiles" ? tileWords.join(" ") : userInput;
    if (!raw.trim()) return;
    judge(raw);
  }

  async function nextExercise() {
    if (!lesson) return;
    setChecked(null);
    setMisses(0);
    setUserInput("");
    setTileWords([]);
    setUsed([]);
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

  if (loading || !lesson) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] px-8 py-6 text-center">
          Loading today&apos;s grammar lesson…
        </div>
      </main>
    );
  }

  const locked = checked !== null && !checked.almost;
  const choiceBank = bank.length ? bank : currentEx?.options ?? [];

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

            <button
              type="button"
              onClick={() => void teach()}
              disabled={teaching}
              className="w-full rounded-xl bg-[#231b12] px-6 py-3.5 text-base font-bold text-[#fbf7ee] hover:bg-[#3a2d1f] disabled:opacity-60"
            >
              {teaching ? "Madame is saying the forms…" : taught ? "Hear the forms again" : "Hear the forms"}
            </button>
            {voiceNote && <p className="text-sm text-[#6e563a]">{voiceNote}</p>}

            <div className="rounded-xl border border-[#3c2d1e]/20 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                The forms
              </h3>
              <div className="mt-3 divide-y divide-[#3c2d1e]/10">
                {lesson.keyPoints.slice(0, revealed).map((kp, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <div className="font-bold text-[#231b12]">{kp.fr}</div>
                      <div className="text-xs text-[#5c4934]">{kp.en}</div>
                    </div>
                    {kp.note && (
                      <span className="rounded bg-[#f4ecdc] px-2.5 py-1 text-xs text-[#5c4934]">
                        {kp.note}
                      </span>
                    )}
                  </div>
                ))}
                {revealed === 0 && (
                  <p className="py-3 text-sm text-[#6e563a]">The forms appear here as Madame says them.</p>
                )}
              </div>
            </div>

            {examplesShown > 0 && (
              <div className="rounded-xl border border-[#3c2d1e]/20 bg-[#f4ecdc]/70 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                  How you&apos;ll hear it
                </h3>
                <div className="mt-3 space-y-2.5">
                  {lesson.examples.slice(0, examplesShown).map((ex, i) => (
                    <div key={i} className="rounded-lg bg-white p-3">
                      <div className="text-sm font-bold text-[#231b12]">{ex.fr}</div>
                      <div className="text-xs text-[#5c4934]">{ex.en}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-emerald-800/30 bg-emerald-50 p-4 text-xs text-emerald-950">
              <strong>Today&apos;s village line:</strong> {lesson.useItPrompt}
            </div>

            {taught && (
              <button
                type="button"
                onClick={() => setStep("practice")}
                className="w-full rounded-xl bg-[#2f6b45] px-6 py-3.5 text-base font-bold text-white hover:bg-[#245636] transition"
              >
                Start the exercises ({allExercises.length}) →
              </button>
            )}
          </div>
        )}

        {step === "practice" && currentEx && (
          <div className="rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-6 shadow-md">
            <div className="flex items-center justify-between text-sm text-[#6e563a]">
              <span className="tabular-nums">{exIdx + 1} of {allExercises.length}</span>
              {!locked ? (
                <button type="button" onClick={() => setStep("study")} className="underline">
                  Hear the forms
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
                Hear it again
              </button>
            )}

            {(currentEx.kind === "mcq" || currentEx.kind === "listen") && (
              <div className="mt-4 space-y-3">
                {choiceBank.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setUserInput(opt);
                      judge(opt);
                    }}
                    className={`min-h-12 w-full rounded-xl px-4 py-3 text-left text-base font-semibold transition ${
                      checked && userInput === opt
                        ? checked.correct
                          ? "border-2 border-[#2f6b45] bg-[#e7f3ec] text-[#1b3825]"
                          : "border-2 border-red-800 bg-red-50 text-red-950"
                        : "border-2 border-[#3c2d1e]/20 bg-white text-[#231b12] hover:bg-[#f4ecdc]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {(currentEx.kind === "gap" || currentEx.kind === "translate") && (
              <div className="mt-4">
                <input
                  type="text"
                  disabled={locked}
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    if (checked?.almost) setChecked(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !locked && userInput.trim()) checkCurrentAnswer();
                  }}
                  placeholder="Type your French answer here…"
                  className="w-full rounded-xl border-2 border-[#3c2d1e]/30 bg-white px-4 py-3 text-base text-[#231b12]"
                />
              </div>
            )}

            {currentEx.kind === "tiles" && (
              <div className="mt-4 space-y-3">
                <div className="min-h-[52px] rounded-xl border-2 border-dashed border-[#3c2d1e]/30 bg-white p-3 flex flex-wrap gap-2">
                  {tileWords.length === 0 ? (
                    <span className="text-xs text-[#7a6248]">Click the words in order.</span>
                  ) : (
                    tileWords.map((w, i) => (
                      <button
                        key={`${w}-${i}`}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setTileWords((prev) => prev.filter((_, idx) => idx !== i));
                          setUsed((prev) => prev.filter((_, idx) => idx !== i));
                          if (checked?.almost) setChecked(null);
                        }}
                        className="rounded-lg bg-[#231b12] px-3 py-1.5 text-sm font-bold text-[#fbf7ee]"
                      >
                        {w}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {choiceBank.map((w, i) => (
                    <button
                      key={`${w}-opt-${i}`}
                      type="button"
                      disabled={locked || used.includes(i)}
                      onClick={() => {
                        if (used.includes(i)) return;
                        setUsed((prev) => [...prev, i]);
                        setTileWords((prev) => [...prev, w]);
                        if (checked?.almost) setChecked(null);
                      }}
                      className="rounded-lg border border-[#3c2d1e]/30 bg-[#efe6d4] px-3 py-1.5 text-sm font-bold text-[#231b12] hover:bg-[#e2d3b9] disabled:opacity-30"
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
                    : checked.almost
                      ? "border-amber-500 bg-amber-50 text-amber-950"
                      : "border-red-800/40 bg-red-50 text-red-950"
                }`}
              >
                <div className="font-bold">
                  {checked.correct ? "Correct." : checked.almost ? "Almost!" : `The answer is « ${currentEx.answer} ».`}
                </div>
                <p className="mt-1 text-xs">{checked.explanation}</p>
              </div>
            )}

            <div className="mt-6">
              {!locked ? (
                currentEx.kind === "mcq" || currentEx.kind === "listen" ? null : (
                  <button
                    type="button"
                    onClick={checkCurrentAnswer}
                    className="w-full rounded-xl bg-[#231b12] px-6 py-4 text-lg font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
                  >
                    Check
                  </button>
                )
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
                setUsed([]);
                setChecked(null);
                setMisses(0);
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
