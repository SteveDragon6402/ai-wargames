"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (${res.status})` };
  }
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function createRoom() {
    if (!name.trim()) {
      setError("Enter a commander name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/got-houses/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to create room");
      router.push(`/got-houses/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      codeRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setError("Enter a commander name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/got-houses/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase(), displayName: name.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to join");
      router.push(`/got-houses/room/${data.roomId}/lobby`);
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
        background: "#060606",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {/* House sigils */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 32,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              border: "1px solid #1a3a5a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              marginBottom: 6,
            }}
          >
            ☾
          </div>
          <div style={{ fontSize: 9, color: "#3a6a8a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            The North
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 10, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.2em" }}>
            vs
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              border: "1px solid #5a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              marginBottom: 6,
            }}
          >
            ♟
          </div>
          <div style={{ fontSize: 9, color: "#8a3a3a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Westerlands
          </div>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: "#c8941a",
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            marginBottom: 6,
          }}
        >
          War of the Five Kings
        </h1>
        <p style={{ fontSize: 9, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.2em" }}>
          AI-adjudicated · node warfare · Westeros theatre
        </p>
      </div>

      {/* Main panel */}
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          border: "1px solid #1e1e1e",
          background: "#080808",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            padding: "8px 16px",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#2a2a2a",
          }}
        >
          Command Uplink
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Commander name */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#555",
                marginBottom: 6,
              }}
            >
              Commander name
            </label>
            <input
              style={{
                width: "100%",
                background: "#0a0a0a",
                border: "1px solid #1e1e1e",
                padding: "8px 12px",
                fontSize: 13,
                color: "#ccc",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                transition: "border-color 0.12s",
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#c8941a")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            />
          </div>

          {/* Faction info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div
              style={{
                border: "1px solid #1a3a5a",
                padding: "10px 12px",
                background: "#050a12",
              }}
            >
              <div style={{ fontSize: 9, color: "#6aaad8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Host → The North
              </div>
              <div style={{ fontSize: 9, color: "#2a4a6a" }}>Robb Stark, 5 armies</div>
            </div>
            <div
              style={{
                border: "1px solid #5a1a1a",
                padding: "10px 12px",
                background: "#120505",
              }}
            >
              <div style={{ fontSize: 9, color: "#d87070", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Joiner → Westerlands
              </div>
              <div style={{ fontSize: 9, color: "#6a2a2a" }}>Tywin Lannister, 2 armies</div>
            </div>
          </div>

          {/* Create button */}
          <button
            type="button"
            disabled={loading}
            onClick={createRoom}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "#1a1200",
              border: "1px solid #3a2a00",
              color: "#c8941a",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit",
              transition: "border-color 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#c8941a";
              e.currentTarget.style.color = "#f0b429";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#3a2a00";
              e.currentTarget.style.color = "#c8941a";
            }}
          >
            {loading ? "Establishing uplink…" : "Raise your banners →"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
            <span style={{ fontSize: 9, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              or join existing
            </span>
            <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
          </div>

          {/* Join code */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={codeRef}
              style={{
                flex: 1,
                background: "#0a0a0a",
                border: "1px solid #1e1e1e",
                padding: "8px 12px",
                fontSize: 18,
                color: "#ccc",
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.3em",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.12s",
              }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="XXXXXX"
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#c8941a")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            />
            <button
              type="button"
              disabled={loading || code.length !== 6}
              onClick={joinRoom}
              style={{
                padding: "8px 20px",
                background: "transparent",
                border: "1px solid #1e1e1e",
                color: code.length === 6 ? "#888" : "#2a2a2a",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: code.length === 6 ? "pointer" : "default",
                fontFamily: "inherit",
                transition: "border-color 0.12s, color 0.12s",
              }}
              onMouseEnter={(e) => {
                if (code.length === 6) {
                  e.currentTarget.style.borderColor = "#888";
                  e.currentTarget.style.color = "#ccc";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1e1e1e";
                e.currentTarget.style.color = code.length === 6 ? "#888" : "#2a2a2a";
              }}
            >
              Join
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              margin: "0 20px 16px",
              padding: "8px 12px",
              border: "1px solid #5a1a1a",
              background: "#120505",
              fontSize: 11,
              color: "#d87070",
            }}
          >
            {error}
          </div>
        )}

        {/* Standalone link */}
        <div
          style={{
            borderTop: "1px solid #1a1a1a",
            padding: "8px 16px",
            textAlign: "center",
          }}
        >
          <a
            href="/got-houses"
            style={{
              fontSize: 9,
              color: "#2a2a2a",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textDecoration: "none",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a2a")}
          >
            Play standalone (no room)
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 32,
          fontSize: 9,
          color: "#1a1a1a",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span>AI-adjudicated node warfare · secure channel</span>
        <a
          href="/secret-test"
          style={{
            fontSize: 9,
            color: "#3a2a1a",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c8941a")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#3a2a1a")}
        >
          Secret Test — The Wars of the Roses
        </a>
      </div>
    </main>
  );
}
