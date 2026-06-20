"use client";

import { useCallback, useEffect, useState } from "react";
import type { Command, GameState, TurnEvent } from "@wargame/shared";

export interface RoomSnapshot {
  room: {
    id: string;
    code: string;
    status: string;
    scenarioId: string;
    hostPlayerId: string | null;
    soloDualFaction?: boolean;
  };
  players: Array<{ id: string; factionId: string; displayName: string }>;
  game: {
    turn: number;
    phase: string;
    turnEndsAt: string | null;
    state: GameState;
    winnerFactionId: string | null;
    lastTurnEvents: TurnEvent[];
  } | null;
  viewer: {
    playerId: string;
    factionId: string;
    displayName: string;
  } | null;
  orders: Command[];
  readyPlayerIds: string[];
  mySubmitted: boolean;
}

function isRoomSnapshot(data: unknown): data is RoomSnapshot {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.room === "object" &&
    d.room !== null &&
    Array.isArray(d.players)
  );
}

export function useRoom(roomId: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setError("Missing room id");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        const err =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Failed to load room";
        setError(err);
        return;
      }
      if (!isRoomSnapshot(data)) {
        setError("Invalid room data");
        return;
      }
      setSnapshot(data);
      setError(null);
      return data;
    } catch {
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh, roomId]);

  const pushEvent = useCallback((msg: string) => {
    setEvents((prev) => [msg, ...prev].slice(0, 30));
  }, []);

  return { snapshot, refresh, error, events, pushEvent, setSnapshot, loading };
}
