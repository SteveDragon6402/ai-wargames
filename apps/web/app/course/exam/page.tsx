"use client";

import { useEffect, useState } from "react";
import type { ExamAttemptRecord, ExamBankItem } from "@/app/course/types";
import { hear } from "@/app/sejour/lib/voice";

export default function WeeklyExamPage() {
  const [kind, setKind] = useState<"w1" | "w2" | "w3" | "w4">("w1");
  const [week, setWeek] = useState<number>(1);
  const [items, setItems] = useState<ExamBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttemptRecord | null>(null);
  const [locked, setLocked] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawKind = params.get("kind") || (params.get("week") ? `w${params.get("week")}` : "");
    const query = rawKind ? `?kind=${encodeURIComponent(rawKind)}` : "";

    fetch(`/api/course/exam${query}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/";
          return null;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setLocked(data?.error || "This exam is not open.");
          return null;
        }
        return data;
      })
      .then((data) => {
        if (data?.items) {
          setItems(data.items);
          if (data.kind) setKind(data.kind);
          if (data.week) setWeek(data.week);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/course/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          itemIds: items.map((i) => i.id),
          answers,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLocked(data?.error || "This exam is not open.");
        return;
      }
      if (data?.attempt) setAttempt(data.attempt);
    } finally {
      setSubmitting(false);
    }
  }

  if (locked && items.length === 0 && !attempt) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-amber-800/30 bg-[#fbf7ee] p-6 text-center">
          <h1 className="font-serif text-2xl font-bold">Exam closed</h1>
          <p className="mt-2 text-sm text-[#4a3b2a]">{locked}</p>
          <a href="/home" className="mt-5 inline-block rounded-xl bg-[#231b12] px-5 py-2.5 text-sm font-bold text-[#fbf7ee]">
            Back to the course hub
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] px-8 py-6 text-center">
          Your Teacher is selecting your Week {week} DELF A1 exam paper…
        </div>
      </main>
    );
  }

  if (attempt) {
    const passed = attempt.scores.overall >= 50;
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl">
          <div
            className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white ${
              passed ? "bg-emerald-800" : "bg-amber-800"
            }`}
          >
            {passed ? `Week ${week} Exam Passed!` : `Week ${week} Exam Completed`}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold text-[#231b12]">
            Score: {attempt.scores.overall}% ({passed ? "Admis(e) ✓" : "Needs Review"})
          </h1>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["listening", "reading", "language", "writing"] as const).map((sec) => {
              const s = attempt.scores.bySection[sec] ?? 0;
              return (
                <div key={sec} className="rounded-xl border border-[#3c2d1e]/15 bg-white p-3 text-center">
                  <div className="text-[11px] font-bold uppercase text-[#8b5e34]">{sec}</div>
                  <div className="mt-1 text-lg font-bold text-[#231b12]">{s}%</div>
                </div>
              );
            })}
          </div>

          {attempt.scores.feedback && (
            <div className="mt-5 rounded-xl border border-[#3c2d1e]/20 bg-[#f4ecdc] p-4 text-sm text-[#231b12]">
              <div className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                Teacher&apos;s Written Evaluation
              </div>
              <p className="mt-1 leading-relaxed">{attempt.scores.feedback}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/home"
              className="flex-1 rounded-xl bg-[#231b12] px-5 py-3 text-center text-sm font-bold text-[#fbf7ee] hover:bg-[#3a2d1f]"
            >
              Return to 4-Week Course Hub →
            </a>
            <button
              type="button"
              onClick={() => {
                setAttempt(null);
                setAnswers({});
              }}
              className="rounded-xl border border-[#3c2d1e]/30 bg-white px-4 py-3 text-sm font-bold text-[#231b12]"
            >
              Retake Exam
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] pb-16">
      <header className="border-b border-[#3c2d1e]/15 bg-[#231b12] text-[#fbf7ee] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">
              DELF A1 Weekly Checkpoint · Week {week} of 4
            </div>
            <h1 className="font-serif text-xl font-bold">
              Week {week} Personalized Exam ({items.length} Questions)
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

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-6 pt-6 space-y-5">
        {locked ? (
          <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950" role="alert">
            {locked}
          </p>
        ) : null}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] p-5 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
              <span>
                Question {idx + 1} · {item.section.toUpperCase()}
              </span>
              <span>Week {item.week}</span>
            </div>

            {item.section === "listening" && item.stimulusFr && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => hear("rousseau", item.stimulusFr!)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#3c2d1e]/30 bg-[#efe6d4] px-4 py-2 text-sm font-bold text-[#231b12] hover:bg-[#e2d3b9]"
                >
                  Play the recording
                </button>
                <p className="mt-2 text-xs text-[#6e563a]">The script stays hidden. Listen, then answer.</p>
              </div>
            )}

            {item.section === "reading" && item.stimulusFr && (
              <div className="mt-3 rounded-xl border border-[#3c2d1e]/15 bg-white p-4 font-serif text-sm leading-relaxed text-[#231b12] whitespace-pre-line">
                {item.stimulusFr}
              </div>
            )}

            <h3 className="mt-3 font-serif text-lg font-bold text-[#231b12]">{item.prompt}</h3>

            {item.options && item.options.length > 0 ? (
              <div className="mt-3 space-y-2">
                {item.options.map((opt) => {
                  const selected = answers[item.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: opt }))}
                      className={`w-full rounded-xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition ${
                        selected
                          ? "border-[#231b12] bg-[#231b12] text-[#fbf7ee]"
                          : "border-[#3c2d1e]/20 bg-white text-[#231b12] hover:bg-[#f4ecdc]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : item.section === "writing" ? (
              <textarea
                rows={4}
                value={answers[item.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Write your response in French (20–40 words)…"
                className="mt-3 w-full rounded-xl border border-[#3c2d1e]/30 bg-white p-3.5 text-sm text-[#231b12]"
              />
            ) : (
              <input
                type="text"
                value={answers[item.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Type your French answer…"
                className="mt-3 w-full rounded-xl border border-[#3c2d1e]/30 bg-white px-3.5 py-2.5 text-sm text-[#231b12]"
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[#231b12] px-6 py-4 text-base font-bold text-[#fbf7ee] hover:bg-[#3a2d1f] disabled:opacity-50 shadow-lg"
        >
          {submitting ? "Teacher is grading your exam…" : `Submit Week ${week} Exam for Grading →`}
        </button>
      </form>
    </main>
  );
}
