"use client";

import { useEffect, useState } from "react";

export function StreakClose({
  streak,
  previousStreak,
  examReady,
}: {
  streak: number;
  previousStreak: number;
  examReady: boolean;
}) {
  const [shown, setShown] = useState(previousStreak);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(streak);
      return;
    }
    const id = window.setTimeout(() => setShown(streak), 420);
    return () => window.clearTimeout(id);
  }, [previousStreak, streak]);

  async function leave() {
    await fetch("/api/auth/me", { method: "DELETE" }).catch(() => null);
    window.location.href = "/";
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#231b12] px-6 text-[#fbf7ee]" role="dialog" aria-label="Day complete">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">Day complete</p>
        <p
          className="mt-4 font-serif text-[7.5rem] leading-none tabular-nums transition-transform duration-500"
          style={{ transform: shown === streak ? "scale(1)" : "scale(0.82)" }}
        >
          {shown}
        </p>
        <h1 className="mt-3 font-serif text-3xl">{streak === 1 ? "day in a row" : "days in a row"}</h1>
        <p className="mt-3 text-[15px] text-[#e7d7c0]">
          {examReady ? "The week exam is waiting when you come back." : "Madame will have the coffee on tomorrow."}
        </p>
        <button
          type="button"
          onClick={() => void leave()}
          className="mt-8 w-full rounded-xl bg-[#f4e7cf] px-6 py-4 text-lg font-bold text-[#231b12]"
        >
          Log off
        </button>
      </div>
    </div>
  );
}
