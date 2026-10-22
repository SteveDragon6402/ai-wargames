"use client";

import { useEffect, useState } from "react";
import { Check, Volume2, X } from "lucide-react";
import { ITEM_BY_ID, itemIcon } from "../data/items";
import type { DayList } from "../data/lists";
import { formatEuros, listProgress } from "../lib/shop";
import { canSpeak, speakFrench } from "../lib/voice";
import type { Visit } from "../hooks/useEpicerie";

interface Review {
  glosses: { index: number; en: string }[];
  phrases: { fr: string; en: string }[];
  tip: string;
}

export function Debrief({ visit, list, onNext }: { visit: Visit; list: DayList; onNext: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const progress = listProgress(list, visit.basket);
  const done = progress.filter((entry) => entry.done).length;
  const complete = done === progress.length;
  const lines = visit.transcript.map((turn) => ({ role: turn.role, text: turn.text }));

  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch("/api/epicerie/debrief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    })
      .then(async (response) => {
        const data = (await response.json()) as Review & { error?: string };
        if (!live) return;
        if (!response.ok || data.error) setFailed(true);
        else setReview(data);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const gloss = new Map(review?.glosses.map((item) => [item.index, item.en]) ?? []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ep-cream)]/70">Day {visit.day + 1} · {list.title}</p>
      <h1 className="ep-display mt-2 text-[40px] font-semibold leading-tight text-[var(--ep-cream)]">
        {complete ? "Everything on the list." : `${done} of ${progress.length} on the list.`}
      </h1>
      <p className="mt-2 text-[17px] text-[var(--ep-cream)]/80">
        You spent <span className="tabular-nums">{formatEuros(visit.spent)}</span>
        {visit.learned.length ? ` and heard ${visit.learned.length} new word${visit.learned.length === 1 ? "" : "s"}.` : "."}
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="ep-paper rounded-md p-5" aria-label="The list">
          <h2 className="ep-hand text-[26px] font-bold">The list</h2>
          <ul className="mt-2 grid gap-1.5">
            {progress.map((entry) => {
              const item = ITEM_BY_ID[entry.itemId];
              return (
                <li key={entry.itemId} className="flex items-center gap-3">
                  {entry.done ? <Check className="h-5 w-5 text-[var(--ep-sage)]" aria-label="Bought" /> : <X className="h-5 w-5 text-[var(--ep-terracotta)]" aria-label="Missed" />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemIcon(entry.itemId)} alt="" width={28} height={28} />
                  <span className="flex-1">
                    <span lang="fr" className="font-semibold">
                      {item?.fr}
                    </span>
                    <span className="block text-[13px] text-[var(--ep-ink-soft)]">{entry.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ep-paper rounded-md p-5" aria-label="Phrases worth keeping">
          <h2 className="ep-hand text-[26px] font-bold">Worth keeping</h2>
          {review ? (
            <>
              <ul className="mt-2 grid gap-2">
                {review.phrases.map((phrase) => (
                  <li key={phrase.fr} className="flex items-start gap-2">
                    <span className="flex-1">
                      <span lang="fr" className="block font-semibold">
                        {phrase.fr}
                      </span>
                      <span className="block text-[14px] text-[var(--ep-ink-soft)]">{phrase.en}</span>
                    </span>
                    {canSpeak() ? (
                      <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5" onClick={() => speakFrench(phrase.fr)} aria-label={`Hear ${phrase.fr}`}>
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {review.tip ? <p className="mt-4 border-t border-[rgb(43_29_20/0.12)] pt-3 text-[15px] italic">{review.tip}</p> : null}
            </>
          ) : failed ? (
            <div className="mt-2 text-[15px]">
              <p>The notes could not be written up.</p>
              <button type="button" className="ep-button ep-ink-quiet mt-3" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[15px] italic text-[var(--ep-ink-soft)]">Writing up what he said…</p>
          )}
        </section>
      </div>

      <details className="ep-paper mt-5 rounded-md p-5">
        <summary className="min-h-[44px] cursor-pointer content-center font-semibold">What Gérard said, in English</summary>
        <ol className="mt-3 grid gap-3">
          {visit.transcript.map((turn, index) => (
            <li key={index} className={turn.role === "event" ? "text-[14px] italic text-[var(--ep-ink-soft)]" : ""}>
              {turn.role === "gerard" ? (
                <>
                  <span lang="fr" className="font-semibold">
                    Gérard: {turn.text}
                  </span>
                  <span className="block text-[14px] text-[var(--ep-ink-soft)]">{gloss.get(index) ?? (review ? "" : "…")}</span>
                </>
              ) : turn.role === "you" ? (
                <span>
                  You: {turn.text || <em>(pointing)</em>}
                </span>
              ) : (
                turn.text
              )}
            </li>
          ))}
        </ol>
      </details>

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <a href="/" className="ep-button ep-quiet">
          Back to the table
        </a>
        <button type="button" className="ep-button ep-primary" onClick={onNext}>
          Come back tomorrow
        </button>
      </div>
    </main>
  );
}
