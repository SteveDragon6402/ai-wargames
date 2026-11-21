import { weakestSkills, type Progress } from "./gates";
import type { Skill } from "./skills";

export interface LessonSpec {
  id: string;
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** How Madame offers it in one natural sentence. */
  offer: string;
  /** The short explanation + 2 practice prompts. */
  teach: string;
  /** Sample phrases the player practices. */
  examples: { fr: string; en: string }[];
  skills: Skill[];
}

/** Phase 1 curriculum: 15 core A1 DELF grammar & survival lessons in increasing difficulty (Phase 2 expands to 50). */
export const CURRICULUM: LessonSpec[] = [
  {
    id: "je",
    level: 1,
    title: "Bonjour, and introducing yourself",
    offer: "how to say hello and introduce yourself with je m'appelle and je suis",
    teach: "Bonjour means hello. Je m'appelle means my name is, and je suis means I am. Have them try: Bonjour, je m'appelle… and one thing about themselves.",
    examples: [
      { fr: "Bonjour, je m'appelle…", en: "Hello, my name is…" },
      { fr: "Enchanté / Enchantée.", en: "Nice to meet you." },
    ],
    skills: ["intro", "register"],
  },
  {
    id: "please",
    level: 1,
    title: "S'il vous plaît and merci",
    offer: "s'il vous plaît and merci — please and thank you",
    teach: "S'il vous plaît goes at the end of a request. Merci comes after someone helps you. Au revoir et bonne journée when you leave.",
    examples: [
      { fr: "Une baguette, s'il vous plaît.", en: "A baguette, please." },
      { fr: "Merci beaucoup, bonne journée !", en: "Thank you very much, have a good day!" },
    ],
    skills: ["register", "ordering"],
  },
  {
    id: "articles",
    level: 1,
    title: "Un, une, le, la (a and the)",
    offer: "un and une for a, and le and la for the",
    teach: "Every French noun is masculine or feminine. Un pain, une baguette. Le pain, la baguette. Plural is des (some) or les (the).",
    examples: [
      { fr: "Un croissant et une baguette.", en: "A croissant and a baguette." },
      { fr: "Le beurre et la confiture.", en: "The butter and the jam." },
    ],
    skills: ["ordering", "food"],
  },
  {
    id: "voudrais",
    level: 1,
    title: "Je voudrais (I would like)",
    offer: "je voudrais, the polite way to ask for anything in a shop or café",
    teach: "Je voudrais means I would like. Put the thing right after it: Je voudrais une baguette, s'il vous plaît.",
    examples: [
      { fr: "Je voudrais un café, s'il vous plaît.", en: "I would like a coffee, please." },
      { fr: "Je voudrais deux croissants.", en: "I would like two croissants." },
    ],
    skills: ["ordering", "register"],
  },
  {
    id: "vous",
    level: 2,
    title: "Tu and vous",
    offer: "when to say vous and when to say tu",
    teach: "Vous is for Madame Rousseau, shopkeepers, waiters, and any adult you don't know well. Tu is only for a young friend or child once they use tu with you.",
    examples: [
      { fr: "Comment allez-vous ?", en: "How are you? (polite / vous)" },
      { fr: "Comment tu t'appelles ?", en: "What's your name? (informal / tu)" },
    ],
    skills: ["register", "smalltalk"],
  },
  {
    id: "etre",
    level: 2,
    title: "Être and avoir (to be and to have)",
    offer: "je suis and j'ai — I am and I have",
    teach: "Être (to be): je suis, tu es, vous êtes. Avoir (to have): j'ai, tu as, vous avez. Note that French says j'ai faim (I have hunger) and j'ai vingt ans (I have twenty years).",
    examples: [
      { fr: "Je suis fatigué(e), j'ai faim.", en: "I am tired, I'm hungry." },
      { fr: "Vous avez du pain ?", en: "Do you have bread?" },
    ],
    skills: ["intro", "smalltalk"],
  },
  {
    id: "numbers",
    level: 2,
    title: "Numbers and prices (1 to 20)",
    offer: "counting and understanding prices in euros",
    teach: "Un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix. Ça fait combien ? asks how much it comes to.",
    examples: [
      { fr: "Ça fait combien, s'il vous plaît ?", en: "How much does that come to, please?" },
      { fr: "Deux euros cinquante.", en: "Two euros fifty." },
    ],
    skills: ["numbers", "ordering"],
  },
  {
    id: "questions",
    level: 2,
    title: "Asking simple questions",
    offer: "c'est combien, où est, and qu'est-ce que c'est",
    teach: "C'est combien ? = How much is it? Où est… ? = Where is…? Qu'est-ce que c'est ? = What is that?",
    examples: [
      { fr: "C'est combien, la brioche ?", en: "How much is the brioche?" },
      { fr: "Où est la pharmacie ?", en: "Where is the pharmacy?" },
    ],
    skills: ["ordering", "listening"],
  },
  {
    id: "negation",
    level: 3,
    title: "Saying not: ne … pas",
    offer: "ne and pas, the two words that wrap around a verb to say not",
    teach: "Ne goes before the verb and pas goes after it: Je ne sais pas (I don't know), Je ne comprends pas (I don't understand). Before a vowel, ne becomes n'.",
    examples: [
      { fr: "Je ne comprends pas.", en: "I don't understand." },
      { fr: "Je n'ai pas de monnaie.", en: "I don't have change." },
    ],
    skills: ["smalltalk", "listening"],
  },
  {
    id: "aimer",
    level: 3,
    title: "Likes and dislikes (aimer, préférer)",
    offer: "saying what you like and don't like with j'aime and je préfère",
    teach: "J'aime means I like; j'adore means I love; je n'aime pas means I don't like. Always use le/la/les after it: J'aime le fromage.",
    examples: [
      { fr: "J'aime beaucoup le fromage.", en: "I really like cheese." },
      { fr: "Tu aimes le foot ?", en: "Do you like football?" },
    ],
    skills: ["smalltalk", "food"],
  },
  {
    id: "partitive",
    level: 3,
    title: "Some: du, de la, des",
    offer: "du, de la, and des for 'some' food or drink",
    teach: "When talking about an uncounted amount of food, use du (masculine), de la (feminine), de l' (before vowel), or des (plural): du pain, de la soupe, de l'eau, des œufs.",
    examples: [
      { fr: "Je prends du pain et de la soupe.", en: "I'll have some bread and some soup." },
      { fr: "Une carafe d'eau, s'il vous plaît.", en: "A jug of water, please." },
    ],
    skills: ["food", "ordering"],
  },
  {
    id: "aller",
    level: 4,
    title: "Going places: aller + au / à la",
    offer: "je vais and tu vas — saying where you're going",
    teach: "Aller (to go): je vais, tu vas, on va, vous allez. Combine with au (masculine place), à la (feminine), or aux (plural): Je vais à la boulangerie, on va au parc.",
    examples: [
      { fr: "Je vais à la boulangerie.", en: "I'm going to the bakery." },
      { fr: "On va au parc cet après-midi ?", en: "Shall we go to the park this afternoon?" },
    ],
    skills: ["smalltalk", "intro"],
  },
  {
    id: "venir_de",
    level: 4,
    title: "Where you're from and nationality",
    offer: "je viens de… and masculine/feminine nationalities",
    teach: "Je viens de + city or country (Je viens de Londres, du Canada, des États-Unis). Nationalities add -e in the feminine: anglais / anglaise, américain / américaine.",
    examples: [
      { fr: "Je viens de Londres. Je suis anglais(e).", en: "I come from London. I'm English." },
      { fr: "Tu viens d'où ?", en: "Where are you from?" },
    ],
    skills: ["intro", "smalltalk"],
  },
  {
    id: "prendre",
    level: 4,
    title: "Ordering at a table: je prends + l'addition",
    offer: "je prends for ordering a dish, and l'addition for the bill",
    teach: "At a restaurant, waiters ask Vous avez choisi ? Answer with Je prends… or Pour moi, le steak frites. Ask for the bill with L'addition, s'il vous plaît.",
    examples: [
      { fr: "Je prends la soupe du jour.", en: "I'll have the soup of the day." },
      { fr: "L'addition, s'il vous plaît.", en: "The bill, please." },
    ],
    skills: ["ordering", "register", "food"],
  },
  {
    id: "avoir_mal",
    level: 5,
    title: "At the pharmacy: avoir mal à…",
    offer: "explaining what hurts or what someone needs at the pharmacie",
    teach: "Avoir mal à + body part: J'ai mal à la tête (headache), mal à la gorge (sore throat), elle a de la fièvre (she has a fever), elle tousse (she is coughing).",
    examples: [
      { fr: "Elle a mal à la gorge et elle tousse.", en: "She has a sore throat and is coughing." },
      { fr: "Vous avez un sirop pour la toux ?", en: "Do you have a cough syrup?" },
    ],
    skills: ["ordering", "smalltalk"],
  },
];

