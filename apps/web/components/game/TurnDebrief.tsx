"use client";

import { useCallback, useEffect, useState } from "react";
import type { TurnEvent } from "@wargame/shared";
import { formatEvent } from "@/lib/format-event";

interface HistoryEntry {
  turn: number;
  events: TurnEvent[];
}

interface TurnDebriefProps {
  completedTurn: number;
  events: TurnEvent[];
  roomId: string;
  availableTurns: number[];
  onDismiss: () => void;
}

function groupEventsByNode(events: TurnEvent[]): Map<string, TurnEvent[]> {
  const groups = new Map<string, TurnEvent[]>();
  const ungrouped: TurnEvent[] = [];

  for (const e of events) {
    const nodeId =
      "nodeId" in e
        ? (e as { nodeId: string }).nodeId
        : "from" in e
          ? (e as { from: string }).from
          : null;

    if (nodeId) {
      const existing = groups.get(nodeId) ?? [];
      existing.push(e);
      groups.set(nodeId, existing);
    } else {
      ungrouped.push(e);
    }
  }

  if (ungrouped.length > 0) {
    groups.set("__general__", ungrouped);
  }

  return groups;
}

function getBattleOutcomeLabel(event: Extract<TurnEvent, { type: "node_battle" }>): string {
  if (event.overallWinner === "draw") return "No decisive outcome";
  const winFaction =
    event.overallWinner === "side1" ? event.side1FactionId : event.side2FactionId;
  return `${(winFaction ?? "").toUpperCase()} PREVAILS`;
}

function EventItem({ event }: { event: TurnEvent }) {
  const isNarrative = event.type === "node_battle";
  const text = formatEvent(event);
  if (!text) return null;

  if (isNarrative) {
    const narrativeEvent = event as Extract<TurnEvent, { type: "node_battle" }>;
    return (
      <li
        className="mb-4"
        style={{ borderLeft: "2px solid #8b6914", paddingLeft: "12px" }}
      >
        <p
          className="mb-1 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "#8b6914" }}
        >
          {getBattleOutcomeLabel(narrativeEvent)}
        </p>
        <p
          className="font-narrative text-sm leading-relaxed"
          style={{ color: "#3a2e1e", fontStyle: "italic" }}
        >
          {narrativeEvent.narrative}
        </p>
      </li>
    );
  }

  return (
    <li
      className="py-0.5 text-[10px] uppercase tracking-wide"
      style={{ color: "#888", fontFamily: "var(--font-mono), monospace" }}
    >
      &gt; {text}
    </li>
  );
}

