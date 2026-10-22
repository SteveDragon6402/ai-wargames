"use client";

import { useState } from "react";
import { Hand, Send, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ITEM_BY_ID, itemIcon } from "../data/items";
import { GESTURES, type GestureId } from "../lib/gerard";

const GESTURE_BUTTONS: { id: GestureId; label: string }[] = [
  { id: "nod", label: "Nod yes" },
  { id: "shake", label: "Shake head" },
  { id: "shrug", label: "Shrug" },
  { id: "wave", label: "Wave" },
];

const FINGERS: GestureId[] = ["one", "two", "three", "four", "five"];

interface ComposerProps {
  pointed: string | null;
  busy: boolean;
  disabled: boolean;
  onClearPoint: () => void;
  onOpenShelves: () => void;
  text: string;
  onText: (text: string) => void;
  onSend: (text: string, gesture: GestureId | null) => void;
}

export function Composer({ pointed, busy, disabled, text, onText, onClearPoint, onOpenShelves, onSend }: ComposerProps) {
  const [gesturesOpen, setGesturesOpen] = useState(false);
  const item = pointed ? ITEM_BY_ID[pointed] : null;
  const blocked = busy || disabled;
  const canSend = !blocked && Boolean(text.trim() || pointed);

  function send(gesture: GestureId | null = null) {
    if (blocked || (!text.trim() && !pointed && !gesture)) return;
    onSend(text, gesture);
    onText("");
    setGesturesOpen(false);
  }

  return (
    <form
      className="mt-3 border-t border-[rgb(43_29_20/0.12)] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {item ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ep-brass)]/25 py-1 pl-1.5 pr-1 text-[14px] text-[var(--ep-ink)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={itemIcon(item.id)} alt="" width={26} height={26} />
            <span>Pointing at this</span>
            <button type="button" onClick={onClearPoint} className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/10" aria-label="Stop pointing">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className="text-[14px] text-[var(--ep-ink-soft)]">
            <span className="hidden md:inline">Click anything on the shelves to point at it.</span>
            <button type="button" className="inline-flex min-h-[44px] items-center underline md:hidden" onClick={onOpenShelves}>
              Point at something on the shelves
            </button>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Popover open={gesturesOpen} onOpenChange={setGesturesOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="ep-button ep-icon ep-ink-quiet" aria-label="Gesture" disabled={blocked}>
              <Hand className="h-5 w-5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            className="w-[296px] border-[rgb(43_29_20/0.2)] bg-[var(--ep-paper)] p-3 text-[var(--ep-ink)] shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          >
            <p className="mb-2 text-[13px] text-[var(--ep-ink-soft)]">Sent along with anything you have typed or pointed at.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {GESTURE_BUTTONS.map((gesture) => (
                <button
                  key={gesture.id}
                  type="button"
                  onClick={() => send(gesture.id)}
                  className="h-11 rounded-lg border border-[rgb(43_29_20/0.12)] bg-white px-2 text-[15px] font-semibold hover:bg-[var(--ep-paper-shade)]"
                  title={`You ${GESTURES[gesture.id].replace(/\btheir\b/g, "your")}`}
                >
                  {gesture.label}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-[13px] text-[var(--ep-ink-soft)]">Hold up fingers</p>
            <div className="grid grid-cols-5 gap-1.5">
              {FINGERS.map((id, index) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => send(id)}
                  className="h-11 rounded-lg border border-[rgb(43_29_20/0.12)] bg-white text-[18px] font-semibold tabular-nums hover:bg-[var(--ep-paper-shade)]"
                  aria-label={`Hold up ${index + 1} finger${index ? "s" : ""}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <label className="sr-only" htmlFor="ep-say">
          What you say
        </label>
        <input
          id="ep-say"
          value={text}
          onChange={(event) => onText(event.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Say something… in French if you can"
          className="h-11 min-w-0 flex-1 rounded-full border border-[rgb(43_29_20/0.2)] bg-white/70 px-4 text-[16px] text-[var(--ep-ink)] placeholder:text-[var(--ep-ink-soft)]/70"
          disabled={blocked}
          lang="fr"
        />
        <button type="submit" className="ep-button ep-primary shrink-0" disabled={!canSend}>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Say</span>
        </button>
      </div>
    </form>
  );
}
