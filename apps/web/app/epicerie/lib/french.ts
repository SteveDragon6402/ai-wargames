import { ITEMS } from "../data/items";
import { normalise } from "./shop";

const STEMS = [
  ...ITEMS.flatMap((item) => item.keywords),
  "pain",
  "fromage",
  "bouteille",
  "boite",
  "pot",
  "tablette",
  "kilo",
  "rouge",
  "tete",
  "barquette",
  "euro",
  "centime",
];

/** Everyday French, plus the words a customer would need in this shop. */
const FRENCH = new Set([
  "bonjour",
  "bonsoir",
  "salut",
  "merci",
  "pardon",
  "oui",
  "non",
  "sil",
  "plait",
  "svp",
  "je",
  "tu",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "elles",
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "au",
  "aux",
  "et",
  "ou",
  "mais",
  "donc",
  "car",
  "que",
  "qui",
  "quoi",
  "dont",
  "pas",
  "plus",
  "ne",
  "ce",
  "cet",
  "cette",
  "ces",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "son",
  "sa",
  "ses",
  "notre",
  "votre",
  "leur",
  "moi",
  "toi",
  "lui",
  "veux",
  "voudrais",
  "voulez",
  "prendre",
  "avoir",
  "suis",
  "est",
  "sont",
  "ai",
  "as",
  "avez",
  "combien",
  "ca",
  "cest",
  "ceci",
  "cela",
  "ici",
  "revoir",
  "madame",
  "monsieur",
  "mademoiselle",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "bon",
  "bonne",
  "avec",
  "pour",
  "dans",
  "sur",
  "chez",
  "comment",
  "pourquoi",
  "quand",
  "aussi",
  "encore",
  "alors",
  "puis",
  "tout",
  "bien",
  "mal",
  "petit",
  "petite",
  "grand",
  "grande",
  "excusez",
  "desole",
  "desolee",
  "voila",
  "donne",
  "donnez",
  "fait",
  "fais",
  "faites",
  "peux",
  "peut",
  "pouvez",
  "jour",
  "soir",
  "ah",
  "bah",
  "hein",
  "quoi",
  "es",
  "merde",
  "putain",
  "connard",
  "connasse",
  "bordel",
  "chier",
  "foutre",
  "foutu",
  "salaud",
  "salope",
  "pute",
  "encule",
  "nique",
  "gueule",
  "merdeux",
  "degage",
  "couille",
  "emmerde",
]);

const ENGLISH = new Set([
  "the",
  "a",
  "an",
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "it",
  "my",
  "your",
  "me",
  "want",
  "have",
  "has",
  "do",
  "does",
  "did",
  "please",
  "hello",
  "hi",
  "hey",
  "thank",
  "thanks",
  "how",
  "much",
  "what",
  "where",
  "this",
  "that",
  "some",
  "any",
  "eggs",
  "milk",
  "bread",
  "yes",
  "no",
  "ok",
  "okay",
  "and",
  "of",
  "to",
  "for",
  "with",
  "can",
  "could",
  "would",
  "like",
  "need",
  "get",
  "give",
  "is",
  "are",
  "am",
  "not",
  "dont",
  "money",
  "bye",
  "goodbye",
]);

function frenchToken(token: string): boolean {
  if (FRENCH.has(token)) return true;
  return STEMS.some((stem) => token === stem || token === `${stem}s` || token === `${stem}x` || token === `${stem}es`);
}

/** Short or very common words. They support a sentence, but one of them alone is not proof of French. */
const LIGHT = new Set([
  "un",
  "une",
  "le",
  "la",
  "les",
  "je",
  "tu",
  "il",
  "on",
  "et",
  "ou",
  "de",
  "des",
  "du",
  "au",
  "ce",
  "ca",
  "ah",
  "bon",
  "oui",
  "non",
  "es",
  "est",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
]);

function tokensOf(raw: string): string[] {
  return normalise(raw)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/** A line of real French, including swearing. A number or "tu" by itself does not count. */
export function isFrenchUtterance(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 2) return false;
  const tokens = tokensOf(text);
  if (!tokens.length) return false;
  let english = 0;
  let strong = /[àâäçéèêëïîôùûüœ]/i.test(text);
  for (const token of tokens) {
    if (frenchToken(token)) {
      if (token.length >= 4 && !LIGHT.has(token)) strong = true;
    } else if (ENGLISH.has(token)) english += 1;
  }
  return strong && english === 0;
}

const LINE_LABELS = ["Understood", "Close", "English", "Unclear", "French"] as const;
export type LineLabel = (typeof LINE_LABELS)[number];

/** French, including a swear, is never filed under English. */
export function labelForLine(said: string, line: string): LineLabel {
  const text = said.trim().toLowerCase();
  const base: LineLabel = text.startsWith("under")
    ? "Understood"
    : text.startsWith("close")
      ? "Close"
      : text.startsWith("eng")
        ? "English"
        : text.startsWith("fr")
          ? "French"
          : "Unclear";
  if ((base === "English" || base === "Unclear") && isFrenchUtterance(line)) return "French";
  return base;
}

/** Drop tool markup the model sometimes pastes into the prose. */
export function reviewProse(text: string): string {
  const cut = text.search(/<\/?[a-zA-Z]/);
  return (cut === -1 ? text : text.slice(0, cut)).replace(/\s+/g, " ").trim();
}

/** Phrases the model buried in that markup, when the phrases field itself arrived empty. */
export function phrasesBuriedIn(text: string): { fr: string; en: string }[] {
  const start = text.indexOf("[{");
  const end = text.lastIndexOf("}]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 2)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { fr: string; en: string } => {
        if (!item || typeof item !== "object") return false;
        const phrase = item as { fr?: unknown; en?: unknown };
        return typeof phrase.fr === "string" && typeof phrase.en === "string";
      })
      .slice(0, 6);
  } catch {
    return [];
  }
}

/** Whether a highlighted scrap is French enough to send to the voice. */
export function looksFrench(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 2 || text.length > 280) return false;
  const tokens = tokensOf(text);
  if (!tokens.length) return false;
  let french = /[àâäçéèêëïîôùûüœ]/i.test(text) ? 2 : 0;
  let english = 0;
  for (const token of tokens) {
    if (frenchToken(token)) french += 1;
    else if (ENGLISH.has(token)) english += 1;
  }
  return french > 0 && french > english;
}
