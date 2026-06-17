import { eq } from "drizzle-orm";
import { initGameFromScenario } from "@wargame/engine";
import { games, getDb, players, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { getScenariosDir, getTurnDurationSeconds } from "@/lib/env";
import { getCurrentPlayer } from "@/lib/player";
import { scheduleTurnEnd } from "@/lib/turn-queue";

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
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.hostPlayerId !== player.id) {
    return NextResponse.json({ error: "Only host can start" }, { status: 403 });
  }

  const roomPlayers = await db
    .select()
    .from(players)
    .where(eq(players.roomId, roomId));

  const minPlayers = room.soloDualFaction ? 1 : 2;
  if (roomPlayers.length < minPlayers) {
    return NextResponse.json(
      { error: minPlayers === 1 ? "Need 1 player" : "Need 2 players" },
      { status: 400 }
    );
  }

  const { state } = initGameFromScenario(getScenariosDir(), room.scenarioId);
  const turnEndsAt = new Date(Date.now() + getTurnDurationSeconds() * 1000);

  const jobId = await scheduleTurnEnd(roomId, getTurnDurationSeconds() * 1000);

  await db.insert(games).values({
    roomId,
    turn: state.turn,
    phase: state.phase,
    turnEndsAt,
    turnJobId: jobId,
    readyPlayerIds: [],
    state,
  });

  await db
    .update(rooms)
    .set({ status: "playing" })
    .where(eq(rooms.id, roomId));

  return NextResponse.json({
    turnEndsAt: turnEndsAt.toISOString(),
    state,
  });
}
