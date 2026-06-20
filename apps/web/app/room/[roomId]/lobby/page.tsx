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
      <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div style={{ color: "#e05555", fontFamily: "var(--font-mono), monospace" }}>
          &gt; ERROR: Invalid room link.{" "}
          <Link href="/" style={{ color: "var(--color-gold)" }}>← Return</Link>
        </div>
      </main>
    );
  }

  const players = snapshot?.players ?? [];
  const playerFactions = new Set(players.map((p) => p.factionId));
  const allFactions = ["rohan", "isengard"];

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: "var(--color-bg)", fontFamily: "var(--font-mono), monospace" }}
    >
      {/* Header */}
      <div className="mb-1 flex items-center gap-3">
        <Link
          href="/"
          className="text-[9px] uppercase tracking-widest transition-colors"
          style={{ color: "#444" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
        >
          ← Home
        </Link>
        <span style={{ color: "#2a2a2a" }}>|</span>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: "var(--color-gold)" }}>
          WAR ROOM: MIDDLE-EARTH
        </span>
      </div>

      <h1
        className="mb-1 text-center text-3xl font-bold uppercase tracking-widest"
        style={{ color: "#ddd", letterSpacing: "0.2em" }}
      >
        Command Center Lobby
      </h1>

      {/* Status beacon */}
      <div className="mb-8 flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: players.length >= 2 ? "var(--color-gold)" : "#5ecb6b", animation: "pulse 2s infinite" }}
        />
        <span
          className="text-[9px] uppercase tracking-widest"
          style={{ color: "#444" }}
        >
          {players.length >= 2
            ? "Secure uplink established"
            : "Searching for commanders…"}
          {snapshot?.room?.code ? ` — Sector ${snapshot.room.code}` : ""}
        </span>
      </div>

      {loading && !snapshot && (
        <p className="mb-6 text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>
          Establishing uplink…
        </p>
      )}

      {/* Room code prominent display */}
      {snapshot?.room?.code && (
        <div className="mb-8 text-center">
          <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "#444" }}>
            Room Code
          </div>
          <div
            className="text-4xl font-bold tracking-[0.3em]"
            style={{ color: "var(--color-gold)", fontFamily: "var(--font-mono), monospace" }}
          >
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
              className="flex-1"
              style={{
                border: `1px solid ${isMe ? textColor : "#2a2a2a"}`,
                background: "var(--color-surface)",
              }}
            >
              {/* Faction color bar */}
              <div style={{ height: 3, background: topColor }} />

              <div className="p-4">
                {player ? (
                  <>
                    <div
                      className="mb-1 text-xs font-bold uppercase tracking-widest"
                      style={{ color: textColor }}
                    >
                      {factionDisplayName(faction).toUpperCase()}
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-wider mb-3"
                      style={{ color: "#444" }}
                    >
                      {tagline}
                    </div>
                    <div
                      className="text-[10px] uppercase tracking-widest"
                      style={{ color: "#888" }}
                    >
                      {player.displayName}
                      {isMe && (
                        <span
                          className="ml-2 text-[8px] rounded px-1 py-px"
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
                      className="mb-1 text-xs font-bold uppercase tracking-widest"
                      style={{ color: textColor }}
                    >
                      {factionDisplayName(faction).toUpperCase()}
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-wider mb-3"
                      style={{ color: "#444" }}
                    >
                      {tagline}
                    </div>
                    <div
                      className="text-[10px] uppercase tracking-widest mb-3"
                      style={{ color: "#333" }}
                    >
                      Slot Open
                    </div>
                    <div
                      className="text-[9px] leading-snug"
                      style={{ color: "#333" }}
                    >
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
        <p className="mb-4 text-[9px] uppercase tracking-widest" style={{ color: "#444" }}>
          You are{" "}
          <span style={{ color: "#ccc" }}>{snapshot.viewer.displayName}</span>{" "}
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
          className="btn-gold"
          style={{ padding: "12px 40px", fontSize: "11px" }}
        >
          {starting ? "Initiating…" : "Launch Operation →"}
        </button>
      ) : (snapshot?.players?.length ?? 0) < 2 ? (
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "#444" }}
        >
          Host control restricted · Awaiting opponent readiness
        </p>
      ) : !isHost ? (
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "#444" }}
        >
          Awaiting host to launch operation…
        </p>
      ) : null}

      {(startError || error) && (
        <p
          className="mt-4 text-[10px] uppercase tracking-widest"
          style={{ color: "#e05555" }}
        >
          &gt; {startError || error}
        </p>
      )}

      {/* Refresh */}
      <button
        type="button"
        onClick={() => refresh()}
        className="mt-6 text-[9px] uppercase tracking-widest transition-colors"
        style={{ color: "#2a2a2a" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a2a")}
      >
        ↻ Refresh uplink
      </button>

      {/* Ticker */}
      <div
        className="mt-10 text-[8px] uppercase tracking-widest"
        style={{ color: "#1a1a1a" }}
      >
        &gt; AI-ADJUDICATED NODE WARFARE · LINK SECURE
      </div>
    </main>
  );
}
