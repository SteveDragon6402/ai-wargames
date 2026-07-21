"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import GameCore from "@/app/got-houses/components/GameCore";
import { INITIAL_GAME_STATE } from "@/app/got-houses/data/initial-state";
import type { GameState, Faction } from "@/app/got-houses/types";

interface RoomInfo {
  roomId: string;
  factionId: Faction;
  soloDualFaction: boolean;
}

export default function RoomGamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [initialGameState, setInitialGameState] = useState<GameState | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  // Load initial state from DB
  useEffect(() => {
    if (!roomId) {
      setErrorMsg("Invalid room ID");
      setLoadingState("error");
      return;
    }

    fetch(`/api/got-houses/rooms/${roomId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{
          room: { id: string; status: string; soloDualFaction: boolean; hostPlayerId: string | null };
          game: { state: GameState } | null;
          viewer: { playerId: string; factionId: string; displayName: string } | null;
        }>;
      })
      .then((data) => {
        // Redirect if still in lobby
        if (data.room.status === "lobby") {
          router.replace(`/got-houses/room/${roomId}/lobby`);
          return;
        }

        const factionId = (data.viewer?.factionId ?? "north") as Faction;
        const solo = data.room.soloDualFaction;

        // Build initial state: load from DB, then apply room-specific overrides
        const base: GameState = data.game?.state
          ? (data.game.state as GameState)
          : { ...INITIAL_GAME_STATE, adminMode: solo, activeFaction: factionId };

        // Override: in non-solo games, start showing the viewer's faction
        // (adminMode can still be toggled in the UI)
        const overriddenState: GameState = {
          ...base,
          activeFaction: solo ? base.activeFaction : factionId,
          adminMode: solo ? true : base.adminMode,
        };

        setInitialGameState(overriddenState);
        setRoomInfo({ roomId, factionId, soloDualFaction: solo });
        setLoadingState("ready");
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load room");
        setLoadingState("error");
      });
  }, [roomId, router]);

  // Persistence callback — saves state to DB
  const savePending = useRef(false);
  const handleSave = useCallback(
    async (state: GameState) => {
      if (!roomId || savePending.current) return;
      savePending.current = true;
      try {
        await fetch(`/api/got-houses/rooms/${roomId}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
      } catch (e) {
        console.warn("[RoomGamePage] Failed to save state:", e);
      } finally {
        savePending.current = false;
      }
    },
    [roomId]
  );

  if (loadingState === "loading") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#060606",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              color: "#c8941a",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              marginBottom: 12,
            }}
          >
            Marshalling forces…
          </div>
          <div
            style={{
              width: 40,
              height: 2,
              background: "#c8941a",
              margin: "0 auto",
              opacity: 0.5,
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.2; transform: scaleX(0.5); }
            50% { opacity: 0.7; transform: scaleX(1); }
          }
        `}</style>
      </div>
    );
  }

  if (loadingState === "error" || !initialGameState) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#060606",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        <p style={{ fontSize: 12, color: "#d87070", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {errorMsg || "Failed to load game"}
        </p>
        <a
          href="/"
          style={{
            fontSize: 10,
            color: "#333",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          ← Return to command
        </a>
      </div>
    );
  }

  return (
    <GameCore
      initialState={initialGameState}
      onSave={handleSave}
    />
  );
}
