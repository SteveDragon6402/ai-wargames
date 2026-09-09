import { headers } from "next/headers";
import { getSessionToken } from "@/lib/session";
import { PLAYER_HEADER } from "../types";

export async function resolveRoomViewer<T extends { id: string; sessionToken: string }>(
  roomPlayers: T[]
): Promise<T | null> {
  const h = await headers();
  const playerId = h.get(PLAYER_HEADER)?.trim();
  if (playerId) {
    const byId = roomPlayers.find((p) => p.id === playerId);
    if (byId) return byId;
  }
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;
  return roomPlayers.find((p) => p.sessionToken === sessionToken) ?? null;
}
