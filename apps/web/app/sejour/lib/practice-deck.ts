import { VOCAB_ITEMS } from "@/app/course/content/vocab";
import { normalizeFrenchAnswer, promptWithoutGiveaway } from "@/app/course/engine/answers";
import { recognitionForDay, spokenForDay } from "@/app/course/content/spoken";

export interface PracticeCard {
  fr: string;
  en: string;
  /** "from" shows French and asks for English. "to" shows English and asks for French. */
  direction: "from" | "to";
  fresh: boolean;
  sentence: boolean;
  exampleFr: string;
  exampleEn: string;
}

function exampleFor(fr: string): { fr: string; en: string } | null {
  const words = fr
    .toLowerCase()
    .replace(/[«»"'.…!?]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const hits = VOCAB_ITEMS.filter((item) => item.exampleFr && words.includes(item.fr.toLowerCase()));
  hits.sort((a, b) => b.fr.length - a.fr.length);
  const hit = hits[0];
  if (!hit?.exampleFr) return null;
  return { fr: hit.exampleFr, en: hit.exampleEn ?? "" };
}

function sentenceFor(fr: string, en: string): { fr: string; en: string } {
  const known = exampleFor(fr);
  if (known) return known;
  const clean = fr.replace(/[.!?…]+$/g, "").trim();
  return {
    fr: `Vous dites « ${clean} ».`,
    en: en ? `You say “${en.replace(/[.!?]+$/g, "").trim()}”.` : "You say that.",
  };
}

/**
 * Warm up with French-to-English words, then ask for French.
 * Early days stay on the French-to-English side. Later days ask for more French.
 * Lines from the review (extra) are always "say it in French".
 * Two new words can appear, taught on the card before the question.
 */
export function buildPracticeDeck(day: number, extra: readonly { fr: string; en: string }[]): PracticeCard[] {
  const seen = new Set<string>();
  const take = (fr: string) => {
    const key = fr.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  const drills = extra.filter((card) => take(card.fr));
  const spokenWords: { fr: string; en: string }[] = [];
  const spokenSentences: { fr: string; en: string }[] = [];
  for (const card of spokenForDay(day)) {
    if (!take(card.fr)) continue;
    if (card.fr.trim().split(/\s+/).length >= 3) spokenSentences.push(card);
    else spokenWords.push(card);
  }
  const fresh = recognitionForDay(day)
    .filter((card) => take(card.fr))
    .slice(0, 2);

  const toShare = Math.min(0.7, 0.2 + Math.max(0, day - 1) * 0.02);
  const warmupCount = Math.max(2, Math.round(spokenWords.length * (1 - toShare)));
  const warmup = spokenWords.slice(0, day < 8 ? Math.max(warmupCount, 3) : warmupCount);
  const laterWords = spokenWords.slice(warmup.length);

  const cards: PracticeCard[] = [];
  const push = (
    card: { fr: string; en: string },
    direction: "from" | "to",
    freshCard: boolean,
  ) => {
    const sentence = card.fr.trim().split(/\s+/).length >= 3;
    const example = sentence ? { fr: card.fr, en: card.en } : sentenceFor(card.fr, card.en);
    cards.push({
      fr: card.fr,
      en: card.en,
      direction: sentence && day < 8 && !drills.some((item) => item.fr === card.fr) ? "from" : direction,
      fresh: freshCard,
      sentence,
      exampleFr: example.fr,
      exampleEn: example.en,
    });
  };

  for (const card of warmup) push(card, "from", false);
  for (const card of drills) push(card, "to", false);
  for (const card of fresh) push(card, "to", true);
  for (const card of laterWords) push(card, "to", false);
  for (const card of spokenSentences) push(card, day < 8 ? "from" : "to", false);

  return cards
    .filter((card) => {
      if (card.direction !== "to") return true;
      const goal = normalizeFrenchAnswer(card.fr);
      if (goal.length < 4) return true;
      const cleaned = promptWithoutGiveaway(card.en, card.fr);
      return Boolean(cleaned) || !normalizeFrenchAnswer(card.en).includes(goal);
    })
    .slice(0, 8);
}
