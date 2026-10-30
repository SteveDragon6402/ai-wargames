"use client";

import { useEffect, useState } from "react";
import { Check, Volume2, X } from "lucide-react";
import { ITEM_BY_ID, itemIcon } from "../data/items";
import type { DayList } from "../data/lists";
import { labelForLine, phrasesBuriedIn, reviewProse, type LineLabel } from "../lib/french";
import { GESTURES, isGesture } from "../lib/gerard";
import { formatEuros, listProgress, type Turn } from "../lib/shop";
import { canSpeak, speakFrench } from "../lib/voice";
import type { Visit } from "../hooks/useEpicerie";
import { HearSelection } from "./HearSelection";

interface Review {
  glosses: { index: number; en: string }[];
  yours: { index: number; said: LineLabel; note: string }[];
  phrases: { fr: string; en: string }[];
  tip: string;
  analysis: string;
}

const SAID_TONE: Record<LineLabel, string> = {
  Understood: "bg-[var(--ep-sage)] text-[var(--ep-cream)]",
  Close: "bg-[var(--ep-brass)] text-[var(--ep-ink)]",
  French: "bg-[var(--ep-walnut)] text-[var(--ep-cream)]",
  English: "bg-[var(--ep-terracotta)] text-[var(--ep-cream)]",
  Unclear: "bg-[rgb(43_29_20/0.12)] text-[var(--ep-ink)]",
};

function youDid(turn: Turn): string {
  const acts = [
    turn.pointed ? `pointing at ${ITEM_BY_ID[turn.pointed]?.en ?? "something"}` : "",
    turn.gesture && isGesture(turn.gesture) ? GESTURES[turn.gesture] : "",
  ].filter(Boolean);
  const said = turn.text.trim();
  if (!said) return acts.length ? `(${acts.join(", ")})` : "(silence)";
  return acts.length ? `${said} — ${acts.join(", ")}` : said;
}

