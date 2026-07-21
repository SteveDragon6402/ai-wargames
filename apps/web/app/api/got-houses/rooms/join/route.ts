import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, rooms, players } from "@wargame/db";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  let body: { code?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.toUpperCase().trim() : "";
  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "") || "Commander";

  if (code.length !== 6) {
    return NextResponse.json({ error: "Room code must be 6 characters" }, { status: 400 });
  }

  try {
    const db = getDb();

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.scenarioId !== "got-houses") {
      return NextResponse.json({ error: "Not a GOT Houses room" }, { status: 400 });
    }
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "Game already started or finished" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(players)
      .where(eq(players.roomId, room.id));

    if (existing.length >= 2) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    // Second player always gets Westerlands
    const factionId = "westerlands";
    const playerId = randomUUID();
    const sessionToken = randomUUID();

    await db.insert(players).values({
      id: playerId,
      roomId: room.id,
      factionId,
      displayName,
      sessionToken,
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ roomId: room.id, playerId, factionId });
  } catch (e) {
    console.error("[POST /api/got-houses/rooms/join]", e);
    return NextResponse.json(
      { error: "Failed to join room. Is the database initialised?" },
      { status: 500 }
    );
  }
}
