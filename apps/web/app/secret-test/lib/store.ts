import { eq } from "drizzle-orm";
import { getDb, rooms, players, secretTestGames } from "@wargame/db";
import type { SecretTestState } from "../types";
import { parseState } from "./state";

export async function loadSecretRoom(roomId: string) {
  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room || room.scenarioId !== "secret-test") return null;
  const roomPlayers = await db.select().from(players).where(eq(players.roomId, roomId));
  const [row] = await db
    .select()
    .from(secretTestGames)
    .where(eq(secretTestGames.roomId, roomId))
    .limit(1);
  const state = row ? parseState(row.state) : null;
  return { db, room, roomPlayers, state };
}

export async function saveState(roomId: string, state: SecretTestState) {
  const db = getDb();
  await db
    .update(secretTestGames)
    .set({ state, updatedAt: new Date() })
    .where(eq(secretTestGames.roomId, roomId));
}
