import { randomUUID } from "node:crypto";
import { getDb, rooms, players, secretTestGames } from "@wargame/db";
import { NextResponse } from "next/server";
import { generateRoomCode } from "@/lib/room-code";
import { setSessionCookie } from "@/lib/session";
import { randomFaction } from "@/app/secret-test/types";
import { createInitialState } from "@/app/secret-test/lib/state";

export async function POST(req: Request) {
  let body: { displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const displayName =
    (typeof body.displayName === "string" ? body.displayName.trim() : "") || "Captain";

  try {
    const db = getDb();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const code = generateRoomCode();
    const factionId = randomFaction();

    await db.insert(rooms).values({
      id: roomId,
      code,
      status: "lobby",
      scenarioId: "secret-test",
      hostPlayerId: playerId,
      soloDualFaction: false,
    });

    await db.insert(players).values({
      id: playerId,
      roomId,
      factionId,
      displayName,
      sessionToken,
    });

    await db.insert(secretTestGames).values({
      roomId,
      state: createInitialState(),
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ roomId, code, playerId, factionId });
  } catch (e) {
    console.error("[POST /api/secret-test/rooms]", e);
    return NextResponse.json(
      { error: "Failed to create room. Is the database initialised?" },
      { status: 500 }
    );
  }
}
