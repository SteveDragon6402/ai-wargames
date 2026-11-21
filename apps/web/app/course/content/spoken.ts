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

export function wordTargetNote(day: number, extra: readonly { fr: string }[] = []): string {
  const spoken = spokenForDay(day).map((item) => item.fr);
  const heard = recognitionForDay(day).map((item) => `${item.fr} (${item.en})`);
  const again = extra.map((item) => item.fr).filter(Boolean);
  const againLine = again.length ? ` They got lost on: ${again.join("; ")}. Those come before anything new.` : "";
  return `[WORDS]: By the end of the month they should say about 300 words (the 150 most common, plus about 150 from the places) and recognize 500 to 1000. Today they should SAY: ${spoken.join(", ")}.${againLine} They only need to RECOGNIZE these, each glossed once in English, not quizzed: ${heard.join("; ")}. One new spoken word in a turn. Answering what they just said comes before any of these words.`;
}
