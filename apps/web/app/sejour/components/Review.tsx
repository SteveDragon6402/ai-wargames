"use client";

import { useEffect, useState } from "react";
import { Coach } from "./Coach";
import { Wait } from "./Wait";
import type { ReviewLine } from "../hooks/useSejour";
import type { Gap } from "../lib/save";

interface ReviewData {
  glosses: { index: number; en: string }[];
  yours: { index: number; said: string; note: string; en?: string }[];
  analysis: string;
  phrases: { fr: string; en: string }[];
  tip: string;
  gaps?: Gap[];
  mastered?: string[];
  error?: string;
}

export function Review({
  lines,
  scene,
  onContinue,
  onStudy,
}: {
  lines: ReviewLine[];
  scene?: string;
  onContinue: () => void;
  onStudy?: (gaps: Gap[], mastered: string[]) => void;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [quotes, setQuotes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/epicerie/debrief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lines, scene }),
        });
        const body = (await response.json()) as ReviewData;
        if (!cancelled) setData(response.ok ? body : { glosses: [], yours: [], analysis: "", phrases: [], tip: "", error: body.error ?? "The review didn't come back." });
      } catch {
        if (!cancelled) setData({ glosses: [], yours: [], analysis: "", phrases: [], tip: "", error: "No connection." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, scene]);

  useEffect(() => {
    if (!data || data.error) return;
    onStudy?.(data.gaps ?? [], data.mastered ?? []);
  }, [data, onStudy]);

  function quoteLine(text: string) {
    setQuotes((current) => (current.includes(text) ? current.filter((item) => item !== text) : [...current, text].slice(-2)));
  }

  function saidInEnglish(said: string | undefined): string {
    if (said === "Understood") return "That landed";
    if (said === "Close") return "Almost";
    if (said === "English") return "That was English";
    if (said === "French") return "French, and it didn't quite ask";
    if (said === "Unclear") return "Hard to tell";
    return said ?? "";
  }

  const gloss = new Map((data?.glosses ?? []).map((item) => [item.index, item.en]));
  const yours = new Map((data?.yours ?? []).map((item) => [item.index, item]));

  return (
    <section aria-label="How it went">
      <h2 className="ep-display text-[28px]">How it went</h2>
      {!data ? <Wait>Going over what you said.</Wait> : null}
      {data?.error ? <p className="sj-error">{data.error}</p> : null}
      {data?.analysis ? <p className="mt-3 text-[16px] leading-relaxed">{data.analysis}</p> : null}
      <ul className="mt-4 space-y-3">
        {lines.map((line, index) => (
          <li key={index}>
            <p className="text-[15px]">
              <span className="font-semibold">{line.role === "you" ? "You" : "Them"}: </span>
              {line.text}
            </p>
            {line.role === "gerard" && gloss.get(index) ? <p className="mt-1 text-[15px]">{gloss.get(index)}</p> : null}
            {line.role === "you" && yours.get(index)?.en ? <p className="mt-1 text-[15px]">{yours.get(index)?.en}</p> : null}
            {line.role === "you" && yours.get(index) ? (
              <p className="mt-1 text-[15px] leading-relaxed">
                <span className="font-semibold">{saidInEnglish(yours.get(index)?.said)}. </span>
                {yours.get(index)?.note}
              </p>
            ) : null}
            <button type="button" className="ep-button mt-1" aria-pressed={quotes.includes(line.text)} onClick={() => quoteLine(line.text)}>
              {quotes.includes(line.text) ? "Quoted" : "Ask about this line"}
            </button>
          </li>
        ))}
      </ul>
      {data?.tip ? <p className="mt-4 text-[15px]">{data.tip}</p> : null}
      {data ? <Coach lines={lines} scene={scene} quotes={quotes} /> : null}
      <button type="button" className="ep-button ep-primary mt-4" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
