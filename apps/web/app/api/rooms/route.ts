import { randomUUID } from "node:crypto";
import { loadScenario } from "@wargame/engine";
import { getDb, players, rooms } from "@wargame/db";
import { createRoomSchema } from "@wargame/shared";
import { NextResponse } from "next/server";
import { getScenariosDir } from "@/lib/env";
import { generateRoomCode } from "@/lib/room-code";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  let body: Awaited<ReturnType<typeof req.json>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join(", ");
    return NextResponse.json({ error: msgs || "Invalid request" }, { status: 400 });
  }

  const scenarioId = parsed.data.scenarioId ?? "battle-of-fords";

  let hostFactionId: string;
  try {
    const { scenario } = loadScenario(getScenariosDir(), scenarioId);
    hostFactionId = scenario.factions[0] ?? "rohan";
  } catch {
    return NextResponse.json({ error: `Unknown scenario: ${scenarioId}` }, { status: 400 });
  }

  try {
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
    });

    await db.insert(players).values({
      id: playerId,
      roomId,
      factionId: hostFactionId,
      displayName: parsed.data.displayName,
      sessionToken,
    });

    await setSessionCookie(sessionToken);

    return NextResponse.json({ roomId, code, playerId, factionId: hostFactionId });
  } catch (e) {
    console.error("[POST /api/rooms]", e);
    return NextResponse.json(
      { error: "Failed to create room. Is the database initialised?" },
      { status: 500 }
    );
  }
}
