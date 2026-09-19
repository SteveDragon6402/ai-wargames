import { and, eq } from "drizzle-orm";
import { getDb, rooms, players, gotV2Games } from "@wargame/db";
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { mergeRoomState } from "@/app/got-houses-v2/lib/room-sync";
import type { Faction, GameState } from "@/app/got-houses-v2/types";

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.turn === "number" &&
    typeof s.phase === "string" &&
    !!s.north &&
    !!s.westerlands
  );
}

const MERGE_TRIES = 8;

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

  if (!isGameState(body.state)) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  try {
    const db = getDb();
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.scenarioId !== "got-houses-v2") {
      return NextResponse.json({ error: "Not a GOT Houses room" }, { status: 404 });
    }

    const roomPlayers = await db.select().from(players).where(eq(players.roomId, roomId));
    const viewer = roomPlayers.find((p) => p.sessionToken === sessionToken);
    if (!viewer) {
      return NextResponse.json({ error: "Not in this room" }, { status: 403 });
    }

    const writer = room.soloDualFaction ? "both" : (viewer.factionId as Faction);
    const incoming = body.state;

    for (let attempt = 0; attempt < MERGE_TRIES; attempt++) {
      const existing = await db
        .select()
        .from(gotV2Games)
        .where(eq(gotV2Games.roomId, roomId))
        .limit(1);

      if (existing.length === 0) {
        try {
          await db.insert(gotV2Games).values({ roomId, state: incoming });
          return NextResponse.json({ ok: true, state: incoming });
        } catch {
          continue;
        }
      }

      const row = existing[0];
      const current = isGameState(row.state) ? row.state : incoming;
      const merged = mergeRoomState(current, incoming, writer);
      const lastTry = attempt === MERGE_TRIES - 1;
      const updated = await db
        .update(gotV2Games)
        .set({ state: merged, updatedAt: new Date() })
        .where(
          lastTry
            ? eq(gotV2Games.roomId, roomId)
            : and(eq(gotV2Games.roomId, roomId), eq(gotV2Games.updatedAt, row.updatedAt))
        )
        .returning({ roomId: gotV2Games.roomId });

      if (updated.length > 0) {
        return NextResponse.json({ ok: true, state: merged });
      }
    }

    return NextResponse.json({ error: "Room save conflict" }, { status: 409 });
  } catch (e) {
    console.error("[POST /api/got-houses-v2/rooms/[roomId]/state]", e);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}
