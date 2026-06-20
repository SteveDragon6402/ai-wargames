import { and, eq } from "drizzle-orm";
import { gameHistory, getDb } from "@wargame/db";
import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/player";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const player = await getCurrentPlayer(roomId);
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const turnParam = searchParams.get("turn");

  const db = getDb();

  if (turnParam) {
    const turn = parseInt(turnParam, 10);
    if (isNaN(turn)) {
      return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
    }
    const [entry] = await db
      .select()
      .from(gameHistory)
      .where(and(eq(gameHistory.roomId, roomId), eq(gameHistory.turn, turn)))
      .limit(1);
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ turn: entry.turn, events: entry.events, stateAfter: entry.stateAfter });
  }

  const entries = await db
    .select({ turn: gameHistory.turn })
    .from(gameHistory)
    .where(eq(gameHistory.roomId, roomId));

  return NextResponse.json({ turns: entries.map((e) => e.turn) });
}
