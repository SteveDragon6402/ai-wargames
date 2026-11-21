"use client";

import type { Gap, Save } from "../lib/save";
import { hear } from "../lib/voice";
import { skillProfile } from "../world/gates";
import { GRAMMAR_LESSONS } from "@/app/course/content/grammar";
import { SKILL_INFO, SKILLS } from "../world/skills";

export function Lessons({
  save,
  gaps,
  onPracticeLesson,
  onToggleSkip,
  onClose,
}: {
  save: Save;
  gaps: Gap[];
  onPracticeLesson?: (lessonId: string) => void;
  onToggleSkip?: (lessonId: string) => void;
  onClose: () => void;
}) {
  const marked = new Set(gaps.map((gap) => gap.id));
  const done = new Set(save.lessonsDone);
  const skipped = new Set(save.lessonsSkipped);
  const profile = skillProfile(save);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-3 sm:items-center"
      role="dialog"
      aria-label="Lessons and A1 Progress"
      data-voice="rousseau"
    >
      <div className="sj-sheet max-h-[88vh] w-full max-w-2xl overflow-auto rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="ep-display text-[26px]">A1 DELF Curriculum &amp; Progress</h2>
          <button type="button" className="ep-button" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Skill profile */}
        <div className="mt-3 rounded-lg bg-white/70 p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">
            Your A1 DELF Skills (0–4 scale · 2 = functional)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILLS.map((skill) => {
              const avg = profile[skill];
              return (
                <div key={skill} className="rounded border border-black/10 bg-white px-2.5 py-1.5 text-[13px]">
                  <div className="flex items-center justify-between font-medium">
                    <span>{SKILL_INFO[skill].label}</span>
                    <span>{typeof avg === "number" ? avg.toFixed(1) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <h3 className="mt-4 ep-display text-[22px]">
          28-day course ({save.lessonsDone.length}/{GRAMMAR_LESSONS.length} passed)
        </h3>
        <ul className="mt-2 space-y-3">
          {GRAMMAR_LESSONS.map((lesson) => {
            const isDone = done.has(lesson.id);
            const isSkipped = skipped.has(lesson.id);
            const isGap = marked.has(lesson.id);
            return (
              <li key={lesson.id} className="rounded-lg border border-black/10 bg-white/85 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[16px] font-semibold">
                    Week {lesson.week} · Day {lesson.day} · {lesson.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    {isDone ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-900">
                        ✓ Completed
                      </span>
                    ) : isSkipped ? (
                      <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-stone-700">Already knew</span>
                    ) : null}
                    {isGap ? (
                      <span className="rounded-full bg-amber-200 px-2.5 py-0.5 font-semibold text-amber-950">
                        Recommended next
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed">{lesson.useItPrompt}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[13px] text-[var(--ep-ink-soft)]">
                  {lesson.examples.map((ex) => (
                    <button
                      key={ex.fr}
                      type="button"
                      onClick={() => void hear("rousseau", ex.fr, "any")}
                      className="rounded border border-amber-900/20 bg-amber-50 px-2.5 py-1 text-left transition hover:bg-amber-100"
                    >
                      🔊 <strong>{ex.fr}</strong> — {ex.en}
                    </button>
                  ))}
                </div>
                {(onPracticeLesson || onToggleSkip) ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-black/10 pt-2">
                    {onPracticeLesson ? (
                      <button
                        type="button"
                        className="ep-button ep-primary text-[12px]"
                        onClick={() => {
                          onPracticeLesson(lesson.id);
                          onClose();
                        }}
                      >
                        Practice with Madame Rousseau →
                      </button>
                    ) : null}
                    {onToggleSkip && !isDone ? (
                      <button
                        type="button"
                        className="ep-button text-[12px]"
                        onClick={() => onToggleSkip(lesson.id)}
                      >
                        {isSkipped ? "Put back in queue" : "I already know this"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
