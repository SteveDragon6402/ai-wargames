"use client";

import { useState } from "react";
import { Hand } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GESTURES, type GestureId } from "../lib/gerard";

const GESTURE_BUTTONS: { id: GestureId; label: string }[] = [
  { id: "nod", label: "Nod yes" },
  { id: "shake", label: "Shake head" },
  { id: "shrug", label: "Shrug" },
  { id: "wave", label: "Wave" },
];

const FINGERS: GestureId[] = ["one", "two", "three", "four", "five"];

/** The same hand signals as the shop, sent with whatever is already typed. */
export function GesturePad({ disabled, onPick }: { disabled?: boolean; onPick: (gesture: GestureId) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="ep-button ep-ink-quiet" aria-label="Gesture" disabled={disabled}>
          <Hand className="h-5 w-5" aria-hidden="true" />
          Gesture
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[296px] border-[rgb(43_29_20/0.2)] bg-[var(--ep-paper)] p-3 text-[var(--ep-ink)] shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
      >
        <p className="mb-2 text-[13px] text-[var(--ep-ink-soft)]">Sent with anything you've typed or pointed at.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {GESTURE_BUTTONS.map((gesture) => (
            <button
              key={gesture.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(gesture.id);
              }}
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
              onClick={() => {
                setOpen(false);
                onPick(id);
              }}
              className="h-11 rounded-lg border border-[rgb(43_29_20/0.12)] bg-white text-[18px] font-semibold tabular-nums hover:bg-[var(--ep-paper-shade)]"
              aria-label={`Hold up ${index + 1} finger${index ? "s" : ""}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
