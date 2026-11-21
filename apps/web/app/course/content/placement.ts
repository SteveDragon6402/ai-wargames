import type { PlacementQuestion } from "@/app/course/types";

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  // ============================================================================
  // WEEK 1 (4 questions)
  // ============================================================================
  {
    id: "pl-w1-01",
    week: 1,
    topic: "etre_subject_pronouns",
    prompt: "Listen or read and complete the introduction: « Bonjour ! Je m'appelle Clara et je ___ étudiante à Paris. »",
    audioFr: "Bonjour ! Je m'appelle Clara et je suis étudiante à Paris.",
    options: ["suis", "es", "est", "sommes"],
    answer: "suis",
  },
  {
    id: "pl-w1-02",
    week: 1,
    topic: "articles_gender",
    prompt: "Choose the correct indefinite article for a feminine singular noun at the bakery: « Je prends ___ baguette et un croissant. »",
    options: ["une", "un", "le", "des"],
    answer: "une",
  },
  {
    id: "pl-w1-03",
    week: 1,
    topic: "je_voudrais_ordering",
    prompt: "You are ordering politely at a café. Which sentence is the polite way to say 'I would like a coffee, please'?",
    audioFr: "Bonjour monsieur, je voudrais un café, s'il vous plaît.",
    options: [
      "Je voudrais un café, s'il vous plaît.",
      "Donne-moi un café maintenant.",
      "J'ai un café, merci.",
      "Tu veux le café.",
    ],
    answer: "Je voudrais un café, s'il vous plaît.",
  },
  {
    id: "pl-w1-04",
    week: 1,
    topic: "avoir_numbers_1_20",
    prompt: "How do you say 'I am hungry and I am twenty years old' in French?",
    audioFr: "J'ai faim et j'ai vingt ans.",
    options: [
      "J'ai faim et j'ai vingt ans.",
      "Je suis faim et je suis vingt ans.",
      "J'ai faim et je suis douze ans.",
      "Tu as faim et il a vingt ans.",
    ],
    answer: "J'ai faim et j'ai vingt ans.",
  },

  // ============================================================================
  // WEEK 2 (4 questions)
  // ============================================================================
  {
    id: "pl-w2-01",
    week: 2,
    topic: "partitive_articles",
    prompt: "Complete the sentence at the market with the correct partitive articles: « Pour le dîner, j'achète ___ fromage et ___ salade. »",
    options: ["du / de la", "de la / du", "des / le", "un / de l'"],
    answer: "du / de la",
  },
  {
    id: "pl-w2-02",
    week: 2,
    topic: "er_verbs_adjective_agreement",
    prompt: "Choose the form with the correct `-er` verb conjugation and feminine adjective agreement: « Marie ___ une soupe ___ . »",
    audioFr: "Marie prépare une soupe chaude.",
    options: [
      "prépare / chaude",
      "prépares / chaud",
      "préparons / chaudes",
      "prépare / chaud",
    ],
    answer: "prépare / chaude",
  },
  {
    id: "pl-w2-03",
    week: 2,
    topic: "negation_pas_de",
    prompt: "How does « Je mange du pain » change in the negative ('I do not eat bread')?",
    options: [
      "Je ne mange pas de pain.",
      "Je ne mange pas du pain.",
      "Je pas mange de pain.",
      "Je ne mange rien le pain.",
    ],
    answer: "Je ne mange pas de pain.",
  },
  {
    id: "pl-w2-04",
    week: 2,
    topic: "venir_de_nationalities",
    prompt: "Listen and choose the sentence with the correct prepositions for origin: 'I come from Canada and I live in London.'",
    audioFr: "Je viens du Canada et j'habite à Londres.",
    options: [
      "Je viens du Canada et j'habite à Londres.",
      "Je viens de le Canada et j'habite en Londres.",
      "Je viens au Canada et j'habite de Londres.",
      "Je viens des Canada et j'habite au Londres.",
    ],
    answer: "Je viens du Canada et j'habite à Londres.",
  },

  // ============================================================================
  // WEEK 3 (4 questions)
  // ============================================================================
  {
    id: "pl-w3-01",
    week: 3,
    topic: "aller_places",
    prompt: "Complete with the present tense of `aller` and the contracted preposition: « Ce soir, nous ___ ___ cinéma avec des amis. »",
    options: ["allons au", "allez à la", "vont au", "allons en"],
    answer: "allons au",
  },
  {
    id: "pl-w3-02",
    week: 3,
    topic: "faire_activities",
    prompt: "Complete the sentence about weekend activities: « Le samedi matin, je ___ ___ vélo dans le parc. »",
    audioFr: "Le samedi matin, je fais du vélo dans le parc.",
    options: ["fais du", "fait de la", "faisons le", "fais à la"],
    answer: "fais du",
  },
  {
    id: "pl-w3-03",
    week: 3,
    topic: "telling_time_schedules",
    prompt: "Listen to the answer and choose the question that asks 'At what time does the film start?'",
    audioFr: "À quelle heure commence le film ? Il commence à vingt heures trente.",
    options: [
      "À quelle heure commence le film ?",
      "Combien coûte le film ?",
      "Qui regarde le film ?",
      "Depuis quand est le film ?",
    ],
    answer: "À quelle heure commence le film ?",
  },
  {
    id: "pl-w3-04",
    week: 3,
    topic: "possessives_questions",
    prompt: "Choose the correct question word and possessive adjective: « ___ habite ___ sœur ? — Elle habite à Lyon avec ___ parents. »",
    options: [
      "Où / ta / ses",
      "Que / ton / sa",
      "Quand / ma / mon",
      "Où / ton / leur",
    ],
    answer: "Où / ta / ses",
  },

  // ============================================================================
  // WEEK 4 (4 questions)
  // ============================================================================
  {
    id: "pl-w4-01",
    week: 4,
    topic: "modals_prendre_restaurant",
    prompt: "At the restaurant, complete the dialogue: « Nous ___ le menu du jour, et est-ce que vous ___ nous apporter l'addition ? »",
    audioFr: "Nous prenons le menu du jour, et est-ce que vous pouvez nous apporter l'addition ?",
    options: [
      "prenons / pouvez",
      "prends / veulent",
      "prenez / peux",
      "prennent / savons",
    ],
    answer: "prenons / pouvez",
  },
  {
    id: "pl-w4-02",
    week: 4,
    topic: "avoir_mal_a_health",
    prompt: "You are at the pharmacy with a sore throat and a headache. Which sentence is correct?",
    audioFr: "Bonjour madame, j'ai mal à la gorge et j'ai mal à la tête.",
    options: [
      "J'ai mal à la gorge et à la tête.",
      "Je suis mal de la gorge et la tête.",
      "J'ai mal au gorge et aux tête.",
      "Je fais mal dans la gorge et à la tête.",
    ],
    answer: "J'ai mal à la gorge et à la tête.",
  },
  {
    id: "pl-w4-03",
    week: 4,
    topic: "directions_prepositions",
    prompt: "Choose the correct directions to the pharmacy: « Tournez ___ après le pont ; la pharmacie est ___ la boulangerie. »",
    options: [
      "à gauche / en face de",
      "au gauche / devant de",
      "en gauche / à côté",
      "la gauche / près du",
    ],
    answer: "à gauche / en face de",
  },
  {
    id: "pl-w4-04",
    week: 4,
    topic: "passe_compose_avoir",
    prompt: "How do you say 'Yesterday morning, I bought bread and I ate a croissant' in the `passé composé`?",
    audioFr: "Hier matin, j'ai acheté du pain et j'ai mangé un croissant.",
    options: [
      "Hier matin, j'ai acheté du pain et j'ai mangé un croissant.",
      "Hier matin, j'achète du pain et je mange un croissant.",
      "Hier matin, je suis acheté du pain et je suis mangé un croissant.",
      "Hier matin, j'ai acheter du pain et j'ai manger un croissant.",
    ],
    answer: "Hier matin, j'ai acheté du pain et j'ai mangé un croissant.",
  },
];
