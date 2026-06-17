"use client";

interface EventLogProps {
  events: string[];
  open: boolean;
  onToggle: () => void;
}

export function EventLog({ events, open, onToggle }: EventLogProps) {
  return (
    <section className="border-t border-slate-800/80">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-1.5 text-left game-label hover:text-slate-300"
      >
        Battle log {open ? "▼" : "▶"} ({events.length})
      </button>
      {open && (
        <ul className="max-h-24 overflow-y-auto overscroll-contain px-3 pb-2 text-[11px] leading-relaxed text-slate-400">
          {events.length === 0 ? (
            <li className="italic text-slate-600">No events yet</li>
          ) : (
            events.map((e, i) => (
              <li key={i} className="border-b border-slate-900 py-1 last:border-0">
                {e}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
