import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { isFactionId } from "@/app/secret-test/types";
import { toPlayerView } from "@/app/secret-test/lib/view";
import { loadSecretRoom } from "@/app/secret-test/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

  try {
    const loaded = await loadSecretRoom(roomId);
    if (!loaded) return NextResponse.json({ error: "The cipher is unknown." }, { status: 404 });

    const { room, roomPlayers, state } = loaded;
    const sessionToken = await getSessionToken();
    const viewer = sessionToken
      ? (roomPlayers.find((p) => p.sessionToken === sessionToken) ?? null)
      : null;

    const faction = viewer && isFactionId(viewer.factionId) ? viewer.factionId : null;

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        scenarioId: room.scenarioId,
        hostPlayerId: room.hostPlayerId,
      },
      players: roomPlayers.map((p) => ({
        id: p.id,
        factionId: p.factionId,
        displayName: p.displayName,
      })),
      viewer: viewer && faction
        ? { playerId: viewer.id, factionId: faction, displayName: viewer.displayName }
        : null,
      game: state && faction ? toPlayerView(state, faction) : null,
    });
  } catch (e) {
    console.error("[GET /api/secret-test/rooms/[roomId]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
