"use client";

import { useEffect, useState } from "react";
import { looksFrench } from "@/app/epicerie/lib/french";
import { hear } from "../lib/voice";
import type { Phrase } from "../lib/save";

interface SelectionMenuProps {
  phrases: Phrase[];
  onAdd: (fr: string, en: string) => void;
}

interface Pick {
  text: string;
  voice: string;
  left: number;
  /** Sit above the line, growing upward, so the words stay visible. */
  above: boolean;
  edge: number;
}

const VOICES = new Set([
  "gerard",
  "rousseau",
  "announcer",
  "conductor",
  "officer",
  "serge",
  "amina",
  "joel",
  "lea",
  "marc",
  "ines",
  "paul",
  "chloe",
  "henri",
  "monique",
  "yves",
  "nadine",
  "luc",
]);

function voiceOf(node: Node): string {
  const element = node instanceof Element ? node : node.parentElement;
  const id = element?.closest("[data-voice]")?.getAttribute("data-voice") ?? "rousseau";
  return VOICES.has(id) ? id : "rousseau";
}

function readPick(): Pick | null | undefined {
  const menu = document.getElementById("sj-selection-menu");
  if (menu?.contains(document.activeElement)) return undefined;
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const text = active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0).replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 280) return null;
    const rect = active.getBoundingClientRect();
    return place(text, voiceOf(active), rect);
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode || selection.rangeCount === 0) return null;
  if (menu?.contains(selection.anchorNode)) return undefined;
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 280) return null;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return place(text, voiceOf(selection.anchorNode), rect);
}

function place(text: string, voice: string, rect: DOMRect): Pick {
  const above = rect.top > 160;
  const width = Math.min(440, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  return { text, voice, left, above, edge: above ? window.innerHeight - rect.top + 8 : rect.bottom + 8 };
}

async function translate(text: string): Promise<{ fr: string; en: string } | { error: string }> {
  try {
    const response = await fetch("/api/sejour/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json().catch(() => null)) as { fr?: string; en?: string; error?: string } | null;
    if (!response.ok || !data?.fr || !data.en) return { error: data?.error ?? "The translation didn't come through." };
    return { fr: data.fr, en: data.en };
  } catch {
    return { error: "No connection." };
  }
}

/** Hear, translate, or keep whatever is highlighted. */
export function SelectionMenu({ phrases, onAdd }: SelectionMenuProps) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNote("");
  }, [pick?.text]);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const menu = document.getElementById("sj-selection-menu");
        if (menu?.contains(document.activeElement)) return;
        const next = readPick();
        setPick((current) => (next === undefined ? current : next));
      });
    };
    document.addEventListener("selectionchange", read);
    return () => {
      document.removeEventListener("selectionchange", read);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  async function pair(): Promise<{ fr: string; en: string } | { error: string }> {
    if (!pick) return { error: "Highlight a line." };
    return translate(pick.text);
  }

  return pick ? (
    <div
      id="sj-selection-menu"
      role="toolbar"
      aria-label="Highlighted line"
      className="fixed z-50 flex max-w-[90vw] flex-col items-start gap-1"
      style={pick.above ? { bottom: pick.edge, left: pick.left } : { top: pick.edge, left: pick.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="rounded-xl bg-[var(--ep-paper)] p-1 shadow-[0_10px_24px_rgb(0_0_0/0.35)]">
        <p className="px-2 pt-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">This highlight</p>
        <div className="mt-1 flex flex-wrap gap-1">
        <button
          type="button"
          className="ep-button ep-primary"
          onClick={() => {
            setNote("");
            void hear(pick.voice, pick.text, "any").then((problem) => {
              if (problem) setNote(problem);
            });
          }}
        >
          Hear
        </button>
        <button
          type="button"
          className="ep-button ep-ink-quiet"
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setNote("");
            void pair().then((result) => {
              setBusy(false);
              if ("error" in result) {
                setNote(result.error);
                return;
              }
              setNote(looksFrench(pick.text) ? `English: ${result.en}` : `French: ${result.fr}`);
            });
          }}
        >
          {busy ? "…" : "Translate"}
        </button>
        <button
          type="button"
          className="ep-button ep-ink-quiet"
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setNote("");
            void pair().then((result) => {
              setBusy(false);
              if ("error" in result) {
                setNote(result.error);
                return;
              }
              if (!looksFrench(result.fr)) {
                setNote("That's not French.");
                return;
              }
              if (phrases.some((item) => item.fr.toLowerCase() === result.fr.toLowerCase())) {
                setNote("Already in the phrasebook.");
                return;
              }
              onAdd(result.fr, result.en);
              setNote("In the phrasebook.");
            });
          }}
        >
          Add to phrasebook
        </button>
        </div>
      </div>
      {note ? (
        <p role="status" className="max-w-sm rounded-lg bg-[var(--ep-paper)] px-3 py-2 text-[15px] text-[var(--ep-ink)] shadow-[0_10px_24px_rgb(0_0_0/0.28)]">
          {note}
        </p>
      ) : null}
    </div>
  ) : null;
}
