import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, players, rooms } from "@wargame/db";
import { joinRoomSchema } from "@wargame/shared";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  let body: Awaited<ReturnType<typeof req.json>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = joinRoomSchema.safeParse(body);
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join(", ");
    return NextResponse.json({ error: msgs || "Invalid request" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, parsed.data.code.toUpperCase()))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(players)
      .where(eq(players.roomId, room.id));

    if (existing.length >= 2) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    const factionId = existing.some((p) => p.factionId === "rohan")
      ? "isengard"
      : "rohan";

    const playerId = randomUUID();
    const sessionToken = randomUUID();

    await db.insert(players).values({
      id: playerId,
      roomId: room.id,
      factionId,
      displayName: parsed.data.displayName,
      sessionToken,
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ roomId: room.id, playerId, factionId });
  } catch (e) {
    console.error("[POST /api/rooms/join]", e);
    return NextResponse.json(
      { error: "Failed to join room. Is the database initialised?" },
      { status: 500 }
    );
  }
}
