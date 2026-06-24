"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameState, TurnEvent } from "@wargame/shared";
import { MapView } from "@/components/game/MapView";
import { formatEvent } from "@/lib/format-event";

interface HistoryEntry {
  turn: number;
  events: TurnEvent[];
  stateAfter: GameState;
}

interface TurnDebriefProps {
  completedTurn: number;
  events: TurnEvent[];
  initialState: GameState;
  roomId: string;
  availableTurns: number[];
  onDismiss: () => void;
}

/* ── event formatting ─────────────────────────────────────────────── */

const EVENT_ICONS: Partial<Record<TurnEvent["type"], string>> = {
  move: "⟶",
  rout: "↯",
  victory: "⚑",
  dig_in: "⛰",
  disengage: "↩",
  morale_change: "↕",
  combat: "⚔",
  battle_result: "⚔",
  intercept: "✕",
  reinforce: "+",
  intention_achieved: "✓",
  deny_blocked: "⊘",
  node_battle: "⚔",
};

function eventLine(e: TurnEvent): { icon: string; text: string; dim?: boolean } | null {
  const icon = EVENT_ICONS[e.type] ?? "·";
  switch (e.type) {
    case "move":
      return { icon, text: `${e.unitId.replace(/_/g, " ")} moved: ${e.from.replace(/_/g, " ")} → ${e.to.replace(/_/g, " ")}` };
    case "rout":
      return { icon, text: `${e.unitId.replace(/_/g, " ")} routed from ${e.from.replace(/_/g, " ")}${e.to ? ` → ${e.to.replace(/_/g, " ")}` : " (eliminated)"}` };
    case "node_battle": {
      const winner =
        e.overallWinner === "side1"
          ? e.side1FactionId
          : e.overallWinner === "side2"
            ? e.side2FactionId
            : null;
      return {
        icon,
        text: winner
          ? `${e.nodeId.replace(/_/g, " ")}: ${winner.toUpperCase()} prevails`
          : `${e.nodeId.replace(/_/g, " ")}: no decisive outcome`,
      };
    }
    case "combat":
      return { icon, text: `Combat at ${e.nodeId.replace(/_/g, " ")}: ${e.winner}` };
    case "battle_result":
      return { icon, text: `${e.nodeId.replace(/_/g, " ")}: ${e.outcome} — ${e.winnerFactionId ?? "draw"}` };
    case "dig_in":
      return { icon, text: `${e.unitId.replace(/_/g, " ")} dug in at ${e.nodeId.replace(/_/g, " ")}`, dim: true };
    case "disengage":
      return { icon, text: `Disengaged at ${e.nodeId.replace(/_/g, " ")}`, dim: true };
    case "morale_change":
      return {
        icon: e.delta < 0 ? "↓" : "↑",
        text: `${e.unitId.replace(/_/g, " ")} morale ${e.delta > 0 ? "+" : ""}${e.delta} → ${e.newMorale}`,
        dim: true,
      };
    case "victory":
      return { icon, text: `${e.factionId.toUpperCase()} wins — ${e.reason}` };
    case "intercept":
      return { icon, text: `Intercept at ${e.nodeId.replace(/_/g, " ")}`, dim: true };
    case "reinforce":
      return { icon, text: `${e.unitId.replace(/_/g, " ")} reinforced at ${e.nodeId.replace(/_/g, " ")}`, dim: true };
    case "intention_achieved":
      return { icon, text: `Objective achieved: ${String(e.intention)}`, dim: true };
    case "deny_blocked":
      return { icon, text: `Entry blocked at ${e.nodeId.replace(/_/g, " ")}`, dim: true };
  }
  return null;
}

/* priority order for event display */
const EVENT_PRIORITY: TurnEvent["type"][] = [
  "victory",
  "node_battle",
  "battle_result",
  "combat",
  "rout",
  "move",
  "intercept",
  "reinforce",
  "dig_in",
  "disengage",
  "morale_change",
  "intention_achieved",
  "deny_blocked",
];

function sortEvents(events: TurnEvent[]): TurnEvent[] {
  return [...events].sort(
    (a, b) => EVENT_PRIORITY.indexOf(a.type) - EVENT_PRIORITY.indexOf(b.type)
  );
}

/* ── component ────────────────────────────────────────────────────── */

