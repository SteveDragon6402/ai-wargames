"use client";

import { useEffect, useRef, useState } from "react";
import { GesturePad } from "@/app/epicerie/components/GesturePad";
import { GESTURES, type GestureId } from "@/app/epicerie/lib/gerard";
import { hear, stopHearing, talk, type TalkReply, type TalkTurn } from "../lib/voice";
import { Wait } from "./Wait";

interface ConversationProps {
  title: string;
  portrait?: string;
  character: string;
  role: "host" | "conductor" | "officer" | "friend" | "waiter";
  who: string;
  context: string;
  memory: string;
  placeholder?: string;
  hearLabel?: string;
  /** She starts. The player has not said anything yet. */
  speakFirst?: boolean;
  endLabel?: string;
  onReply?: (reply: TalkReply, history: TalkTurn[]) => void;
  onEnd?: (history: TalkTurn[]) => void;
}

export function Conversation({ title, portrait, character, role, who, context, memory, placeholder, hearLabel = "Hear this", speakFirst = false, endLabel = "That's enough", onReply, onEnd }: ConversationProps) {
  const [history, setHistory] = useState<TalkTurn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(speakFirst);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [spoken, setSpoken] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopHearing();
    };
  }, []);
  const bubbleAt = history.findLastIndex((turn) => turn.who === "them");
  const last = bubbleAt >= 0 ? history[bubbleAt] : undefined;
  const earlier = history.filter((_, index) => index !== bubbleAt);

  async function land(reply: TalkReply, next: TalkTurn[]) {
    if (!alive.current) return;
    if (reply.error || !reply.line) {
      setHistory(next);
      setError(reply.error ?? "They didn't answer.");
      setBusy(false);
      return;
    }
    const withLine = [...next, { who: "them" as const, text: reply.line }];
    setHistory(withLine);
    onReply?.(reply, withLine);
    const clip = (reply.audio || reply.line).trim();
    setSpoken(clip);
    if (!alive.current) return;
    const problem = await hear(character, clip, "any");
    if (!alive.current) return;
    if (problem) setError(problem);
    if (reply.quiet || reply.left) setClosed(true);
    setBusy(false);
  }

  useEffect(() => {
    if (!speakFirst) return;
    let cancel = false;
    void (async () => {
      const reply = await talk({ role, who, history: [], said: "", context, memory, opening: true });
      if (cancel) return;
      await land(reply, []);
    })();
    return () => {
      cancel = true;
    };
    // She speaks once, when this scene mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakFirst]);

  async function send(said: string, gesture: GestureId | null = null) {
    if (busy || closed) return;
    const words = said.trim();
    if (!words && !gesture) return;
    stopHearing();
    setBusy(true);
    setError(null);
    const visible = [gesture ? GESTURES[gesture].replace(/\btheir\b/g, "your") : "", words].filter(Boolean).join(". ");
    const soFar = [...history, { who: "you" as const, text: visible }];
    setHistory(soFar);
    const reply = await talk({ role, who, history, said: words, context, memory, gesture: gesture ?? undefined });
    if (!alive.current) return;
    await land(reply, soFar);
  }

  return (
    <section aria-label={title} data-voice={character}>
      <div className="flex items-start gap-3">
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="" width={72} height={96} className="h-24 w-[72px] rounded-md object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="ep-display text-[22px]">{title}</p>
          <p className="sj-line mt-1">{last?.text ?? "They haven't spoken yet."}</p>
          {busy ? <Wait>{history.at(-1)?.who === "you" ? "Waiting for an answer." : `${title} is about to speak.`}</Wait> : null}
          {error ? <p className="sj-error">{error}</p> : null}
          {spoken ? (
            <button type="button" className="ep-button mt-2" onClick={() => void hear(character, spoken, "any").then((problem) => setError(problem))}>
              {hearLabel}
            </button>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 max-h-36 space-y-1 overflow-auto">
        {earlier.map((turn, index) => (
          <li key={`${index}-${turn.who}`} className={turn.who === "you" ? "sj-you" : "text-[15px]"}>
            <span className="font-semibold">{turn.who === "you" ? "You" : title}: </span>
            {turn.text}
          </li>
        ))}
      </ul>
      {closed ? null : (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const said = text.trim();
            if (!said) return;
            setText("");
            void send(said);
          }}
        >
          <div className="flex items-start gap-2">
            <GesturePad disabled={busy} onPick={(gesture) => { setText(""); void send(text, gesture); }} />
            <textarea
              className="ep-ruled min-h-[72px] w-full resize-none rounded-md border border-[rgb(43_29_20/0.28)] bg-white p-2"
              value={text}
              placeholder={placeholder ?? "Answer"}
              aria-label={`Answer ${title}`}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </div>
          <button type="submit" className="ep-button ep-primary self-start" disabled={busy || !text.trim()}>
            {busy ? "One moment" : "Answer"}
          </button>
        </form>
      )}
      {onEnd ? (
        <button type="button" className="ep-button mt-3" disabled={busy} onClick={() => { stopHearing(); onEnd(history); }}>
          {endLabel}
        </button>
      ) : null}
    </section>
  );
}
