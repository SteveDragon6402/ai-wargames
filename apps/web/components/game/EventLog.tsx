"use client";

interface EventLogProps {
  events: string[];
  open?: boolean;
  onToggle?: () => void;
}

export function EventLog({ events }: EventLogProps) {
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "var(--font-mono), monospace" }}>
      {/* Transmission header */}
      <div
        className="shrink-0 px-3 py-2 text-[9px] font-bold uppercase tracking-widest"
        style={{ borderBottom: "1px solid var(--color-border)", color: "#444" }}
      >
        &gt;&gt; Incoming Transmission
      </div>

      {/* Events */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {events.length === 0 ? (
          <p
            className="px-3 py-4 text-[9px] uppercase tracking-widest italic"
            style={{ color: "#2a2a2a" }}
          >
            No transmissions received
          </p>
        ) : (
          <ul className="flex flex-col-reverse">
            {[...events].reverse().map((e, i) => (
              <li
                key={i}
                className="px-3 py-2"
                style={{ borderBottom: "1px solid var(--color-border-dim)" }}
              >
                <p
                  className="text-[9px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: "#555" }}
                >
                  TICK: {String(i).padStart(4, "0")}.{String(Math.floor(Math.random() * 99)).padStart(2, "0")}
                </p>
                <p
                  className="text-[10px] leading-relaxed"
                  style={{ color: "#999" }}
                >
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
