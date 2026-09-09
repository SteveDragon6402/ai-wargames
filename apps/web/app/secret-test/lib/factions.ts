import { eq } from "drizzle-orm";
import { getDb, players } from "@wargame/db";
import { isFactionId, rivalFaction, type FactionId } from "../types";

type Db = ReturnType<typeof getDb>;
type Row = { id: string; factionId: string };

export async function ensureDistinctFactions<T extends Row>(db: Db, roomPlayers: T[]): Promise<T[]> {
  const a = roomPlayers[0];
  const b = roomPlayers[1];
  if (!a || !b) return roomPlayers;

  const reds = roomPlayers.filter((p) => p.factionId === "red");
  const blues = roomPlayers.filter((p) => p.factionId === "blue");
  if (reds.length === 1 && blues.length === 1) return roomPlayers;

  const aFac: FactionId = isFactionId(a.factionId) ? a.factionId : "red";
  const bFac = rivalFaction(aFac);
  await db.update(players).set({ factionId: aFac }).where(eq(players.id, a.id));
  await db.update(players).set({ factionId: bFac }).where(eq(players.id, b.id));
  return roomPlayers.map((p) => {
    if (p.id === a.id) return { ...p, factionId: aFac };
    if (p.id === b.id) return { ...p, factionId: bFac };
    return p;
  });
}
