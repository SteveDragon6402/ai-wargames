"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { factionDisplayName } from "@/lib/unit-labels";

interface ScenarioMeta {
  id: string;
  name: string;
  factions: string[];
}

async function safeJson(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (${res.status})` };
  }
}

/* ------------------------------------------------------------------ Types */

interface AdminRoom {
  id: string;
  code: string;
  status: string;
  scenarioId: string;
  soloDualFaction?: boolean;
  createdAt: string;
  players: { displayName: string; factionId: string }[];
  game: {
    turn: number;
    phase: string;
    winnerFactionId: string | null;
    turnEndsAt: string | null;
  } | null;
}

/* ================================================================= Main page */

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  /* Scenario picker */
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("battle-of-fords");

  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.scenarios) && d.scenarios.length > 0) {
          setScenarios(d.scenarios);
        }
      })
      .catch(() => {});
  }, []);

  /* Admin state */
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminPwError, setAdminPwError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRooms, setAdminRooms] = useState<AdminRoom[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [soloCreating, setSoloCreating] = useState(false);

  /* ---- room creation / join ---- */

  async function createRoom() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name.trim() || "Commander",
          scenarioId: selectedScenarioId,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to create room");
      router.push(`/room/${data.roomId}/lobby`);
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
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase(),
          displayName: name.trim() || "Commander",
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to join");
      router.push(`/room/${data.roomId}/lobby`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  /* ---- admin ---- */

  async function adminLogin() {
    setAdminLoading(true);
    setAdminPwError("");
    try {
      const res = await fetch("/api/admin/rooms", {
        headers: { Authorization: `Bearer ${adminPw}` },
      });
      if (res.status === 401) {
        setAdminPwError("Incorrect password");
        return;
      }
      const data = await safeJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load");
      setAdminRooms((data.rooms as AdminRoom[]) ?? []);
      setAdminAuthed(true);
    } catch (e) {
      setAdminPwError(e instanceof Error ? e.message : "Error");
    } finally {
      setAdminLoading(false);
    }
  }

  async function adminRefresh() {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/rooms", {
        headers: { Authorization: `Bearer ${adminPw}` },
      });
      const data = await safeJson(res);
      if (res.ok) setAdminRooms((data.rooms as AdminRoom[]) ?? []);
    } finally {
      setAdminLoading(false);
    }
  }

  async function adminCreateSoloGame() {
    setSoloCreating(true);
    setAdminPwError("");
    try {
      const res = await fetch("/api/admin/rooms/solo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminPw}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: name.trim() || "Commander",
          scenarioId: selectedScenarioId,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create solo game");
      }
      router.push(`/room/${data.roomId}/game`);
    } catch (e) {
      setAdminPwError(e instanceof Error ? e.message : "Error");
    } finally {
      setSoloCreating(false);
    }
  }

  async function adminDelete(roomId: string) {
    setDeletingId(roomId);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminPw}` },
      });
      if (res.ok) {
        setAdminRooms((prev) => prev.filter((r) => r.id !== roomId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  function closeAdmin() {
    setAdminOpen(false);
    setAdminAuthed(false);
    setAdminPw("");
    setAdminPwError("");
    setAdminRooms([]);
  }

  /* ---- render ---- */

  return (
    <>
      <main
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ background: "var(--color-bg)" }}
      >
        {/* Logo / title block */}
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          {/* Crosshair emblem */}
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full" style={{ border: "1px solid #2a2a2a" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <line x1="16" y1="2" x2="16" y2="30" stroke="#c8941a" strokeWidth="1.5" />
              <line x1="2" y1="16" x2="30" y2="16" stroke="#c8941a" strokeWidth="1.5" />
              <path d="M16 6 Q22 10 22 16 Q22 22 16 26 Q10 22 10 16 Q10 10 16 6Z" stroke="#c8941a" strokeWidth="1" fill="none" />
              <circle cx="16" cy="16" r="2" fill="#c8941a" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold uppercase tracking-widest"
            style={{ color: "var(--color-gold)", letterSpacing: "0.25em" }}
          >
            AI Wargames
          </h1>
          <p
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#444", letterSpacing: "0.2em" }}
          >
            AI-Adjudicated Node Warfare
          </p>
        </div>

        {/* Command panel */}
        <div
          className="w-full max-w-sm"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          {/* Panel header */}
          <div
            className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest"
            style={{ borderBottom: "1px solid var(--color-border)", color: "#444" }}
          >
            &gt;&gt; COMMAND UPLINK
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div>
              <label
                className="mb-1 block text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "#555" }}
              >
                Commander Designation
              </label>
              <input
                className="w-full px-3 py-2 text-sm outline-none transition-all"
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  color: "#ddd",
                  fontFamily: "var(--font-mono), monospace",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Commander"
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                maxLength={32}
              />
            </div>

            {/* Scenario picker */}
            {scenarios.length > 0 && (
              <div>
                <label
                  className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: "#555" }}
                >
                  Theatre of War
                </label>
                <div className="flex flex-col gap-1">
                  {scenarios.map((s) => {
                    const selected = s.id === selectedScenarioId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedScenarioId(s.id)}
                        className="w-full px-3 py-2 text-left transition-all"
                        style={{
                          background: selected ? "#0f0d04" : "#060606",
                          border: selected
                            ? "1px solid var(--color-gold)"
                            : "1px solid #1e1e1e",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) e.currentTarget.style.borderColor = "#333";
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) e.currentTarget.style.borderColor = "#1e1e1e";
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="truncate text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: selected ? "var(--color-gold)" : "#888" }}
                          >
                            {s.name}
                          </span>
                          {selected && (
                            <span
                              className="shrink-0 text-[8px] font-bold uppercase tracking-widest"
                              style={{ color: "var(--color-gold)" }}
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-0.5 text-[8px] uppercase tracking-widest"
                          style={{ color: "#444" }}
                        >
                          {s.factions.map((f) => factionDisplayName(f)).join(" vs ")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={createRoom}
              className="btn-gold w-full"
            >
              {loading ? "Establishing uplink…" : "Initiate New Operation"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
              <span
                className="text-[9px] uppercase tracking-widest"
                style={{ color: "#333" }}
              >
                or join existing
              </span>
              <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
            </div>

            <div className="flex gap-2">
              <input
                ref={codeRef}
                className="flex-1 px-3 py-2 text-center text-lg uppercase tracking-widest outline-none transition-all"
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  color: "#ddd",
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.3em",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="XXXXXX"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              />
              <button
                type="button"
                disabled={loading || code.length !== 6}
                onClick={joinRoom}
                className="btn-outline px-5"
              >
                Join
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mx-5 mb-4 px-3 py-2 text-[10px] uppercase tracking-wide"
              style={{ border: "1px solid #5a1a1a", background: "#1a0a0a", color: "#e05555" }}
            >
              &gt; ERROR: {error}
            </div>
          )}

          {/* Admin link */}
          <div
            className="px-4 py-2 text-center"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="text-[9px] uppercase tracking-widest transition-colors"
              style={{ color: "#333" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
            >
              Admin Access
            </button>
          </div>
        </div>

        {/* Ticker line */}
        <div
          className="mt-8 text-[9px] uppercase tracking-widest"
          style={{ color: "#2a2a2a" }}
        >
          &gt; AI-ADJUDICATED NODE WARFARE · SECURE CHANNEL
        </div>
      </main>

      {/* Admin overlay */}
      {adminOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: "rgba(0,0,0,0.92)" }}>
          <div
            className="my-8 w-full max-w-3xl shadow-2xl"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            {/* Header */}
            <header
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--color-gold)" }}
              >
                &gt;&gt; Admin Panel
              </h2>
              <button
                type="button"
                onClick={closeAdmin}
                className="text-xs transition-colors"
                style={{ color: "#444" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ccc")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
              >
                ✕
              </button>
            </header>

            <div className="p-5">
              {!adminAuthed ? (
                /* Password gate */
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: "#555" }}>Enter the admin password to continue.</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#ddd", fontFamily: "var(--font-mono), monospace" }}
                      placeholder="Password"
                      value={adminPw}
                      onChange={(e) => setAdminPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && adminLogin()}
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={adminLoading || !adminPw}
                      onClick={adminLogin}
                      className="btn-gold"
                    >
                      {adminLoading ? "Checking…" : "Login"}
                    </button>
                  </div>
                  {adminPwError && (
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: "#e05555" }}>&gt; {adminPwError}</p>
                  )}
                </div>
              ) : (
                /* Room list */
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: "#555" }}>
                      {adminRooms.length} room{adminRooms.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={soloCreating || adminLoading}
                        onClick={adminCreateSoloGame}
                        className="btn-gold"
                        style={{ padding: "6px 12px", fontSize: "9px" }}
                      >
                        {soloCreating ? "Starting…" : "Play both sides"}
                      </button>
                      <button
                        type="button"
                        disabled={adminLoading}
                        onClick={adminRefresh}
                        className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                      >
                        {adminLoading ? "Refreshing…" : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {adminRooms.length === 0 ? (
                    <p className="py-8 text-center text-[10px] uppercase tracking-widest" style={{ color: "#333" }}>No rooms found.</p>
                  ) : (
                    <div style={{ border: "1px solid var(--color-border)" }}>
                      {adminRooms.map((room) => (
                        <RoomRow
                          key={room.id}
                          room={room}
                          deleting={deletingId === room.id}
                          onDelete={() => adminDelete(room.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================= RoomRow */

function RoomRow({
  room,
  deleting,
  onDelete,
}: {
  room: AdminRoom;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusColor =
    room.status === "playing"
      ? "var(--color-gold)"
      : room.status === "finished"
        ? "#444"
        : "#5ecb6b";

  const createdAgo = timeAgo(new Date(room.createdAt));

  return (
    <div
      className="flex items-start justify-between gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ fontFamily: "var(--font-mono), monospace", color: "#ddd" }}
          >
            {room.code}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {room.status}
          </span>
          {room.soloDualFaction && (
            <span
              className="rounded px-1.5 py-px text-[8px] font-bold uppercase tracking-wider"
              style={{ color: "#5ecb6b", border: "1px solid #2d6a35" }}
            >
              Solo
            </span>
          )}
          {room.game && (
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "#444" }}
            >
              T{room.game.turn}
              {room.game.winnerFactionId
                ? ` · ${factionDisplayName(room.game.winnerFactionId)} won`
                : ` · ${room.game.phase}`}
            </span>
          )}
          <span className="text-[9px]" style={{ color: "#333" }}>{createdAgo}</span>
        </div>

        {room.players.length > 0 && (
          <p className="mt-0.5 text-[9px] uppercase tracking-wider" style={{ color: "#444" }}>
            {room.players
              .map((p) => `${p.displayName} (${factionDisplayName(p.factionId)})`)
              .join(" vs ")}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase" style={{ color: "#555" }}>Sure?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
              style={{ border: "1px solid #8b1a1a", color: "#e05555", background: "#1a0a0a" }}
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-[9px] uppercase"
              style={{ color: "#444" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
            style={{ border: "1px solid #2a2a2a", color: "#444" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#8b1a1a";
              e.currentTarget.style.color = "#e05555";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#444";
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
