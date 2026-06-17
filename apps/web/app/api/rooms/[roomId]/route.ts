import { maybeAdvanceTurn } from "@wargame/server";
import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/player";
import { buildRoomSnapshot } from "@/lib/room-response";
import { cancelTurnJob } from "@/lib/turn-queue";
import { scheduleNextTurnJob } from "@/lib/after-resolve";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const resolved = await maybeAdvanceTurn(roomId, {
    cancelScheduledJob: cancelTurnJob,
  });
  if (resolved) {
    await scheduleNextTurnJob(roomId, resolved.turnEndsAt, resolved.winner);
  }
  const player = await getCurrentPlayer(roomId);
  const snapshot = await buildRoomSnapshot(roomId, player?.id);
  if (!snapshot) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
