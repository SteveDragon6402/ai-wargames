import { eq } from "drizzle-orm";
import { getDb, rooms, players } from "@wargame/db";
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";

export async function POST(
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
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "Room is not in lobby state" }, { status: 400 });
    }

    const roomPlayers = await db.select().from(players).where(eq(players.roomId, roomId));

    // Require host session to start (or solo room)
    if (!room.soloDualFaction && sessionToken) {
      const viewer = roomPlayers.find((p) => p.sessionToken === sessionToken);
      if (!viewer || viewer.id !== room.hostPlayerId) {
        return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
      }
    }

    // Require 2 players unless solo
    if (!room.soloDualFaction && roomPlayers.length < 2) {
      return NextResponse.json({ error: "Need 2 players to start" }, { status: 400 });
    }

    await db
      .update(rooms)
      .set({ status: "playing" })
      .where(eq(rooms.id, roomId));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/got-houses/rooms/[roomId]/start]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
