"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SwordIcon } from "@phosphor-icons/react";
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
        {/* Logo / title block */}
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          {/* Sword emblem */}
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-hairline">
            <SwordIcon size={32} color="#00d992" />
          </div>
          <h1 className="text-2xl font-normal tracking-tight text-ink-strong">
            AI Wargames
          </h1>
          <p className="text-sm text-mute">
            AI-adjudicated node warfare
          </p>
        </div>

        {/* Command panel */}
        <div className="w-full max-w-sm rounded-md border border-hairline bg-canvas">
          {/* Panel header */}
          <div className="border-b border-hairline px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">
            Command Uplink
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-body">
                Commander name
              </label>
              <input
                className="w-full rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary"
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
                <label className="mb-1.5 block text-xs font-medium text-body">
                  Theatre of war
                </label>
                <div className="flex flex-col gap-1">
                  {scenarios.map((s) => {
                    const selected = s.id === selectedScenarioId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedScenarioId(s.id)}
                        className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-primary bg-canvas-soft"
                            : "border-hairline bg-canvas hover:border-hairline-dim"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm font-medium ${
                              selected ? "text-primary-soft" : "text-ink"
                            }`}
                          >
                            {s.name}
                          </span>
                          {selected && (
                            <span className="shrink-0 text-xs text-primary-soft">✓</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-mute">
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
              className="btn-primary w-full"
            >
              {loading ? "Establishing uplink…" : "Initiate new operation"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-hairline" />
              <span className="text-xs text-mute">or join existing</span>
              <div className="h-px flex-1 bg-hairline" />
            </div>

            <div className="flex gap-2">
              <input
                ref={codeRef}
                className="flex-1 rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-center text-lg uppercase tracking-[0.3em] text-ink outline-none transition-colors focus:border-primary"
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
            <div className="mx-5 mb-4 rounded-sm border border-faction-isengard-deep bg-canvas-soft px-3 py-2 text-sm text-faction-isengard">
              {error}
            </div>
          )}

          {/* Admin link */}
          <div className="border-t border-hairline px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="text-xs text-mute transition-colors hover:text-body"
            >
              Admin access
            </button>
          </div>
        </div>

        {/* Alternative game modes */}
        <div className="mt-6 w-full max-w-sm">
          <div
            className="mb-2 text-[8px] uppercase tracking-widest text-center"
            style={{ color: "#2a2a2a" }}
          >
            Other Theatres
          </div>
          <a
            href="/got-houses"
            className="flex w-full items-center justify-between px-4 py-3 transition-all"
            style={{
              border: "1px solid #1e1e1e",
              background: "#060606",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3a2a00";
              e.currentTarget.style.background = "#0a0800";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1e1e1e";
              e.currentTarget.style.background = "#060606";
            }}
          >
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: "#888", fontFamily: "var(--font-mono), monospace" }}
              >
                Game of Thrones Houses Mode
              </div>
              <div
                className="mt-0.5 text-[8px] uppercase tracking-widest"
                style={{ color: "#333" }}
              >
                Westeros Theatre
              </div>
            </div>
            <span
              className="text-[9px] uppercase tracking-widest"
              style={{ color: "#2a2a2a" }}
            >
              →
            </span>
          </a>
        </div>

        {/* Ticker line */}
        <div className="mt-8 text-xs text-hairline-dim">
          AI-adjudicated node warfare · secure channel
        </div>
      </main>

      {/* Admin overlay */}
      {adminOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80">
          <div className="my-8 w-full max-w-3xl rounded-md border border-hairline bg-canvas shadow-2xl">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">Admin panel</h2>
              <button
                type="button"
                onClick={closeAdmin}
                className="text-sm text-mute transition-colors hover:text-ink"
              >
                ✕
              </button>
            </header>

            <div className="p-5">
              {!adminAuthed ? (
                /* Password gate */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-body">Enter the admin password to continue.</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="flex-1 rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink outline-none focus:border-primary"
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
                      className="btn-primary"
                    >
                      {adminLoading ? "Checking…" : "Login"}
                    </button>
                  </div>
                  {adminPwError && (
                    <p className="text-sm text-faction-isengard">{adminPwError}</p>
                  )}
                </div>
              ) : (
                /* Room list */
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-body">
                      {adminRooms.length} room{adminRooms.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={soloCreating || adminLoading}
                        onClick={adminCreateSoloGame}
                        className="btn-primary"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                      >
                        {soloCreating ? "Starting…" : "Play both sides"}
                      </button>
                      <button
                        type="button"
                        disabled={adminLoading}
                        onClick={adminRefresh}
                        className="text-xs text-mute hover:text-body disabled:opacity-50"
                      >
                        {adminLoading ? "Refreshing…" : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {adminRooms.length === 0 ? (
                    <p className="py-8 text-center text-sm text-mute">No rooms found.</p>
                  ) : (
                    <div className="rounded-sm border border-hairline">
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

  const statusColorClass =
    room.status === "playing"
      ? "text-primary-soft"
      : room.status === "finished"
        ? "text-mute"
        : "text-faction-rohan";

  const createdAgo = timeAgo(new Date(room.createdAt));

  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-mono text-sm tracking-wide text-ink">{room.code}</span>
          <span className={`text-xs font-medium uppercase tracking-wide ${statusColorClass}`}>
            {room.status}
          </span>
          {room.soloDualFaction && (
            <span className="rounded-pill border border-faction-rohan-deep px-1.5 py-px text-xs text-faction-rohan">
              Solo
            </span>
          )}
          {room.game && (
            <span className="text-xs text-mute">
              T{room.game.turn}
              {room.game.winnerFactionId
                ? ` · ${factionDisplayName(room.game.winnerFactionId)} won`
                : ` · ${room.game.phase}`}
            </span>
          )}
          <span className="text-xs text-hairline-dim">{createdAgo}</span>
        </div>

        {room.players.length > 0 && (
          <p className="mt-0.5 text-xs text-mute">
            {room.players
              .map((p) => `${p.displayName} (${factionDisplayName(p.factionId)})`)
              .join(" vs ")}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-body">Sure?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="rounded-sm border border-faction-isengard-deep bg-canvas-soft px-2 py-1 text-xs font-medium text-faction-isengard disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-xs text-mute"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-sm border border-hairline px-2 py-1 text-xs font-medium text-mute transition-colors hover:border-faction-isengard-deep hover:text-faction-isengard"
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
