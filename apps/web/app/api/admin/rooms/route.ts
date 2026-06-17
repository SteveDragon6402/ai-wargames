import { desc } from "drizzle-orm";
import { games, getDb, players, rooms } from "@wargame/db";
import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const allRooms = await db
      .select()
      .from(rooms)
      .orderBy(desc(rooms.createdAt));

    const allPlayers = await db.select().from(players);
    const allGames = await db.select().from(games);

    const playersByRoom = new Map<string, typeof allPlayers>();
    for (const p of allPlayers) {
      const list = playersByRoom.get(p.roomId) ?? [];
      list.push(p);
      playersByRoom.set(p.roomId, list);
    }

    const gameByRoom = new Map<string, (typeof allGames)[number]>();
    for (const g of allGames) {
      gameByRoom.set(g.roomId, g);
    }

    const result = allRooms.map((r) => {
      const roomPlayers = playersByRoom.get(r.id) ?? [];
      const game = gameByRoom.get(r.id) ?? null;
      return {
        id: r.id,
        code: r.code,
        status: r.status,
        scenarioId: r.scenarioId,
        soloDualFaction: r.soloDualFaction ?? false,
        createdAt: r.createdAt,
        players: roomPlayers.map((p) => ({
          displayName: p.displayName,
          factionId: p.factionId,
        })),
        game: game
          ? {
              turn: game.turn,
              phase: game.phase,
              winnerFactionId: game.winnerFactionId ?? null,
              turnEndsAt: game.turnEndsAt,
            }
          : null,
      };
    });

    return NextResponse.json({ rooms: result });
  } catch (e) {
    console.error("[GET /api/admin/rooms]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
