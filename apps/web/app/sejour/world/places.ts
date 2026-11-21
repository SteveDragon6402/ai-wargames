/** Every scene a conversation can happen in. Reviews and ratings are tagged with one of these. */
export const SCENES = [
  "host",
  "meal",
  "boulangerie",
  "epicerie",
  "supermarche",
  "cooking",
  "bistro",
  "auberge",
  "speedfriending",
  "parc",
  "cinema",
  "sport",
  "pharmacie",
  "family",
  "lesson",
] as const;
export type SceneId = (typeof SCENES)[number];

export function isScene(value: unknown): value is SceneId {
  return typeof value === "string" && (SCENES as readonly string[]).includes(value);
}

/** Places that appear as chips once they are unlocked and Madame has brought them up. */
export const PLACES = ["boulangerie", "epicerie", "supermarche", "bistro", "auberge", "speedfriending"] as const;
export type PlaceId = (typeof PLACES)[number];

/** Outings a friend can invite you to once the friendship gate has passed. */
export const OUTINGS = ["parc", "cinema", "sport"] as const;
export type OutingId = (typeof OUTINGS)[number];

export const EVENTS = ["family", "sick"] as const;
export type EventId = (typeof EVENTS)[number];

/** Everything a gate can unlock. */
export type UnlockId = PlaceId | `invite_${OutingId}` | `event_${EventId}`;

export function isPlace(value: unknown): value is PlaceId {
  return typeof value === "string" && (PLACES as readonly string[]).includes(value);
}
export function isOuting(value: unknown): value is OutingId {
  return typeof value === "string" && (OUTINGS as readonly string[]).includes(value);
}

export interface PlaceInfo {
  id: PlaceId | OutingId;
  label: string;
  fr: string;
  icon: string;
  scene: string;
  /** What Madame is told about it when nudging. */
  hint: string;
}

export const PLACE_INFO: Record<PlaceId | OutingId, PlaceInfo> = {
  boulangerie: {
    id: "boulangerie",
    label: "Boulangerie",
    fr: "la boulangerie",
    icon: "🥖",
    scene: "/sejour/v2/scenes/boulangerie.jpg",
    hint: "Martine's bakery on the corner. A simple first errand: buy bread for the two of you.",
  },
  epicerie: {
    id: "epicerie",
    label: "L'Épicerie (Grocer)",
    fr: "l'épicerie",
    icon: "🧺",
    scene: "/epicerie/shop-bg.webp",
    hint: "Gérard's traditional counter grocery. You must converse with Gérard in French for him to hand you the ingredients to cook together tonight.",
  },
  supermarche: {
    id: "supermarche",
    label: "Le Supermarché",
    fr: "le supermarché",
    icon: "🛒",
    scene: "/sejour/places/market.jpg",
    hint: "The larger self-service supermarket. Click items on the shelves to read their French labels and add them directly to your basket.",
  },
  bistro: {
    id: "bistro",
    label: "Le Petit Bistro",
    fr: "le Petit Bistro",
    icon: "☕",
    scene: "/sejour/v2/scenes/bistro.jpg",
    hint: "A casual bistro with a young waiter, Théo. Lunch on your own, with her cash.",
  },
  auberge: {
    id: "auberge",
    label: "L'Auberge",
    fr: "l'Auberge",
    icon: "🍷",
    scene: "/sejour/v2/scenes/auberge.jpg",
    hint: "The formal restaurant. Serge the waiter uses vous and no English. A treat.",
  },
  speedfriending: {
    id: "speedfriending",
    label: "Speed friending",
    fr: "le speed friending",
    icon: "👥",
    scene: "/sejour/hall.jpg",
    hint: "The speed-friending evening at the salle des fêtes. They sign up with a form each time; you can help.",
  },
  parc: { id: "parc", label: "Le parc", fr: "le parc", icon: "🌳", scene: "/sejour/v2/scenes/parc.jpg", hint: "The park." },
  cinema: { id: "cinema", label: "Le cinéma", fr: "le cinéma", icon: "🎬", scene: "/sejour/v2/scenes/cinema.jpg", hint: "The village cinema." },
  sport: { id: "sport", label: "Le foot", fr: "le foot", icon: "⚽", scene: "/sejour/v2/scenes/football.jpg", hint: "Five-a-side football with Marc's club." },
};
