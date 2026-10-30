"use client";

import { HANDOUTS } from "../data/handouts";
import type { Gap } from "../lib/save";

export function Lessons({ gaps, onClose }: { gaps: Gap[]; onClose: () => void }) {
  const marked = new Set(gaps.map((gap) => gap.id));
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-3 sm:items-center" role="dialog" aria-label="Lessons">
      <div className="sj-sheet max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="ep-display text-[26px]">Lessons</h2>
          <button type="button" className="ep-button" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="mt-3 space-y-4">
          {HANDOUTS.map((handout) => (
            <li key={handout.id}>
              <h3 className="text-[18px] font-semibold">
                {handout.title}
                {marked.has(handout.id) ? " · for you" : ""}
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed">{handout.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
