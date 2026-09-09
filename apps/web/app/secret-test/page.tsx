"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { storeRoomPlayer } from "./lib/client-player";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (${res.status})` };
  }
}

export default function SecretTestLanding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function createRoom() {
    if (!name.trim()) {
      setError("Enter the name the ballot will carry.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/secret-test/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to open a campaign");
      if (typeof data.roomId === "string" && typeof data.playerId === "string") {
        storeRoomPlayer(data.roomId, data.playerId);
      }
      router.push(`/secret-test/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (code.length !== 6) {
      setError("Room code must be six characters.");
      codeRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setError("Enter the name the ballot will carry.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/secret-test/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase(), displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to join");
      if (typeof data.roomId === "string" && typeof data.playerId === "string") {
        storeRoomPlayer(data.roomId, data.playerId);
      }
      router.push(`/secret-test/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

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
      <nav
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 28,
          border: "1px solid #2a2a2e",
          padding: 4,
        }}
      >
        <a href="/" className="rose-link" style={{ padding: "8px 16px" }}>
          War of the Five Kings
        </a>
        <span
          style={{
            padding: "8px 16px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#c4a35a",
            background: "#16140e",
            border: "1px solid #6e5724",
          }}
        >
          Secret Test
        </span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 22 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 4, background: "#c42828", margin: "0 auto" }} />
          <div className="rose-label" style={{ marginTop: 8, color: "#c42828" }}>Red</div>
        </div>
        <div className="rose-serif" style={{ fontSize: 13, color: "#4a4a4e", fontStyle: "italic" }}>
          versus
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 4, background: "#2b54a8", margin: "0 auto" }} />
          <div className="rose-label" style={{ marginTop: 8, color: "#6a8ad8" }}>Blue</div>
        </div>
      </div>

      <h1 className="rose-title" style={{ fontSize: 40, margin: "0 0 6px", textAlign: "center" }}>
        Republic of Valden
      </h1>
      <p className="rose-label" style={{ marginBottom: 8 }}>Secret Test · election</p>
      <p
        className="rose-serif"
        style={{
          maxWidth: 460,
          textAlign: "center",
          color: "#9a9890",
          fontSize: 17,
          fontStyle: "italic",
          lineHeight: 1.45,
          margin: "0 0 32px",
        }}
      >
        Twelve months. Seventeen constituencies. Five states. Win three states and you take the presidency.
        You are assigned red or blue at random. Blank slate — positions are whatever you say.
      </p>

      <div className="rose-panel" style={{ width: "100%", maxWidth: 400 }}>
        <div className="rose-label" style={{ borderBottom: "1px solid #2a2a2e", padding: "10px 18px", color: "#6e5724" }}>
          Campaign desk
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="rose-label" htmlFor="st-name" style={{ display: "block", marginBottom: 6 }}>
              Candidate name
            </label>
            <input
              id="st-name"
              className="rose-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As it will appear on the ballot"
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
            />
          </div>
          <button type="button" className="rose-btn" disabled={loading} onClick={createRoom}>
            {loading ? "Opening the office…" : "Open a campaign"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#222" }} />
            <span className="rose-label">or join by code</span>
            <div style={{ flex: 1, height: 1, background: "#222" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={codeRef}
              className="rose-input"
              style={{ flex: 1, textAlign: "center", letterSpacing: "0.28em", textTransform: "uppercase", fontSize: 18 }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="XXXXXX"
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <button
              type="button"
              className="rose-btn rose-btn-ghost"
              disabled={loading || code.length !== 6}
              onClick={joinRoom}
            >
              Enter
            </button>
          </div>
        </div>
        {error && <div className="rose-error" style={{ margin: "0 18px 18px" }}>{error}</div>}
      </div>
    </main>
  );
}
