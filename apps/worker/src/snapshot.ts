import { eq } from "drizzle-orm";
import { games, getDb, players, rooms } from "@wargame/db";

export async function buildSnapshot(roomId: string) {
  const db = getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return null;

  const roomPlayers = await db
    .select({
      id: players.id,
      factionId: players.factionId,
      displayName: players.displayName,
    })
    .from(players)
    .where(eq(players.roomId, roomId));

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.roomId, roomId))
    .limit(1);

  return {
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      scenarioId: room.scenarioId,
      hostPlayerId: room.hostPlayerId,
    },
    players: roomPlayers,
    game: game
      ? {
          turn: game.turn,
          phase: game.phase,
          turnEndsAt: game.turnEndsAt?.toISOString() ?? null,
          state: game.state,
          winnerFactionId: game.winnerFactionId,
        }
      : null,
  };
}
