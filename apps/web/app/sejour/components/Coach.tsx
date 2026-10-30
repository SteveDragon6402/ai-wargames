"use client";

import { useState } from "react";
import { HANDOUT_BY_ID } from "../data/handouts";
import type { ReviewLine } from "../hooks/useSejour";
import { Wait } from "./Wait";

interface CoachTurn {
  who: "you" | "them";
  text: string;
}

/** A chat under the review. The scene stays in the request, and a line can be quoted. */
export function Coach({ lines, scene, quotes }: { lines: ReviewLine[]; scene?: string; quotes: string[] }) {
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<CoachTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handouts, setHandouts] = useState<string[]>([]);

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setError("");
    setQuestion("");
    const history = chat;
    setChat((current) => [...current, { who: "you", text: asked }]);
    try {
      const response = await fetch("/api/sejour/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines, scene, quotes, question: asked, history }),
      });
      const body = (await response.json()) as { say?: string; handouts?: string[]; error?: string };
      if (!response.ok || !body.say) {
        setError(body.error ?? "The coach didn't answer.");
        return;
      }
      setChat((current) => [...current, { who: "them", text: body.say ?? "" }]);
      setHandouts(Array.isArray(body.handouts) ? body.handouts : []);
    } catch {
      setError("No connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[rgb(43_29_20/0.15)] pt-4">
      <h3 className="ep-display text-[22px]">Ask about what you said</h3>
      {quotes.length ? (
        <ul className="mt-2 space-y-1">
          {quotes.map((quote) => (
            <li key={quote} className="text-[15px] italic">
              “{quote}”
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[15px]">Choose a line above, then ask.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="ep-button" disabled={!quotes.length || busy} onClick={() => void ask("How would I say what I meant?")}>
          How would I say what I meant?
        </button>
        <button type="button" className="ep-button" disabled={!quotes.length || busy} onClick={() => void ask("Why was this wrong?")}>
          Why was this wrong?
        </button>
        <button type="button" className="ep-button" disabled={quotes.length < 2 || busy} onClick={() => void ask("What's the difference between these?")}>
          What&apos;s the difference between these?
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {chat.map((turn, index) => (
          <li key={`${index}-${turn.who}`} className={turn.who === "you" ? "sj-you" : "text-[15px] leading-relaxed"}>
            <span className="font-semibold">{turn.who === "you" ? "You" : "Coach"}: </span>
            {turn.text}
          </li>
        ))}
      </ul>
      {busy ? <Wait>The coach is reading the scene.</Wait> : null}
      {error ? <p className="sj-error">{error}</p> : null}
      {handouts.length ? <p className="mt-2 text-[15px]">Handout: {handouts.map((id) => HANDOUT_BY_ID[id]?.title ?? id).join(", ")}</p> : null}
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <textarea
          className="ep-ruled min-h-[72px] w-full resize-none rounded-md border border-[rgb(43_29_20/0.28)] bg-white p-2"
          value={question}
          placeholder="Ask about a line"
          aria-label="Ask the coach"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="ep-button ep-primary self-start" disabled={busy || !question.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
