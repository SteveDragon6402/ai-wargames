import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, rooms, players } from "@wargame/db";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { isFactionId, rivalFaction } from "@/app/secret-test/types";

export async function POST(req: Request) {
  let body: { code?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.toUpperCase().trim() : "";
  const displayName =
    (typeof body.displayName === "string" ? body.displayName.trim() : "") || "Captain";

  if (code.length !== 6) {
    return NextResponse.json({ error: "The cipher must be six characters." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);

    if (!room) {
      return NextResponse.json({ error: "The cipher is unknown." }, { status: 404 });
    }
    if (room.scenarioId !== "secret-test") {
      return NextResponse.json({ error: "That cipher belongs to another war." }, { status: 400 });
    }
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "This council has already opened." }, { status: 400 });
    }

    const existing = await db.select().from(players).where(eq(players.roomId, room.id));
    if (existing.length >= 2) {
      return NextResponse.json({ error: "Both seats are taken." }, { status: 400 });
    }

    const host = existing[0];
    const hostFaction = host && isFactionId(host.factionId) ? host.factionId : "lancaster";
    const factionId = rivalFaction(hostFaction);
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
    console.error("[POST /api/secret-test/rooms/join]", e);
    return NextResponse.json(
      { error: "Failed to join. Is the database initialised?" },
      { status: 500 }
    );
  }
}