export function Debrief({
  visit,
  list,
  journal,
  onJournal,
  onNext,
}: {
  visit: Visit;
  list: DayList;
  journal: string;
  onJournal: (journal: string) => void;
  onNext: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState(journal);
  const progress = listProgress(list, visit.basket);
  const done = progress.filter((entry) => entry.done).length;
  const complete = done === progress.length;
  const lines = visit.transcript.map((turn) => ({ role: turn.role, text: turn.text, pointed: turn.pointed, gesture: turn.gesture }));

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

  useEffect(() => {
    const timer = window.setTimeout(() => onJournal(notes), 400);
    return () => {
      window.clearTimeout(timer);
      onJournal(notes);
    };
  }, [notes, onJournal]);

  const gloss = new Map(review?.glosses.map((item) => [item.index, item.en]) ?? []);
  const yours = new Map(review?.yours.map((item) => [item.index, item]) ?? []);
  const analysis = review?.analysis ? reviewProse(review.analysis) : "";
  const phrases = review?.phrases.length ? review.phrases : phrasesBuriedIn(review?.analysis ?? "");
  const customer = visit.transcript.map((turn, index) => ({ turn, index })).filter((item) => item.turn.role === "you");
  const shopkeeper = visit.transcript.map((turn, index) => ({ turn, index })).filter((item) => item.turn.role === "gerard");

  return (
    <HearSelection>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="text-[13px] uppercase tracking-[0.16em] text-[var(--ep-cream)]/70">
          Day {visit.day + 1} · {list.title}
        </p>
        <h1 className="ep-display mt-2 max-w-[18ch] text-balance text-[40px] font-semibold leading-tight text-[var(--ep-cream)]">
          {complete ? "Everything on the list." : `${done} of ${progress.length} on the list.`}
        </h1>
        <p className="mt-2 text-[17px] text-[var(--ep-cream)]/80">
          You spent <span className="tabular-nums">{formatEuros(visit.spent)}</span>.
        </p>

        <section className="ep-paper mt-8 rounded-md p-5" aria-label="How the visit went">
          <h2 className="ep-display text-[26px] font-semibold">How it went</h2>
          {analysis ? (
            <p className="mt-3 text-[17px] leading-relaxed text-pretty">{analysis}</p>
          ) : failed ? (
            <div className="mt-3 text-[15px]">
              <p>The visit could not be read back.</p>
              <button type="button" className="ep-button ep-ink-quiet mt-3" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[15px] italic text-[var(--ep-ink-soft)]">Reading the visit back…</p>
          )}
          {review?.tip ? <p className="mt-4 border-t border-[rgb(43_29_20/0.12)] pt-3 text-[15px]">{review.tip}</p> : null}
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="ep-paper rounded-md p-5" aria-label="What you said">
            <h2 className="ep-display text-[22px] font-semibold">What you said</h2>
            <ol className="mt-3 grid gap-4">
              {customer.length ? (
                customer.map(({ turn, index }) => {
                  const verdict = yours.get(index);
                  const said = verdict ? labelForLine(verdict.said, turn.text) : null;
                  return (
                    <li key={index}>
                      <p lang={turn.text.trim() ? "fr" : undefined}>{youDid(turn)}</p>
                      {verdict && said ? (
                        <>
                          <p className="mt-1.5">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${SAID_TONE[said]}`}>{said}</span>
                          </p>
                          <p className="mt-1 text-[14px] leading-relaxed text-[var(--ep-ink-soft)]">{reviewProse(verdict.note)}</p>
                        </>
                      ) : (
                        <p className="mt-1 text-[14px] italic text-[var(--ep-ink-soft)]">{review || failed ? "" : "…"}</p>
                      )}
                    </li>
                  );
                })
              ) : (
                <li className="text-[15px] text-[var(--ep-ink-soft)]">You left without a word.</li>
              )}
            </ol>
          </section>

          <section className="ep-paper rounded-md p-5" aria-label="What Gérard said">
            <h2 className="ep-display text-[22px] font-semibold">What he said</h2>
            <ol className="mt-3 grid gap-4">
              {shopkeeper.map(({ turn, index }) => (
                <li key={index}>
                  <p lang="fr" className="font-semibold">
                    {turn.text}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--ep-ink-soft)]">{gloss.get(index) ?? (review || failed ? "" : "…")}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <p className="mt-3 text-[13px] text-[var(--ep-cream)]/70">Highlight French to hear it.</p>

        {phrases.length ? (
          <section className="ep-paper mt-5 rounded-md p-5" aria-label="Phrases worth keeping">
            <h2 className="ep-display text-[22px] font-semibold">Worth keeping</h2>
            <ul className="mt-3 grid gap-2">
              {phrases.map((phrase) => (
                <li key={phrase.fr} className="flex items-start gap-2">
                  <span className="flex-1">
                    <span lang="fr" className="block font-semibold">
                      {phrase.fr}
                    </span>
                    <span className="block text-[14px] text-[var(--ep-ink-soft)]">{phrase.en}</span>
                  </span>
                  {canSpeak() ? (
                    <button type="button" className="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5" onClick={() => speakFrench(phrase.fr)} aria-label={`Hear ${phrase.fr}`}>
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="ep-paper ep-ruled relative mt-5 rounded-md px-5 pb-4 pt-5" aria-label="Your notebook">
          <label htmlFor="ep-notebook" className="ep-hand text-[28px] font-bold leading-none">
            Your notebook
          </label>
          <textarea
            id="ep-notebook"
            className="ep-notebook mt-3 w-full bg-transparent text-[var(--ep-ink)]"
            value={notes}
            spellCheck
            placeholder="une baguette, a loaf"
            onChange={(event) => setNotes(event.target.value.slice(0, 4000))}
          />
        </section>

        <section className="ep-paper mt-5 rounded-md p-5" aria-label="The list">
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

        <div className="mt-8 flex flex-wrap justify-between gap-3">
          <a href="/" className="ep-button ep-quiet">
            Back to the table
          </a>
          <button type="button" className="ep-button ep-primary" onClick={onNext}>
            Come back tomorrow
          </button>
        </div>
      </main>
    </HearSelection>
  );
}
