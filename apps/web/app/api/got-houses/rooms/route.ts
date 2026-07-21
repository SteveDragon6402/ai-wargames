import { randomUUID } from "node:crypto";
import { getDb, rooms, players, gotGames } from "@wargame/db";
import { NextResponse } from "next/server";
import { generateRoomCode } from "@/lib/room-code";
import { setSessionCookie } from "@/lib/session";
import { INITIAL_GAME_STATE } from "@/app/got-houses/data/initial-state";

export async function POST(req: Request) {
  let body: { displayName?: string; solo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "") || "Commander";
  const solo = body.solo === true;

  try {
    const db = getDb();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const code = generateRoomCode();

    await db.insert(rooms).values({
      id: roomId,
      code,
      status: solo ? "playing" : "lobby",
      scenarioId: "got-houses",
      hostPlayerId: playerId,
      soloDualFaction: solo,
    });

    await db.insert(players).values({
      id: playerId,
      roomId,
      factionId: "north",
      displayName,
      sessionToken,
    });

    // Seed initial game state
    const initialState = {
      ...INITIAL_GAME_STATE,
      adminMode: solo, // solo rooms start with admin mode on
      activeFaction: "north" as const,
    };
    await db.insert(gotGames).values({
      roomId,
      state: initialState,
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ roomId, code, playerId, factionId: "north", solo });
  } catch (e) {
    console.error("[POST /api/got-houses/rooms]", e);
    return NextResponse.json(
      { error: "Failed to create room. Is the database initialised?" },
      { status: 500 }
    );
  }
}
