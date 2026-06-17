"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { factionDisplayName } from "@/lib/unit-labels";

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
        body: JSON.stringify({ displayName: name.trim() || "Commander" }),
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
        body: JSON.stringify({ displayName: name.trim() || "Commander" }),
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI Wargames</h1>
          <p className="mt-2 text-slate-400">
            First Battle of the Fords of Isen — create or join a room with a code.
          </p>
        </div>

        <label className="block text-sm text-slate-400">
          Your name
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Commander"
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            maxLength={32}
          />
        </label>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={createRoom}
            className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create room"}
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-600">or join</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="flex gap-2">
            <input
              ref={codeRef}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-lg uppercase tracking-widest text-slate-100 focus:border-amber-500 focus:outline-none"
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
              className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Admin link */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="text-xs text-slate-700 hover:text-slate-500 transition-colors"
          >
            Admin
          </button>
        </div>
      </main>

      {/* Admin overlay */}
      {adminOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/90 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Admin panel</h2>
              <button
                type="button"
                onClick={closeAdmin}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              >
                ✕
              </button>
            </header>

            <div className="p-5">
              {!adminAuthed ? (
                /* Password gate */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-slate-400">Enter the admin password to continue.</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
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
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
                    >
                      {adminLoading ? "Checking…" : "Login"}
                    </button>
                  </div>
                  {adminPwError && (
                    <p className="text-sm text-red-400">{adminPwError}</p>
                  )}
                </div>
              ) : (
                /* Room list */
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {adminRooms.length} room{adminRooms.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={soloCreating || adminLoading}
                        onClick={adminCreateSoloGame}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
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
                    <p className="py-8 text-center text-sm text-slate-600">No rooms found.</p>
                  ) : (
                    <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
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
      ? "text-amber-400"
      : room.status === "finished"
        ? "text-slate-500"
        : "text-sky-400";

  const createdAgo = timeAgo(new Date(room.createdAt));

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-mono text-sm font-bold tracking-widest text-slate-100">
            {room.code}
          </span>
          <span className={`text-xs font-medium capitalize ${statusColor}`}>
            {room.status}
          </span>
          {room.soloDualFaction && (
            <span className="rounded bg-emerald-900/50 px-1.5 py-px text-[9px] font-medium text-emerald-400">
              Solo
            </span>
          )}
          {room.game && (
            <span className="text-xs text-slate-500">
              Turn {room.game.turn}
              {room.game.winnerFactionId
                ? ` · ${factionDisplayName(room.game.winnerFactionId)} won`
                : ` · ${room.game.phase}`}
            </span>
          )}
          <span className="text-xs text-slate-600">{createdAgo}</span>
        </div>

        {room.players.length > 0 && (
          <p className="mt-0.5 text-xs text-slate-500">
            {room.players
              .map((p) => `${p.displayName} (${factionDisplayName(p.factionId)})`)
              .join(" vs ")}
          </p>
        )}
      </div>

      <div className="shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Sure?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="rounded border border-red-700 bg-red-900/40 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/70 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:border-red-700/60 hover:text-red-400 transition-colors"
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
