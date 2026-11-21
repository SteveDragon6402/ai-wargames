/** The A1 rubric the coach scores every conversation on. 0 = nothing, 2 = broken but it works, 4 = comfortable. */
export const SKILLS = ["intro", "ordering", "numbers", "food", "smalltalk", "listening", "register"] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_INFO: Record<Skill, { label: string; levels: [string, string, string, string, string] }> = {
  intro: {
    label: "Introducing yourself",
    levels: [
      "No French about themselves.",
      "A word or two: a name, bonjour.",
      "Je m'appelle / je suis + name, and one more fact (age, country), even with mistakes.",
      "Name, age, nationality, where they live, in short correct sentences.",
      "Introduces themselves easily and asks the other person back.",
    ],
  },
  ordering: {
    label: "Asking for things",
    levels: [
      "Cannot ask for anything in French.",
      "Names the thing alone, or points.",
      "Je voudrais / un, une + thing, understandable even if broken.",
      "Polite full requests with quantity and s'il vous plaît.",
      "Asks, changes the order, asks about options, without help.",
    ],
  },
  numbers: {
    label: "Numbers and money",
    levels: [
      "Does not follow numbers or prices.",
      "Follows a price with help or repetition.",
      "Understands and says simple prices and quantities.",
      "Handles prices, change and quantities reliably.",
      "Numbers are no obstacle at all.",
    ],
  },
  food: {
    label: "Food and kitchen words",
    levels: [
      "No food words.",
      "One or two food words.",
      "Names the main things they eat or buy.",
      "Names food, utensils and tastes with the right article.",
      "Talks about food, likes and dislikes easily.",
    ],
  },
  smalltalk: {
    label: "Talking with people",
    levels: [
      "No exchange beyond hello.",
      "Answers a simple question with one word.",
      "Answers and asks one simple question (likes, plans, family), broken but it works.",
      "Keeps a short exchange going in both directions.",
      "Chats freely about everyday topics.",
    ],
  },
  listening: {
    label: "Following what's said",
    levels: [
      "Does not react to what was said.",
      "Reacts to a word they recognised.",
      "Responds sensibly to most simple lines.",
      "Follows everyday speech and answers on topic.",
      "Follows fast natural speech.",
    ],
  },
  register: {
    label: "Politeness",
    levels: [
      "No greetings or politeness.",
      "Bonjour or merci now and then.",
      "Greets, thanks, uses s'il vous plaît; tu/vous sometimes wrong.",
      "Right register: vous with adults and staff, tu only after a young person used it.",
      "Natural politeness, including au revoir, bonne journée, excusez-moi.",
    ],
  },
};

export type Ratings = Partial<Record<Skill, number>>;

export function isSkill(value: unknown): value is Skill {
  return typeof value === "string" && (SKILLS as readonly string[]).includes(value);
}

/** Keep only known skills, rounded and clamped to 0–4. */
export function cleanRatings(raw: unknown): Ratings {
  const out: Ratings = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSkill(key)) continue;
    const score = typeof value === "number" ? value : typeof value === "object" && value && "score" in value ? Number((value as { score: unknown }).score) : Number.NaN;
    if (!Number.isFinite(score)) continue;
    out[key] = Math.max(0, Math.min(4, Math.round(score)));
  }
  return out;
}

/** A rubric block for the reviewer prompt. */
export function rubricText(): string {
  return SKILLS.map((skill) => `${skill} (${SKILL_INFO[skill].label}): ${SKILL_INFO[skill].levels.map((text, level) => `${level}=${text}`).join(" ")}`).join("\n");
}

/**
 * Deterministic floor for skill ratings based on the French lines the player actually spoke,
 * so a clear introduction or order never fails to register if the model leaves a rating blank.
 */
export function baselineRatingsFromLines(scene: string, playerLines: readonly string[], current: Ratings): Ratings {
  const out: Ratings = { ...current };
  const combined = playerLines.join(" \n ").toLowerCase();
  if (!combined.trim()) return out;

  const bump = (skill: Skill, min: number) => {
    if ((out[skill] ?? 0) < min) out[skill] = min;
  };

  if (/\b(je m'appelle|je suis|moi c'est|j'habite|je viens|mon nom|enchant[eé])\b/i.test(combined)) {
    bump("intro", 2);
  }
  if (/\b(bonjour|bonsoir|salut|merci|s'il vous pla[iî]t|s'il te pla[iî]t|au revoir|bonne journ[eé]e|madame|monsieur)\b/i.test(combined)) {
    bump("register", 2);
  }
  if (/\b(vous|s'il vous pla[iî]t|madame|monsieur|excusez-moi)\b/i.test(combined) && /\b(merci|au revoir|bonne journ[eé]e)\b/i.test(combined)) {
    bump("register", 3);
  }
  if (
    /\b(je voudrais|je prends|un |une |des |du |de la |baguette|croissant|pain|brioche|tarte|caf[eé]|soupe|sirop|pastilles|[oœ]uf|beurre|fromage|tomate|lait|pomme|ail|oignon|huile|addition|combien)\b/i.test(
      combined,
    )
  ) {
    bump("ordering", 2);
  }
  if (/\b(combien|euro|euros|un|deux|trois|quatre|cinq|six|dix|addition|monnaie)\b/i.test(combined)) {
    bump("numbers", 2);
  }
  if (/\b(pain|baguette|croissant|beurre|miel|[oœ]uf|tomate|soupe|fromage|camembert|bon|d[eé]licieux|chaud|frais|salade|steak|poisson|pomme|ail|oignon|lait|huile)\b/i.test(combined)) {
    bump("food", 2);
  }
  if (scene === "speedfriending" || scene === "parc" || scene === "cinema" || scene === "sport" || scene === "family") {
    if (playerLines.length >= 1 && /\b(bonjour|salut|je m'appelle|je suis|j'aime|tu |vous |et toi|et vous|oui|non|super|bien|foot|film|chien|parc|merci)\b/i.test(combined)) {
      bump("smalltalk", 2);
    }
  }
  return out;
}

/** Reading the words caps listening credit below the level that opens new places. */
export function capListening(ratings: Ratings, readingAssist: boolean): Ratings {
  if (!readingAssist) return ratings;
  const next: Ratings = { ...ratings };
  if ((next.listening ?? 0) > 1) next.listening = 1;
  return next;
}

