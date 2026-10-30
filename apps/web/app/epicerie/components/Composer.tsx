"use client";

import { Send, X } from "lucide-react";
import { ITEM_BY_ID, itemIcon } from "../data/items";
import { type GestureId } from "../lib/gerard";
import { GesturePad } from "./GesturePad";

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
  const item = pointed ? ITEM_BY_ID[pointed] : null;
  const blocked = busy || disabled;
  const canSend = !blocked && Boolean(text.trim() || pointed);

  function send(gesture: GestureId | null = null) {
    if (blocked || (!text.trim() && !pointed && !gesture)) return;
    onSend(text, gesture);
    onText("");
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
        <GesturePad disabled={blocked} onPick={(gesture) => send(gesture)} />

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