export const LESSON_BY_ID: Record<string, LessonSpec> = Object.fromEntries(CURRICULUM.map((lesson) => [lesson.id, lesson]));

export interface LessonChoiceState extends Progress {
  lessonsDone: readonly string[];
  lessonsSkipped: readonly string[];
  gaps: readonly { id: string; note: string }[];
}

/**
 * Pick the next lesson for Madame to offer:
 * 1. Exclude lessons already completed or skipped (unless all have been seen, then allow skipped ones).
 * 2. If the very first lesson ('je') hasn't been done or skipped, always start there.
 * 3. If an open gap matches an available lesson id, offer that immediately.
 * 4. Otherwise look at the lowest remaining difficulty tier (and one tier above) and pick a lesson targeting the player's weakest rated skill.
 */
export function nextLesson(state: LessonChoiceState): LessonSpec {
  const done = new Set(state.lessonsDone);
  const skipped = new Set(state.lessonsSkipped);

  let pool = CURRICULUM.filter((lesson) => !done.has(lesson.id) && !skipped.has(lesson.id));
  if (!pool.length) {
    pool = CURRICULUM.filter((lesson) => !done.has(lesson.id));
  }
  if (!pool.length) {
    return CURRICULUM[0];
  }

  // Always offer the introductory 'je' lesson first if untouched
  const intro = pool.find((lesson) => lesson.id === "je");
  if (intro && state.lessonsDone.length === 0 && state.lessonsSkipped.length === 0) {
    return intro;
  }

  // Check if an open coach gap directly names an available lesson
  for (const gap of state.gaps) {
    const match = pool.find((lesson) => lesson.id === gap.id);
    if (match) return match;
  }

  const minLevel = Math.min(...pool.map((lesson) => lesson.level));
  const nearPool = pool.filter((lesson) => lesson.level <= minLevel + 1);

  const weak = weakestSkills(state);
  for (const skill of weak) {
    const match = nearPool.find((lesson) => lesson.skills.includes(skill));
    if (match) return match;
  }

  return pool[0];
}
