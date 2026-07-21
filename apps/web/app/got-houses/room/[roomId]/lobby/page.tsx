"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface RoomPlayer {
  id: string;
  factionId: string;
  displayName: string;
}
interface RoomSnapshot {
  room: {
    id: string;
    code: string;
    status: string;
    hostPlayerId: string | null;
    soloDualFaction: boolean;
  };
  players: RoomPlayer[];
  viewer: { playerId: string; factionId: string; displayName: string } | null;
}

const FACTION_STYLE = {
  north: {
    color: "#6aaad8",
    border: "#1a3a5a",
    bg: "#050a12",
    tagline: "The House of the Direwolf",
    armies: "Robb Stark, Roose Bolton, Manderly, Greatjon Umber, Galbart Glover",
    empty: "Awaiting a Stark commander…",
  },
  westerlands: {
    color: "#d87070",
    border: "#5a1a1a",
    bg: "#120505",
    tagline: "The House of the Lion",
    armies: "Tywin Lannister, Jaime's Vanguard",
    empty: "Awaiting a Lannister commander…",
  },
} as const;

export default function GOTLobbyPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [copied, setCopied] = useState(false);

  async function refresh() {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/got-houses/rooms/${roomId}`);
      if (!res.ok) {
        const d = await res.json();
        setError(typeof d.error === "string" ? d.error : "Room not found");
        return;
      }
      const data = await res.json() as RoomSnapshot;
      setSnapshot(data);

      // Auto-redirect if game already started
      if (data.room.status === "playing") {
        router.replace(`/got-houses/room/${roomId}/game`);
      }
    } catch {
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  }

  // Poll while waiting for second player
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startGame() {
    setStarting(true);
    setStartError("");
    try {
      const res = await fetch(`/api/got-houses/rooms/${roomId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      router.push(`/got-houses/room/${roomId}/game`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Error");
    } finally {
      setStarting(false);
    }
  }

  function copyCode() {
    if (snapshot?.room.code) {
      navigator.clipboard.writeText(snapshot.room.code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <p style={{ fontSize: 11, color: "#333", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Establishing uplink…
        </p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main style={pageStyle}>
        <p style={{ fontSize: 12, color: "#d87070", fontFamily: "var(--font-mono), monospace" }}>{error || "Room not found"}</p>
        <Link href="/" style={linkStyle}>← Return to command</Link>
      </main>
    );
  }

  const { room, players, viewer } = snapshot;
  const isHost = viewer?.playerId === room.hostPlayerId;
  const hasEnoughPlayers = players.length >= 2 || room.soloDualFaction;
  const canStart = isHost && hasEnoughPlayers && room.status === "lobby";

  const factions: Array<"north" | "westerlands"> = ["north", "westerlands"];

  return (
    <main style={pageStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/" style={linkStyle}>← Home</Link>
        <span style={{ color: "#1e1e1e" }}>|</span>
        <span style={{ fontSize: 10, color: "#c8941a", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          War of the Five Kings
        </span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 400, color: "#ccc", letterSpacing: "0.1em", marginBottom: 4, textTransform: "uppercase", fontFamily: "var(--font-mono), monospace" }}>
        Campaign Lobby
      </h1>

      {/* Status beacon */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <span style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: hasEnoughPlayers ? "#5ecb6b" : "#c8941a",
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 10, color: "#333", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {hasEnoughPlayers ? "Both commanders present" : "Awaiting second commander…"}
        </span>
      </div>

      {/* Room code */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono), monospace", marginBottom: 8 }}>
          Room code — share with your opponent
        </div>
        <button
          type="button"
          onClick={copyCode}
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 36,
            letterSpacing: "0.3em",
            color: "#c8941a",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {room.code}
        </button>
        {copied && (
          <div style={{ fontSize: 9, color: "#5ecb6b", marginTop: 4, fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Copied ✓
          </div>
        )}
      </div>

      {/* Faction slots */}
      <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 500, marginBottom: 28 }}>
        {factions.map((faction) => {
          const player = players.find((p) => p.factionId === faction);
          const isMe = viewer?.factionId === faction;
          const s = FACTION_STYLE[faction];

          return (
            <div
              key={faction}
              style={{
                flex: 1,
                border: `1px solid ${isMe ? s.color : s.border}`,
                background: s.bg,
                overflow: "hidden",
              }}
            >
              <div style={{ height: 2, background: s.border }} />
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: s.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "var(--font-mono), monospace", marginBottom: 2 }}>
                  {faction === "north" ? "The North" : "The Westerlands"}
                </div>
                <div style={{ fontSize: 9, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono), monospace", marginBottom: 10 }}>
                  {s.tagline}
                </div>

                {player ? (
                  <>
                    <div style={{ fontSize: 13, color: "#ccc", marginBottom: 2 }}>
                      {player.displayName}
                      {isMe && (
                        <span style={{ marginLeft: 8, fontSize: 9, color: s.color, border: `1px solid ${s.border}`, padding: "1px 6px", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "#2a2a2a", fontFamily: "var(--font-mono), monospace", lineHeight: 1.6 }}>
                      {s.armies}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "#1e1e1e", marginBottom: 4 }}>Slot open</div>
                    <div style={{ fontSize: 9, color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", lineHeight: 1.6 }}>
                      {s.empty}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Viewer info */}
      {viewer && (
        <p style={{ fontSize: 11, color: "#555", marginBottom: 20, fontFamily: "var(--font-mono), monospace" }}>
          You are{" "}
          <span style={{ color: "#ccc" }}>{viewer.displayName}</span>
          {" — commanding "}
          <span style={{ color: FACTION_STYLE[viewer.factionId as "north" | "westerlands"]?.color ?? "#888" }}>
            {viewer.factionId === "north" ? "The North" : "The Westerlands"}
          </span>
        </p>
      )}

      {/* Start button */}
      {canStart ? (
        <button
          type="button"
          disabled={starting}
          onClick={startGame}
          style={{
            padding: "12px 40px",
            background: "#1a1200",
            border: "1px solid #3a2a00",
            color: "#c8941a",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            cursor: starting ? "wait" : "pointer",
            fontFamily: "var(--font-mono), monospace",
            transition: "border-color 0.12s, color 0.12s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8941a"; e.currentTarget.style.color = "#f0b429"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#3a2a00"; e.currentTarget.style.color = "#c8941a"; }}
        >
          {starting ? "Marshalling forces…" : "March to war →"}
        </button>
      ) : !hasEnoughPlayers ? (
        <p style={{ fontSize: 11, color: "#333", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Awaiting Lannister commander…
        </p>
      ) : !isHost ? (
        <p style={{ fontSize: 11, color: "#333", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Awaiting host to march to war…
        </p>
      ) : null}

      {startError && (
        <p style={{ marginTop: 12, fontSize: 11, color: "#d87070", fontFamily: "var(--font-mono), monospace" }}>
          {startError}
        </p>
      )}

      {/* Footer ticker */}
      <div style={{ marginTop: 40, fontSize: 9, color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "0.15em" }}>
        AI-adjudicated node warfare · link secure
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#060606",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "sans-serif",
};

const linkStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#333",
  textDecoration: "none",
  fontFamily: "var(--font-mono), monospace",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  transition: "color 0.12s",
};
