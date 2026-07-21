import { eq } from "drizzle-orm";
import { getDb, rooms, players, gotGames } from "@wargame/db";
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  try {
    const db = getDb();
    const sessionToken = await getSessionToken();

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.scenarioId !== "got-houses") {
      return NextResponse.json({ error: "Not a GOT Houses room" }, { status: 404 });
    }

    const roomPlayers = await db.select().from(players).where(eq(players.roomId, roomId));
    const [gotGame] = await db.select().from(gotGames).where(eq(gotGames.roomId, roomId)).limit(1);

    const viewer = sessionToken
      ? (roomPlayers.find((p) => p.sessionToken === sessionToken) ?? null)
      : null;

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        scenarioId: room.scenarioId,
        hostPlayerId: room.hostPlayerId,
        soloDualFaction: room.soloDualFaction,
      },
      players: roomPlayers.map((p) => ({
        id: p.id,
        factionId: p.factionId,
        displayName: p.displayName,
      })),
      game: gotGame
        ? { state: gotGame.state, updatedAt: gotGame.updatedAt }
        : null,
      viewer: viewer
        ? { playerId: viewer.id, factionId: viewer.factionId, displayName: viewer.displayName }
        : null,
    });
  } catch (e) {
    console.error("[GET /api/got-houses/rooms/[roomId]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
