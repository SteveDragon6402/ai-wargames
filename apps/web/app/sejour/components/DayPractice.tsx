"use client";

import { useMemo, useState } from "react";
import { recognitionForDay, spokenForDay } from "@/app/course/content/spoken";
import { hear } from "../lib/voice";

interface Card {
  fr: string;
  en: string;
}

export function DayPractice({
  day,
  extra,
  onDone,
}: {
  day: number;
  extra: Card[];
  onDone: () => void;
}) {
  const cards = useMemo(() => {
    const seen = new Set<string>();
    const all = [...extra, ...spokenForDay(day), ...recognitionForDay(day)];
    const out: Card[] = [];
    for (const card of all) {
      const key = card.fr.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(card);
      if (out.length >= 8) break;
    }
    return out;
  }, [day, extra]);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const card = cards[index];

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
  return (
    <section className="sj-sheet rounded-xl" aria-label="Words for today">
      <p className="text-sm tabular-nums text-[var(--ep-ink-soft)]">
        {index + 1} of {cards.length}
      </p>
      <h2 className="ep-display mt-3 text-[32px] leading-tight">{card.fr}</h2>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="ep-button" onClick={() => void hear("rousseau", card.fr, "any")}>
          Hear it
        </button>
        {show ? (
          <p className="self-center text-[16px] text-[var(--ep-ink-soft)]">{card.en || "Say that piece back."}</p>
        ) : (
          <button type="button" className="ep-button" onClick={() => setShow(true)}>
            Show the English
          </button>
        )}
      </div>
      <button
        type="button"
        className="ep-button ep-primary mt-8"
        onClick={() => {
          if (last) onDone();
          else {
            setShow(false);
            setIndex((n) => n + 1);
          }
        }}
      >
        {last ? "Dinner" : "Next word"}
      </button>
    </section>
  );
}
