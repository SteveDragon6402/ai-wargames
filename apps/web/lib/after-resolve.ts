import { eq } from "drizzle-orm";
import { games, getDb } from "@wargame/db";
import { scheduleTurnEnd } from "./turn-queue";

export async function scheduleNextTurnJob(
  roomId: string,
  turnEndsAt: Date | null,
  winner: string | null | undefined
) {
  if (winner || !turnEndsAt) return;
  const delayMs = Math.max(0, turnEndsAt.getTime() - Date.now());
  const jobId = await scheduleTurnEnd(roomId, delayMs);
  const db = getDb();
  await db
    .update(games)
    .set({ turnJobId: jobId })
    .where(eq(games.roomId, roomId));
}
