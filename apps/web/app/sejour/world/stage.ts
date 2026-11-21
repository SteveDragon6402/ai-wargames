import { isOuting, isPlace, type OutingId, type PlaceId, type UnlockId } from "./places";

export type StageKind = "image" | "minigame" | "form" | "menu" | "clip";

export interface StageCall {
  kind: StageKind;
  id: string;
}

const ALLOWED_STAGE: Record<StageKind, readonly string[]> = {
  image: ["boulangerie", "baguette", "croissant", "brioche", "dining", "kitchen", "parc", "dog", "cinema", "pharmacie", "camille", "football"],
  minigame: ["pet_dog", "frisbee", "penalty", "cooking"],
  form: ["speedfriending", "sport"],
  menu: ["bistro", "auberge"],
  clip: ["petit_nicolas", "amelie", "intouchables"],
};

export function cleanStageCall(raw: unknown): StageCall | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { kind?: unknown; id?: unknown };
  const kind = item.kind as StageKind;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!(kind in ALLOWED_STAGE)) return null;
  if (!ALLOWED_STAGE[kind].includes(id)) return null;
  return { kind, id };
}

/**
 * Filter any place suggestions from Madame against the player's actual unlocked set.
 * A place that has not passed its gate can never be suggested or shown as a chip.
 */
export function filterSuggestedPlaces(suggested: readonly unknown[], unlocked: readonly UnlockId[]): PlaceId[] {
  const allowed = new Set<string>(unlocked);
  const out: PlaceId[] = [];
  for (const raw of suggested) {
    if (isPlace(raw) && allowed.has(raw) && !out.includes(raw)) {
      out.push(raw);
    }
  }
  return out;
}

/** Filter a friend's outing invitation against unlocked `invite_<outing>` gates. */
export function filterInvite(outing: unknown, unlocked: readonly UnlockId[]): OutingId | null {
  if (!isOuting(outing)) return null;
  const key: UnlockId = `invite_${outing}`;
  return unlocked.includes(key) ? outing : null;
}
