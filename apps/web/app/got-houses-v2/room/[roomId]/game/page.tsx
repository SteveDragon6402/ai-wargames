"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import GameCore from "@/app/got-houses-v2/components/GameCore";
import type { SyncRole } from "@/app/got-houses-v2/components/GameCore";
import { INITIAL_GAME_STATE } from "@/app/got-houses-v2/data/initial-state";
import type { GameState, Faction } from "@/app/got-houses-v2/types";

interface RoomInfo {
  roomId: string;
  factionId: Faction;
  soloDualFaction: boolean;
  syncRole: SyncRole;
}

type RoomPayload = {
  room: {
    id: string;
    status: string;
    soloDualFaction: boolean;
    hostPlayerId: string | null;
  };
  game: { state: GameState } | null;
  viewer: { playerId: string; factionId: string; displayName: string } | null;
};

function syncRoleFor(data: RoomPayload, factionId: Faction): SyncRole {
  if (data.room.soloDualFaction) return "solo";
  const isHost = !!data.viewer && data.viewer.playerId === data.room.hostPlayerId;
  if (isHost) return "host";
  // Joiner is Westerlands; treat a missing host id as guest if we are West.
  return factionId === "north" ? "host" : "guest";
}

export default function RoomGamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [initialGameState, setInitialGameState] = useState<GameState | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [remoteState, setRemoteState] = useState<GameState | null>(null);

  // Load initial state from DB
  useEffect(() => {
    if (!roomId) {
      setErrorMsg("Invalid room ID");
      setLoadingState("error");
      return;
    }

    fetch(`/api/got-houses-v2/rooms/${roomId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<RoomPayload>;
      })
      .then((data) => {
        // Redirect if still in lobby
        if (data.room.status === "lobby") {
          router.replace(`/got-houses-v2/room/${roomId}/lobby`);
          return;
        }

        const factionId = (data.viewer?.factionId ?? "north") as Faction;
        const solo = data.room.soloDualFaction;
        const role = syncRoleFor(data, factionId);

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
        setRemoteState(data.game?.state ?? overriddenState);
        setRoomInfo({ roomId, factionId, soloDualFaction: solo, syncRole: role });
        setLoadingState("ready");
      })
      .catch((e) => {
        setErrorMsg(e instanceof Error ? e.message : "Failed to load room");
        setLoadingState("error");
      });
  }, [roomId, router]);

  // Poll the room save so the other browser's lock is visible.
  useEffect(() => {
    if (!roomId || loadingState !== "ready" || !roomInfo || roomInfo.soloDualFaction) {
      return;
    }

    let cancelled = false;

    async function pull() {
      try {
        const res = await fetch(`/api/got-houses-v2/rooms/${roomId}`);
        if (!res.ok) return;
        const data = (await res.json()) as RoomPayload;
        if (cancelled || !data.game?.state) return;
        setRemoteState(data.game.state as GameState);
      } catch {
        // Next tick retries.
      }
    }

    const id = window.setInterval(pull, 1500);
    void pull();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomId, loadingState, roomInfo]);

  // Persistence — never drop a save that arrives while another POST is in flight.
  const savePending = useRef(false);
  const queuedSave = useRef<GameState | null>(null);

  const handleSave = useCallback(
    async (state: GameState) => {
      if (!roomId) return;
      if (savePending.current) {
        queuedSave.current = state;
        return;
      }
      savePending.current = true;
      let next: GameState | null = state;
      while (next) {
        queuedSave.current = null;
        try {
          const res = await fetch(`/api/got-houses-v2/rooms/${roomId}/state`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: next }),
          });
          if (res.ok) {
            const data = (await res.json()) as { state?: GameState };
            if (data.state) setRemoteState(data.state);
          }
        } catch (e) {
          console.warn("[RoomGamePage] Failed to save state:", e);
        }
        next = queuedSave.current;
      }
      savePending.current = false;
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

  if (loadingState === "error" || !initialGameState || !roomInfo) {
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
      syncRole={roomInfo.syncRole}
      viewerFaction={roomInfo.factionId}
      remoteState={roomInfo.soloDualFaction ? null : remoteState}
    />
  );
}
