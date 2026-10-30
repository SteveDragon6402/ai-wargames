import type { Gap } from "../lib/save";
import { LESSONS, lessonForDay, type Lesson } from "./lessons";

export interface Handout {
  id: string;
  title: string;
  body: string;
}

/** A fixed set. The review and the coach name these ids, and Madame offers from them. */
export const HANDOUTS: Handout[] = [
  {
    id: "je",
    title: "Bonjour, and je",
    body: "Bonjour is hello. Je means I. Je suis means I am, and then your name: Je suis Anne.",
  },
  {
    id: "articles",
    title: "A and the",
    body: "Un and une mean a. Le and la mean the. Un café, une pomme, le train, la gare. The word changes with the thing.",
  },
  {
    id: "voudrais",
    title: "I would like",
    body: "Je voudrais means I would like. Then the thing: Je voudrais un café. Je voudrais des œufs.",
  },
  {
    id: "negation",
    title: "Not",
    body: "Ne sits before the verb and pas sits after it. Je ne veux pas means I don't want. Je ne comprends pas means I don't understand.",
  },
  {
    id: "questions",
    title: "Asking",
    body: "C'est combien means how much is it. Où est means where is. Quel train means which train.",
  },
  {
    id: "please",
    title: "Please and thanks",
    body: "S'il vous plaît goes at the end of a request. Merci comes after they have helped. With a young person who has already said tu, it is s'il te plaît.",
  },
  {
    id: "etre",
    title: "I am and I have",
    body: "Je suis means I am. J'ai means I have. Je suis fatigué, or fatiguée. J'ai faim. Vous êtes means you are, when you are using vous.",
  },
  {
    id: "vous",
    title: "Tu and vous",
    body: "Vous is for Gérard, for Madame Rousseau, for a waiter, for the conductor, and for anyone older. Friendly does not make it tu. Tu is for a young person at speed friending, and only after they have used tu with you.",
  },
  {
    id: "verbs",
    title: "A few verbs",
    body: "Être, to be: je suis, vous êtes. Avoir, to have: j'ai, vous avez. Vouloir, to want: je veux, je voudrais, vous voulez. Aller, to go: je vais, vous allez. The je form and the vous form are the two you need first.",
  },
];

export const HANDOUT_IDS = HANDOUTS.map((handout) => handout.id);

export const HANDOUT_BY_ID: Record<string, Handout> = Object.fromEntries(HANDOUTS.map((handout) => [handout.id, handout]));

/** What Madame should offer. A recorded gap comes before the day's usual lesson, and a mastered phrase is skipped. */
export function offerLesson(day: number, mastered: readonly string[], gaps: readonly Gap[]): Lesson {
  const open = gaps.find((gap) => HANDOUT_BY_ID[gap.id] && !mastered.includes(gap.id));
  if (open) {
    const handout = HANDOUT_BY_ID[open.id];
    return {
      id: handout.id,
      title: handout.title,
      offer: handout.title,
      teach: `${handout.body} They showed this: ${open.note}. Offer the handout. If they want to talk about something else, follow them.`,
    };
  }
  const usual = lessonForDay(day);
  if (!mastered.includes(usual.id)) return usual;
  return LESSONS.find((lesson) => !mastered.includes(lesson.id)) ?? usual;
}

/** A short brief so she does not reteach what already landed, and so she can leave the script. */
export function levelBrief(mastered: readonly string[], gaps: readonly Gap[]): string {
  const known = mastered.length
    ? `They already manage: ${mastered.join(", ")}. Do not teach those again unless they ask. If je voudrais is in that list, do not teach je voudrais.`
    : "You do not know their level yet. Ask, lightly, whether they have spoken French, and listen. If a phrase comes out whole, treat it as known and do not teach it.";
  const waiting = gaps.length
    ? `Open gaps: ${gaps.map((gap) => `${gap.id} (${gap.note})`).join("; ")}. Offer one of these before the day's usual lesson.`
    : "No gaps recorded yet.";
  return `${known} ${waiting} Offer a lesson. Do not insist, and do not be bossy. If they ask about something else that belongs to the day or to the French, answer that and teach from what they just said. Do not drag them back. Vous is for you, for Gérard, for waiters, the conductor, and anyone older. Tu is only for a young person at speed friending, and only after they have used tu. Never tell them to use tu with Gérard because he was friendly.`;
}