export function TurnDebrief({
  completedTurn,
  events,
  roomId,
  availableTurns,
  onDismiss,
}: TurnDebriefProps) {
  const [viewingTurn, setViewingTurn] = useState(completedTurn);
  const [viewingEvents, setViewingEvents] = useState<TurnEvent[]>(events);
  const [loading, setLoading] = useState(false);

  const loadTurn = useCallback(
    async (turn: number) => {
      if (turn === completedTurn) {
        setViewingTurn(completedTurn);
        setViewingEvents(events);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/history?turn=${turn}`);
        if (res.ok) {
          const data = (await res.json()) as HistoryEntry;
          setViewingTurn(data.turn);
          setViewingEvents(data.events);
        }
      } finally {
        setLoading(false);
      }
    },
    [completedTurn, events, roomId]
  );

  const sortedTurns = [...availableTurns].sort((a, b) => a - b);
  const minTurn = sortedTurns[0] ?? completedTurn;
  const maxTurn = sortedTurns[sortedTurns.length - 1] ?? completedTurn;
  const currentIdx = sortedTurns.indexOf(viewingTurn);
  const prevTurn = currentIdx > 0 ? sortedTurns[currentIdx - 1] : null;
  const nextTurn = currentIdx < sortedTurns.length - 1 ? sortedTurns[currentIdx + 1] : null;

  const grouped = groupEventsByNode(viewingEvents);

  /* Separate narrative battles from other events */
  const battleEvents = viewingEvents.filter((e) => e.type === "node_battle");
  const otherEvents = viewingEvents.filter((e) => e.type !== "node_battle");

  const casualtyEvents = otherEvents.filter(
    (e) => e.type === "battle_result" || e.type === "combat" || e.type === "rout" || e.type === "morale_change"
  );
  const movementEvents = otherEvents.filter(
    (e) => e.type === "move" || e.type === "intercept" || e.type === "reinforce"
  );
  const victoryEvent = viewingEvents.find((e) => e.type === "victory");

  /* Generate a narrative title from events */
  const narrativeTitle = battleEvents.length > 0
    ? `Conflict at the Fords — Turn ${viewingTurn}`
    : victoryEvent
      ? "The War is Decided"
      : `Turn ${viewingTurn} — No Major Engagements`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  /* Slider range — map turn index to percentage */
  const sliderPct =
    sortedTurns.length > 1
      ? (currentIdx / (sortedTurns.length - 1)) * 100
      : 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Top bar */}
      <div
        className="flex shrink-0 items-start justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-widest"
            style={{ color: "#ddd", fontFamily: "var(--font-mono), monospace" }}
          >
            Tactical Resolution
          </h1>
          <p
            className="mt-0.5 text-[9px] uppercase tracking-widest"
            style={{ color: "#444" }}
          >
            Turn {viewingTurn} · Cycle Complete · Awaiting Orders
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "var(--color-gold)" }}
          >
            Code: Epsilon-Nine
          </p>
          <p className="text-[8px] uppercase tracking-widest" style={{ color: "#333" }}>
            ● Link Secure
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left — parchment narrative card */}
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div
            className="flex flex-1 flex-col overflow-hidden"
            style={{ background: "#f5efe0", border: "1px solid #c8a96a" }}
          >
            {/* Parchment header */}
            <div
              className="shrink-0 px-6 pt-5 pb-2"
              style={{ borderBottom: "1px solid #d4b97a" }}
            >
              <h2
                className="font-narrative text-2xl"
                style={{ color: "#1a1208", fontWeight: 700 }}
              >
                {narrativeTitle}
              </h2>
              <div
                className="mt-1 h-px"
                style={{ background: "#c8a96a" }}
              />
            </div>

            {/* Narrative content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {loading ? (
                <p
                  className="py-8 text-center text-[10px] uppercase tracking-widest"
                  style={{ color: "#888" }}
                >
                  Retrieving field reports…
                </p>
              ) : viewingEvents.length === 0 ? (
                <p
                  className="py-8 text-center text-[10px] uppercase tracking-widest"
                  style={{ color: "#888" }}
                >
                  No engagements recorded.
                </p>
              ) : (
                <>
                  {/* Narrative battle events */}
                  {battleEvents.length > 0 && (
                    <ul className="mb-4">
                      {battleEvents.map((e, i) => (
                        <EventItem key={i} event={e} />
                      ))}
                    </ul>
                  )}
                  {/* Other events in mono style */}
                  {movementEvents.length > 0 && (
                    <div className="mb-4">
                      <p
                        className="mb-2 text-[8px] font-bold uppercase tracking-widest"
                        style={{ color: "#8b6914" }}
                      >
                        Movement Orders
                      </p>
                      <ul className="space-y-0.5">
                        {movementEvents.map((e, i) => (
                          <EventItem key={i} event={e} />
                        ))}
                      </ul>
                    </div>
                  )}
                  {casualtyEvents.length > 0 && (
                    <div>
                      <p
                        className="mb-2 text-[8px] font-bold uppercase tracking-widest"
                        style={{ color: "#8b6914" }}
                      >
                        Casualty Returns
                      </p>
                      <ul className="space-y-0.5">
                        {casualtyEvents.map((e, i) => (
                          <EventItem key={i} event={e} />
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Fallback: show all events grouped if no specific categories */}
                  {battleEvents.length === 0 && movementEvents.length === 0 && casualtyEvents.length === 0 && (
                    <ul className="space-y-1">
                      {Array.from(grouped.values()).flat().map((e, i) => (
                        <EventItem key={i} event={e} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Timeline scrubber */}
            {sortedTurns.length > 1 && (
              <div
                className="shrink-0 px-6 py-3"
                style={{ borderTop: "1px solid #d4b97a" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] uppercase tracking-widest" style={{ color: "#8b6914" }}>
                    Turn {minTurn}
                  </span>
                  <span className="text-[8px] uppercase tracking-widest" style={{ color: "#8b6914" }}>
                    Turn {maxTurn} {maxTurn === completedTurn ? "(Current)" : ""}
                  </span>
                </div>
                <div
                  className="relative h-2 rounded-full"
                  style={{ background: "#d4b97a" }}
                >
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{ width: `${sliderPct}%`, background: "#8b6914" }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2"
                    style={{
                      left: `${sliderPct}%`,
                      transform: "translate(-50%, -50%)",
                      background: "#1a0a00",
                      borderColor: "#c8941a",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={!prevTurn || loading}
                    onClick={() => prevTurn && loadTurn(prevTurn)}
                    className="text-[9px] uppercase tracking-widest disabled:opacity-30"
                    style={{ color: "#8b6914" }}
                  >
                    ← Turn {prevTurn ?? "—"}
                  </button>
                  <button
                    type="button"
                    disabled={!nextTurn || loading}
                    onClick={() => nextTurn && loadTurn(nextTurn)}
                    className="text-[9px] uppercase tracking-widest disabled:opacity-30"
                    style={{ color: "#8b6914" }}
                  >
                    Turn {nextTurn ?? "—"} →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — side panels */}
        <div
          className="flex w-64 shrink-0 flex-col gap-0"
          style={{ borderLeft: "1px solid var(--color-border)" }}
        >
          {/* Casualty Reports */}
          <div
            className="flex flex-1 flex-col overflow-hidden"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div
              className="flex shrink-0 items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="text-[9px]" style={{ color: "var(--color-gold)" }}>▲</span>
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "var(--color-gold)" }}
              >
                Casualty Reports
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {casualtyEvents.length === 0 ? (
                <p className="text-[9px] uppercase tracking-wide" style={{ color: "#333" }}>
                  No casualties reported.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {casualtyEvents.map((e, i) => {
                    const text = formatEvent(e);
                    if (!text) return null;
                    return (
                      <li
                        key={i}
                        className="text-[9px] uppercase tracking-wide"
                        style={{ color: "#666" }}
                      >
                        &gt; {text}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Territory Shifts */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div
              className="flex shrink-0 items-center gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <span className="text-[9px]" style={{ color: "var(--color-gold)" }}>▲</span>
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "var(--color-gold)" }}
              >
                Territory Shifts
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {movementEvents.length === 0 ? (
                <p className="text-[9px] uppercase tracking-wide" style={{ color: "#333" }}>
                  No territory changes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {movementEvents.slice(0, 6).map((e, i) => {
                    const text = formatEvent(e);
                    if (!text) return null;
                    return (
                      <li key={i}>
                        <div
                          className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide"
                          style={{ color: "#666" }}
                        >
                          <span style={{ color: "#333" }}>—</span>
                          {text}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="flex shrink-0 items-center justify-between px-6 py-4"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          {viewingTurn !== completedTurn && (
            <button
              type="button"
              onClick={() => loadTurn(completedTurn)}
              className="text-[9px] uppercase tracking-widest transition-colors"
              style={{ color: "#444" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-gold)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
            >
              ↩ Return to Turn {completedTurn}
            </button>
          )}
        </div>

        {viewingTurn === completedTurn && (
          <button
            type="button"
            onClick={onDismiss}
            className="btn-gold ml-auto"
          >
            Continue to Next Phase →
          </button>
        )}
      </div>
    </div>
  );
}
