"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { GameState, TurnEvent } from "@wargame/shared";
import { formatEvent } from "@/lib/format-event";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

export function useSocket(
  roomId: string,
  onRefresh: () => void,
  onTurnResolved: (state: GameState, events: TurnEvent[]) => void,
  onEvent: (msg: string) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.emit("room:join", { roomId });

    socket.on("room:state", () => onRefresh());
    socket.on("turn:start", () => onRefresh());
    socket.on("turn:player_ready", () => onRefresh());
    socket.on("turn:both_ready", () => onEvent("Both players ready — resolving"));

    socket.on(
      "turn:resolved",
      ({ state, events }: { state: GameState; events: TurnEvent[] }) => {
        onTurnResolved(state, events);
        for (const e of events) {
          const msg = formatEvent(e);
          if (msg) onEvent(msg);
        }
      }
    );

    socket.on("game:over", ({ winnerFactionId }: { winnerFactionId: string }) => {
      onEvent(`Game over — ${winnerFactionId} wins`);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, onRefresh, onTurnResolved, onEvent]);
}
