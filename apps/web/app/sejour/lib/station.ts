export interface Stop {
  id: string;
  fr: string;
  en: string;
  /** The name on the announcement and the board. */
  station: string;
  street: string;
}

export const STOPS: Stop[] = [
  { id: "home", fr: "Centre-ville", en: "the town centre", station: "Gare du Centre", street: "rue des Tilleuls" },
  { id: "market", fr: "Le Marché", en: "the market", station: "Gare du Marché", street: "rue du Marché" },
  { id: "hall", fr: "La Halle", en: "the hall", station: "Gare de la Halle", street: "place de la Halle" },
  { id: "auberge", fr: "L'Auberge", en: "the inn", station: "Gare de l'Auberge", street: "rue de l'Auberge" },
  { id: "quai", fr: "Le Quai", en: "the quay", station: "Gare du Quai", street: "quai des Pêcheurs" },
  { id: "terrasse", fr: "La Terrasse", en: "the terrace", station: "Gare de la Terrasse", street: "avenue des Platanes" },
];

export const STOP_BY_ID: Record<string, Stop> = Object.fromEntries(STOPS.map((stop) => [stop.id, stop]));

export interface Departure {
  stopId: string;
  platform: 1 | 2 | 3;
  minutes: number;
}

/** A platform lets you on only in the five minutes before the train leaves. */
export const OPEN_MINUTES = 5;

export type Gate = "gone" | "early" | "open";

export function gate(departure: Departure | undefined): Gate {
  if (!departure || departure.minutes <= 0) return "gone";
  if (departure.minutes > OPEN_MINUTES) return "early";
  return "open";
}

export function allGone(board: Departure[]): boolean {
  return board.length > 0 && board.every((departure) => departure.minutes <= 0);
}

export function tickBoard(board: Departure[], by = 1): Departure[] {
  return board.map((departure) => ({ ...departure, minutes: Math.max(0, departure.minutes - by) }));
}

/** A board that always includes the destination, plus two other trains. Yours is usually still shut. */
export function boardFor(day: number, destination: string): Departure[] {
  const platforms = [1, 2, 3] as const;
  const destPlatform = platforms[Math.abs(day) % 3];
  const pool = STOPS.filter((stop) => stop.id !== destination);
  const otherPlatforms = platforms.filter((platform) => platform !== destPlatform);
  return [
    { stopId: destination, platform: destPlatform, minutes: 6 + (Math.abs(day) % 5) },
    { stopId: pool[Math.abs(day) % pool.length].id, platform: otherPlatforms[0], minutes: 3 },
    { stopId: pool[(Math.abs(day) + 2) % pool.length].id, platform: otherPlatforms[1], minutes: 9 },
  ];
}

export function trainOn(board: Departure[], platform: number): Departure | null {
  return board.find((departure) => departure.platform === platform) ?? null;
}

const WORDS = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze"];

export function announcement(board: Departure[]): string {
  return board
    .map((departure) => {
      const stop = STOP_BY_ID[departure.stopId];
      const name = stop?.station ?? departure.stopId;
      const voie = WORDS[departure.platform] ?? "une";
      if (departure.minutes <= 0) return `Le train pour ${name} est parti.`;
      const when = departure.minutes === 1 ? "une minute" : `${WORDS[departure.minutes] ?? "quelques"} minutes`;
      return `Le train pour ${name}, voie ${voie}, départ dans ${when}.`;
    })
    .join(" ");
}
