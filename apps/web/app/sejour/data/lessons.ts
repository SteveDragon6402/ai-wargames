export interface Lesson {
  id: string;
  title: string;
  offer: string;
  teach: string;
}

/** One short lesson a morning, for someone who has never spoken French. Day 4 is the negative. */
export const LESSONS: Lesson[] = [
  {
    id: "je",
    title: "Bonjour, and je",
    offer: "bonjour, and je, which means I",
    teach: "Bonjour is hello. Je means I. Je suis means I am. Have them try Bonjour, then Je suis and their name.",
  },
  {
    id: "articles",
    title: "A and the",
    offer: "un, une, le and la",
    teach: "Un and une mean a. Le and la mean the. Un café, une pomme, le train, la gare. Two tries, using things from today's outing.",
  },
  {
    id: "voudrais",
    title: "I would like",
    offer: "je voudrais, which means I would like",
    teach: "Je voudrais, then the thing. Je voudrais un café. Two tries that fit today's outing.",
  },
  {
    id: "negation",
    title: "Not",
    offer: "ne and pas, the two words that mean not",
    teach: "Ne sits before the verb and pas sits after it. Je ne veux pas means I don't want. Je ne comprends pas means I don't understand. Two tries: a no, and something they don't want today.",
  },
  {
    id: "questions",
    title: "Asking",
    offer: "c'est combien and où est",
    teach: "C'est combien means how much is it. Où est means where is. Two tries for today's outing.",
  },
  {
    id: "please",
    title: "Please and thanks",
    offer: "s'il vous plaît and merci",
    teach: "S'il vous plaît goes at the end of a request. Merci comes after. Two tries for today's outing.",
  },
  {
    id: "etre",
    title: "I am and I have",
    offer: "je suis and j'ai",
    teach: "Je suis means I am. J'ai means I have. Je suis fatigué. J'ai faim. Two tries.",
  },
];

export function lessonForDay(day: number): Lesson {
  const index = (Math.max(1, day) - 1) % LESSONS.length;
  return LESSONS[index];
}
