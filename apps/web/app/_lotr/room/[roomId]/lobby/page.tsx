"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRoom } from "@/hooks/useRoom";
import { factionDisplayName } from "@/lib/unit-labels";

const FACTION_COLOR: Record<string, string> = {
  rohan: "#2d6a35",
  isengard: "#8b1a1a",
};
const FACTION_TEXT: Record<string, string> = {
  rohan: "#5ecb6b",
  isengard: "#e05555",
};
const FACTION_TAGLINE: Record<string, string> = {
  rohan: "The Horse-lords",
  isengard: "The White Hand",
};

export default function LobbyPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();
  const { snapshot, refresh, error, loading } = useRoom(roomId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const isHost =
    snapshot?.viewer?.playerId === snapshot?.room?.hostPlayerId;
  const canStart =
    snapshot?.room?.status === "lobby" &&
    (snapshot?.players?.length ?? 0) >= 2 &&
    isHost;

  useEffect(() => {
    if (snapshot?.room?.status === "playing" && roomId) {
      router.replace(`/room/${roomId}/game`);
    }
  }, [snapshot?.room?.status, roomId, router]);

  async function startGame() {
    if (!roomId) return;
    setStarting(true);
    setStartError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      router.push(`/room/${roomId}/game`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  if (!roomId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-sm text-faction-isengard">
          Invalid room link.{" "}
          <Link href="/" className="text-primary-soft">← Return</Link>
        </div>
      </main>
    );
  }

  const players = snapshot?.players ?? [];
  const allFactions = ["rohan", "isengard"];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-3">
        <Link
          href="/"
          className="text-xs text-mute transition-colors hover:text-body"
        >
          ← Home
        </Link>
        <span className="text-hairline">|</span>
        <span className="text-xs font-medium text-primary-soft">
          AI Wargames
        </span>
      </div>

      <h1 className="mb-1 text-center text-2xl font-normal tracking-tight text-ink-strong">
        Command Center Lobby
      </h1>

      {/* Status beacon */}
      <div className="mb-8 flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${
            players.length >= 2 ? "bg-primary" : "bg-faction-rohan"
          }`}
        />
        <span className="text-xs text-mute">
          {players.length >= 2
            ? "Secure uplink established"
            : "Searching for commanders…"}
          {snapshot?.room?.code ? ` — Sector ${snapshot.room.code}` : ""}
        </span>
      </div>

      {loading && !snapshot && (
        <p className="mb-6 text-sm text-mute">Establishing uplink…</p>
      )}

      {/* Room code prominent display */}
      {snapshot?.room?.code && (
        <div className="mb-8 text-center">
          <div className="mb-1 text-xs text-mute">Room code</div>
          <div className="font-mono text-4xl tracking-[0.3em] text-primary-soft">
            {snapshot.room.code}
          </div>
        </div>
      )}

      {/* Faction slots */}
      <div className="mb-8 flex w-full max-w-xl gap-4">
        {allFactions.map((faction) => {
          const player = players.find((p) => p.factionId === faction);
          const isMe = snapshot?.viewer?.factionId === faction;
          const topColor = FACTION_COLOR[faction] ?? "#222";
          const textColor = FACTION_TEXT[faction] ?? "#888";
          const tagline = FACTION_TAGLINE[faction] ?? "";

          return (
            <div
              key={faction}
              className="flex-1 overflow-hidden rounded-md bg-canvas-soft"
              style={{
                border: `1px solid ${isMe ? textColor : "#3d3a39"}`,
              }}
            >
              {/* Faction color bar */}
              <div style={{ height: 3, background: topColor }} />

              <div className="p-4">
                {player ? (
                  <>
                    <div
                      className="mb-1 text-sm font-semibold"
                      style={{ color: textColor }}
                    >
                      {factionDisplayName(faction)}
                    </div>
                    <div className="mb-3 text-xs text-mute">{tagline}</div>
                    <div className="text-sm text-body">
                      {player.displayName}
                      {isMe && (
                        <span
                          className="ml-2 rounded-pill px-1.5 py-px text-xs"
                          style={{ color: textColor, border: `1px solid ${topColor}` }}
                        >
                          You
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="mb-1 text-sm font-semibold"
                      style={{ color: textColor }}
                    >
                      {factionDisplayName(faction)}
                    </div>
                    <div className="mb-3 text-xs text-mute">{tagline}</div>
                    <div className="mb-3 text-sm text-hairline-dim">Slot open</div>
                    <div className="text-xs leading-snug text-hairline-dim">
                      Searching for a suitable commander…
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Host controls */}
      {snapshot?.viewer && (
        <p className="mb-4 text-sm text-mute">
          You are{" "}
          <span className="text-ink">{snapshot.viewer.displayName}</span>{" "}
          commanding{" "}
          <span style={{ color: FACTION_TEXT[snapshot.viewer.factionId ?? ""] ?? "#888" }}>
            {factionDisplayName(snapshot.viewer.factionId ?? "")}
          </span>
        </p>
      )}

      {canStart ? (
        <button
          type="button"
          disabled={starting}
          onClick={startGame}
          className="btn-primary"
          style={{ padding: "12px 40px", fontSize: "14px" }}
        >
          {starting ? "Initiating…" : "Launch operation →"}
        </button>
      ) : (snapshot?.players?.length ?? 0) < 2 ? (
        <p className="text-sm text-mute">
          Host control restricted · Awaiting opponent readiness
        </p>
      ) : !isHost ? (
        <p className="text-sm text-mute">Awaiting host to launch operation…</p>
      ) : null}

      {(startError || error) && (
        <p className="mt-4 text-sm text-faction-isengard">{startError || error}</p>
      )}

      {/* Refresh */}
      <button
        type="button"
        onClick={() => refresh()}
        className="mt-6 text-xs text-hairline-dim transition-colors hover:text-mute"
      >
        ↻ Refresh uplink
      </button>

      {/* Ticker */}
      <div className="mt-10 text-xs text-hairline-dim">
        AI-adjudicated node warfare · link secure
      </div>
    </main>
  );
}
