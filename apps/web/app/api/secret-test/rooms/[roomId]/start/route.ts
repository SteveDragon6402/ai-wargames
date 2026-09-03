import { eq } from "drizzle-orm";
import { getDb, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { loadSecretRoom, saveState } from "@/app/secret-test/lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  try {
    const loaded = await loadSecretRoom(roomId);
    if (!loaded) return NextResponse.json({ error: "The cipher is unknown." }, { status: 404 });

    const { room, roomPlayers, state } = loaded;
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "This council has already opened." }, { status: 400 });
    }

    const sessionToken = await getSessionToken();
    const viewer = sessionToken
      ? roomPlayers.find((p) => p.sessionToken === sessionToken)
      : null;
    if (!viewer || viewer.id !== room.hostPlayerId) {
      return NextResponse.json({ error: "Only the host may open the war." }, { status: 403 });
    }
    if (roomPlayers.length < 2) {
      return NextResponse.json({ error: "Both houses must be seated." }, { status: 400 });
    }
    if (!state) {
      return NextResponse.json({ error: "Game state missing." }, { status: 500 });
    }

    const db = getDb();
    await db.update(rooms).set({ status: "playing" }).where(eq(rooms.id, roomId));
    await saveState(roomId, { ...state, phase: "resolving", turn: 1 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/secret-test/rooms/[roomId]/start]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
