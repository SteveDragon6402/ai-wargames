import { eq } from "drizzle-orm";
import { getDb, players } from "@wargame/db";
import { getSessionToken } from "./session";

export async function getCurrentPlayer(roomId: string) {
  const token = await getSessionToken();
  if (!token) return null;
  const db = getDb();
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.sessionToken, token))
    .limit(1);
  if (!player || player.roomId !== roomId) return null;
  return player;
}
