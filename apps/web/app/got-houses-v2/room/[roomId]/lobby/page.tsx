"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    name: "The North",
    tagline: "House of the Direwolf",
    armies: "Robb Stark, Roose Bolton, Manderly, Greatjon Umber, Galbart Glover",
    empty: "Awaiting a Stark commander",
    slot: "text-north border-north/40 bg-north-deep/50",
  },
  westerlands: {
    name: "The Westerlands",
    tagline: "House of the Lion",
    armies: "Tywin Lannister, Jaime's Vanguard",
    empty: "Awaiting a Lannister commander",
    slot: "text-west border-west/40 bg-west-deep/50",
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
      const res = await fetch(`/api/got-houses-v2/rooms/${roomId}`);
      if (!res.ok) {
        const d = await res.json();
        setError(typeof d.error === "string" ? d.error : "Room not found");
        return;
      }
      const data = (await res.json()) as RoomSnapshot;
      setSnapshot(data);
      if (data.room.status === "playing") {
        router.replace(`/got-houses-v2/room/${roomId}/game`);
      }
    } catch {
      setError("Failed to load room");
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
      const res = await fetch(`/api/got-houses-v2/rooms/${roomId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      router.push(`/got-houses-v2/room/${roomId}/game`);
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
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Opening the table…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-bad">{error || "Room not found"}</p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Return to command
        </Link>
      </main>
    );
  }

  const { room, players, viewer } = snapshot;
  const isHost = viewer?.playerId === room.hostPlayerId;
  const hasEnoughPlayers = players.length >= 2 || room.soloDualFaction;
  const canStart = isHost && hasEnoughPlayers && room.status === "lobby";
  const factions: Array<"north" | "westerlands"> = ["north", "westerlands"];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="mb-2 flex items-center gap-3 text-[13px] text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="text-border">/</span>
        <span>Campaign lobby</span>
      </div>

      <h1 className="font-display text-4xl font-semibold tracking-wide text-foreground">
        The table is set
      </h1>

      <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            hasEnoughPlayers ? "bg-good" : "bg-primary"
          )}
        />
        {hasEnoughPlayers
          ? "Both commanders present"
          : "Waiting for the second commander"}
      </div>

      <div className="mt-8 text-center">
        <div className="text-[12px] text-muted-foreground">
          Room code — share with your opponent
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="mt-1 font-mono text-4xl tracking-[0.28em] text-primary"
          title="Copy room code"
        >
          {room.code}
        </button>
        {copied && <div className="mt-1 text-[12px] text-good">Copied</div>}
      </div>

      <div className="mt-10 flex w-full max-w-xl gap-3">
        {factions.map((faction) => {
          const player = players.find((p) => p.factionId === faction);
          const isMe = viewer?.factionId === faction;
          const s = FACTION_STYLE[faction];
          return (
            <div
              key={faction}
              className={cn(
                "flex-1 rounded-sm border px-4 py-4",
                s.slot,
                isMe && "ring-1 ring-current"
              )}
            >
              <div className="font-display text-xl leading-tight">{s.name}</div>
              <div className="mt-0.5 text-[12px] opacity-70">{s.tagline}</div>
              {player ? (
                <>
                  <div className="mt-3 text-[15px] text-foreground">
                    {player.displayName}
                    {isMe && (
                      <span className="ml-2 rounded-sm border border-current px-1.5 py-0.5 text-[10px]">
                        You
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed opacity-70">
                    {s.armies}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 text-[14px] text-muted-foreground">Seat open</div>
                  <div className="mt-1 text-[12px] opacity-70">{s.empty}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {viewer && (
        <p className="mt-6 text-[14px] text-muted-foreground">
          You are <span className="text-foreground">{viewer.displayName}</span>,
          commanding{" "}
          <span
            className={
              viewer.factionId === "north" ? "text-north" : "text-west"
            }
          >
            {viewer.factionId === "north" ? "the North" : "the Westerlands"}
          </span>
          .
        </p>
      )}

      {canStart ? (
        <Button
          type="button"
          disabled={starting}
          onClick={startGame}
          className="mt-8 h-11 px-8 text-[13px] font-semibold"
        >
          {starting ? "Marshalling forces…" : "March to war"}
        </Button>
      ) : !hasEnoughPlayers ? (
        <p className="mt-8 text-[13px] text-muted-foreground">
          Waiting for a Lannister commander…
        </p>
      ) : !isHost ? (
        <p className="mt-8 text-[13px] text-muted-foreground">
          Waiting for the host to march…
        </p>
      ) : null}

      {startError && (
        <p className="mt-3 text-[13px] text-bad">{startError}</p>
      )}
    </main>
  );
}
