export interface CinemaLine {
  speaker: string;
  voice: string;
  fr: string;
  en: string;
  backdrop?: string;
  shot?: string;
  emoji?: string;
}

export interface CinemaClip {
  id: string;
  youtubeId: string;
  youtubeQuery: string;
  poster: string;
  title: string;
  film: string;
  year: number;
  level: 1 | 2 | 3;
  context: string;
  /** Dialogue lines spoken in the clip, each with a visual cinema frame and ElevenLabs/browser voice. */
  lines: CinemaLine[];
  words: { fr: string; en: string }[];
  question: {
    promptFr: string;
    promptEn: string;
    choices: { fr: string; en: string; correct?: boolean }[];
  };
}

export const CINEMA_CLIPS: CinemaClip[] = [
  {
    id: "petit_nicolas",
    youtubeId: "jNQXAC9IVRw",
    youtubeQuery: "Le Petit Nicolas 2009 la photo de classe extrait VF",
    poster: "/sejour/places/square.jpg",
    title: "La photo de classe",
    film: "Le Petit Nicolas",
    year: 2009,
    level: 1,
    context: "A schoolboy introduces his classmates and teacher on the morning of the school photo.",
    lines: [
      {
        speaker: "Nicolas",
        voice: "paul",
        fr: "Bonjour ! Moi, je m'appelle Nicolas. Aujourd'hui, c'est le grand jour : on fait la photo de classe !",
        en: "Hello! My name is Nicolas. Today is the big day: we're taking the school photo!",
        backdrop: "/sejour/places/square.jpg",
        shot: "Cour de l'école · Morning bell rings in the schoolyard",
        emoji: "👦📸",
      },
      {
        speaker: "Alceste",
        voice: "marc",
        fr: "J'ai faim ! Tu veux un morceau de mon pain au chocolat avant la photo ?",
        en: "I'm hungry! Do you want a piece of my pain au chocolat before the photo?",
        backdrop: "/sejour/places/bakery.jpg",
        shot: "Gros plan · Alceste holding a warm pastry in both hands",
        emoji: "🥐😋",
      },
      {
        speaker: "La maîtresse",
        voice: "nadine",
        fr: "Les enfants, silence s'il vous plaît ! Mettez-vous en rang et souriez pour le photographe !",
        en: "Children, quiet please! Line up and smile for the photographer!",
        backdrop: "/sejour/hall.jpg",
        shot: "Plan large · The teacher claps her hands as the camera flashes",
        emoji: "👩‍🏫✨",
      },
      {
        speaker: "Nicolas",
        voice: "paul",
        fr: "J'adore mes copains et j'adore l'école… surtout pendant la récréation !",
        en: "I love my pals and I love school… especially during recess!",
        backdrop: "/sejour/places/square.jpg",
        shot: "Plan final · Flash of the vintage camera — *CLIC !*",
        emoji: "📷😄",
      },
    ],
    words: [
      { fr: "la photo de classe", en: "the school photo" },
      { fr: "les enfants", en: "the children" },
      { fr: "souriez", en: "smile" },
      { fr: "un copain", en: "a friend / pal" },
    ],
    question: {
      promptFr: "Qu'est-ce qu'Alceste mange dans la cour ?",
      promptEn: "What is Alceste eating in the schoolyard?",
      choices: [
        { fr: "Un pain au chocolat", en: "A pain au chocolat", correct: true },
        { fr: "Une soupe à l'oignon", en: "An onion soup" },
        { fr: "Une pomme verte", en: "A green apple" },
      ],
    },
  },
  {
    id: "hulot",
    youtubeId: "M7lc1UVf-VE",
    youtubeQuery: "Les Vacances de Monsieur Hulot 1953 extrait plage gare Jacques Tati",
    poster: "/sejour/station.jpg",
    title: "Le train pour la plage",
    film: "Les Vacances de Monsieur Hulot",
    year: 1953,
    level: 1,
    context: "Holidaymakers try to find the right platform at a busy French train station before heading to the seaside.",
    lines: [
      {
        speaker: "Le chef de gare",
        voice: "conductor",
        fr: "Attention au départ ! Le train pour Saint-Marc-sur-Mer part sur la voie numéro deux !",
        en: "Stand clear for departure! The train for Saint-Marc-sur-Mer leaves from platform number two!",
        backdrop: "/sejour/station.jpg",
        shot: "Quai de la gare · Steam rises as the loudspeaker crackles",
        emoji: "🚂📢",
      },
      {
        speaker: "La voyageuse",
        voice: "chloe",
        fr: "Pardon monsieur, où est la voie numéro deux, s'il vous plaît ?",
        en: "Excuse me sir, where is platform number two, please?",
        backdrop: "/sejour/quay.jpg",
        shot: "Plan moyen · Monsieur Hulot tips his hat with his pipe and umbrella",
        emoji: "🧳🎩",
      },
      {
        speaker: "Monsieur Hulot",
        voice: "luc",
        fr: "Bonjour madame ! C'est par là, à gauche, juste après l'escalier. Bon voyage !",
        en: "Hello madam! It's that way, to the left, right past the stairs. Have a good trip!",
        backdrop: "/sejour/places/river.jpg",
        shot: "Arrivée à la mer · Waves and beach umbrellas in the summer sun",
        emoji: "🏖️🌊",
      },
    ],
    words: [
      { fr: "la voie numéro deux", en: "platform / track number two" },
      { fr: "le train part", en: "the train is leaving" },
      { fr: "c'est par là", en: "it's that way" },
      { fr: "bon voyage", en: "have a good trip" },
    ],
    question: {
      promptFr: "Sur quelle voie part le train ?",
      promptEn: "From which platform does the train leave?",
      choices: [
        { fr: "La voie numéro deux", en: "Platform number two", correct: true },
        { fr: "La voie numéro dix", en: "Platform number ten" },
        { fr: "À la boulangerie", en: "At the bakery" },
      ],
    },
  },
  {
    id: "amelie",
    youtubeId: "HUECWi5pX7o",
    youtubeQuery: "Le Fabuleux Destin d'Amélie Poulain les petits plaisirs extrait VF",
    poster: "/sejour/places/cafe.jpg",
    title: "Les petits plaisirs d'Amélie",
    film: "Le Fabuleux Destin d'Amélie Poulain",
    year: 2001,
    level: 2,
    context: "A narrator describes the simple everyday things Amélie loves and dislikes in Montmartre, Paris.",
    lines: [
      {
        speaker: "Narrateur",
        voice: "henri",
        fr: "Amélie aime briser la croûte des crèmes brûlées avec la pointe de la petite cuillère.",
        en: "Amélie likes cracking the crust of crème brûlées with the tip of a teaspoon.",
        backdrop: "/sejour/places/cafe.jpg",
        shot: "Café des Deux Moulins · Warm amber light over a porcelain ramekin",
        emoji: "🍮🥄",
      },
      {
        speaker: "Amélie",
        voice: "chloe",
        fr: "Bonjour monsieur. Un café chaud et un croissant au beurre, s'il vous plaît.",
        en: "Hello sir. A hot coffee and a butter croissant, please.",
        backdrop: "/sejour/terrace.jpg",
        shot: "Au comptoir · Amélie smiles softly across the zinc bar",
        emoji: "☕🥐",
      },
      {
        speaker: "Narrateur",
        voice: "henri",
        fr: "Elle aime aussi faire des ricochets sur le canal Saint-Martin… et elle déteste quand on est de mauvaise humeur le matin.",
        en: "She also likes skipping stones on the Canal Saint-Martin… and she hates when people are in a bad mood in the morning.",
        backdrop: "/sejour/places/river.jpg",
        shot: "Canal Saint-Martin · Pebbles skip three times across the water",
        emoji: "🪨💧",
      },
    ],
    words: [
      { fr: "elle aime", en: "she likes" },
      { fr: "elle déteste", en: "she hates" },
      { fr: "la petite cuillère", en: "the teaspoon" },
      { fr: "la crème brûlée", en: "the crème brûlée" },
    ],
    question: {
      promptFr: "Qu'est-ce qu'Amélie aime faire avec sa petite cuillère ?",
      promptEn: "What does Amélie like doing with her teaspoon?",
      choices: [
        { fr: "Briser la croûte de la crème brûlée", en: "Crack the crust of the crème brûlée", correct: true },
        { fr: "Boire un grand verre d'eau", en: "Drink a tall glass of water" },
        { fr: "Jouer au football", en: "Play football" },
      ],
    },
  },
  {
    id: "intouchables",
    youtubeId: "34WIbmXkewU",
    youtubeQuery: "Intouchables 2011 entretien d'embauche extrait VF Omar Sy François Cluzet",
    poster: "/sejour/places/library.jpg",
    title: "L'entretien d'embauche",
    film: "Intouchables",
    year: 2011,
    level: 3,
    context: "Driss comes for a job interview in a grand Paris townhouse, speaking casually while Philippe uses formal French.",
    lines: [
      {
        speaker: "Philippe",
        voice: "henri",
        fr: "Bonjour. Alors, dites-moi : pourquoi voulez-vous ce travail ?",
        en: "Hello. So, tell me: why do you want this job?",
        backdrop: "/sejour/places/library.jpg",
        shot: "Salon doré · High ceilings and bookshelves in a Paris hôtel particulier",
        emoji: "🏛️🪑",
      },
      {
        speaker: "Driss",
        voice: "marc",
        fr: "Franchement ? Je voudrais juste une signature sur mon papier, s'il vous plaît.",
        en: "Honestly? I just want a signature on my paper, please.",
        backdrop: "/sejour/places/library.jpg",
        shot: "Champ-contrechamp · Driss leans forward with an easy grin",
        emoji: "📄😄",
      },
      {
        speaker: "Philippe",
        voice: "henri",
        fr: "Revenez demain matin à neuf heures. On verra bien si vous tenez deux semaines.",
        en: "Come back tomorrow morning at nine o'clock. We'll see if you last two weeks.",
        backdrop: "/sejour/v2/scenes/street.jpg",
        shot: "Sortie sur la rue · Driss walks out into the Paris morning, surprised",
        emoji: "🕘🤝",
      },
    ],
    words: [
      { fr: "un travail", en: "a job" },
      { fr: "franchement", en: "honestly" },
      { fr: "demain matin", en: "tomorrow morning" },
      { fr: "on verra", en: "we'll see" },
    ],
    question: {
      promptFr: "À quelle heure Driss doit-il revenir demain matin ?",
      promptEn: "At what time must Driss come back tomorrow morning?",
      choices: [
        { fr: "À neuf heures", en: "At nine o'clock", correct: true },
        { fr: "À midi", en: "At noon" },
        { fr: "À minuit", en: "At midnight" },
      ],
    },
  },
];

export const CLIP_BY_ID: Record<string, CinemaClip> = Object.fromEntries(CINEMA_CLIPS.map((c) => [c.id, c]));
