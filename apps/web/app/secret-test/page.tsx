"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RoseGlyph } from "./components/RoseGlyph";

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
      setError("Give the chronicler your name.");
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
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to raise a standard");
      router.push(`/secret-test/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (code.length !== 6) {
      setError("The cipher must be six characters.");
      codeRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setError("Give the chronicler your name.");
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
          border: "1px solid #2a241c",
          padding: 4,
        }}
      >
        <a href="/" className="rose-link" style={{ padding: "8px 16px", letterSpacing: "0.12em" }}>
          War of the Five Kings
        </a>
        <span
          style={{
            padding: "8px 16px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#b08d3e",
            background: "#1a1208",
            border: "1px solid #6e5724",
          }}
        >
          Secret Test
        </span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 28 }}>
        <div style={{ textAlign: "center" }}>
          <RoseGlyph house="lancaster" size={52} />
          <div className="rose-label" style={{ marginTop: 8, color: "#a01c2c" }}>
            Lancaster
          </div>
        </div>
        <div
          className="rose-serif"
          style={{ fontSize: 13, color: "#3a342c", letterSpacing: "0.2em", fontStyle: "italic" }}
        >
          versus
        </div>
        <div style={{ textAlign: "center" }}>
          <RoseGlyph house="york" size={52} />
          <div className="rose-label" style={{ marginTop: 8, color: "#cfc8b8" }}>
            York
          </div>
        </div>
      </div>

      <h1 className="rose-title" style={{ fontSize: 42, margin: "0 0 6px", textAlign: "center" }}>
        The Wars of the Roses
      </h1>
      <p className="rose-label" style={{ marginBottom: 8 }}>
        Secret Test
      </p>
      <p
        className="rose-serif"
        style={{
          maxWidth: 420,
          textAlign: "center",
          color: "#8a8070",
          fontSize: 17,
          fontStyle: "italic",
          lineHeight: 1.45,
          margin: "0 0 36px",
        }}
      >
        England, 1455. Two players. Private dispatches. You will never see the other house’s letters.
        Lancaster or York is assigned by lot.
      </p>

      <div className="rose-panel" style={{ width: "100%", maxWidth: 400 }}>
        <div
          className="rose-label"
          style={{
            borderBottom: "1px solid #2a241c",
            padding: "10px 18px",
            color: "#6e5724",
          }}
        >
          The privy council
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="rose-label" htmlFor="st-name" style={{ display: "block", marginBottom: 6 }}>
              Your name
            </label>
            <input
              id="st-name"
              className="rose-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As the chronicle will know you"
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
            />
          </div>

          <button type="button" className="rose-btn" disabled={loading} onClick={createRoom}>
            {loading ? "Raising the standard…" : "Raise your standard"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#1e1a14" }} />
            <span className="rose-label">or enter by cipher</span>
            <div style={{ flex: 1, height: 1, background: "#1e1a14" }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={codeRef}
              className="rose-input"
              style={{
                flex: 1,
                textAlign: "center",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontSize: 18,
              }}
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

      <p className="rose-label" style={{ marginTop: 36, color: "#2a241c" }}>
        A chronicler behind the arras · one throne
      </p>
    </main>
  );
}
