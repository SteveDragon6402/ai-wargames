import { VOCAB_ITEMS } from "@/app/course/content/vocab";

/** Everyday glue the theme deck under-teaches. These are spoken targets, not scene props. */
const GLUE: { fr: string; en: string }[] = [
  { fr: "encore", en: "again / still" },
  { fr: "alors", en: "so / then" },
  { fr: "jamais", en: "never" },
  { fr: "sans", en: "without" },
  { fr: "déjà", en: "already" },
  { fr: "autre", en: "other" },
  { fr: "même", en: "same / even" },
  { fr: "savoir", en: "to know" },
  { fr: "mettre", en: "to put" },
  { fr: "quelque chose", en: "something" },
  { fr: "parce que", en: "because" },
  { fr: "aussi", en: "also" },
];

function rotate<T>(items: T[], start: number, count: number): T[] {
  if (!items.length || count <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < count && i < items.length; i++) out.push(items[(start + i) % items.length]);
  return out;
}

/** About six chunks to say today: glue plus the core deck for this week. */
export function spokenForDay(day: number): { fr: string; en: string }[] {
  const week = Math.min(4, Math.max(1, Math.ceil(day / 7))) as 1 | 2 | 3 | 4;
  const core = VOCAB_ITEMS.filter((item) => item.core && item.week <= week).map((item) => ({ fr: item.fr, en: item.en }));
  const glue = rotate(GLUE, (day - 1) % GLUE.length, 3);
  const fromDeck = rotate(core, ((day - 1) * 3) % Math.max(1, core.length), 3);
  return [...glue, ...fromDeck];
}

/** Scene words to hear and gloss once. Not a quiz. */
export function recognitionForDay(day: number): { fr: string; en: string }[] {
  const week = Math.min(4, Math.max(1, Math.ceil(day / 7))) as 1 | 2 | 3 | 4;
  const scene = VOCAB_ITEMS.filter((item) => !item.core && item.week === week).map((item) => ({ fr: item.fr, en: item.en }));
  return rotate(scene, ((day - 1) * 4) % Math.max(1, scene.length), 6);
}

/** One aside for the character's first line. The next turn does not include it. */
export function openingWordNudge(day: number, extra: readonly { fr: string }[] = []): string {
  const spoken = spokenForDay(day).map((item) => item.fr);
  const again = extra.map((item) => item.fr).filter(Boolean);
  const focus = again[0] ? ` They had trouble with « ${again[0]} ». If that one fits, prefer it.` : "";
  return `Private, for this line only. You are still yourself. This is not a lesson, and you do not mention practice or teaching. If one of these can come up the way you would actually talk, use one, then get on with why they are here. A baker with the weather on the list might ask how the weather is, and then ask what they want. If none of it fits, say what you were going to say.${focus}\n${spoken.join(", ")}`;
}
