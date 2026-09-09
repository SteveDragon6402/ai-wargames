import { PLAYER_HEADER } from "../types";

const key = (roomId: string) => `secret-test-player:${roomId}`;

export function rememberViewer(roomId: string, playerId: string | undefined): void {
  if (!playerId || loadRoomPlayer(roomId)) return;
  storeRoomPlayer(roomId, playerId);
}

export function storeRoomPlayer(roomId: string, playerId: string): void {
  if (!roomId || !playerId) return;
  try {
    sessionStorage.setItem(key(roomId), playerId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadRoomPlayer(roomId: string): string | null {
  if (!roomId) return null;
  try {
    return sessionStorage.getItem(key(roomId));
  } catch {
    return null;
  }
}

export function roomHeaders(roomId: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const playerId = loadRoomPlayer(roomId);
  if (playerId) headers.set(PLAYER_HEADER, playerId);
  return headers;
}

export function roomFetch(roomId: string, input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, headers: roomHeaders(roomId, init?.headers) });
}
