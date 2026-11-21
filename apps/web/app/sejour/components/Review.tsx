"use client";

import { useEffect, useState } from "react";
import { Coach } from "./Coach";
import { Wait } from "./Wait";
import { bindReviewAsk } from "./SelectionMenu";
import { hear } from "../lib/voice";
import type { Gap } from "../lib/save";
import { SKILL_INFO, type Ratings, type Skill } from "../world/skills";

export interface ReviewLine {
  role: "you" | "gerard";
  text: string;
}

interface ReviewData {
  glosses: { index: number; en: string }[];
  yours: { index: number; said: string; note: string; en?: string }[];
  analysis: string;
  phrases: { fr: string; en: string }[];
  tip: string;
  gaps?: Gap[];
  mastered?: string[];
  ratings?: Ratings;
  error?: string;
  repeat?: { fr: string; en: string }[];
}

export function Review({
  lines,
  scene,
  newUnlocks = [],
  readingAssist = false,
  onContinue,
  onStudy,
  onDrill,
  continueLabel = "Continue",
}: {
  lines: ReviewLine[];
  scene?: string;
  newUnlocks?: string[];
  readingAssist?: boolean;
  onContinue: () => void;
  onStudy?: (gaps: Gap[], mastered: string[], ratings: Ratings) => void;
  onDrill?: (phrases: { fr: string; en: string }[]) => void;
  continueLabel?: string;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [quotes, setQuotes] = useState<string[]>([]);

  useEffect(() => {
    bindReviewAsk((text) => setQuotes((current) => (current.includes(text) ? current : [...current, text].slice(-2))));
    return () => bindReviewAsk(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/sejour/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lines, scene, readingAssist }),
        });
        const body = (await response.json()) as ReviewData;
        if (!cancelled) {
          setData(
            response.ok
              ? body
              : {
                  glosses: [],
                  yours: [],
                  analysis: "",
                  phrases: [],
                  tip: "",
                  ratings: body.ratings ?? {},
                  error: body.error ?? "The review didn't come back.",
                },
          );
          onStudy?.(body.gaps ?? [], body.mastered ?? [], body.ratings ?? {});
          if (body.repeat?.length) onDrill?.(body.repeat);
        }
      } catch {
        if (!cancelled) setData({ glosses: [], yours: [], analysis: "", phrases: [], tip: "", error: "No connection." });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once for the lines handed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glossBy = new Map(data?.glosses.map((gloss) => [gloss.index, gloss.en]));
  const noteBy = new Map(data?.yours.map((item) => [item.index, item]));
  const ratingEntries = Object.entries(data?.ratings ?? {}) as [Skill, number][];

  return (
    <section aria-label="Review">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ep-display text-[28px]">After the conversation</h2>
        <button type="button" className="ep-button ep-primary" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
      {!data ? <Wait>Reading what you said.</Wait> : null}
      {data?.error ? <p className="sj-error mt-2">{data.error}</p> : null}

      {newUnlocks.length > 0 ? (
        <div className="mt-3 rounded-xl border border-emerald-800/30 bg-emerald-50/90 p-3.5 text-emerald-950">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-emerald-800">
            ✨ Progress in Saint-Aubin
          </p>
          <p className="mt-0.5 text-[15px] font-medium">
            {newUnlocks.join(" · ")}
          </p>
        </div>
      ) : null}

      {ratingEntries.length > 0 ? (
        <div className="mt-3 rounded-lg bg-white/75 p-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide">A1 DELF Skill Check</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ratingEntries.map(([skill, score]) => {
              const info = SKILL_INFO[skill];
              if (!info) return null;
              return (
                <div key={skill} className="rounded border border-black/10 bg-white p-2 text-[14px]">
                  <div className="flex items-center justify-between font-medium">
                    <span>{info.label}</span>
                    <span>{score} / 4</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4].map((bar) => (
                      <span
                        key={bar}
                        className={`h-2 flex-1 rounded-sm ${bar <= score ? "bg-[var(--ep-ink)]" : "bg-black/15"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--ep-ink-soft)]">{info.levels[score]}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {data?.analysis ? <p className="mt-3 text-[16px] leading-relaxed">{data.analysis}</p> : null}
      {data?.tip ? <p className="mt-2 text-[15px] italic">{data.tip}</p> : null}

      {data?.phrases?.length ? (
        <div className="mt-3 rounded-lg bg-white/60 p-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide">Useful phrases from this scene</p>
          <ul className="mt-1.5 space-y-1.5 text-[15px]">
            {data.phrases.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void hear("rousseau", p.fr, "any")}
                  className="rounded border border-black/15 bg-white px-2 py-0.5 text-[12px] hover:bg-amber-50"
                >
                  🔊
                </button>
                <span className="font-semibold">{p.fr}</span> — <span className="text-[var(--ep-ink-soft)]">{p.en}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="mt-4 space-y-3">
        {lines.map((line, index) => {
          const mine = noteBy.get(index);
          const gloss = glossBy.get(index);
          const isQuoted = quotes.includes(line.text);
          return (
            <li key={index} className="rounded-lg bg-white/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[16px]">
                  <span className="font-semibold">{line.role === "you" ? "You" : "Them"}: </span>
                  {line.text}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void hear("rousseau", line.text, "any")}
                    className="rounded border border-black/15 bg-white/90 px-2 py-0.5 text-[12px] hover:bg-amber-50"
                    title="Hear this line"
                  >
                    🔊
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuotes((curr) =>
                        curr.includes(line.text) ? curr.filter((q) => q !== line.text) : [...curr, line.text].slice(-2),
                      )
                    }
                    className={`rounded border px-2 py-0.5 text-[12px] ${
                      isQuoted
                        ? "border-amber-800 bg-amber-200 font-semibold text-amber-950"
                        : "border-black/15 bg-white/90 hover:bg-amber-50"
                    }`}
                  >
                    {isQuoted ? "✓ Quoted for coach" : "Ask coach"}
                  </button>
                </div>
              </div>
              {gloss ? <p className="mt-1 text-[14px] text-[var(--ep-ink-soft)]">{gloss}</p> : null}
              {mine?.en ? <p className="mt-1 text-[14px] text-[var(--ep-ink-soft)]">{mine.en}</p> : null}
              {mine ? (
                <p className="mt-1 text-[14px]">
                  <span className="font-semibold">{mine.said}. </span>
                  {mine.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Coach
        lines={lines}
        scene={scene ?? "host"}
        quotes={quotes}
      />
    </section>
  );
}
