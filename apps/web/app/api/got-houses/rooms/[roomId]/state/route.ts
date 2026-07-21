import { eq } from "drizzle-orm";
import { getDb, rooms, gotGames } from "@wargame/db";
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  let body: { state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  try {
    const db = getDb();
    const sessionToken = await getSessionToken();

    // Verify the room exists and caller has a session in it
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Upsert the game state
    const existing = await db.select().from(gotGames).where(eq(gotGames.roomId, roomId)).limit(1);
    if (existing.length > 0) {
      await db
        .update(gotGames)
        .set({ state: body.state, updatedAt: new Date() })
        .where(eq(gotGames.roomId, roomId));
    } else {
      await db.insert(gotGames).values({ roomId, state: body.state });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/got-houses/rooms/[roomId]/state]", e);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}
