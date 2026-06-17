import { eq } from "drizzle-orm";
import { games, getDb, players, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/player";
import { resolveRoomTurn } from "@wargame/server";
import { scheduleNextTurnJob } from "@/lib/after-resolve";
import { cancelTurnJob } from "@/lib/turn-queue";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const player = await getCurrentPlayer(roomId);
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [game] = await db.select().from(games).where(eq(games.roomId, roomId)).limit(1);
  if (!game || game.phase !== "planning") {
    return NextResponse.json({ error: "Not in planning phase" }, { status: 400 });
  }

  const ready = new Set(game.readyPlayerIds ?? []);
  ready.add(player.id);

  await db
    .update(games)
    .set({ readyPlayerIds: [...ready] })
    .where(eq(games.roomId, roomId));

  const roomPlayers = await db
    .select()
    .from(players)
    .where(eq(players.roomId, roomId));

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const solo = room?.soloDualFaction ?? false;
  const minPlayers = solo ? 1 : 2;
  const allReady =
    roomPlayers.length >= minPlayers &&
    roomPlayers.every((p) => ready.has(p.id));

  if (allReady) {
    if (game.turnJobId) {
      await cancelTurnJob(game.turnJobId);
    }
    const resolved = await resolveRoomTurn(roomId);
    if (resolved) {
      await scheduleNextTurnJob(roomId, resolved.turnEndsAt, resolved.winner);
    }
    return NextResponse.json({
      ok: true,
      submitted: true,
      resolving: true,
      resolved: Boolean(resolved),
      turn: resolved?.result.state.turn,
      events: resolved?.result.events ?? [],
    });
  }

  return NextResponse.json({
    ok: true,
    submitted: true,
    resolving: false,
    readyCount: ready.size,
    totalPlayers: roomPlayers.length,
  });
}
