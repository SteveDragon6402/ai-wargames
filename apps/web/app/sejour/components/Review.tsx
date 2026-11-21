"use client";

import { useEffect, useRef, useState } from "react";
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
  practice?: { topic: string; said: string; correct: string }[];
  englishFixes?: { fr: string; en: string }[];
}

function sameFrench(typed: string, target: string): boolean {
  const norm = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9' ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return norm(typed) === norm(target);
}

function PracticeCards({ items }: { items: { topic: string; said: string; correct: string }[] }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [missed, setMissed] = useState(false);
  const [ok, setOk] = useState(false);
  const [finished, setFinished] = useState(false);
  const card = items[index];

  if (finished || !card) {
    return <p className="mt-2 text-[15px]">You have the line.</p>;
  }

  function advance() {
    if (index + 1 >= items.length) setFinished(true);
    else {
      setIndex((n) => n + 1);
      setTyped("");
      setMissed(false);
      setOk(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[rgb(43_29_20/0.2)] bg-white/80 p-4">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ep-ink-soft)]">
        Practice {index + 1} of {items.length}
        {card.topic ? ` · ${card.topic}` : ""}
      </p>
      <p className="mt-2 text-[15px]">You said: {card.said}</p>
      <p className="mt-2 text-[16px]">
        In French: <strong>{card.correct}</strong>
        <button
          type="button"
          className="ml-2 rounded border border-black/15 bg-white px-2 py-0.5 text-[12px]"
          onClick={() => void hear("rousseau", card.correct, "any")}
        >
          Hear it
        </button>
      </p>
      <p className="mt-1 text-[15px]">Type that line.</p>
      {ok ? (
        <p className="mt-3 text-[16px] text-emerald-950">Yes. That&apos;s the line.</p>
      ) : null}
      {missed && !ok ? <p className="mt-2 text-[15px] text-amber-950">Look at the line and type it again.</p> : null}
      {ok ? (
        <button type="button" className="ep-button ep-primary mt-3" onClick={advance}>
          Next
        </button>
      ) : (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (sameFrench(typed, card.correct)) setOk(true);
            else setMissed(true);
          }}
        >
          <input
            className="min-w-[16rem] flex-1 rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-3 py-2 text-[16px]"
            value={typed}
            aria-label="Type the French"
            onChange={(event) => setTyped(event.target.value)}
          />
          <button type="submit" className="ep-button ep-primary">
            Check
          </button>
        </form>
      )}
    </div>
  );
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
  const [sawBottom, setSawBottom] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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
          const drill = [...(body.englishFixes ?? []), ...(body.phrases ?? []), ...(body.repeat ?? [])];
          if (drill.length) onDrill?.(drill);
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

  useEffect(() => {
    if (!data) return;
    const node = endRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSawBottom(true);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [data]);

  const canContinue = data !== null && sawBottom;

  const glossBy = new Map(data?.glosses.map((gloss) => [gloss.index, gloss.en]));
  const noteBy = new Map(data?.yours.map((item) => [item.index, item]));
  const ratingEntries = Object.entries(data?.ratings ?? {}) as [Skill, number][];

  return (
    <section aria-label="Review">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ep-display text-[28px]">After the conversation</h2>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {data && !sawBottom ? (
            <p id="review-scroll-hint" className="text-sm text-[var(--ep-ink-soft)]">
              Scroll to the bottom.
            </p>
          ) : null}
          <button
            type="button"
            className="ep-button ep-primary"
            disabled={!canContinue}
            aria-describedby={data && !sawBottom ? "review-scroll-hint" : undefined}
            onClick={onContinue}
          >
            {continueLabel}
          </button>
        </div>
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
      {data?.englishFixes?.length ? (
        <div className="mt-3 rounded-lg bg-white/70 p-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide">Say this in French next time</p>
          <ul className="mt-2 space-y-2 text-[15px]">
            {data.englishFixes.map((fix) => (
              <li key={fix.fr}>
                <span>You said “{fix.en}”.</span>{" "}
                <button type="button" className="font-semibold hover:underline" onClick={() => void hear("rousseau", fix.fr, "any")}>
                  {fix.fr}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data?.tip ? <p className="mt-2 text-[15px] italic">{data.tip}</p> : null}
      {data?.practice?.length ? <PracticeCards items={data.practice} /> : null}

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
        canContinue={canContinue}
        onContinue={onContinue}
        continueLabel={continueLabel}
        continueDescribedBy={data && !sawBottom ? "review-scroll-hint" : undefined}
      />
      <div ref={endRef} className="h-px w-full" aria-hidden="true" />
    </section>
  );
}
