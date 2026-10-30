"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { looksFrench } from "../lib/french";
import { speakFrench } from "../lib/voice";

/** A "Hear this" button for whatever French is highlighted inside. */
export function HearSelection({ children }: { children: React.ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [pick, setPick] = useState<{ text: string; top: number; left: number } | null>(null);
  const [refusal, setRefusal] = useState("");

  useEffect(() => {
    setRefusal("");
  }, [pick?.text]);

  useEffect(() => {
    if (!root) return;
    const read = () => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement && root.contains(active)) {
        const text = active.value.slice(active.selectionStart, active.selectionEnd).replace(/\s+/g, " ").trim();
        if (text.length < 2 || text.length > 280) {
          setPick(null);
          return;
        }
        const rect = active.getBoundingClientRect();
        setPick({ text, top: Math.max(8, rect.top - 52), left: rect.left });
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.anchorNode || !root.contains(selection.anchorNode)) {
        setPick(null);
        return;
      }
      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2 || text.length > 280 || selection.rangeCount === 0) {
        setPick(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) {
        setPick(null);
        return;
      }
      setPick({ text, top: Math.max(8, rect.top - 52), left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)) });
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [root]);

  return (
    <div ref={setRoot}>
      {children}
      {pick ? (
        <div className="fixed z-50 flex max-w-[90vw] items-center gap-2" style={{ top: pick.top, left: pick.left }}>
          <button
            type="button"
            className="ep-button ep-primary shadow-[0_10px_24px_rgb(0_0_0/0.35)]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!looksFrench(pick.text)) {
                setRefusal("That's not French.");
                return;
              }
              setRefusal("");
              void speakFrench(pick.text);
            }}
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Hear this
          </button>
          {refusal ? (
            <p role="alert" className="rounded-full bg-[var(--ep-paper)] px-3 py-2 text-[14px] font-semibold text-[var(--ep-terracotta)] shadow-[0_10px_24px_rgb(0_0_0/0.35)]">
              {refusal}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