export function TurnDebrief({
  completedTurn,
  events,
  initialState,
  roomId,
  availableTurns,
  onDismiss,
}: TurnDebriefProps) {
  const [viewingTurn, setViewingTurn] = useState(completedTurn);
  const [viewingEvents, setViewingEvents] = useState<TurnEvent[]>(events);
  const [viewingState, setViewingState] = useState<GameState>(initialState);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const sortedTurns = [...availableTurns].sort((a, b) => a - b);
  const currentIdx = sortedTurns.indexOf(viewingTurn);
  const prevTurn = currentIdx > 0 ? sortedTurns[currentIdx - 1] : null;
  const nextTurn = currentIdx < sortedTurns.length - 1 ? sortedTurns[currentIdx + 1] : null;
  const minTurn = sortedTurns[0] ?? completedTurn;
  const maxTurn = sortedTurns[sortedTurns.length - 1] ?? completedTurn;
  const sliderPct =
    sortedTurns.length > 1 ? (currentIdx / (sortedTurns.length - 1)) * 100 : 100;

  const fetchSummary = useCallback(
    async (turn: number, evts: TurnEvent[]) => {
      if (evts.length === 0) { setSummary(null); return; }
      setSummaryLoading(true);
      setSummary(null);
      try {
        const res = await fetch(`/api/rooms/${roomId}/history/summary?turn=${turn}`);
        if (res.ok) {
          const data = (await res.json()) as { summary: string | null };
          setSummary(data.summary);
        }
      } finally {
        setSummaryLoading(false);
      }
    },
    [roomId]
  );

  const loadTurn = useCallback(
    async (turn: number) => {
      if (turn === completedTurn) {
        setViewingTurn(completedTurn);
        setViewingEvents(events);
        setViewingState(initialState);
        fetchSummary(completedTurn, events);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/history?turn=${turn}`);
        if (res.ok) {
          const data = (await res.json()) as HistoryEntry;
          setViewingTurn(data.turn);
          setViewingEvents(data.events);
          setViewingState(data.stateAfter);
          fetchSummary(data.turn, data.events);
        }
      } finally {
        setLoading(false);
      }
    },
    [completedTurn, events, initialState, roomId, fetchSummary]
  );

  // Fetch summary for the initial turn on mount
  useEffect(() => {
    fetchSummary(completedTurn, events);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && viewingTurn === completedTurn) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, viewingTurn, completedTurn]);

  const sorted = sortEvents(viewingEvents);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas font-mono">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold uppercase tracking-wide text-ink">
            Tactical Resolution
          </h1>
          <p className="text-xs uppercase tracking-wide text-mute">
            Turn {viewingTurn} · Cycle complete · Awaiting orders
          </p>
        </div>

        {/* Timeline scrubber — inline in header */}
        {sortedTurns.length > 1 && (
          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              disabled={!prevTurn || loading}
              onClick={() => prevTurn && loadTurn(prevTurn)}
              className="text-xs uppercase tracking-wide text-mute transition-colors hover:text-primary-soft disabled:opacity-30"
            >
              ← T{prevTurn ?? "—"}
            </button>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-xs text-hairline-dim">
                <span>T{minTurn}</span>
                <div className="relative h-1 w-32 rounded-xs bg-hairline-dim">
                  <div
                    className="absolute h-full rounded-xs bg-primary-deep"
                    style={{ width: `${sliderPct}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-canvas bg-primary"
                    style={{
                      left: `${sliderPct}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>
                <span>T{maxTurn}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={!nextTurn || loading}
              onClick={() => nextTurn && loadTurn(nextTurn)}
              className="text-xs uppercase tracking-wide text-mute transition-colors hover:text-primary-soft disabled:opacity-30"
            >
              T{nextTurn ?? "—"} →
            </button>
          </div>
        )}

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-primary-soft">
            Code: Epsilon-Nine
          </p>
          <p className="text-xs uppercase tracking-wide text-hairline-dim">
            ● Link Secure
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left — live map of historical state */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/70 text-xs uppercase tracking-wide text-mute">
              Loading turn {viewingTurn}…
            </div>
          )}
          <MapView
            state={viewingState}
            myFaction={undefined}
            selectedUnitId={null}
            validNodeIds={[]}
            pickMode="none"
            pickableUnitIds={[]}
            onSelectUnit={() => {}}
            onSelectNode={() => {}}
            readonly
          />
        </div>

        {/* Right — AI summary + event list */}
        <div className="flex w-72 shrink-0 flex-col border-l border-hairline">
          {/* AI summary box */}
          <div className="shrink-0 border-b border-hairline p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-soft">
              ▲ Situation Report
            </p>
            {summaryLoading ? (
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="text-xs uppercase tracking-wide text-mute">
                  Generating…
                </span>
              </div>
            ) : summary ? (
              <p className="font-narrative text-sm leading-relaxed text-body">
                {summary}
              </p>
            ) : (
              <p className="text-xs italic uppercase tracking-wide text-hairline-dim">
                No events to summarise.
              </p>
            )}
          </div>

          {/* Event list */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="border-b border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-wide text-mute">
              &gt;&gt; Action Log
            </div>
            {sorted.length === 0 ? (
              <p className="p-4 text-xs uppercase tracking-wide text-hairline-dim">
                No events recorded.
              </p>
            ) : (
              <ul className="divide-y divide-hairline-dim">
                {sorted.map((e, i) => {
                  const line = eventLine(e);
                  if (!line) return null;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2 px-4 py-2"
                      style={{ opacity: line.dim ? 0.5 : 1 }}
                    >
                      <span
                        className="shrink-0 text-xs"
                        style={{
                          color:
                            e.type === "victory"
                              ? "var(--color-primary)"
                              : e.type === "rout"
                                ? "var(--stat-bad)"
                                : "#555",
                          marginTop: 1,
                        }}
                      >
                        {line.icon}
                      </span>
                      <span className="text-xs uppercase tracking-wide leading-relaxed text-body">
                        {line.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center justify-between border-t border-hairline px-5 py-3">
        <div className="text-xs uppercase tracking-wide text-hairline-dim">
          &gt; Press Enter to continue
        </div>
        {viewingTurn !== completedTurn ? (
          <button
            type="button"
            onClick={() => loadTurn(completedTurn)}
            className="text-xs uppercase tracking-wide text-mute transition-colors hover:text-primary-soft"
          >
            ↩ Jump to Turn {completedTurn}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="btn-primary"
          >
            Begin Turn {completedTurn + 1} →
          </button>
        )}
      </div>
    </div>
  );
}
