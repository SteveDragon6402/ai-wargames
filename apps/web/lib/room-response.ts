import type { Command } from "@wargame/shared";
import { and, eq } from "drizzle-orm";
import { games, getDb, orders as ordersTable, players, rooms } from "@wargame/db";

export async function buildRoomSnapshot(roomId: string, viewerPlayerId?: string) {
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

  const viewer = roomPlayers.find((p) => p.id === viewerPlayerId);
  const myFaction = viewer?.factionId;
  const soloDualFaction = room.soloDualFaction ?? false;

  let orders: Command[] = [];
  if (game && viewerPlayerId) {
    if (soloDualFaction) {
      const rows = await db
        .select()
        .from(ordersTable)
        .where(
          and(eq(ordersTable.roomId, roomId), eq(ordersTable.turn, game.turn))
        );
      orders = rows.map((r) => r.command);
    } else {
      const rows = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.roomId, roomId),
            eq(ordersTable.turn, game.turn),
            eq(ordersTable.playerId, viewerPlayerId)
          )
        );
      orders = rows.map((r) => r.command);
    }
  }

  return {
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      scenarioId: room.scenarioId,
      hostPlayerId: room.hostPlayerId,
      soloDualFaction,
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
    viewer: viewer
      ? { playerId: viewer.id, factionId: viewer.factionId, displayName: viewer.displayName }
      : null,
    orders,
    readyPlayerIds: Array.isArray(game?.readyPlayerIds) ? game.readyPlayerIds : [],
    mySubmitted: viewerPlayerId
      ? (game?.readyPlayerIds ?? []).includes(viewerPlayerId)
      : false,
  };
}
