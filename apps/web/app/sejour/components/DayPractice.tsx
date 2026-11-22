"use client";

import { useMemo, useState } from "react";
import { frenchAnswerIsAlmost, frenchAnswersMatch, normalizeFrenchAnswer, promptWithoutGiveaway } from "@/app/course/engine/answers";
import { hear } from "../lib/voice";
import { buildPracticeDeck, type PracticeCard } from "../lib/practice-deck";

function playYes() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const now = ctx.currentTime;
  [523.25, 659.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.06;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
  window.setTimeout(() => void ctx.close(), 500);
}

function englishMatch(given: string, answer: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const typed = norm(given);
  if (typed.length < 2) return false;
  return answer.split("/").map(norm).filter(Boolean).some((part) => typed === part || part.startsWith(typed) || typed.startsWith(part));
}

export function DayPractice({
  day,
  extra,
  onDone,
}: {
  day: number;
  extra: { fr: string; en: string }[];
  onDone: () => void;
}) {
  const cards = useMemo(() => buildPracticeDeck(day, extra), [day, extra]);
  const [index, setIndex] = useState(0);
  const [taught, setTaught] = useState(false);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<null | "yes" | "almost" | "no">(null);
  const [sentence, setSentence] = useState(false);
  const [misses, setMisses] = useState(0);
  const card = cards[index];

  function resetCard() {
    setTaught(false);
    setTyped("");
    setVerdict(null);
    setSentence(false);
    setMisses(0);
  }

  if (!card) {
    return (
      <section className="sj-sheet rounded-xl" aria-label="Words for today">
        <h2 className="ep-display text-[28px]">Words for today</h2>
        <p className="mt-2 text-[15px]">Nothing new to hold onto. Dinner is on the table.</p>
        <button type="button" className="ep-button ep-primary mt-6" onClick={onDone}>
          Dinner
        </button>
      </section>
    );
  }

  const last = index === cards.length - 1;
  const frenchPrompt = card.direction === "to" ? promptWithoutGiveaway(card.en || "", card.fr) : card.fr;
  const prompt = card.direction === "from" ? card.fr : frenchPrompt || card.en || card.fr;
  const locked = verdict === "yes" || verdict === "no";
  const promptGivesFrench = normalizeFrenchAnswer(prompt).includes(normalizeFrenchAnswer(card.fr)) && normalizeFrenchAnswer(card.fr).length >= 4;

  function check() {
    if (!typed.trim() || locked) return;
    const right = card.direction === "from"
      ? englishMatch(typed, card.en)
      : frenchAnswersMatch(typed, card.fr);
    if (right) {
      setVerdict("yes");
      playYes();
      return;
    }
    const nextMisses = misses + 1;
    setMisses(nextMisses);
    if (nextMisses >= 2) {
      setVerdict("no");
      return;
    }
    if (card.direction === "to" && frenchAnswerIsAlmost(typed, card.fr)) {
      setVerdict("almost");
      return;
    }
    setVerdict("no");
  }

  function next() {
    if (last) onDone();
    else {
      resetCard();
      setIndex((n) => n + 1);
    }
  }

  return (
    <section className="sj-sheet rounded-xl" aria-label="Words for today">
      <p className="text-sm tabular-nums text-[var(--ep-ink-soft)]">
        {index + 1} of {cards.length}
      </p>
      {card.fresh && !taught ? (
        <Teach card={card} onReady={() => setTaught(true)} />
      ) : (
        <>
          <p className="mt-3 text-[15px] text-[var(--ep-ink-soft)]">
            {card.direction === "from" ? "What does this mean?" : "How do you say this in French?"}
          </p>
          <h2 className="ep-display mt-2 text-[32px] leading-tight">{prompt}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {card.direction === "from" || locked ? (
              <button type="button" className="ep-button" onClick={() => void hear("rousseau", card.fr, "any")}>
                Hear the French
              </button>
            ) : null}
            {!card.sentence && !promptGivesFrench && locked ? (
              <button type="button" className="ep-button" onClick={() => setSentence((open) => !open)}>
                {sentence ? "Hide the sentence" : "Use it in a sentence"}
              </button>
            ) : null}
          </div>
          {sentence && !card.sentence ? (
            <p className="mt-3 text-[16px]">
              <button type="button" className="text-left hover:underline" onClick={() => void hear("rousseau", card.exampleFr, "any")}>
                <strong>{card.exampleFr}</strong>
              </button>
              {card.exampleEn ? <span className="text-[var(--ep-ink-soft)]"> — {card.exampleEn}</span> : null}
            </p>
          ) : null}
          <form
            className="mt-5 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              check();
            }}
          >
            <input
              className="min-w-[16rem] flex-1 rounded-md border border-[rgb(43_29_20/0.28)] bg-white px-3 py-2 text-[16px]"
              value={typed}
              disabled={locked}
              aria-label={card.direction === "from" ? "Type the English" : "Type the French"}
              placeholder={card.direction === "from" ? "Type the English" : "Type the French"}
              onChange={(event) => {
                setTyped(event.target.value);
                if (verdict === "almost") setVerdict(null);
              }}
            />
            {locked ? null : (
              <button type="submit" className="ep-button ep-primary">
                Check
              </button>
            )}
          </form>
          {verdict === "yes" ? (
            <p className="mt-3 text-[16px] text-emerald-950">Yes. {card.direction === "from" ? card.en : card.fr}</p>
          ) : null}
          {verdict === "almost" ? (
            <p className="mt-3 text-[16px] text-amber-950">Almost. One letter is off.</p>
          ) : null}
          {verdict === "no" ? (
            <p className="mt-3 text-[16px]">The line is <strong>{card.direction === "from" ? card.en : card.fr}</strong>.</p>
          ) : null}
          {locked ? (
            <button type="button" className="ep-button ep-primary mt-6" onClick={next}>
              {last ? "Dinner" : "Next"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function Teach({ card, onReady }: { card: PracticeCard; onReady: () => void }) {
  return (
    <>
      <p className="mt-3 text-[15px] text-[var(--ep-ink-soft)]">A new one.</p>
      <h2 className="ep-display mt-2 text-[32px] leading-tight">{card.fr}</h2>
      <p className="mt-2 text-[16px]">{card.en}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="ep-button" onClick={() => void hear("rousseau", card.fr, "any")}>
          Hear it
        </button>
        <button type="button" className="ep-button ep-primary" onClick={onReady}>
          Try it
        </button>
      </div>
    </>
  );
}
