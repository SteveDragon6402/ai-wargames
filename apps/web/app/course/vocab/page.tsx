"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabItem } from "@/app/course/types";
import { VOCAB_DOMAIN_LABELS } from "@/app/course/types";
import { scoreVocabRecall } from "@/app/course/engine/answers";
import { hear } from "@/app/sejour/lib/voice";

export default function VocabExercisePage() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [courseDay, setCourseDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState<"flashcards" | "recall" | "done">("flashcards");
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [quizIdx, setQuizIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [quizFeedback, setQuizFeedback] = useState<null | { correct: boolean; expected: string }>(null);
  const [results, setResults] = useState<{ itemId: string; correct: boolean }[]>([]);
  const [lockReason, setLockReason] = useState("");
  const [finishError, setFinishError] = useState("");
  const [completionInfo, setCompletionInfo] = useState<null | { streak: number; nextDay: number; advanced: boolean; examReady: boolean }>(
    null,
  );
  const answersRef = useRef<{ itemId: string; typed: string }[]>([]);

  useEffect(() => {
    fetch("/api/course/vocab")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.locked) setLockReason(data.reason || "Finish grammar and the village day first.");
        if (data?.items) setItems(data.items);
        if (data?.day) setCourseDay(data.day);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] px-8 py-6 text-center">
          Loading your post-day vocabulary deck…
        </div>
      </main>
    );
  }

  const currentCard = items[cardIdx];
  const currentQuiz = items[quizIdx];

  function checkRecallAnswer() {
    if (!currentQuiz) return;
    const raw = typed.trim();
    const isCorrect = scoreVocabRecall(currentQuiz, raw);
    answersRef.current.push({ itemId: currentQuiz.id, typed: raw });
    setQuizFeedback({ correct: isCorrect, expected: currentQuiz.fr });
    setResults((prev) => [...prev, { itemId: currentQuiz.id, correct: isCorrect }]);
  }

  async function nextRecallItem() {
    setQuizFeedback(null);
    setTyped("");
    if (quizIdx + 1 < items.length) {
      setQuizIdx((i) => i + 1);
    } else {
      const res = await fetch("/api/course/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersRef.current,
          completeSession: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setFinishError(data?.reason || data?.error || "This session was not saved.");
        return;
      }
      setResults(
        Array.isArray(data.results)
          ? data.results.map((row: { itemId: string; correct: boolean }) => ({ itemId: row.itemId, correct: row.correct }))
          : results,
      );
      setCompletionInfo({
        streak: data?.course?.streak ?? 1,
        nextDay: data?.course?.currentDay ?? courseDay,
        advanced: Boolean(data.advanced),
        examReady: courseDay % 7 === 0 && !data.advanced,
      });
      setStage("done");
    }
  }

  if (lockReason || items.length === 0) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] p-6 text-center">
          <h1 className="font-serif text-2xl font-bold">Evening recall is closed</h1>
          <p className="mt-2 text-sm text-[#4a3b2a]">
            {lockReason || "There are no words queued for today."}
          </p>
          <a href="/home" className="mt-5 inline-block rounded-xl bg-[#231b12] px-5 py-2.5 text-sm font-bold text-[#fbf7ee]">
            Back to the course hub
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] pb-16">
      <header className="border-b border-[#3c2d1e]/15 bg-[#231b12] text-[#fbf7ee] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">
              Day {courseDay} · Step 3: Post-Day Vocabulary &amp; Flashcard Recall
            </div>
            <h1 className="font-serif text-xl font-bold">
              {stage === "flashcards"
                ? `Stage 1: Flashcards (${cardIdx + 1}/${items.length})`
                : stage === "recall"
                ? `Stage 2: Active Recall (${quizIdx + 1}/${items.length})`
                : "Daily Session Complete!"}
            </h1>
          </div>
          <a
            href="/home"
            className="rounded-full border border-white/25 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            ← Course Hub
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8">
        {stage === "flashcards" && currentCard && (
          <div className="rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl text-center">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
              <span>{VOCAB_DOMAIN_LABELS[currentCard.domain].label}</span>
              <span>
                Card {cardIdx + 1} of {items.length}
              </span>
            </div>

            <div
              onClick={() => setFlipped((f) => !f)}
              className="mt-5 cursor-pointer rounded-2xl border-2 border-[#3c2d1e]/20 bg-white px-6 py-12 shadow-inner transition hover:border-[#231b12]"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-[#7a6248]">
                {flipped ? "English Meaning & Example" : "French (Click card to flip)"}
              </div>
              <div className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
                {flipped ? currentCard.en : currentCard.fr}
              </div>
              {currentCard.article && !flipped && (
                <div className="mt-1 text-xs font-semibold text-[#8b5e34]">
                  Article: {currentCard.article}
                </div>
              )}
              {flipped && currentCard.exampleFr && (
                <div className="mt-4 border-t border-[#3c2d1e]/10 pt-3 text-sm text-[#4a3b2a]">
                  <div className="font-bold text-[#231b12]">« {currentCard.exampleFr} »</div>
                  {currentCard.exampleEn && <div className="text-xs text-[#6e563a]">{currentCard.exampleEn}</div>}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => hear("rousseau", currentCard.fr)}
                className="rounded-xl border border-[#3c2d1e]/30 bg-[#efe6d4] px-4 py-2 text-xs font-bold text-[#231b12] hover:bg-[#e2d3b9]"
              >
                🔊 Hear Word
              </button>
              {currentCard.exampleFr && (
                <button
                  type="button"
                  onClick={() => hear("rousseau", currentCard.exampleFr!)}
                  className="rounded-xl border border-[#3c2d1e]/30 bg-[#efe6d4] px-4 py-2 text-xs font-bold text-[#231b12] hover:bg-[#e2d3b9]"
                >
                  🔊 Hear Example Sentence
                </button>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[#3c2d1e]/15 pt-4">
              <button
                type="button"
                disabled={cardIdx === 0}
                onClick={() => {
                  setFlipped(false);
                  setCardIdx((i) => Math.max(0, i - 1));
                }}
                className="rounded-lg border border-[#3c2d1e]/25 px-4 py-2 text-xs font-bold disabled:opacity-40"
              >
                ← Previous Card
              </button>

              {cardIdx + 1 < items.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlipped(false);
                    setCardIdx((i) => i + 1);
                  }}
                  className="rounded-xl bg-[#231b12] px-5 py-2.5 text-sm font-bold text-[#fbf7ee]"
                >
                  Next Card →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage("recall")}
                  className="rounded-xl bg-emerald-800 px-6 py-2.5 text-sm font-bold text-white"
                >
                  Start Stage 2: Active Recall →
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "recall" && currentQuiz && (
          <div className="rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
              <span>Active Recall Quiz</span>
              <span>
                {quizIdx + 1} of {items.length}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-[#6e563a]">How do you say in French:</div>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#231b12]">
                “{currentQuiz.en}”
              </h2>
              {currentQuiz.exampleEn && (
                <p className="mt-1 text-xs italic text-[#6e563a]">
                  Context: {currentQuiz.exampleEn}
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                disabled={quizFeedback !== null}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !quizFeedback && typed.trim()) {
                    checkRecallAnswer();
                  }
                }}
                placeholder="Type the French…"
                className="flex-1 rounded-xl border border-[#3c2d1e]/30 bg-white px-3.5 py-2.5 text-sm"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {!quizFeedback && (
                <button
                  type="button"
                  onClick={() => checkRecallAnswer()}
                  className="rounded-xl bg-[#231b12] px-4 py-2.5 text-xs font-bold text-[#fbf7ee]"
                >
                  Check
                </button>
              )}
            </div>

            {finishError ? (
              <p className="mt-3 text-sm font-semibold text-amber-950" role="alert">{finishError}</p>
            ) : null}

            {quizFeedback && (
              <div
                className={`mt-4 rounded-xl border-2 p-4 text-sm ${
                  quizFeedback.correct
                    ? "border-emerald-700/40 bg-emerald-50 text-emerald-950"
                    : "border-amber-800/40 bg-amber-50 text-amber-950"
                }`}
              >
                <div className="font-bold">
                  {quizFeedback.correct ? "✓ Exactement !" : `Answer: ${quizFeedback.expected}`}
                </div>
                {currentQuiz.exampleFr && <div className="mt-1 text-xs">« {currentQuiz.exampleFr} »</div>}
                <button
                  type="button"
                  onClick={nextRecallItem}
                  className="mt-3 rounded-xl bg-[#231b12] px-5 py-2 text-xs font-bold text-white"
                >
                  {quizIdx + 1 < items.length ? "Next Word →" : "Complete Day & Save Streak →"}
                </button>
              </div>
            )}
          </div>
        )}

        {stage === "done" && completionInfo && (
          <div className="rounded-2xl border-2 border-emerald-800/40 bg-[#fbf7ee] p-7 text-center shadow-xl">
            <div className="inline-block rounded-full bg-emerald-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Day {courseDay} Complete!
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
              🔥 {completionInfo.streak}-Day Streak!
            </h2>
            <p className="mt-2 text-sm text-[#4a3b2a]">
              You typed {items.length} words ({results.filter((r) => r.correct).length}/{items.length} in French).{" "}
              {completionInfo.advanced
                ? <>The day is saved. Day {completionInfo.nextDay} is open.</>
                : completionInfo.examReady
                  ? "The day is saved. Sit the weekly exam before the next day opens."
                  : "The recall is saved. Finish the rest of today before the next day opens."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {completionInfo.examReady && (
                <a
                  href={`/course/exam?kind=w${Math.ceil(courseDay / 7)}`}
                  className="rounded-xl bg-amber-900 px-6 py-3.5 text-sm font-bold text-amber-50 hover:bg-amber-800"
                >
                  🎓 Sit Week {Math.ceil(courseDay / 7)} Exam Now →
                </a>
              )}
              <a
                href="/home"
                className="rounded-xl bg-[#231b12] px-6 py-3.5 text-sm font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
              >
                Return to Course Hub →
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
