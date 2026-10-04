import type { GameState } from "./types";

export const SAVE_KEY = "mercenary-v2-save";

export function saveGame(state: GameState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.company?.units?.length !== 10) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGame() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}
