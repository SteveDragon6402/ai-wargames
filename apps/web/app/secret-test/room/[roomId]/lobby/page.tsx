"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { rememberViewer, roomFetch } from "../../../lib/client-player";
import {
  CAMPAIGN_SHORT,
  isFactionId,
  type FactionId,
  type SecretTestSnapshot,
} from "../../../types";

const STYLE: Record<FactionId, { color: string; border: string; bg: string; empty: string }> = {
  red: { color: "#e07070", border: "#c42828", bg: "#140808", empty: "No candidate yet." },
  blue: { color: "#7a9ae0", border: "#2b54a8", bg: "#080a14", empty: "No candidate yet." },
};

export default function SecretTestLobbyPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<SecretTestSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [copied, setCopied] = useState(false);

  async function refresh() {
    if (!roomId) return;
    try {
      const res = await roomFetch(roomId, `/api/secret-test/rooms/${roomId}`);
      const data = (await res.json()) as SecretTestSnapshot & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Unknown room.");
        return;
      }
      rememberViewer(roomId, data.viewer?.playerId);
      setSnapshot(data);
      if (data.room.status === "playing" || data.room.status === "ended") {
        router.replace(`/secret-test/room/${roomId}/game`);
      }
    } catch {
      setError("Failed to reach the desk.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startGame() {
    setStarting(true);
    setStartError("");
    try {
      const res = await roomFetch(roomId, `/api/secret-test/rooms/${roomId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open the campaign");
      router.push(`/secret-test/room/${roomId}/game`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <main style={center}>
        <p className="rose-label">The office is being opened…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main style={center}>
        <p className="rose-error">{error || "Unknown room."}</p>
        <Link href="/secret-test" className="rose-link" style={{ marginTop: 16 }}>
          ← Return
        </Link>
      </main>
    );
  }

  const { room, players, viewer } = snapshot;
  const isHost = viewer?.playerId === room.hostPlayerId;
  const hasEnough = players.length >= 2;
  const canStart = isHost && hasEnough && room.status === "lobby";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Link href="/secret-test" className="rose-link">
          ← Secret Test
        </Link>
        <span style={{ color: "#2a2a2e" }}>|</span>
        <span className="rose-label" style={{ color: "#6e5724" }}>
          Republic of Valden
        </span>
      </div>

      <h1 className="rose-title" style={{ fontSize: 32, margin: "8px 0 4px" }}>
        Campaign lobby
      </h1>
      <p className="rose-serif" style={{ color: "#8a8a86", fontStyle: "italic", marginBottom: 24, textAlign: "center" }}>
        Twelve months to election night. Win three of five states.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span className="rose-dot" style={{ background: hasEnough ? "#5a8f4a" : "#c4a35a" }} />
        <span className="rose-label">{hasEnough ? "Both campaigns are seated" : "Awaiting the other campaign…"}</span>
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div className="rose-label" style={{ marginBottom: 8 }}>
          Room code — share with the other candidate
        </div>
        <button
          type="button"
          onClick={() => {
            if (snapshot.room.code) {
              navigator.clipboard.writeText(snapshot.room.code).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="rose-serif"
          style={{
            fontSize: 40,
            letterSpacing: "0.28em",
            color: "#c4a35a",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {room.code}
        </button>
        {copied && <div className="rose-label" style={{ color: "#5a8f4a", marginTop: 6 }}>Copied</div>}
      </div>

      <div style={{ display: "flex", gap: 14, width: "100%", maxWidth: 560, marginBottom: 24 }}>
        {(["red", "blue"] as FactionId[]).map((faction) => {
          const player = players.find((p) => p.factionId === faction);
          const isMe = viewer?.factionId === faction;
          const s = STYLE[faction];
          return (
            <div key={faction} style={{ flex: 1, border: `1px solid ${isMe ? s.color : s.border}`, background: s.bg }}>
              <div style={{ height: 3, background: s.border }} />
              <div style={{ padding: "16px" }}>
                <div className="rose-label" style={{ color: s.color, marginBottom: 8 }}>
                  {CAMPAIGN_SHORT[faction]}
                </div>
                {player ? (
                  <div className="rose-serif" style={{ fontSize: 20, color: "#efece4" }}>
                    {player.displayName}
                    {isMe && (
                      <span className="rose-label" style={{ marginLeft: 8, color: s.color, border: `1px solid ${s.border}`, padding: "2px 7px" }}>
                        You
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="rose-serif" style={{ fontSize: 15, color: "#4a4a4e", fontStyle: "italic" }}>
                    {s.empty}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewer && isFactionId(viewer.factionId) && (
        <p className="rose-serif" style={{ color: "#8a8a86", marginBottom: 20, textAlign: "center" }}>
          You are <span style={{ color: "#efece4" }}>{viewer.displayName}</span>
          {" — "}
          <span style={{ color: viewer.factionId === "red" ? "#e07070" : "#7a9ae0", fontWeight: 600 }}>
            YOU ARE {viewer.factionId.toUpperCase()}
          </span>
          . The other colour is the other campaign.
        </p>
      )}

      {canStart ? (
        <button type="button" className="rose-btn" disabled={starting} onClick={startGame}>
          {starting ? "Opening the map…" : "Start the twelve months"}
        </button>
      ) : !hasEnough ? (
        <p className="rose-label">The other campaign has not entered.</p>
      ) : !isHost ? (
        <p className="rose-label">Waiting for the host to start…</p>
      ) : null}

      {startError && <p className="rose-error" style={{ marginTop: 16 }}>{startError}</p>}
    </main>
  );
}

const center: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
