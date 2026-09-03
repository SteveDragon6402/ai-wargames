"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoseGlyph } from "../../../components/RoseGlyph";
import { HOUSE_LABEL, HOUSE_SHORT, isFactionId, type FactionId, type SecretTestSnapshot } from "../../../types";

const HOUSE_STYLE: Record<
  FactionId,
  { color: string; border: string; bg: string; empty: string }
> = {
  lancaster: {
    color: "#c45c5c",
    border: "#7a1420",
    bg: "#12080a",
    empty: "The red rose has no captain yet.",
  },
  york: {
    color: "#cfc8b8",
    border: "#5a564c",
    bg: "#12110e",
    empty: "The white rose has no captain yet.",
  },
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
      const res = await fetch(`/api/secret-test/rooms/${roomId}`);
      const data = (await res.json()) as SecretTestSnapshot & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "The cipher is unknown.");
        return;
      }
      setSnapshot(data);
      if (data.room.status === "playing" || data.room.status === "ended") {
        router.replace(`/secret-test/room/${roomId}/game`);
      }
    } catch {
      setError("Failed to reach the council.");
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
      const res = await fetch(`/api/secret-test/rooms/${roomId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open the war");
      router.push(`/secret-test/room/${roomId}/game`);
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
      <main className="rose-root" style={center}>
        <p className="rose-label">The hall is being prepared…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="rose-root" style={center}>
        <p className="rose-error">{error || "The cipher is unknown."}</p>
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
        <span style={{ color: "#2a241c" }}>|</span>
        <span className="rose-label" style={{ color: "#6e5724" }}>
          England, 1455
        </span>
      </div>

      <h1 className="rose-title" style={{ fontSize: 32, margin: "8px 0 4px" }}>
        The council chamber
      </h1>
      <p
        className="rose-serif"
        style={{ color: "#8a8070", fontStyle: "italic", marginBottom: 28, textAlign: "center" }}
      >
        The throne is weak. Two houses will take their seats. Dispatches remain sealed from the rival.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <span
          className="rose-dot"
          style={{ background: hasEnough ? "#5a8f4a" : "#b08d3e" }}
        />
        <span className="rose-label">
          {hasEnough ? "Both houses are seated" : "Awaiting the rival house…"}
        </span>
      </div>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="rose-label" style={{ marginBottom: 8 }}>
          Cipher — share with the other captain
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="rose-serif"
          style={{
            fontSize: 40,
            letterSpacing: "0.28em",
            color: "#b08d3e",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {room.code}
        </button>
        {copied && (
          <div className="rose-label" style={{ color: "#5a8f4a", marginTop: 6 }}>
            Copied
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, width: "100%", maxWidth: 560, marginBottom: 28 }}>
        {(["lancaster", "york"] as FactionId[]).map((faction) => {
          const player = players.find((p) => p.factionId === faction);
          const isMe = viewer?.factionId === faction;
          const s = HOUSE_STYLE[faction];
          return (
            <div
              key={faction}
              style={{
                flex: 1,
                border: `1px solid ${isMe ? s.color : s.border}`,
                background: s.bg,
              }}
            >
              <div style={{ height: 3, background: s.border }} />
              <div style={{ padding: "16px 16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <RoseGlyph house={faction} size={22} />
                  <div
                    className="rose-label"
                    style={{ color: s.color, letterSpacing: "0.12em" }}
                  >
                    {HOUSE_SHORT[faction]}
                  </div>
                </div>
                <div className="rose-label" style={{ marginBottom: 12, color: "#3a342c" }}>
                  {HOUSE_LABEL[faction]}
                </div>
                {player ? (
                  <>
                    <div className="rose-serif" style={{ fontSize: 20, color: "#efe6d2" }}>
                      {player.displayName}
                      {isMe && (
                        <span
                          className="rose-label"
                          style={{
                            marginLeft: 8,
                            color: s.color,
                            border: `1px solid ${s.border}`,
                            padding: "2px 7px",
                            verticalAlign: "middle",
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rose-serif" style={{ fontSize: 15, color: "#3a342c", fontStyle: "italic" }}>
                    {s.empty}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewer && isFactionId(viewer.factionId) && (
        <p className="rose-serif" style={{ color: "#8a8070", marginBottom: 22 }}>
          You are <span style={{ color: "#efe6d2" }}>{viewer.displayName}</span>
          {" — "}
          {HOUSE_LABEL[viewer.factionId]}
        </p>
      )}

      {canStart ? (
        <button type="button" className="rose-btn" disabled={starting} onClick={startGame}>
          {starting ? "Breaking the first seals…" : "Open the first dispatches"}
        </button>
      ) : !hasEnough ? (
        <p className="rose-label">The other rose has not yet entered the hall.</p>
      ) : !isHost ? (
        <p className="rose-label">Awaiting the host to open the first dispatches…</p>
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
