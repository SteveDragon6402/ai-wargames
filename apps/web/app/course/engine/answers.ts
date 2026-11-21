/** Shared answer matching and listening-mode rules. Safe to import from client pages. */

export const GRAMMAR_PASS_PERCENT = 70;

export type ListeningMode = "auto" | "on" | "off";

export function normalizeFrenchAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function frenchAnswersMatch(given: string, answer: string, accept: readonly string[] = []): boolean {
  const candidate = normalizeFrenchAnswer(given);
  if (!candidate) return false;
  return [answer, ...accept].some((target) => normalizeFrenchAnswer(target) === candidate);
}

/** Whole-word / whole-phrase match. "pain" does not hit inside "copain". */
export function containsFrenchPhrase(haystack: string, phrase: string): boolean {
  const text = normalizeFrenchAnswer(haystack);
  const target = normalizeFrenchAnswer(phrase);
  if (!text || !target || target.length < 3) return false;
  const pattern = target
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?:^|\\s)${pattern}(?:$|\\s)`).test(text);
}

const ARTICLE = /^(un|une|le|la|les|l'|du|des|de la|de l')\s+/;

/** Typed French recall. The English gloss never counts, even if it is the only thing they type. */
export function scoreVocabRecall(item: { fr: string; en: string; article?: string }, typed: string): boolean {
  const given = normalizeFrenchAnswer(typed);
  if (!given) return false;
  const glosses = item.en.split("/").map((part) => normalizeFrenchAnswer(part)).filter(Boolean);
  if (glosses.includes(given) || normalizeFrenchAnswer(item.en) === given) return false;
  const fr = normalizeFrenchAnswer(item.fr);
  const bare = fr.replace(ARTICLE, "").trim();
  const withArticle = item.article ? normalizeFrenchAnswer(`${item.article} ${item.fr}`) : "";
  return given === fr || given === bare || (withArticle !== "" && given === withArticle);
}

const DINNER_SCENES = new Set(["meal", "homemeal", "family"]);
const ERRAND_SCENES = new Set(["boulangerie", "epicerie", "shop", "supermarche", "bistro", "auberge", "pharmacie"]);

/**
 * Whether NPC French stays off the screen.
 * Auto mode is reading: the words stay up until a conversation is familiar.
 * Madame's morning talks hide from week 2. A repeated errand hides on the third visit.
 * Dinners stay readable. "off" shows every word and limits listening credit. "on" hides all of it.
 * `visits` is how many times they have already finished that scene.
 */
export function hideNpcText(courseDay: number, scene: string, mode: ListeningMode, visits = 0): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  if (DINNER_SCENES.has(scene)) return false;
  const day = Math.max(1, Math.min(28, courseDay || 1));
  if (scene === "host" && day >= 8) return true;
  if (ERRAND_SCENES.has(scene) && visits >= 2) return true;
  return false;
}

export function examDayForKind(kind: "w1" | "w2" | "w3" | "w4"): number {
  if (kind === "w1") return 7;
  if (kind === "w2") return 14;
  if (kind === "w3") return 21;
  return 28;
}

/** The exam for this course day, or null on an ordinary day. */
export function examKindForDay(day: number): "w1" | "w2" | "w3" | "w4" | null {
  if (day === 7) return "w1";
  if (day === 14) return "w2";
  if (day === 21) return "w3";
  if (day === 28) return "w4";
  return null;
}

/**
 * Sit the paper on its day. A retake is allowed the morning after, once an attempt exists,
 * so the results screen can be submitted again without opening the paper a week early.
 */
/** Objective items count as one point each. A writing score is one item (score/100), so one essay cannot equal a whole listening section. */
export function weightedExamPercent(parts: readonly { points: number; max: number }[]): number {
  const earned = parts.reduce((sum, part) => sum + part.points, 0);
  const max = parts.reduce((sum, part) => sum + part.max, 0);
  return max > 0 ? Math.round((earned / max) * 100) : 0;
}

export function examKindAllowed(
  currentDay: number,
  kind: "w1" | "w2" | "w3" | "w4",
  hasAttempt: boolean,
): boolean {
  const examDay = examDayForKind(kind);
  if (currentDay === examDay) return true;
  return currentDay === examDay + 1 && hasAttempt;
}
