"use client";

interface EventLogProps {
  events: string[];
  open?: boolean;
  onToggle?: () => void;
}

export function EventLog({ events }: EventLogProps) {
  return (
    <div className="flex h-full flex-col font-mono">
      {/* Transmission header */}
      <div className="shrink-0 border-b border-hairline px-3 py-2 text-xs font-semibold uppercase tracking-wide text-mute">
        &gt;&gt; Incoming Transmission
      </div>

      {/* Events */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {events.length === 0 ? (
          <p className="px-3 py-4 text-xs uppercase tracking-wide italic text-hairline-dim">
            No transmissions received
          </p>
        ) : (
          <ul className="flex flex-col-reverse">
            {[...events].reverse().map((e, i) => (
              <li key={i} className="border-b border-hairline-dim px-3 py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-mute">
                  TICK: {String(i).padStart(4, "0")}.{String(Math.floor(Math.random() * 99)).padStart(2, "0")}
                </p>
                <p className="text-xs leading-relaxed text-body">
                  {e}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
