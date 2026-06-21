import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { initGameFromScenario } from "@wargame/engine";
import { games, getDb, players, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { getScenariosDir } from "@/lib/env";
import { generateRoomCode } from "@/lib/room-code";
import { setSessionCookie } from "@/lib/session";

/**
 * Create a solo room where one player commands both factions.
 * Starts the game immediately and sets the session cookie for the new player.
 */
export async function POST(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let displayName = "Commander";
  let scenarioId = "battle-of-fords";
  try {
    const body = await req.json();
    if (body && typeof body.displayName === "string" && body.displayName.trim()) {
      displayName = body.displayName.trim().slice(0, 32);
    }
    if (body && typeof body.scenarioId === "string" && body.scenarioId.trim()) {
      scenarioId = body.scenarioId.trim();
    }
  } catch {
    /* empty body is fine */
  }

  try {
    const scenariosDir = getScenariosDir();
    const { scenario, state } = initGameFromScenario(scenariosDir, scenarioId);
    const hostFactionId = scenario.factions[0] ?? "rohan";

    const db = getDb();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const code = generateRoomCode();

    await db.insert(rooms).values({
      id: roomId,
      code,
      status: "lobby",
      scenarioId,
      hostPlayerId: playerId,
      soloDualFaction: true,
    });

    await db.insert(players).values({
      id: playerId,
      roomId,
      factionId: hostFactionId,
      displayName,
      sessionToken,
    });

    // Solo mode: no timer — turn advances only when the player clicks End Turn
    await db.insert(games).values({
      roomId,
      turn: state.turn,
      phase: state.phase,
      turnEndsAt: null,
      turnJobId: null,
      readyPlayerIds: [],
      state,
    });

    await db
      .update(rooms)
      .set({ status: "playing" })
      .where(eq(rooms.id, roomId));

    await setSessionCookie(sessionToken);

    return NextResponse.json({
      roomId,
      code,
      playerId,
      soloDualFaction: true,
    });
  } catch (e) {
    console.error("[POST /api/admin/rooms/solo]", e);
    return NextResponse.json(
      { error: "Failed to create solo game. Is the database initialised?" },
      { status: 500 }
    );
  }
}
