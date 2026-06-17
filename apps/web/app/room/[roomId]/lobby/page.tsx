"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRoom } from "@/hooks/useRoom";

export default function LobbyPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params.roomId === "string" ? params.roomId : "";
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
      <main className="mx-auto max-w-lg p-6 text-slate-100">
        <p className="text-red-400">Invalid room link.</p>
        <Link href="/" className="mt-4 inline-block text-amber-400">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg p-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
          ← Home
        </Link>

        <h1 className="mt-4 text-2xl font-semibold">Lobby</h1>

        {loading && !snapshot && (
          <p className="mt-4 text-slate-400">Loading room…</p>
        )}

        <p className="mt-2 text-slate-400">
          Room code:{" "}
          <span className="font-mono text-2xl tracking-widest text-amber-400">
            {snapshot?.room?.code ?? "…"}
          </span>
        </p>

        <ul className="mt-6 space-y-2">
          {(snapshot?.players ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <span>{p.displayName}</span>
              <span className="capitalize text-slate-400">{p.factionId}</span>
            </li>
          ))}
          {(snapshot?.players?.length ?? 0) < 2 && (
            <li className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-slate-500">
              Waiting for opponent…
            </li>
          )}
        </ul>

        {snapshot?.viewer && (
          <p className="mt-4 text-sm text-slate-500">
            You are{" "}
            <strong className="text-slate-300">{snapshot.viewer.displayName}</strong>{" "}
            ({snapshot.viewer.factionId})
          </p>
        )}

        {canStart && (
          <button
            type="button"
            disabled={starting}
            onClick={startGame}
            className="mt-6 w-full rounded-lg bg-amber-600 py-3 font-medium hover:bg-amber-500 disabled:opacity-50"
          >
            Start game
          </button>
        )}

        {startError && <p className="mt-2 text-sm text-red-400">{startError}</p>}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => refresh()}
          className="mt-4 text-sm text-slate-500 underline"
        >
          Refresh
        </button>
      </div>
    </main>
  );
}
