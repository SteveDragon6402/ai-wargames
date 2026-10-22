"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { DayList } from "../data/lists";
import { listProgress, type Line } from "../lib/shop";

function ListEntryRow({ entry }: { entry: ReturnType<typeof listProgress>[number] }) {
  const [open, setOpen] = useState(false);
  const closing = useRef<number | null>(null);

  const show = () => {
    if (closing.current) window.clearTimeout(closing.current);
    setOpen(true);
  };
  const hide = () => {
    closing.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <button
            type="button"
            className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 text-left hover:bg-black/5"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded border-2 ${entry.done ? "border-[var(--ep-sage)] bg-[var(--ep-sage)] text-white" : "border-[rgb(43_29_20/0.45)]"}`}
              aria-hidden="true"
            >
              {entry.done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </span>
            <span className={`ep-hand flex-1 text-[24px] leading-tight ${entry.done ? "text-[var(--ep-ink-soft)] line-through decoration-2" : ""}`}>{entry.text}</span>
            {entry.need > 1 || (entry.have > 0 && !entry.done) ? (
              <span className="text-[13px] tabular-nums text-[var(--ep-ink-soft)]">
                {Math.min(entry.have, entry.need)}/{entry.need}
              </span>
            ) : null}
            <span className="sr-only">{entry.done ? "Got it." : "Still needed."}</span>
          </button>
        </PopoverAnchor>
        <PopoverContent
          side="left"
          align="start"
          className="w-[260px] border-[rgb(43_29_20/0.2)] bg-[var(--ep-paper)] text-[var(--ep-ink)] shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          onMouseEnter={show}
          onMouseLeave={hide}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="ep-hand text-[22px] leading-snug">“{entry.note}”</p>
          <p className="mt-3 border-t border-[rgb(43_29_20/0.12)] pt-3 text-[14px] text-[var(--ep-ink-soft)]">
            {entry.done ? "In your bag." : entry.have ? `You have ${entry.have} of ${entry.need}.` : `You need ${entry.need}.`}
          </p>
        </PopoverContent>
      </Popover>
    </li>
  );
}

export function GroceryList({ list, basket }: { list: DayList; basket: Line[] }) {
  const progress = listProgress(list, basket);
  const done = progress.filter((entry) => entry.done).length;
  return (
    <section className="ep-paper ep-ruled ep-taped relative rotate-[-0.6deg] rounded-sm px-4 pb-4 pt-6" aria-label="Madame Rousseau's shopping list">
      <div className="flex items-baseline justify-between gap-2 px-2">
        <h2 className="ep-hand text-[30px] font-bold leading-none">{list.title}</h2>
        <p className="text-[13px] tabular-nums text-[var(--ep-ink-soft)]">
          {done} of {progress.length}
        </p>
      </div>
      <ul className="mt-2">
        {progress.map((entry) => (
          <ListEntryRow key={entry.itemId} entry={entry} />
        ))}
      </ul>
      <p className="mt-2 px-2 text-[12px] text-[var(--ep-ink-soft)]">Tap a line for her note.</p>
    </section>
  );
}
