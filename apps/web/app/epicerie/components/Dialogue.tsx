"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { ITEM_BY_ID } from "../data/items";
import { isGesture, type GestureId } from "../lib/gerard";
import type { Turn } from "../lib/shop";
import type { Problem } from "../hooks/useEpicerie";

const CHAR_MS = 24;

function useTypewriter(text: string): [string, boolean, () => void] {
  const [shown, setShown] = useState(text.length);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: no-preference)");
    if (!still.matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= text.length) window.clearInterval(timer);
    }, CHAR_MS);
    return () => window.clearInterval(timer);
  }, [text]);

  return [text.slice(0, shown), shown >= text.length, () => setShown(text.length)];
}

const DOING: Record<GestureId, string> = {
  nod: "nodding",
  shake: "shaking your head",
  shrug: "shrugging",
  wave: "waving",
  thumbs: "thumbs up",
  one: "holding up one finger",
  two: "holding up two fingers",
  three: "holding up three fingers",
  four: "holding up four fingers",
  five: "holding up five fingers",
};

/** What the player did besides talking, e.g. "pointing at something, nodding". */
export function describeYou(turn: Turn): string {
  const parts: string[] = [];
  if (turn.pointed) {
    const item = ITEM_BY_ID[turn.pointed];
    parts.push(`pointing at ${item ? item.en : "something"}`);
  }
  if (turn.gesture && isGesture(turn.gesture)) parts.push(DOING[turn.gesture]);
  return parts.join(", ");
}

export function YouSaid({ turn }: { turn: Turn }) {
  const acts = describeYou(turn);
  return (
    <>
      <span className="font-semibold">You</span>
      {acts ? <em className="text-[var(--ep-ink-soft)]"> ({acts})</em> : null}
      {turn.text ? (
        <>
          : <span lang="fr">{turn.text}</span>
        </>
      ) : null}
    </>
  );
}

interface DialogueProps {
  gerard: Turn | null;
  before: Turn | null;
  busy: boolean;
  problem: Problem | null;
  canReplay: boolean;
  onReplay: () => void;
  onDismiss: () => void;
  children?: React.ReactNode;
}

export function Dialogue({ gerard, before, busy, problem, canReplay, onReplay, onDismiss, children }: DialogueProps) {
  const [typed, done, skip] = useTypewriter(busy ? "" : (gerard?.text ?? ""));

  return (
    <section className="ep-dialogue px-5 pb-4 pt-6 sm:px-7" aria-label="Conversation with Gérard">
      <span className="ep-nameplate ep-display">Gérard</span>

      {before ? (
        <p className="mb-2 pr-12 text-[14px] leading-snug text-[var(--ep-ink-soft)]">
          {before.role === "event" ? (
            <em>{before.text}</em>
          ) : (
            <YouSaid turn={before} />
          )}
        </p>
      ) : null}

      <div className="min-h-[88px]" aria-live="polite" aria-busy={busy}>
        {busy ? (
          <p className="ep-dots flex items-center gap-1.5 py-3 text-[18px] text-[var(--ep-ink-soft)]">
            <span className="sr-only">Gérard is thinking</span>
            <span aria-hidden="true">●</span>
            <span aria-hidden="true">●</span>
            <span aria-hidden="true">●</span>
          </p>
        ) : gerard ? (
          <>
            <button
              type="button"
              className="block w-full cursor-default text-left"
              onClick={skip}
              aria-label={done ? gerard.text : "Show the whole line"}
            >
              <span lang="fr" className="ep-display text-[22px] leading-[1.4] text-[var(--ep-ink)] sm:text-[24px]">
                {typed}
                {!done ? <span aria-hidden="true" className="opacity-30">▍</span> : null}
              </span>
            </button>
            {gerard.action && done ? <p className="mt-1.5 text-[14px] italic text-[var(--ep-ink-soft)]">{gerard.action}</p> : null}
          </>
        ) : (
          <p className="py-3 text-[16px] italic text-[var(--ep-ink-soft)]">The shop is quiet.</p>
        )}
      </div>

      {canReplay && gerard?.text && !busy ? (
        <button
          type="button"
          onClick={onReplay}
          className="absolute right-4 top-3 grid h-11 w-11 place-items-center rounded-full text-[var(--ep-ink-soft)] hover:bg-black/5"
          aria-label="Hear Gérard say it again"
        >
          <Volume2 className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}

      {problem ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--ep-terracotta)]/10 px-3 py-2 text-[14px] text-[var(--ep-terracotta)]">
          <span className="flex-1">{problem.message}</span>
          <button type="button" className="ep-button ep-ink-quiet min-h-[40px] py-1 text-[14px]" onClick={problem.retry}>
            Try again
          </button>
          <button type="button" className="text-[13px] underline" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}

      {children}
    </section>
  );
}
