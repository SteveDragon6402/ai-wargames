import type { GrammarLesson } from "@/app/course/types";

export const GRAMMAR_LESSONS: GrammarLesson[] = [
  // ============================================================================
  // WEEK 1 — ARRIVING & SURVIVING (Days 1–7)
  // ============================================================================
  {
    id: "w1d1_greetings_etre",
    day: 1,
    week: 1,
    title: "Greetings, Je m'appelle & Être",
    subtitle: "Saying hello, introducing yourself, and using the verb 'to be'",
    explanation: [
      "Welcome to your first day in France! Every conversation in French begins with a polite greeting: 'Bonjour' during the day, or 'Bonsoir' in the evening. Adding 'Madame' or 'Monsieur' shows warmth and respect when speaking to your host or a shopkeeper.",
      "To introduce yourself, use the reflexive phrase 'Je m'appelle…' (literally 'I call myself…') followed by your name. You can also use the essential verb 'être' (to be): 'je suis' (I am), 'tu es' (you are — informal), and 'vous êtes' (you are — polite or plural).",
      "When meeting your host Madame Rousseau today, combine these building blocks to say hello, share your name, and say a little about who you are, such as 'Je suis étudiant(e)' or 'Je suis content(e) d'être ici'."
    ],
    keyPoints: [
      { fr: "Bonjour, Madame / Monsieur", en: "Hello, Madam / Sir", note: "Always start interactions with bonjour" },
      { fr: "Je m'appelle…", en: "My name is… (I call myself…)", note: "Standard way to give your name" },
      { fr: "je suis", en: "I am", note: "First person singular of être" },
      { fr: "tu es / vous êtes", en: "you are (informal / polite)", note: "Use vous êtes with Madame and shopkeepers" },
      { fr: "il est / elle est", en: "he is / she is", note: "Third person singular of être" },
      { fr: "Enchanté(e)", en: "Nice to meet you", note: "Say this right after introductions" }
    ],
    examples: [
      { fr: "Bonjour Madame, je m'appelle Alex.", en: "Hello Madam, my name is Alex." },
      { fr: "Je suis américain et je suis étudiant.", en: "I am American and I am a student." },
      { fr: "Vous êtes Madame Rousseau ? Enchanté !", en: "You are Madame Rousseau? Nice to meet you!" },
      { fr: "Comment vous appelez-vous ?", en: "What is your name? (polite)" }
    ],
    exercises: [
      {
        id: "w1d1_ex1",
        kind: "mcq",
        prompt: "Which verb form completes the sentence: « Bonjour, je ___ étudiant. »?",
        options: ["suis", "es", "êtes", "est"],
        answer: "suis",
        explanation: "'Je suis' means 'I am' (first person singular of être)."
      },
      {
        id: "w1d1_ex2",
        kind: "gap",
        prompt: "Complete the introduction: « Bonjour ! Je ___ Alex. » (My name is Alex.)",
        answer: "m'appelle",
        accept: ["m appelle"],
        explanation: "'Je m'appelle' is the standard French expression for 'My name is'."
      },
      {
        id: "w1d1_ex3",
        kind: "mcq",
        prompt: "How do you politely say 'You are very kind' to your host Madame Rousseau? « Vous ___ très gentille. »",
        options: ["êtes", "es", "suis", "sont"],
        answer: "êtes",
        explanation: "With 'vous', the verb être is conjugated as 'vous êtes'."
      },
      {
        id: "w1d1_ex4",
        kind: "tiles",
        prompt: "Arrange the words to greet Madame and introduce yourself:",
        options: ["Bonjour", "Madame,", "je", "m'appelle", "Sam."],
        answer: "Bonjour Madame, je m'appelle Sam.",
        explanation: "Start with 'Bonjour Madame,' followed by 'je m'appelle' and your name."
      },
      {
        id: "w1d1_ex5",
        kind: "listen",
        prompt: "Listen and choose what the speaker says:",
        audioFr: "Bonjour, je suis content d'être ici.",
        options: [
          "Bonjour, je suis content d'être ici.",
          "Bonsoir, tu es fatigué aujourd'hui.",
          "Bonjour, vous êtes le professeur.",
          "Salut, elle est à la boulangerie."
        ],
        answer: "Bonjour, je suis content d'être ici.",
        explanation: "The speaker says 'Bonjour, je suis content d'être ici' (Hello, I am happy to be here)."
      },
      {
        id: "w1d1_ex6",
        kind: "gap",
        prompt: "Fill in the informal 'you are': « Salut Léo, tu ___ français ? »",
        answer: "es",
        explanation: "With 'tu' (informal singular 'you'), être becomes 'tu es'."
      },
      {
        id: "w1d1_ex7",
        kind: "translate",
        prompt: "Translate into French: 'Hello Madam, I am ready.' (use 'prêt')",
        answer: "Bonjour Madame, je suis prêt.",
        accept: [
          "Bonjour Madame, je suis prête.",
          "Bonjour madame je suis prêt",
          "Bonjour madame, je suis prêt"
        ],
        explanation: "'Bonjour Madame' + 'je suis prêt(e)'."
      },
      {
        id: "w1d1_ex8",
        kind: "mcq",
        prompt: "What do you say right after someone introduces themselves to mean 'Nice to meet you'?",
        options: ["Enchanté", "Au revoir", "Excusez-moi", "À demain"],
        answer: "Enchanté",
        explanation: "'Enchanté(e)' means 'Delighted / Nice to meet you'."
      }
    ],
    useItPrompt: "Greet Madame Rousseau at the house with 'Bonjour Madame', tell her your name with 'Je m'appelle…', and use 'je suis…' to tell her one thing about yourself.",
    skills: ["intro", "register"],
    domains: ["greetings_politeness", "self_intro"]
  },
  {
    id: "w1d2_articles",
    day: 2,
    week: 1,
    title: "Definite & Indefinite Articles (un, une, des / le, la, l', les)",
    subtitle: "How every French noun carries a gender and number marker",
    explanation: [
      "In French, every noun is either masculine or feminine, and you almost never use a noun without an article in front of it. Learning a noun together with its article ('une baguette', 'un croissant') is the best habit you can build.",
      "Use indefinite articles when asking for 'a', 'an', or 'some' countable items: 'un' for masculine singular ('un café'), 'une' for feminine singular ('une baguette'), and 'des' for plural ('des croissants').",
      "Use definite articles when talking about 'the' specific thing or things in general: 'le' (masculine), 'la' (feminine), 'l'' before a vowel or silent h ('l'eau', 'l'addition'), and 'les' for all plurals ('les pains')."
    ],
    keyPoints: [
      { fr: "un croissant / un café", en: "a croissant / a coffee", note: "Masculine singular indefinite article" },
      { fr: "une baguette / une brioche", en: "a baguette / a brioche", note: "Feminine singular indefinite article" },
      { fr: "des croissants / des baguettes", en: "some croissants / baguettes", note: "Plural indefinite article (both genders)" },
      { fr: "le pain / la tarte", en: "the bread / the tart", note: "Singular definite articles (masculine / feminine)" },
      { fr: "l'addition / l'eau", en: "the bill / the water", note: "le or la becomes l' before a vowel or mute h" },
      { fr: "les croissants / les tartes", en: "the croissants / the tarts", note: "Plural definite article" }
    ],
    examples: [
      { fr: "Un croissant et une baguette, s'il vous plaît.", en: "A croissant and a baguette, please." },
      { fr: "Le pain est chaud ce matin.", en: "The bread is warm this morning." },
      { fr: "La brioche et les tartes sont délicieuses.", en: "The brioche and the tarts are delicious." },
      { fr: "L'eau est sur la table.", en: "The water is on the table." }
    ],
    exercises: [
      {
        id: "w1d2_ex1",
        kind: "mcq",
        prompt: "Baguette is feminine. How do you say 'a baguette'?",
        options: ["une baguette", "un baguette", "des baguette", "le baguette"],
        answer: "une baguette",
        explanation: "'Une' is the feminine singular indefinite article ('a')."
      },
      {
        id: "w1d2_ex2",
        kind: "gap",
        prompt: "Croissant is masculine. Fill in the indefinite article: « ___ croissant, s'il vous plaît. »",
        answer: "Un",
        accept: ["un"],
        explanation: "'Un' is used before masculine singular countable nouns."
      },
      {
        id: "w1d2_ex3",
        kind: "mcq",
        prompt: "Which definite article goes before a vowel in « ___ addition, s'il vous plaît » (The bill, please)?",
        options: ["L'", "La", "Le", "Les"],
        answer: "L'",
        explanation: "Before a vowel ('addition'), 'la' or 'le' contracts to 'l''."
      },
      {
        id: "w1d2_ex4",
        kind: "gap",
        prompt: "Complete with the plural indefinite article ('some'): « Je prends ___ croissants pour le petit-déjeuner. »",
        answer: "des",
        explanation: "'Des' is the plural of both 'un' and 'une'."
      },
      {
        id: "w1d2_ex5",
        kind: "tiles",
        prompt: "Put the words in order to ask for a baguette and a coffee:",
        options: ["Une", "baguette", "et", "un", "café."],
        answer: "Une baguette et un café.",
        explanation: "'Une baguette' (feminine) + 'et' + 'un café' (masculine)."
      },
      {
        id: "w1d2_ex6",
        kind: "listen",
        prompt: "Listen and select the exact phrase you hear:",
        audioFr: "Le pain et la brioche sont sur la table.",
        options: [
          "Le pain et la brioche sont sur la table.",
          "Un pain et une brioche sont sur la table.",
          "Les pains et les brioches sont sur la table.",
          "Le café et le croissant sont sur la table."
        ],
        answer: "Le pain et la brioche sont sur la table.",
        explanation: "The speaker uses definite articles: 'Le pain' (m.) and 'la brioche' (f.)."
      },
      {
        id: "w1d2_ex7",
        kind: "gap",
        prompt: "Complete with the plural definite article ('the'): « ___ baguettes de Martine sont excellentes. »",
        answer: "Les",
        accept: ["les"],
        explanation: "'Les' means 'the' for all plural nouns."
      },
      {
        id: "w1d2_ex8",
        kind: "translate",
        prompt: "Translate into French: 'a croissant and a baguette'",
        answer: "un croissant et une baguette",
        accept: ["Un croissant et une baguette."],
        explanation: "'un croissant' (masculine) + 'et' + 'une baguette' (feminine)."
      }
    ],
    useItPrompt: "Visit Martine at la boulangerie and order using the right articles ('une baguette', 'un croissant', 'des pains au chocolat').",
    skills: ["ordering", "food"],
    domains: ["bakery_cafe", "greetings_politeness"]
  },
  {
    id: "w1d3_voudrais_politesse",
    day: 3,
    week: 1,
    title: "Polite Requests with Je voudrais",
    subtitle: "Ordering warmly at the bakery and café with French etiquette",
    explanation: [
      "When ordering in a French bakery or café, saying 'Je veux' (I want) sounds too blunt. Instead, French speakers use the conditional 'Je voudrais…' (I would like…), which is immediately warm and courteous.",
      "Every counter interaction follows a smooth three-step ritual: greet first ('Bonjour Madame / Monsieur'), make your request with 'Je voudrais… s'il vous plaît', and close with 'Merci, bonne journée !' (Thank you, have a good day!) and 'Au revoir'.",
      "If you need to get someone's attention or apologize, use 'Excusez-moi' or 'Pardon'. Mastering these polite phrases unlocks friendly service everywhere in the village."
    ],
    keyPoints: [
      { fr: "Je voudrais…", en: "I would like…", note: "Polite way to order or request anything" },
      { fr: "s'il vous plaît", en: "please (formal/polite)", note: "Literally 'if it pleases you'" },
      { fr: "Merci beaucoup", en: "Thank you very much", note: "Use when receiving your items or change" },
      { fr: "Bonne journée !", en: "Have a good day!", note: "Warm farewell used throughout the daytime" },
      { fr: "Excusez-moi, Madame / Monsieur", en: "Excuse me, Madam / Sir", note: "Polite way to get attention" }
    ],
    examples: [
      { fr: "Bonjour Madame, je voudrais une baguette, s'il vous plaît.", en: "Hello Madam, I would like a baguette, please." },
      { fr: "Je voudrais aussi deux croissants, s'il vous plaît.", en: "I would also like two croissants, please." },
      { fr: "Merci beaucoup, bonne journée et au revoir !", en: "Thank you very much, have a good day and goodbye!" },
      { fr: "Excusez-moi Monsieur, je voudrais un café.", en: "Excuse me Sir, I would like a coffee." }
    ],
    exercises: [
      {
        id: "w1d3_ex1",
        kind: "mcq",
        prompt: "Which phrase is the polite way to say 'I would like a baguette' at the bakery?",
        options: [
          "Je voudrais une baguette",
          "Je veux une baguette",
          "Donnez-moi une baguette",
          "Une baguette vite"
        ],
        answer: "Je voudrais une baguette",
        explanation: "'Je voudrais' (I would like) is the polite standard in shops and cafés."
      },
      {
        id: "w1d3_ex2",
        kind: "gap",
        prompt: "Complete the polite request: « Bonjour Madame, je ___ un croissant, s'il vous plaît. »",
        answer: "voudrais",
        explanation: "'Je voudrais' means 'I would like'."
      },
      {
        id: "w1d3_ex3",
        kind: "gap",
        prompt: "Fill in 'please' (polite): « Une brioche, s'il ___ plaît. »",
        answer: "vous",
        explanation: "'S'il vous plaît' is used with adults and shopkeepers."
      },
      {
        id: "w1d3_ex4",
        kind: "tiles",
        prompt: "Build a complete polite order for Martine:",
        options: ["Je", "voudrais", "une", "baguette,", "s'il", "vous", "plaît."],
        answer: "Je voudrais une baguette, s'il vous plaît.",
        explanation: "Subject + voudrais + item + s'il vous plaît."
      },
      {
        id: "w1d3_ex5",
        kind: "listen",
        prompt: "Listen to the customer leaving the bakery and select what they said:",
        audioFr: "Merci beaucoup Madame, bonne journée !",
        options: [
          "Merci beaucoup Madame, bonne journée !",
          "Bonjour Madame, je voudrais du pain !",
          "Excusez-moi Monsieur, bonne soirée !",
          "S'il vous plaît Madame, un croissant !"
        ],
        answer: "Merci beaucoup Madame, bonne journée !",
        explanation: "The customer thanks Martine and wishes her a good day ('bonne journée')."
      },
      {
        id: "w1d3_ex6",
        kind: "mcq",
        prompt: "What do you say when leaving a shop during the day to wish the shopkeeper a nice day?",
        options: ["Bonne journée !", "Bon appétit !", "Enchanté !", "De rien !"],
        answer: "Bonne journée !",
        explanation: "'Bonne journée !' means 'Have a good day!'."
      },
      {
        id: "w1d3_ex7",
        kind: "translate",
        prompt: "Translate into French: 'I would like a coffee, please.' (polite)",
        answer: "Je voudrais un café, s'il vous plaît.",
        accept: [
          "Je voudrais un café s'il vous plaît",
          "Je voudrais un cafe, s'il vous plait"
        ],
        explanation: "'Je voudrais un café, s'il vous plaît.'"
      },
      {
        id: "w1d3_ex8",
        kind: "mcq",
        prompt: "If Martine says « Voilà votre baguette ! », what is the best reply?",
        options: [
          "Merci beaucoup, Madame !",
          "Bonjour, je m'appelle Alex.",
          "Excusez-moi, où est la gare ?",
          "Non, s'il vous plaît."
        ],
        answer: "Merci beaucoup, Madame !",
        explanation: "When handed your order ('Voilà...'), respond with 'Merci beaucoup !'."
      }
    ],
    useItPrompt: "Head to la boulangerie and place a complete polite order with 'Bonjour Madame', 'Je voudrais… s'il vous plaît', and 'Merci, bonne journée !'.",
    skills: ["ordering", "register"],
    domains: ["greetings_politeness", "bakery_cafe"]
  },
  {
    id: "w1d4_numbers_0_20",
    day: 4,
    week: 1,
    title: "Numbers 0–20 & Prices in Euros",
    subtitle: "Asking how much things cost and understanding prices at the counter",
    explanation: [
      "Numbers from 0 to 20 are essential for ordering multiple items ('deux croissants', 'trois baguettes') and paying at the counter. French numbers 1 to 16 each have their own distinct word ('onze, douze, treize, quatorze, quinze, seize'), while 17, 18, and 19 combine ten with seven, eight, and nine ('dix-sept, dix-huit, dix-neuf').",
      "To ask the price of something, say 'Ça fait combien ?' (How much does that come to?) or 'C'est combien ?' (How much is it?).",
      "In French prices, the word 'euro(s)' sits where the decimal point is in English: '1,20 €' is spoken as 'un euro vingt', and '3,50 €' is 'trois euros cinquante'."
    ],
    keyPoints: [
      { fr: "un, deux, trois, quatre, cinq", en: "1, 2, 3, 4, 5", note: "Note that 'un' changes to 'une' before a feminine noun" },
      { fr: "six, sept, huit, neuf, dix", en: "6, 7, 8, 9, 10", note: "Final consonant of six, huit, dix is silent before a consonant" },
      { fr: "onze, douze, treize, quatorze, quinze, seize", en: "11, 12, 13, 14, 15, 16", note: "Unique teen forms" },
      { fr: "dix-sept, dix-huit, dix-neuf, vingt", en: "17, 18, 19, 20", note: "Hyphenated compounds for 17–19" },
      { fr: "Ça fait combien ? / C'est combien ?", en: "How much does that come to? / How much is it?", note: "Natural ways to ask for the total" },
      { fr: "Ça fait deux euros cinquante.", en: "That comes to 2.50 €.", note: "Euro(s) goes between whole euros and cents" }
    ],
    examples: [
      { fr: "Je voudrais deux croissants et trois baguettes, s'il vous plaît.", en: "I would like two croissants and three baguettes, please." },
      { fr: "Ça fait combien, s'il vous plaît ?", en: "How much does that come to, please?" },
      { fr: "Ça fait quatre euros vingt.", en: "That comes to four euros twenty (4.20 €)." },
      { fr: "Voici cinq euros. Merci !", en: "Here is five euros. Thank you!" }
    ],
    exercises: [
      {
        id: "w1d4_ex1",
        kind: "mcq",
        prompt: "How do you ask the baker 'How much does that come to?'",
        options: [
          "Ça fait combien ?",
          "Comment allez-vous ?",
          "Où est la boulangerie ?",
          "Quel âge avez-vous ?"
        ],
        answer: "Ça fait combien ?",
        explanation: "'Ça fait combien ?' (or 'C'est combien ?') asks for the total price."
      },
      {
        id: "w1d4_ex2",
        kind: "gap",
        prompt: "Write the French word for the number 3: « Je voudrais ___ croissants, s'il vous plaît. »",
        answer: "trois",
        explanation: "'Trois' is the number 3."
      },
      {
        id: "w1d4_ex3",
        kind: "mcq",
        prompt: "Which number is 'quinze'?",
        options: ["15", "5", "14", "16"],
        answer: "15",
        explanation: "Quinze = 15 (quatorze = 14, seize = 16)."
      },
      {
        id: "w1d4_ex4",
        kind: "listen",
        prompt: "Listen to the price Martine gives and choose the matching amount:",
        audioFr: "Ça fait trois euros vingt, s'il vous plaît.",
        options: ["3,20 €", "2,30 €", "13,20 €", "3,12 €"],
        answer: "3,20 €",
        explanation: "'Trois euros vingt' is 3 euros and 20 cents (3,20 €)."
      },
      {
        id: "w1d4_ex5",
        kind: "tiles",
        prompt: "Arrange the words to ask for the total price politely:",
        options: ["Ça", "fait", "combien,", "s'il", "vous", "plaît ?"],
        answer: "Ça fait combien, s'il vous plaît ?",
        explanation: "'Ça fait combien' + 's'il vous plaît ?'."
      },
      {
        id: "w1d4_ex6",
        kind: "gap",
        prompt: "Write the number 12 in French: « Ça fait ___ euros. »",
        answer: "douze",
        explanation: "'Douze' means twelve (12)."
      },
      {
        id: "w1d4_ex7",
        kind: "mcq",
        prompt: "How do you say 'two baguettes' in French?",
        options: ["deux baguettes", "un baguettes", "douze baguette", "dix-deux baguettes"],
        answer: "deux baguettes",
        explanation: "Deux = 2, followed by the plural noun 'baguettes'."
      },
      {
        id: "w1d4_ex8",
        kind: "translate",
        prompt: "Translate into French: 'two croissants, please' (polite)",
        answer: "deux croissants, s'il vous plaît",
        accept: [
          "Deux croissants, s'il vous plaît.",
          "deux croissants s'il vous plaît"
        ],
        explanation: "'deux croissants, s'il vous plaît'."
      }
    ],
    useItPrompt: "Order multiple items by number at la boulangerie and ask Martine 'Ça fait combien, s'il vous plaît ?' before paying.",
    skills: ["numbers", "ordering"],
    domains: ["numbers_prices", "bakery_cafe"]
  },
  {
    id: "w1d5_avoir",
    day: 5,
    week: 1,
    title: "The Verb Avoir & Everyday Expressions",
    subtitle: "Saying what you have, your age, and whether you're hungry or thirsty",
    explanation: [
      "Alongside 'être', the verb 'avoir' (to have) is one of the two most important verbs in French. Its present forms are: 'j'ai' (I have — notice how 'je' becomes 'j'' before the vowel), 'tu as', 'il/elle/on a', 'nous avons', 'vous avez', and 'ils/elles ont'.",
      "You use 'avoir' to talk about concrete things you have ('J'ai dix euros', 'J'ai de la monnaie', 'J'ai un chien').",
      "Crucially, French also uses 'avoir' where English uses 'to be' for age and physical feelings: 'J'ai vingt-cinq ans' (I am 25 years old — literally 'I have 25 years'), 'J'ai faim' (I am hungry), 'J'ai soif' (I am thirsty), and 'J'ai chaud / froid' (I am warm / cold)."
    ],
    keyPoints: [
      { fr: "j'ai / tu as / vous avez", en: "I have / you have (informal) / you have (polite)", note: "je contracts to j' before ai" },
      { fr: "il a / elle a / on a", en: "he has / she has / we have", note: "Third person singular of avoir" },
      { fr: "J'ai … ans", en: "I am … years old", note: "French uses avoir + ans for age, never être" },
      { fr: "avoir faim / avoir soif", en: "to be hungry / to be thirsty", note: "J'ai faim = I'm hungry; J'ai soif = I'm thirsty" },
      { fr: "avoir chaud / avoir froid", en: "to feel hot / to feel cold", note: "Used for how a person feels, not the weather" }
    ],
    examples: [
      { fr: "J'ai vingt-trois ans.", en: "I am twenty-three years old." },
      { fr: "J'ai un peu faim et j'ai soif.", en: "I am a little hungry and I am thirsty." },
      { fr: "Est-ce que vous avez de la monnaie ?", en: "Do you have change?" },
      { fr: "Madame Rousseau a un jardin magnifique.", en: "Madame Rousseau has a wonderful garden." }
    ],
    exercises: [
      {
        id: "w1d5_ex1",
        kind: "mcq",
        prompt: "How do you say 'I am 20 years old' in French?",
        options: [
          "J'ai vingt ans.",
          "Je suis vingt ans.",
          "J'ai vingt.",
          "Je suis vingt."
        ],
        answer: "J'ai vingt ans.",
        explanation: "French uses 'avoir' + number + 'ans' to express age."
      },
      {
        id: "w1d5_ex2",
        kind: "gap",
        prompt: "Fill in the correct form of avoir for 'I have': « ___ faim ce matin ! »",
        answer: "J'ai",
        accept: ["j'ai", "J ai", "j ai"],
        explanation: "'J'ai faim' means 'I am hungry'."
      },
      {
        id: "w1d5_ex3",
        kind: "mcq",
        prompt: "Complete the polite question to a shopkeeper: « Vous ___ des croissants chauds ? »",
        options: ["avez", "as", "ai", "êtes"],
        answer: "avez",
        explanation: "With 'vous', avoir is conjugated as 'vous avez'."
      },
      {
        id: "w1d5_ex4",
        kind: "gap",
        prompt: "Complete the informal question: « Quel âge tu ___ ? » (How old are you?)",
        answer: "as",
        explanation: "With 'tu', the verb avoir is 'tu as'."
      },
      {
        id: "w1d5_ex5",
        kind: "listen",
        prompt: "Listen and choose what the speaker says:",
        audioFr: "J'ai très soif, je voudrais un verre d'eau.",
        options: [
          "J'ai très soif, je voudrais un verre d'eau.",
          "J'ai très faim, je voudrais un croissant.",
          "J'ai froid, je voudrais un café chaud.",
          "J'ai vingt ans et je suis étudiant."
        ],
        answer: "J'ai très soif, je voudrais un verre d'eau.",
        explanation: "'J'ai très soif' means 'I am very thirsty'."
      },
      {
        id: "w1d5_ex6",
        kind: "tiles",
        prompt: "Arrange the words to say 'I am hungry and I have five euros':",
        options: ["J'ai", "faim", "et", "j'ai", "cinq", "euros."],
        answer: "J'ai faim et j'ai cinq euros.",
        explanation: "'J'ai faim' (I am hungry) + 'et j'ai cinq euros' (and I have five euros)."
      },
      {
        id: "w1d5_ex7",
        kind: "mcq",
        prompt: "What does « Elle a froid » mean?",
        options: [
          "She is cold.",
          "She has a cold drink.",
          "It is cold outside.",
          "She is hungry."
        ],
        answer: "She is cold.",
        explanation: "'Avoir froid' means a person feels cold."
      },
      {
        id: "w1d5_ex8",
        kind: "translate",
        prompt: "Translate into French: 'I am hungry'",
        answer: "J'ai faim",
        accept: ["J'ai faim.", "j'ai faim"],
        explanation: "French uses 'avoir faim' -> 'J'ai faim'."
      }
    ],
    useItPrompt: "Tell Madame Rousseau your age ('J'ai … ans') and mention if you are hungry or thirsty ('J'ai faim / J'ai soif') at the table.",
    skills: ["intro", "smalltalk"],
    domains: ["self_intro", "bakery_cafe"]
  },
  {
    id: "w1d6_tu_vous_questions",
    day: 6,
    week: 1,
    title: "Tu vs Vous & Asking Simple Questions",
    subtitle: "Choosing the right social register and asking yes/no questions",
    explanation: [
      "French has two words for 'you': 'tu' and 'vous'. Choosing between them is a key part of French politeness ('le registre'). Use 'vous' with your host Madame Rousseau, shopkeepers like Martine and Gérard, waiters at a formal restaurant, and any adult you don't know well. Use 'tu' with peers your own age, children, or once a young person invites you to use 'tu'.",
      "To ask a yes/no question in everyday French, you have two easy choices. First, simply raise your voice at the end of a statement: 'Vous avez du pain ?' (Do you have bread?).",
      "Second, put 'Est-ce que' at the beginning of any statement without changing word order: 'Est-ce que vous avez du pain ?' or 'Est-ce que tu aimes le café ?' (note that 'que' becomes 'qu'' before a vowel: 'Est-ce qu'il est là ?'). To return a question politely, use 'Et vous ?' or 'Et toi ?'."
    ],
    keyPoints: [
      { fr: "vous (polite singular or plural)", en: "you (formal / plural)", note: "Default with Madame, shopkeepers, and strangers" },
      { fr: "tu (informal singular)", en: "you (casual / friend)", note: "Use with young peers who use tu with you" },
      { fr: "Est-ce que… ?", en: "Do / Does / Is / Are…?", note: "Turns any statement into a yes/no question" },
      { fr: "Comment allez-vous ? / Ça va ?", en: "How are you? (polite / casual)", note: "Match your greeting to the register" },
      { fr: "Et vous ? / Et toi ?", en: "And you? (polite / casual)", note: "Great for keeping a conversation going" }
    ],
    examples: [
      { fr: "Bonjour Madame, comment allez-vous aujourd'hui ?", en: "Hello Madam, how are you today?" },
      { fr: "Est-ce que vous avez des brioches ce matin ?", en: "Do you have brioches this morning?" },
      { fr: "Salut Théo ! Tu vas bien ? — Oui, ça va bien, et toi ?", en: "Hi Théo! Are you doing well? — Yes, doing well, and you?" },
      { fr: "Est-ce qu'il y a du café chaud ?", en: "Is there hot coffee?" }
    ],
    exercises: [
      {
        id: "w1d6_ex1",
        kind: "mcq",
        prompt: "Which pronoun should you use when speaking to Martine at the bakery or Madame Rousseau?",
        options: ["vous", "tu", "nous", "ils"],
        answer: "vous",
        explanation: "'Vous' shows respect to your host, shopkeepers, and adults."
      },
      {
        id: "w1d6_ex2",
        kind: "gap",
        prompt: "Turn this statement into a question: « ___-ce que vous avez une baguette ? »",
        answer: "Est",
        accept: ["est"],
        explanation: "'Est-ce que' placed at the start of a statement forms a yes/no question."
      },
      {
        id: "w1d6_ex3",
        kind: "mcq",
        prompt: "A young waiter your age says « Salut ! Tu prends un café ? ». How do you ask 'And you?' back in the same register?",
        options: ["Et toi ?", "Et vous ?", "Et lui ?", "Et moi ?"],
        answer: "Et toi ?",
        explanation: "Since he used 'Salut' and 'tu', reply in the informal register with 'Et toi ?'."
      },
      {
        id: "w1d6_ex4",
        kind: "tiles",
        prompt: "Arrange the words to ask a polite yes/no question:",
        options: ["Est-ce", "que", "vous", "êtes", "prêt ?"],
        answer: "Est-ce que vous êtes prêt ?",
        explanation: "'Est-ce que' + subject ('vous') + verb ('êtes') + adjective ('prêt ?')."
      },
      {
        id: "w1d6_ex5",
        kind: "listen",
        prompt: "Listen to the question and decide whether the speaker is using the formal or informal register:",
        audioFr: "Bonjour Monsieur, comment allez-vous aujourd'hui ?",
        options: [
          "Formal (vous)",
          "Informal (tu)",
          "Talking about a third person (il)",
          "Talking about themselves (je)"
        ],
        answer: "Formal (vous)",
        explanation: "'Bonjour Monsieur, comment allez-vous' uses the polite 'vous' register."
      },
      {
        id: "w1d6_ex6",
        kind: "gap",
        prompt: "Before a vowel, 'Est-ce que' contracts. Fill in the missing word: « Est-ce ___ il a faim ? »",
        answer: "qu'",
        accept: ["qu"],
        explanation: "'Que' contracts to 'qu'' before a vowel ('il', 'elle', 'on')."
      },
      {
        id: "w1d6_ex7",
        kind: "mcq",
        prompt: "Which question correctly matches the 'tu' register?",
        options: [
          "Tu es étudiant ?",
          "Tu êtes étudiant ?",
          "Tu avez faim ?",
          "Tu allez bien ?"
        ],
        answer: "Tu es étudiant ?",
        explanation: "'Tu' pairs with 'es' (être), 'as' (avoir), and 'vas' (aller)."
      },
      {
        id: "w1d6_ex8",
        kind: "translate",
        prompt: "Translate into French (polite): 'Do you have a croissant?' (use Est-ce que)",
        answer: "Est-ce que vous avez un croissant ?",
        accept: ["Est-ce que vous avez un croissant"],
        explanation: "'Est-ce que' + 'vous avez un croissant ?'."
      }
    ],
    useItPrompt: "Use 'vous' and 'Est-ce que vous avez… ?' with Madame Rousseau or Martine, and return a question with 'Et vous ?'.",
    skills: ["register", "smalltalk", "listening"],
    domains: ["greetings_politeness", "self_intro"]
  },
  {
    id: "w1d7_week1_review",
    day: 7,
    week: 1,
    title: "Week 1 Consolidation: First-Week Survival",
    subtitle: "Putting together greetings, être, avoir, articles, numbers, and polite orders",
    explanation: [
      "Félicitations ! You have completed your first week in the village. You now have all the core survival tools: greeting people properly, introducing yourself with 'je m'appelle', 'être', and 'avoir', using 'un/une/des' and 'le/la/les', ordering politely with 'je voudrais', and handling prices from 0 to 20 euros.",
      "In real conversations, these pieces flow together within a single exchange: you greet ('Bonjour Madame'), ask a question ('Est-ce que vous avez des croissants ?'), order ('Je voudrais deux croissants et une baguette, s'il vous plaît'), ask the price ('Ça fait combien ?'), and take your leave ('Merci, bonne journée !').",
      "Today's review brings all of Week 1 together so you are ready for both your daily village conversations and your Week 1 checkpoint exam."
    ],
    keyPoints: [
      { fr: "Je m'appelle… / Je suis… / J'ai … ans", en: "My name is… / I am… / I am … years old", note: "Core self-introduction trio" },
      { fr: "un, une, des / le, la, l', les", en: "a, some / the", note: "Match article to noun gender and number" },
      { fr: "Je voudrais … s'il vous plaît", en: "I would like … please", note: "Polite ordering formula" },
      { fr: "Ça fait combien ? — Trois euros cinquante.", en: "How much is that? — 3.50 €.", note: "Asking and understanding prices" },
      { fr: "Est-ce que vous avez… ? / Et vous ?", en: "Do you have…? / And you?", note: "Polite questions in the vous register" }
    ],
    examples: [
      { fr: "Bonjour Madame, je m'appelle Claire et j'ai vingt-deux ans.", en: "Hello Madam, my name is Claire and I am twenty-two years old." },
      { fr: "Est-ce que vous avez des pains au chocolat ? Je voudrais deux pains au chocolat et une baguette.", en: "Do you have pains au chocolat? I would like two pains au chocolat and a baguette." },
      { fr: "Ça fait combien ? — Quatre euros dix, s'il vous plaît.", en: "How much does that come to? — Four euros ten, please." },
      { fr: "Merci beaucoup, bonne journée et au revoir !", en: "Thank you very much, have a good day and goodbye!" }
    ],
    exercises: [
      {
        id: "w1d7_ex1",
        kind: "mcq",
        prompt: "Choose the sentence with no grammar errors:",
        options: [
          "J'ai vingt ans et je suis étudiant.",
          "Je suis vingt ans et j'ai étudiant.",
          "J'ai vingt ans et tu êtes étudiant.",
          "Je m'appelle vingt ans."
        ],
        answer: "J'ai vingt ans et je suis étudiant.",
        explanation: "Use 'avoir' for age ('J'ai vingt ans') and 'être' for profession/status ('je suis étudiant')."
      },
      {
        id: "w1d7_ex2",
        kind: "gap",
        prompt: "Complete the bakery order: « Bonjour Madame, je ___ une baguette et deux croissants, s'il vous plaît. »",
        answer: "voudrais",
        explanation: "'Je voudrais' is the polite way to order."
      },
      {
        id: "w1d7_ex3",
        kind: "listen",
        prompt: "Listen to the full exchange and select the total price mentioned:",
        audioFr: "Une baguette et deux croissants, ça fait trois euros quarante, s'il vous plaît.",
        options: ["3,40 €", "4,30 €", "3,14 €", "13,40 €"],
        answer: "3,40 €",
        explanation: "'Trois euros quarante' is 3,40 €."
      },
      {
        id: "w1d7_ex4",
        kind: "tiles",
        prompt: "Put the words in order to ask if the baker has warm bread:",
        options: ["Est-ce", "que", "vous", "avez", "du", "pain", "chaud ?"],
        answer: "Est-ce que vous avez du pain chaud ?",
        explanation: "'Est-ce que vous avez' + 'du pain chaud ?'."
      },
      {
        id: "w1d7_ex5",
        kind: "gap",
        prompt: "Fill in the correct article ('a' feminine): « Je prends ___ tarte aux pommes. »",
        answer: "une",
        explanation: "'Tarte' is feminine singular, so it takes 'une'."
      },
      {
        id: "w1d7_ex6",
        kind: "mcq",
        prompt: "How do you say 'You are very kind' to Madame Rousseau?",
        options: [
          "Vous êtes très gentille.",
          "Tu es très gentil.",
          "Vous avez très gentille.",
          "Je suis très gentille."
        ],
        answer: "Vous êtes très gentille.",
        explanation: "Use 'Vous êtes' with Madame Rousseau."
      },
      {
        id: "w1d7_ex7",
        kind: "translate",
        prompt: "Translate into French: 'How much does that come to?'",
        answer: "Ça fait combien ?",
        accept: [
          "Ca fait combien ?",
          "Ça fait combien",
          "C'est combien ?",
          "C est combien ?"
        ],
        explanation: "'Ça fait combien ?' or 'C'est combien ?'."
      },
      {
        id: "w1d7_ex8",
        kind: "translate",
        prompt: "Translate into French: 'Thank you, have a good day!'",
        answer: "Merci, bonne journée !",
        accept: [
          "Merci, bonne journée",
          "Merci bonne journée",
          "Merci, bonne journee !"
        ],
        explanation: "'Merci, bonne journée !' is the natural daytime farewell."
      }
    ],
    useItPrompt: "Have a full, natural conversation with Madame Rousseau and at la boulangerie combining your greetings, questions, orders, and numbers before taking the Week 1 exam.",
    skills: ["intro", "ordering", "numbers", "register"],
    domains: ["greetings_politeness", "self_intro", "numbers_prices", "bakery_cafe"]
  },

  // ============================================================================
  // WEEK 2 — VILLAGE & FOOD (Days 8–14)
  // ============================================================================
  {
    id: "w2d8_partitives",
    day: 8,
    week: 2,
    title: "Partitive Articles (du, de la, de l', des)",
    subtitle: "Talking about 'some' bread, cheese, soup, water, and ingredients",
    explanation: [
      "When you buy or eat uncountable foods — like bread, cheese, butter, soup, milk, or water — English often drops the word 'some' ('I'm buying cheese and water'). In French, you must always include a partitive article!",
      "Form the partitive with 'de' + definite article: 'du' before masculine singular nouns ('du pain', 'du beurre', 'du fromage'), 'de la' before feminine singular nouns ('de la soupe', 'de la confiture'), 'de l'' before a vowel or silent h ('de l'eau', 'de l'ail', 'de l'huile'), and 'des' before plural items ('des œufs', 'des tomates').",
      "You will use partitives constantly with Gérard at l'épicerie, at the supermarket, and when cooking dinner with Madame Rousseau."
    ],
    keyPoints: [
      { fr: "du pain / du fromage / du beurre", en: "(some) bread / cheese / butter", note: "Masculine singular partitive (de + le = du)" },
      { fr: "de la soupe / de la salade / de la confiture", en: "(some) soup / salad / jam", note: "Feminine singular partitive" },
      { fr: "de l'eau / de l'ail / de l'huile", en: "(some) water / garlic / oil", note: "Used before any singular noun starting with a vowel or mute h" },
      { fr: "des œufs / des tomates / des pommes", en: "(some) eggs / tomatoes / apples", note: "Plural partitive / indefinite" },
      { fr: "un morceau de fromage / une bouteille d'eau", en: "a piece of cheese / a bottle of water", note: "Specific quantities use simple 'de' or 'd''" }
    ],
    examples: [
      { fr: "Bonjour Gérard, je voudrais du fromage et du beurre, s'il vous plaît.", en: "Hello Gérard, I would like some cheese and some butter, please." },
      { fr: "Ce soir, nous mangeons de la soupe et de la salade.", en: "Tonight, we are eating soup and salad." },
      { fr: "Il faut de l'ail, de l'huile et des tomates pour la recette.", en: "We need garlic, oil, and tomatoes for the recipe." },
      { fr: "Est-ce que vous avez du lait frais ?", en: "Do you have fresh milk?" }
    ],
    exercises: [
      {
        id: "w2d8_ex1",
        kind: "mcq",
        prompt: "Fromage is masculine. How do you say 'some cheese'?",
        options: ["du fromage", "de la fromage", "de le fromage", "des fromage"],
        answer: "du fromage",
        explanation: "'De + le' contracts to 'du' before masculine singular nouns."
      },
      {
        id: "w2d8_ex2",
        kind: "gap",
        prompt: "Soupe is feminine. Complete: « Ce soir, je prends ___ soupe chaude. »",
        answer: "de la",
        explanation: "'De la' is used before feminine singular uncountable nouns."
      },
      {
        id: "w2d8_ex3",
        kind: "mcq",
        prompt: "Which partitive goes before 'eau' (water) and 'ail' (garlic)?",
        options: ["de l'", "du", "de la", "des"],
        answer: "de l'",
        explanation: "Before a vowel or silent h, both 'du' and 'de la' become 'de l''."
      },
      {
        id: "w2d8_ex4",
        kind: "gap",
        prompt: "Complete the grocery request for 'some butter' (masculine): « Je voudrais ___ beurre, s'il vous plaît. »",
        answer: "du",
        explanation: "'Beurre' is masculine singular, so 'some butter' is 'du beurre'."
      },
      {
        id: "w2d8_ex5",
        kind: "tiles",
        prompt: "Arrange the words to ask Gérard for cheese and eggs:",
        options: ["Je", "voudrais", "du", "fromage", "et", "des", "œufs."],
        answer: "Je voudrais du fromage et des œufs.",
        explanation: "'du fromage' (masculine singular partitive) + 'et' + 'des œufs' (plural)."
      },
      {
        id: "w2d8_ex6",
        kind: "listen",
        prompt: "Listen to the ingredients list and choose what the speaker needs:",
        audioFr: "Pour ce soir, il faut du beurre, de l'ail et des tomates.",
        options: [
          "Butter, garlic, and tomatoes",
          "Bread, milk, and apples",
          "Cheese, oil, and onions",
          "Soup, water, and eggs"
        ],
        answer: "Butter, garlic, and tomatoes",
        explanation: "'du beurre' (butter), 'de l'ail' (garlic), 'des tomates' (tomatoes)."
      },
      {
        id: "w2d8_ex7",
        kind: "mcq",
        prompt: "Why do we say « un morceau de fromage » (with 'de', not 'du')?",
        options: [
          "After a specific quantity ('un morceau', 'un kilo', 'beaucoup'), 'du/de la/des' simplifies to 'de'.",
          "Because 'fromage' is plural here.",
          "Because 'fromage' starts with a vowel.",
          "Because 'morceau' is feminine."
        ],
        answer: "After a specific quantity ('un morceau', 'un kilo', 'beaucoup'), 'du/de la/des' simplifies to 'de'.",
        explanation: "Expressions of quantity ('un kilo de', 'un morceau de', 'beaucoup de') take 'de/d''."
      },
      {
        id: "w2d8_ex8",
        kind: "translate",
        prompt: "Translate into French: 'some bread and some water'",
        answer: "du pain et de l'eau",
        accept: ["Du pain et de l'eau."],
        explanation: "'du pain' (masculine) + 'et' + 'de l'eau' (starts with a vowel)."
      }
    ],
    useItPrompt: "Visit Gérard at l'épicerie or talk with Madame about tonight's meal using 'du', 'de la', 'de l'', and 'des' for every ingredient.",
    skills: ["food", "ordering"],
    domains: ["food_grocery", "kitchen_cooking"]
  },
  {
    id: "w2d9_gender_adjectives",
    day: 9,
    week: 2,
    title: "Noun Gender, Plurals & Adjective Agreement",
    subtitle: "Describing food and things as good, hot, fresh, or delicious",
    explanation: [
      "When you describe food or things in French, adjectives must agree in gender (masculine/feminine) and number (singular/plural) with the noun they describe. Most feminine forms add '-e' ('chaud' -> 'chaude', 'petit' -> 'petite'), and most plurals add '-s' ('chauds', 'chaudes').",
      "Some common food adjectives have special feminine endings: 'bon' (good) doubles the n to become 'bonne'; 'frais' (fresh/cool) becomes 'fraîche'; 'délicieux' (delicious) becomes 'délicieuse'. Adjectives that already end in '-e' in the masculine (like 'jaune', 'rouge', 'magnifique') don't change in the feminine!",
      "In French, most descriptive adjectives (colors, 'chaud', 'frais', 'sucré', 'salé') go AFTER the noun: 'du pain chaud', 'une tomate fraîche'. However, a few short, super-common adjectives like 'bon/bonne', 'petit/petite', 'grand/grande', and 'joli/jolie' go BEFORE the noun: 'un bon café', 'une bonne soupe'."
    ],
    keyPoints: [
      { fr: "un café chaud / une soupe chaude", en: "a hot coffee / a hot soup", note: "Regular adjective: add -e for feminine, -s for plural" },
      { fr: "un bon pain / une bonne baguette", en: "a good bread / a good baguette", note: "bon -> bonne; placed BEFORE the noun" },
      { fr: "du beurre frais / de l'eau fraîche", en: "fresh butter / cool water", note: "frais -> fraîche; placed AFTER the noun" },
      { fr: "un plat délicieux / une tarte délicieuse", en: "a delicious dish / a delicious tart", note: "-eux -> -euse in the feminine" },
      { fr: "des tomates rouges / des pommes vertes", en: "red tomatoes / green apples", note: "Colors go after the noun and take -s in the plural" }
    ],
    examples: [
      { fr: "La soupe de Madame Rousseau est très bonne et bien chaude.", en: "Madame Rousseau's soup is very good and nice and hot." },
      { fr: "Je voudrais du fromage frais et des tomates mûres.", en: "I would like fresh cheese and ripe tomatoes." },
      { fr: "C'est une excellente brioche !", en: "That's an excellent brioche!" },
      { fr: "Les croissants sont chauds et délicieux.", en: "The croissants are warm and delicious." }
    ],
    exercises: [
      {
        id: "w2d9_ex1",
        kind: "mcq",
        prompt: "Since 'soupe' is feminine, how do you say 'The soup is good'?",
        options: [
          "La soupe est bonne.",
          "La soupe est bon.",
          "Le soupe est bonne.",
          "La soupe est bons."
        ],
        answer: "La soupe est bonne.",
        explanation: "The feminine form of 'bon' is 'bonne'."
      },
      {
        id: "w2d9_ex2",
        kind: "gap",
        prompt: "Make 'chaud' agree with 'la tarte' (feminine): « Attention, la tarte est très ___ ! »",
        answer: "chaude",
        explanation: "Add '-e' to 'chaud' for feminine singular: 'chaude'."
      },
      {
        id: "w2d9_ex3",
        kind: "mcq",
        prompt: "What is the feminine singular form of 'frais' (as in 'fresh water' — de l'eau ___)?",
        options: ["fraîche", "fraise", "fraîches", "frais"],
        answer: "fraîche",
        explanation: "The feminine of 'frais' is 'fraîche' (with circumflex or 'fraiche')."
      },
      {
        id: "w2d9_ex4",
        kind: "tiles",
        prompt: "Put the words in the natural French order to say 'a good hot soup':",
        options: ["une", "bonne", "soupe", "chaude"],
        answer: "une bonne soupe chaude",
        explanation: "'Bonne' goes before the noun, while 'chaude' goes after the noun."
      },
      {
        id: "w2d9_ex5",
        kind: "listen",
        prompt: "Listen and identify how the speaker describes the tomatoes:",
        audioFr: "Ces tomates rouges sont très fraîches et délicieuses.",
        options: [
          "Red, very fresh, and delicious",
          "Green, small, and expensive",
          "Warm, sweet, and cooked",
          "Yellow, ripe, and soft"
        ],
        answer: "Red, very fresh, and delicious",
        explanation: "'rouges' (red), 'très fraîches' (very fresh), 'délicieuses' (delicious)."
      },
      {
        id: "w2d9_ex6",
        kind: "gap",
        prompt: "Make 'délicieux' feminine to match 'la brioche': « La brioche est ___. »",
        answer: "délicieuse",
        accept: ["delicieuse"],
        explanation: "Adjectives ending in '-eux' change to '-euse' in the feminine."
      },
      {
        id: "w2d9_ex7",
        kind: "mcq",
        prompt: "Which phrase has correct plural agreement?",
        options: [
          "des croissants chauds",
          "des croissants chaud",
          "des croissant chauds",
          "un croissants chauds"
        ],
        answer: "des croissants chauds",
        explanation: "Both the noun ('croissants') and adjective ('chauds') take '-s' in the plural."
      },
      {
        id: "w2d9_ex8",
        kind: "translate",
        prompt: "Translate into French: 'a good baguette'",
        answer: "une bonne baguette",
        accept: ["Une bonne baguette."],
        explanation: "'Bonne' (feminine of bon) goes before 'baguette'."
      }
    ],
    useItPrompt: "Compliment Madame Rousseau's meal or Gérard's produce using agreed adjectives like 'bon/bonne', 'chaud/chaude', 'frais/fraîche', and 'délicieux/délicieuse'.",
    skills: ["food", "smalltalk"],
    domains: ["food_grocery", "kitchen_cooking"]
  },
  {
    id: "w2d10_er_verbs",
    day: 10,
    week: 2,
    title: "Present Tense Regular -ER Verbs",
    subtitle: "Using aimer, habiter, parler, manger, chercher, and cuisiner",
    explanation: [
      "Over 80% of French verbs end in '-er' in the infinitive ('parler' to speak, 'habiter' to live, 'aimer' to like/love, 'chercher' to look for, 'cuisiner' to cook, 'couper' to cut). Once you know their pattern, you can use hundreds of verbs effortlessly!",
      "To conjugate a regular '-er' verb, drop '-er' and add the endings: 'je -e', 'tu -es', 'il/elle/on -e', 'nous -ons', 'vous -ez', 'ils/elles -ent'. Notice a huge spoken bonus: 'je parle', 'tu parles', 'il/elle parle', and 'ils/elles parlent' all sound identical out loud!",
      "Two small spelling notes: before a verb starting with a vowel or mute h ('aimer', 'habiter'), 'je' contracts to 'j'' ('j'aime', 'j'habite'). And with '-ger' verbs like 'manger' (to eat), we keep the 'e' in 'nous mangeons' so the 'g' stays soft."
    ],
    keyPoints: [
      { fr: "je parle / tu parles / il parle", en: "I speak / you speak / he speaks", note: "-e, -es, -e all have the same pronunciation" },
      { fr: "nous parlons / vous parlez / ils parlent", en: "we speak / you speak / they speak", note: "-ons and -ez have distinct spoken endings; -ent is silent" },
      { fr: "j'aime + le/la/les … / j'aime + infinitive", en: "I like (the) … / I like to …", note: "After aimer, always use le/la/les for nouns: J'aime le fromage" },
      { fr: "j'habite à…", en: "I live in (city/town)…", note: "Mute h means je contracts to j'habite" },
      { fr: "je cherche…", en: "I am looking for…", note: "Includes 'for' automatically — never say 'chercher pour'" },
      { fr: "je cuisine / nous mangeons", en: "I cook / we eat", note: "manger keeps 'e' before -ons: nous mangeons" }
    ],
    examples: [
      { fr: "J'habite à Boston et je parle un peu français.", en: "I live in Boston and I speak a little French." },
      { fr: "J'aime beaucoup le fromage et j'aime cuisiner.", en: "I really like cheese and I like to cook." },
      { fr: "Excusez-moi Gérard, je cherche des tomates et de l'ail.", en: "Excuse me Gérard, I am looking for tomatoes and garlic." },
      { fr: "Qu'est-ce que vous mangez ce soir ?", en: "What are you eating tonight?" }
    ],
    exercises: [
      {
        id: "w2d10_ex1",
        kind: "mcq",
        prompt: "Complete the sentence: « Je ___ un peu français. » (parler)",
        options: ["parle", "parles", "parlez", "parler"],
        answer: "parle",
        explanation: "With 'je', regular -er verbs end in '-e': 'je parle'."
      },
      {
        id: "w2d10_ex2",
        kind: "gap",
        prompt: "Conjugate 'chercher' (to look for) with 'je': « Bonjour Monsieur, je ___ des œufs frais. »",
        answer: "cherche",
        explanation: "Drop '-er' from 'chercher' and add '-e': 'je cherche'."
      },
      {
        id: "w2d10_ex3",
        kind: "mcq",
        prompt: "How do you say 'I like cheese' in French?",
        options: [
          "J'aime le fromage.",
          "J'aime du fromage.",
          "Je aime fromage.",
          "J'aimes le fromage."
        ],
        answer: "J'aime le fromage.",
        explanation: "'Je' contracts to 'J'' before 'aime', and 'aimer' takes the definite article ('le fromage')."
      },
      {
        id: "w2d10_ex4",
        kind: "gap",
        prompt: "Complete the polite question to Madame Rousseau (aimer): « Est-ce que vous ___ la soupe à l'oignon ? »",
        answer: "aimez",
        explanation: "With 'vous', regular -er verbs take '-ez': 'vous aimez'."
      },
      {
        id: "w2d10_ex5",
        kind: "listen",
        prompt: "Listen and choose what the speaker says about themselves:",
        audioFr: "J'habite à Chicago et j'aime beaucoup cuisiner.",
        options: [
          "I live in Chicago and I really like to cook.",
          "I work in Chicago and I hate cooking.",
          "I am visiting Chicago and I am looking for a restaurant.",
          "You live in Chicago and you speak French."
        ],
        answer: "I live in Chicago and I really like to cook.",
        explanation: "'J'habite à Chicago' (I live in Chicago) + 'j'aime beaucoup cuisiner' (I really like to cook)."
      },
      {
        id: "w2d10_ex6",
        kind: "tiles",
        prompt: "Arrange the words to say 'I am looking for tomatoes and I am cooking tonight':",
        options: ["Je", "cherche", "des", "tomates", "et", "je", "cuisine", "ce", "soir."],
        answer: "Je cherche des tomates et je cuisine ce soir.",
        explanation: "'Je cherche des tomates' + 'et je cuisine ce soir.'"
      },
      {
        id: "w2d10_ex7",
        kind: "gap",
        prompt: "Conjugate 'couper' (to cut) for 'tu': « Tu ___ les tomates pour la salade ? »",
        answer: "coupes",
        explanation: "With 'tu', regular -er verbs end in '-es': 'tu coupes'."
      },
      {
        id: "w2d10_ex8",
        kind: "translate",
        prompt: "Translate into French: 'I speak a little French.' (use 'un peu')",
        answer: "Je parle un peu français.",
        accept: [
          "Je parle un peu français",
          "Je parle un peu francais",
          "Je parle un peu le français"
        ],
        explanation: "'Je parle un peu français.'"
      }
    ],
    useItPrompt: "Use '-er' verbs today when shopping ('je cherche…') and cooking with Madame Rousseau ('je coupe…', 'j'aime…', 'nous mangeons…').",
    skills: ["food", "smalltalk", "intro"],
    domains: ["kitchen_cooking", "food_grocery", "self_intro"]
  },
  {
    id: "w2d11_negation",
    day: 11,
    week: 2,
    title: "Negation: ne … pas & ne … pas de",
    subtitle: "Saying what you don't do, don't have, or don't eat",
    explanation: [
      "To make a sentence negative in French, wrap 'ne … pas' around the conjugated verb like a sandwich: 'Je parle' becomes 'Je ne parle pas'. Before a verb starting with a vowel or silent h, 'ne' contracts to 'n'': 'Je n'ai pas', 'Je n'aime pas', 'Il n'est pas'.",
      "Here is the golden rule of French negation with nouns: after a negative verb (except 'être'), indefinite and partitive articles ('un, une, des, du, de la, de l'') ALL change to 'de' (or 'd'' before a vowel)! For example: 'J'ai de la monnaie' -> 'Je n'ai pas de monnaie'; 'Je mange de la viande' -> 'Je ne mange pas de viande'; 'Il y a des œufs' -> 'Il n'y a pas d'œufs'.",
      "Exception: with 'aimer / adorer / préférer' (which use 'le, la, les'), the definite article stays even in the negative: 'Je n'aime pas le café'."
    ],
    keyPoints: [
      { fr: "Je ne parle pas / Je ne comprends pas", en: "I don't speak / I don't understand", note: "ne goes before the verb, pas goes after" },
      { fr: "Je n'ai pas / Je n'aime pas", en: "I don't have / I don't like", note: "ne contracts to n' before a vowel or mute h" },
      { fr: "Je n'ai pas de monnaie.", en: "I don't have any change.", note: "un/une/des/du/de la become 'de' after pas!" },
      { fr: "Je ne mange pas de viande.", en: "I don't eat meat.", note: "de la viande -> pas de viande" },
      { fr: "Il n'y a pas d'œufs.", en: "There aren't any eggs.", note: "des œufs -> pas d'œufs (before a vowel)" },
      { fr: "Je n'aime pas le poisson.", en: "I don't like fish.", note: "Definite articles (le/la/les) never change after pas" }
    ],
    examples: [
      { fr: "Désolé, je n'ai pas de monnaie aujourd'hui.", en: "Sorry, I don't have any change today." },
      { fr: "Je ne mange pas de viande, mais j'aime le fromage.", en: "I don't eat meat, but I like cheese." },
      { fr: "Nous n'avons pas d'ail dans la cuisine.", en: "We don't have any garlic in the kitchen." },
      { fr: "Excusez-moi, je ne comprends pas bien.", en: "Excuse me, I don't understand well." }
    ],
    exercises: [
      {
        id: "w2d11_ex1",
        kind: "mcq",
        prompt: "How do you say 'I don't have any bread' in French?",
        options: [
          "Je n'ai pas de pain.",
          "Je n'ai pas du pain.",
          "Je ne ai pas de pain.",
          "Je pas ai de pain."
        ],
        answer: "Je n'ai pas de pain.",
        explanation: "'Du pain' becomes 'pas de pain' in a negative sentence, and 'ne' contracts to 'n'' before 'ai'."
      },
      {
        id: "w2d11_ex2",
        kind: "gap",
        prompt: "Complete the negative sentence: « Désolé, je n'ai pas ___ monnaie. »",
        answer: "de",
        explanation: "After 'ne … pas', 'de la monnaie' becomes 'pas de monnaie'."
      },
      {
        id: "w2d11_ex3",
        kind: "mcq",
        prompt: "Which sentence correctly says 'I don't understand'?",
        options: [
          "Je ne comprends pas.",
          "Je comprends ne pas.",
          "Ne je comprends pas.",
          "Je n'comprends pas."
        ],
        answer: "Je ne comprends pas.",
        explanation: "'Ne' goes before the consonant-initial verb 'comprends', and 'pas' goes right after."
      },
      {
        id: "w2d11_ex4",
        kind: "gap",
        prompt: "Before a vowel ('œufs'), 'de' contracts. Fill in the blank: « Il n'y a pas ___ œufs dans le frigo. »",
        answer: "d'",
        accept: ["d"],
        explanation: "'Pas de' contracts to 'pas d'' before a vowel ('œufs', 'eau', 'ail')."
      },
      {
        id: "w2d11_ex5",
        kind: "tiles",
        prompt: "Put the words in order to say 'I do not eat meat':",
        options: ["Je", "ne", "mange", "pas", "de", "viande."],
        answer: "Je ne mange pas de viande.",
        explanation: "'Je ne mange pas' + 'de viande'."
      },
      {
        id: "w2d11_ex6",
        kind: "listen",
        prompt: "Listen and choose what the speaker says they are missing:",
        audioFr: "Nous avons des tomates, mais nous n'avons pas d'ail.",
        options: [
          "They have tomatoes, but they don't have garlic.",
          "They have garlic, but they don't have tomatoes.",
          "They don't have tomatoes or garlic.",
          "They have both tomatoes and garlic."
        ],
        answer: "They have tomatoes, but they don't have garlic.",
        explanation: "'Nous n'avons pas d'ail' = We do not have any garlic."
      },
      {
        id: "w2d11_ex7",
        kind: "mcq",
        prompt: "With 'aimer', how do you say 'I don't like coffee'?",
        options: [
          "Je n'aime pas le café.",
          "Je n'aime pas de café.",
          "Je ne aime pas le café.",
          "Je n'aime le pas café."
        ],
        answer: "Je n'aime pas le café.",
        explanation: "Definite articles ('le, la, les') used with 'aimer' do NOT change to 'de' in the negative."
      },
      {
        id: "w2d11_ex8",
        kind: "translate",
        prompt: "Translate into French: 'I do not have any butter.'",
        answer: "Je n'ai pas de beurre.",
        accept: ["Je n'ai pas de beurre", "Je n ai pas de beurre"],
        explanation: "'Je n'ai pas' + 'de beurre' (du -> de after negation)."
      }
    ],
    useItPrompt: "In the kitchen or at l'épicerie today, mention something you don't have or don't eat using 'Je n'ai pas de…' or 'Je ne mange pas de…'.",
    skills: ["food", "smalltalk", "ordering"],
    domains: ["kitchen_cooking", "food_grocery"]
  },
  {
    id: "w2d12_numbers_20_100",
    day: 12,
    week: 2,
    title: "Numbers 20–100, Weights & Larger Bills",
    subtitle: "Counting up to 100 for grocery weights, restaurant bills, and ages",
    explanation: [
      "As you shop at the grocery store and supermarket or eat at a bistro, you'll encounter numbers from 20 to 100 — whether for a 28-euro lunch bill, 50 centimes of change, or 100 grams ('cent grammes') of cheese.",
      "From 20 to 69, French tens are straightforward: 'vingt' (20), 'trente' (30), 'quarante' (40), 'cinquante' (50), 'soixante' (60). For numbers ending in 1, add 'et un' ('vingt et un', 'trente et un'); for 2–9, add a hyphen ('vingt-deux', 'quarante-cinq').",
      "At 70, 80, and 90, French counts in twenties and tens: 70 is 'soixante-dix' (60+10), 75 is 'soixante-quinze' (60+15), 80 is 'quatre-vingts' (4×20), 90 is 'quatre-vingt-dix' (4×20+10), and 100 is 'cent'."
    ],
    keyPoints: [
      { fr: "vingt (20), trente (30), quarante (40)", en: "20, 30, 40", note: "Add 'et un' for 21, 31, 41 (vingt et un)" },
      { fr: "cinquante (50), soixante (60)", en: "50, 60", note: "cinquante = 50 (e.g., deux euros cinquante = 2.50 €)" },
      { fr: "soixante-dix (70), soixante-quinze (75)", en: "70, 75", note: "60 + 10..19 (soixante-onze = 71, soixante-douze = 72)" },
      { fr: "quatre-vingts (80), quatre-vingt-dix (90)", en: "80, 90", note: "Literally 'four twenties' (80) and 'four twenties ten' (90)" },
      { fr: "cent (100) / cent grammes / un demi-kilo", en: "100 / 100 grams / half a kilo", note: "Essential for buying cheese or produce by weight" }
    ],
    examples: [
      { fr: "Ça fait vingt-huit euros cinquante, s'il vous plaît.", en: "That comes to 28.50 €, please." },
      { fr: "Je voudrais deux cents grammes de comté, s'il vous plaît.", en: "I would like 200 grams of Comté cheese, please." },
      { fr: "Ma grand-mère a soixante-douze ans.", en: "My grandmother is seventy-two years old." },
      { fr: "Voici un billet de cinquante euros.", en: "Here is a fifty-euro bill." }
    ],
    exercises: [
      {
        id: "w2d12_ex1",
        kind: "mcq",
        prompt: "Which number is 'trente-cinq'?",
        options: ["35", "25", "45", "53"],
        answer: "35",
        explanation: "Trente (30) + cinq (5) = 35."
      },
      {
        id: "w2d12_ex2",
        kind: "mcq",
        prompt: "How does French express the number 70?",
        options: [
          "soixante-dix",
          "septante-zéro",
          "quatre-vingts",
          "soixante-vingt"
        ],
        answer: "soixante-dix",
        explanation: "In standard French, 70 is 'soixante-dix' (60 + 10)."
      },
      {
        id: "w2d12_ex3",
        kind: "gap",
        prompt: "Write the French word for 50: « Un euro ___ » (1.50 €).",
        answer: "cinquante",
        explanation: "'Cinquante' is 50."
      },
      {
        id: "w2d12_ex4",
        kind: "listen",
        prompt: "Listen to the bill total and select the correct amount:",
        audioFr: "L'addition fait quarante-deux euros cinquante, s'il vous plaît.",
        options: ["42,50 €", "24,50 €", "52,40 €", "14,50 €"],
        answer: "42,50 €",
        explanation: "'Quarante-deux euros cinquante' = 42,50 €."
      },
      {
        id: "w2d12_ex5",
        kind: "mcq",
        prompt: "What number is 'quatre-vingts'?",
        options: ["80", "40", "24", "90"],
        answer: "80",
        explanation: "'Quatre-vingts' (four twenties) is 80."
      },
      {
        id: "w2d12_ex6",
        kind: "tiles",
        prompt: "Arrange the words to ask for 100 grams of cheese:",
        options: ["Je", "voudrais", "cent", "grammes", "de", "fromage."],
        answer: "Je voudrais cent grammes de fromage.",
        explanation: "'Je voudrais cent grammes de fromage' (note 'de' after a quantity)."
      },
      {
        id: "w2d12_ex7",
        kind: "gap",
        prompt: "Write the French word for 100: « Ça coûte ___ euros. »",
        answer: "cent",
        explanation: "'Cent' means 100."
      },
      {
        id: "w2d12_ex8",
        kind: "translate",
        prompt: "Translate into French: 'twenty-five euros'",
        answer: "vingt-cinq euros",
        accept: ["vingt cinq euros", "Vingt-cinq euros"],
        explanation: "25 = 'vingt-cinq' + 'euros'."
      }
    ],
    useItPrompt: "Ask for prices or weights at l'épicerie or le Petit Bistro and say the full euro and centime amounts out loud.",
    skills: ["numbers", "ordering"],
    domains: ["numbers_prices", "food_grocery"]
  },
  {
    id: "w2d13_venir_de_origins",
    day: 13,
    week: 2,
    title: "Venir de, Countries & Nationalities",
    subtitle: "Saying where you come from and matching nationality adjectives",
    explanation: [
      "Whenever you meet locals in the village, they will be curious about where you come from! Use the verb 'venir' (to come): 'je viens', 'tu viens', 'il/elle/on vient', 'nous venons', 'vous venez', 'ils/elles viennent'.",
      "With cities, always use 'venir de' (or 'd'' before a vowel): 'Je viens de New York', 'Je viens de Londres', 'Je viens d'Atlanta'. With countries, the preposition changes according to the country's gender: use 'de' for feminine countries ('Je viens de France', 'd'Angleterre', 'd'Espagne'), 'du' for masculine countries ('Je viens du Canada', 'du Japon'), and 'des' for plural countries ('Je viens des États-Unis').",
      "You can also state your nationality with 'être': remember that nationalities are lowercase adjectives in French and add '-e' (or '-ne') in the feminine: 'américain / américaine', 'anglais / anglaise', 'canadien / canadienne', 'français / française'."
    ],
    keyPoints: [
      { fr: "je viens / tu viens / vous venez", en: "I come / you come (informal / polite)", note: "Present tense of venir" },
      { fr: "Je viens de Londres / de Paris / de Chicago", en: "I come from London / Paris / Chicago", note: "Cities always take 'de' (or 'd'' before a vowel)" },
      { fr: "Je viens du Canada / des États-Unis / de France", en: "I come from Canada / the US / France", note: "du (masc.), des (plural), de/d' (fem. or vowel)" },
      { fr: "américain / américaine", en: "American (m. / f.)", note: "Nationalities are not capitalized when used as adjectives" },
      { fr: "anglais / anglaise, canadien / canadienne", en: "English (m./f.), Canadian (m./f.)", note: "-ien doubles the n in the feminine: -ienne" }
    ],
    examples: [
      { fr: "D'où venez-vous ? — Je viens des États-Unis, de Boston.", en: "Where do you come from? — I come from the United States, from Boston." },
      { fr: "Je suis canadienne, je viens de Montréal.", en: "I am Canadian (f.), I come from Montreal." },
      { fr: "Tu viens d'où ? — Je viens d'Angleterre.", en: "Where are you from? — I come from England." },
      { fr: "Gérard vient d'un petit village en Normandie.", en: "Gérard comes from a small village in Normandy." }
    ],
    exercises: [
      {
        id: "w2d13_ex1",
        kind: "mcq",
        prompt: "Complete the sentence: « Bonjour, je ___ de Chicago. » (I come from Chicago.)",
        options: ["viens", "venez", "vient", "suis"],
        answer: "viens",
        explanation: "'Je viens de…' means 'I come from…'."
      },
      {
        id: "w2d13_ex2",
        kind: "mcq",
        prompt: "Les États-Unis (the United States) is plural. How do you say 'I come from the United States'?",
        options: [
          "Je viens des États-Unis.",
          "Je viens de États-Unis.",
          "Je viens du États-Unis.",
          "Je viens aux États-Unis."
        ],
        answer: "Je viens des États-Unis.",
        explanation: "'De + les' contracts to 'des' before plural country names like 'les États-Unis'."
      },
      {
        id: "w2d13_ex3",
        kind: "gap",
        prompt: "Le Canada is masculine. Fill in the preposition: « Elle vient ___ Canada. »",
        answer: "du",
        explanation: "'De + le' contracts to 'du' before masculine singular countries."
      },
      {
        id: "w2d13_ex4",
        kind: "gap",
        prompt: "Make the nationality adjective feminine for Sophie: « Sophie est ___ (canadien). »",
        answer: "canadienne",
        explanation: "Nationalities ending in '-ien' become '-ienne' in the feminine."
      },
      {
        id: "w2d13_ex5",
        kind: "listen",
        prompt: "Listen and identify where the speaker is from:",
        audioFr: "Je suis anglaise et je viens de Londres.",
        options: [
          "She is English and comes from London.",
          "She is American and comes from Boston.",
          "He is Canadian and comes from Toronto.",
          "She is French and lives in Lyon."
        ],
        answer: "She is English and comes from London.",
        explanation: "'Je suis anglaise' (I am English, f.) + 'je viens de Londres' (I come from London)."
      },
      {
        id: "w2d13_ex6",
        kind: "tiles",
        prompt: "Put the words in order to ask someone politely where they come from:",
        options: ["D'où", "est-ce", "que", "vous", "venez ?"],
        answer: "D'où est-ce que vous venez ?",
        explanation: "'D'où' (From where) + 'est-ce que vous venez ?'."
      },
      {
        id: "w2d13_ex7",
        kind: "mcq",
        prompt: "Before a city name, which preposition follows 'venir'?",
        options: [
          "de (or d' before a vowel): Je viens de Paris.",
          "du: Je viens du Paris.",
          "des: Je viens des Paris.",
          "au: Je viens au Paris."
        ],
        answer: "de (or d' before a vowel): Je viens de Paris.",
        explanation: "Cities always take 'de' (or 'd'' before a vowel) after 'venir'."
      },
      {
        id: "w2d13_ex8",
        kind: "translate",
        prompt: "Translate into French: 'I come from London.' (Londres)",
        answer: "Je viens de Londres.",
        accept: ["Je viens de Londres", "je viens de Londres"],
        explanation: "'Je viens de Londres.'"
      }
    ],
    useItPrompt: "Tell Théo at le Petit Bistro or Gérard at l'épicerie where you come from using 'Je viens de/du/des…' and your nationality with 'Je suis…'.",
    skills: ["intro", "smalltalk"],
    domains: ["countries_nationality", "self_intro"]
  },
  {
    id: "w2d14_week2_review",
    day: 14,
    week: 2,
    title: "Week 2 Consolidation: Village, Food & Origins",
    subtitle: "Synthesizing partitives, adjectives, -er verbs, negation, numbers 20–100, and venir de",
    explanation: [
      "Bravo for finishing Week 2! You can now shop for ingredients with 'du, de la, de l', des', describe food with properly agreed adjectives ('bon/bonne', 'frais/fraîche', 'chaud/chaude'), conjugate regular '-er' verbs ('parler, habiter, aimer, chercher, cuisiner'), use negation ('ne … pas' and 'pas de'), handle numbers up to 100, and explain where you come from with 'venir de'.",
      "Watch out for the two classic contrasts you learned this week: (1) Partitive vs. Definite vs. Negative — 'Je mange du fromage' (some cheese), 'J'aime le fromage' (cheese in general), 'Je n'ai pas de fromage' (no cheese); and (2) City vs. Country with 'venir' and 'habiter' — 'Je viens des États-Unis, j'habite à Boston'.",
      "Complete these 8 exercises to lock in your Week 2 grammar before your conversation and Week 2 exam."
    ],
    keyPoints: [
      { fr: "du, de la, de l', des -> pas de / pas d'", en: "some -> not any", note: "Partitives turn into 'de/d'' after negation" },
      { fr: "J'aime le pain / Je mange du pain", en: "I like bread / I eat (some) bread", note: "aimer takes le/la/les; eating/buying takes du/de la/des" },
      { fr: "une bonne soupe chaude / de l'eau fraîche", en: "a good hot soup / cool water", note: "Adjectives agree in gender and number" },
      { fr: "je parle, tu parles, il parle, vous parlez", en: "regular -er present tense", note: "Core pattern for 80%+ of French verbs" },
      { fr: "Je viens du Canada / des États-Unis / de Londres", en: "I come from Canada / the US / London", note: "venir + du / des / de" }
    ],
    examples: [
      { fr: "Je viens du Canada et j'habite à Vancouver.", en: "I come from Canada and I live in Vancouver." },
      { fr: "Je cherche de l'ail et des tomates fraîches, mais je n'ai pas de monnaie.", en: "I'm looking for garlic and fresh tomatoes, but I don't have change." },
      { fr: "J'aime beaucoup la cuisine française, surtout la bonne soupe chaude.", en: "I really like French cooking, especially good hot soup." },
      { fr: "Ça fait trente-quatre euros cinquante, s'il vous plaît.", en: "That comes to 34.50 €, please." }
    ],
    exercises: [
      {
        id: "w2d14_ex1",
        kind: "mcq",
        prompt: "Choose the pair of sentences that is 100% grammatically correct:",
        options: [
          "J'aime le fromage, mais je n'ai pas de fromage ce soir.",
          "J'aime du fromage, mais je n'ai pas du fromage ce soir.",
          "J'aime le fromage, mais je n'ai pas le fromage ce soir.",
          "Je aime fromage, mais je pas ai de fromage."
        ],
        answer: "J'aime le fromage, mais je n'ai pas de fromage ce soir.",
        explanation: "'Aimer' takes 'le', while the negative of 'avoir du fromage' is 'n'ai pas de fromage'."
      },
      {
        id: "w2d14_ex2",
        kind: "gap",
        prompt: "Fill in the correct partitive before a vowel: « Pour la salade, il faut ___ huile et du sel. »",
        answer: "de l'",
        accept: ["de l"],
        explanation: "'Huile' starts with a silent h, so it takes 'de l''."
      },
      {
        id: "w2d14_ex3",
        kind: "gap",
        prompt: "Conjugate 'cuisiner' for 'nous': « Ce soir, nous ___ avec Madame Rousseau. »",
        answer: "cuisinons",
        explanation: "With 'nous', regular -er verbs end in '-ons': 'nous cuisinons'."
      },
      {
        id: "w2d14_ex4",
        kind: "listen",
        prompt: "Listen and select the statement that matches the audio:",
        audioFr: "Je viens des États-Unis et je ne mange pas de viande.",
        options: [
          "The speaker is from the US and doesn't eat meat.",
          "The speaker is from the US and loves meat.",
          "The speaker is from England and doesn't eat cheese.",
          "The speaker lives in France and cooks meat."
        ],
        answer: "The speaker is from the US and doesn't eat meat.",
        explanation: "'Je viens des États-Unis' + 'je ne mange pas de viande'."
      },
      {
        id: "w2d14_ex5",
        kind: "tiles",
        prompt: "Build the sentence 'La soupe est très bonne et bien chaude.':",
        options: ["La", "soupe", "est", "très", "bonne", "et", "bien", "chaude."],
        answer: "La soupe est très bonne et bien chaude.",
        explanation: "Both 'bonne' and 'chaude' are feminine singular to agree with 'la soupe'."
      },
      {
        id: "w2d14_ex6",
        kind: "mcq",
        prompt: "Which number is 'soixante-quinze'?",
        options: ["75", "65", "85", "95"],
        answer: "75",
        explanation: "Soixante (60) + quinze (15) = 75."
      },
      {
        id: "w2d14_ex7",
        kind: "translate",
        prompt: "Translate into French: 'I am looking for fresh tomatoes.' (use 'fraîches')",
        answer: "Je cherche des tomates fraîches.",
        accept: [
          "Je cherche des tomates fraîches",
          "Je cherche des tomates fraiches.",
          "Je cherche des tomates fraiches"
        ],
        explanation: "'Je cherche' + 'des tomates fraîches' (adjective after noun)."
      },
      {
        id: "w2d14_ex8",
        kind: "translate",
        prompt: "Translate into French: 'I do not have any garlic.' (ail)",
        answer: "Je n'ai pas d'ail.",
        accept: ["Je n'ai pas d'ail", "Je n ai pas d ail"],
        explanation: "'Je n'ai pas d'ail' ('de' contracts to 'd'' before 'ail')."
      }
    ],
    useItPrompt: "Show off your Week 2 skills when shopping, cooking with Madame, or chatting at le Petit Bistro before completing your Week 2 exam.",
    skills: ["food", "ordering", "numbers", "intro"],
    domains: ["food_grocery", "kitchen_cooking", "countries_nationality", "numbers_prices"]
  },

  // ============================================================================
  // WEEK 3 — FRIENDS, ROUTINES & OUTINGS (Days 15–21)
  // ============================================================================
  {
    id: "w3d15_aller_au_a_la",
    day: 15,
    week: 3,
    title: "Aller + Prepositions of Place (au, à la, à l', aux, chez)",
    subtitle: "Saying where you are going in the village and who you are visiting",
    explanation: [
      "To talk about going places around the village, you need the irregular verb 'aller' (to go): 'je vais', 'tu vas', 'il/elle/on va', 'nous allons', 'vous allez', 'ils/elles vont'.",
      "When 'aller' is followed by a place with 'à' (to/at), 'à' contracts with masculine and plural articles: 'à + le' becomes 'au' ('Je vais au parc', 'au cinéma', 'au bistro', 'au supermarché'), 'à + la' stays 'à la' ('Je vais à la boulangerie', 'à la pharmacie'), 'à + l'' stays 'à l'' ('Je vais à l'épicerie', 'à l'auberge'), and 'à + les' becomes 'aux' ('aux toilettes').",
      "When you go to a person's home or shop, use 'chez' + person: 'chez Madame Rousseau', 'chez le médecin', 'chez un ami'."
    ],
    keyPoints: [
      { fr: "je vais / tu vas / il va / nous allons / vous allez / ils vont", en: "I go / you go / he goes / we go / you go / they go", note: "Present tense of aller" },
      { fr: "au parc / au cinéma / au bistro / au supermarché", en: "to the park / cinema / bistro / supermarket", note: "à + le contracts to au" },
      { fr: "à la boulangerie / à la maison", en: "to the bakery / home", note: "Feminine singular places keep à la" },
      { fr: "à l'épicerie / à l'auberge", en: "to the grocery shop / to the inn", note: "Before a vowel or silent h" },
      { fr: "chez Madame Rousseau / chez moi", en: "at/to Madame Rousseau's place / at my place", note: "Use chez before a person or pronoun" }
    ],
    examples: [
      { fr: "Ce matin, je vais à la boulangerie et après je vais au parc.", en: "This morning, I am going to the bakery and afterward I am going to the park." },
      { fr: "Tu vas au cinéma avec nous cet après-midi ?", en: "Are you going to the movies with us this afternoon?" },
      { fr: "Nous allons à l'épicerie chez Gérard.", en: "We are going to the grocery store at Gérard's." },
      { fr: "Je rentre chez Madame Rousseau pour le dîner.", en: "I'm heading back to Madame Rousseau's for dinner." }
    ],
    exercises: [
      {
        id: "w3d15_ex1",
        kind: "mcq",
        prompt: "Le parc is masculine. How do you say 'I am going to the park'?",
        options: [
          "Je vais au parc.",
          "Je vais à le parc.",
          "Je vais à la parc.",
          "Je va au parc."
        ],
        answer: "Je vais au parc.",
        explanation: "'Je vais' + 'au' (à + le) + 'parc'."
      },
      {
        id: "w3d15_ex2",
        kind: "gap",
        prompt: "Fill in the correct form of 'aller' for 'tu': « Est-ce que tu ___ au cinéma ce soir ? »",
        answer: "vas",
        explanation: "With 'tu', 'aller' conjugates as 'tu vas'."
      },
      {
        id: "w3d15_ex3",
        kind: "mcq",
        prompt: "Which preposition goes before 'épicerie' (starts with a vowel)?",
        options: ["à l'", "au", "à la", "chez"],
        answer: "à l'",
        explanation: "Before a vowel or mute h, use 'à l'' ('Je vais à l'épicerie')."
      },
      {
        id: "w3d15_ex4",
        kind: "gap",
        prompt: "Complete the sentence to say 'to Madame Rousseau's house': « Je dîne ___ Madame Rousseau. »",
        answer: "chez",
        explanation: "Use 'chez' before a person's name to mean 'at/to their home or shop'."
      },
      {
        id: "w3d15_ex5",
        kind: "tiles",
        prompt: "Arrange the words to say 'We are going to the bakery':",
        options: ["Nous", "allons", "à", "la", "boulangerie."],
        answer: "Nous allons à la boulangerie.",
        explanation: "'Nous allons' + 'à la boulangerie'."
      },
      {
        id: "w3d15_ex6",
        kind: "listen",
        prompt: "Listen and identify the two places the speaker is going today:",
        audioFr: "Aujourd'hui, je vais au supermarché et ensuite je vais au bistro.",
        options: [
          "The supermarket and then the bistro",
          "The bakery and then the park",
          "The cinema and then the inn",
          "The grocery store and then home"
        ],
        answer: "The supermarket and then the bistro",
        explanation: "'au supermarché' (to the supermarket) + 'ensuite je vais au bistro' (then to the bistro)."
      }
    ],
    useItPrompt: "Tell Madame Rousseau where you are going today using 'Je vais au / à la / à l'…', or ask a friend at Speed Friending where they like to go.",
    skills: ["smalltalk", "intro"],
    domains: ["town_places_directions", "hobbies_leisure"]
  },
  {
    id: "w3d16_faire_hobbies",
    day: 16,
    week: 3,
    title: "Faire + Sports, Weather & Hobbies (faire du, jouer à)",
    subtitle: "Talking about what you do in your free time and the village weather",
    explanation: [
      "The irregular verb 'faire' (to do / to make) is a powerhouse in French: 'je fais', 'tu fais', 'il/elle/on fait', 'nous faisons', 'vous faites', 'ils/elles font'.",
      "Use 'faire + du / de la / de l'' for sports, music, and solo activities: 'faire du sport', 'faire du vélo' (cycling), 'faire de la randonnée' (hiking), 'faire de la cuisine', 'faire une promenade' (take a walk). For team games or board/ball games, use 'jouer au / aux': 'jouer au foot', 'jouer au tennis', 'jouer aux cartes'.",
      "'Il fait' is also how French describes the weather! 'Il fait beau' (it's nice out), 'Il fait chaud' (it's warm), 'Il fait froid' (it's cold)."
    ],
    keyPoints: [
      { fr: "je fais / tu fais / il fait / nous faisons / vous faites / ils font", en: "I do / you do / he does / we do / you do / they do", note: "Notice 'vous faites' and 'ils font'" },
      { fr: "faire du vélo / faire du sport", en: "to cycle / to play sports", note: "faire + du (masculine activity)" },
      { fr: "faire une promenade / faire la cuisine", en: "to go for a walk / to cook", note: "Everyday expressions with faire" },
      { fr: "jouer au foot / jouer au tennis", en: "to play soccer / to play tennis", note: "jouer + au for ball/team sports" },
      { fr: "Il fait beau / Il fait froid", en: "The weather is nice / It is cold", note: "Impersonal weather expression with il fait" }
    ],
    examples: [
      { fr: "Qu'est-ce que tu fais pendant ton temps libre ?", en: "What do you do during your free time?" },
      { fr: "J'aime faire du vélo et faire une promenade au parc.", en: "I like riding my bike and going for a walk in the park." },
      { fr: "Le week-end, je joue au tennis avec mes amis.", en: "On the weekend, I play tennis with my friends." },
      { fr: "Aujourd'hui, il fait très beau dans le village !", en: "Today, the weather is very nice in the village!" }
    ],
    exercises: [
      {
        id: "w3d16_ex1",
        kind: "mcq",
        prompt: "How do you ask a friend informally 'What are you doing?'",
        options: [
          "Qu'est-ce que tu fais ?",
          "Qu'est-ce que tu fait ?",
          "Qu'est-ce que tu faire ?",
          "Qu'est-ce que vous fais ?"
        ],
        answer: "Qu'est-ce que tu fais ?",
        explanation: "With 'tu', 'faire' is 'tu fais'."
      },
      {
        id: "w3d16_ex2",
        kind: "gap",
        prompt: "Complete the sentence with the 'je' form of 'faire': « Le dimanche, je ___ du vélo. »",
        answer: "fais",
        explanation: "'Je fais du vélo' = I go cycling."
      },
      {
        id: "w3d16_ex3",
        kind: "mcq",
        prompt: "How do you say 'The weather is nice today' in French?",
        options: [
          "Il fait beau aujourd'hui.",
          "Il est beau temps.",
          "Le temps fait bon.",
          "Il fait bien."
        ],
        answer: "Il fait beau aujourd'hui.",
        explanation: "'Il fait beau' is the standard expression for nice weather."
      },
      {
        id: "w3d16_ex4",
        kind: "gap",
        prompt: "Complete the sentence for 'vous': « Qu'est-ce que vous ___ ce week-end ? »",
        answer: "faites",
        explanation: "With 'vous', 'faire' is irregular: 'vous faites'."
      },
      {
        id: "w3d16_ex5",
        kind: "tiles",
        prompt: "Put the words in order to say 'I like to play soccer':",
        options: ["J'aime", "jouer", "au", "foot."],
        answer: "J'aime jouer au foot.",
        explanation: "'Jouer au' + sport name ('foot', 'tennis', 'basket')."
      },
      {
        id: "w3d16_ex6",
        kind: "listen",
        prompt: "Listen and choose what the speaker likes to do when the weather is nice:",
        audioFr: "Quand il fait beau, j'aime faire une promenade au parc.",
        options: [
          "When the weather is nice, they like to go for a walk in the park.",
          "When it rains, they stay home and cook.",
          "When it is cold, they go to the cinema.",
          "Every morning, they play tennis at the park."
        ],
        answer: "When the weather is nice, they like to go for a walk in the park.",
        explanation: "'Quand il fait beau' + 'j'aime faire une promenade au parc'."
      }
    ],
    useItPrompt: "Talk about your hobbies and the weather at Speed Friending or with Madame using 'Je fais du/de la…', 'Je joue au…', and 'Il fait beau'.",
    skills: ["smalltalk"],
    domains: ["hobbies_leisure", "weather_describing"]
  },
  {
    id: "w3d17_questions_est_ce_que",
    day: 17,
    week: 3,
    title: "Asking Questions (Est-ce que, Où, Quand, Comment, Pourquoi, Combien)",
    subtitle: "Turning any statement into a natural question and asking for details",
    explanation: [
      "Good conversations are two-way! In French, the easiest and most reliable way to ask a yes/no question is to put 'Est-ce que' in front of any statement: 'Tu aimes le cinéma' becomes 'Est-ce que tu aimes le cinéma ?'. Before a vowel, it contracts to 'Est-ce qu'': 'Est-ce qu'il fait beau ?'.",
      "To ask for specific information, put a question word right before 'est-ce que': 'Où' (Where), 'Quand' (When), 'Comment' (How), 'Pourquoi' (Why), 'Combien' (How much/many), and 'Qu'est-ce que' (What). For example: 'Où est-ce que tu habites ?', 'Qu'est-ce que vous recommandez ?'.",
      "To answer 'Pourquoi… ?' (Why?), start your explanation with 'Parce que…' (Because… — or 'Parce qu'' before a vowel)."
    ],
    keyPoints: [
      { fr: "Est-ce que tu… ? / Est-ce que vous… ?", en: "Do you… ? / Are you… ?", note: "Turns any statement into a yes/no question" },
      { fr: "Qu'est-ce que… ?", en: "What… ?", note: "Literally 'What is it that…?' (Qu'est-ce que tu fais ?)" },
      { fr: "Où / Quand / Comment", en: "Where / When / How", note: "Où est la gare ? / Quand est-ce qu'on part ?" },
      { fr: "Pourquoi… ? — Parce que…", en: "Why…? — Because…", note: "Pair pourquoi with parce que" },
      { fr: "Combien ça coûte ? / Combien de… ?", en: "How much does it cost? / How many…?", note: "Use 'combien de' before a noun" }
    ],
    examples: [
      { fr: "Qu'est-ce que vous conseillez comme plat du jour ?", en: "What do you recommend as the daily special?" },
      { fr: "Où est-ce que tu aimes aller le week-end ?", en: "Where do you like to go on the weekend?" },
      { fr: "Pourquoi est-ce que tu apprends le français ? — Parce que j'adore la France !", en: "Why are you learning French? — Because I love France!" },
      { fr: "À quelle heure est-ce que le film commence ?", en: "At what time does the movie start?" }
    ],
    exercises: [
      {
        id: "w3d17_ex1",
        kind: "mcq",
        prompt: "Which question word means 'Where'?",
        options: ["Où", "Quand", "Comment", "Pourquoi"],
        answer: "Où",
        explanation: "'Où' means 'where' (note the grave accent on ù)."
      },
      {
        id: "w3d17_ex2",
        kind: "gap",
        prompt: "Complete the question 'What do you like to do?': « ___ que tu aimes faire ? »",
        answer: "Qu'est-ce",
        accept: ["Qu est-ce", "Qu'est ce"],
        explanation: "'Qu'est-ce que…' means 'What…'."
      },
      {
        id: "w3d17_ex3",
        kind: "mcq",
        prompt: "How do you reply 'Because I like cheese' to a 'Pourquoi' question?",
        options: [
          "Parce que j'aime le fromage.",
          "Pourquoi j'aime le fromage.",
          "Pour j'aime le fromage.",
          "Comme que j'aime le fromage."
        ],
        answer: "Parce que j'aime le fromage.",
        explanation: "'Pourquoi' (Why) is answered with 'Parce que' (Because)."
      },
      {
        id: "w3d17_ex4",
        kind: "tiles",
        prompt: "Put the words in order to ask 'Where do you live?':",
        options: ["Où", "est-ce", "que", "tu", "habites ?"],
        answer: "Où est-ce que tu habites ?",
        explanation: "Question word ('Où') + 'est-ce que' + subject + verb."
      },
      {
        id: "w3d17_ex5",
        kind: "listen",
        prompt: "Listen to the question and choose what is being asked:",
        audioFr: "Quand est-ce que vous allez au cinéma ?",
        options: [
          "When are you going to the cinema?",
          "Where is the cinema?",
          "Why do you like the cinema?",
          "How much is a cinema ticket?"
        ],
        answer: "When are you going to the cinema?",
        explanation: "'Quand' = When; 'est-ce que vous allez au cinéma ?' = are you going to the cinema?"
      },
      {
        id: "w3d17_ex6",
        kind: "translate",
        prompt: "Translate into French: 'How much does it cost?' (use 'ça coûte')",
        answer: "Combien ça coûte ?",
        accept: [
          "Combien ça coûte",
          "Combien ca coute ?",
          "Combien ca coute",
          "Combien est-ce que ça coûte ?"
        ],
        explanation: "'Combien ça coûte ?' or 'Combien est-ce que ça coûte ?'."
      }
    ],
    useItPrompt: "Ask your Speed Friending partners or the bistro waiter at least two questions starting with 'Est-ce que…', 'Qu'est-ce que…', or 'Où / Pourquoi…'.",
    skills: ["smalltalk", "ordering"],
    domains: ["hobbies_leisure", "town_places_directions"]
  },
  {
    id: "w3d18_possessives_family",
    day: 18,
    week: 3,
    title: "Possessive Adjectives (mon/ma/mes, ton/ta/tes, votre/vos) & Family",
    subtitle: "Talking about your family, friends, and belongings",
    explanation: [
      "In English, 'my' never changes ('my brother', 'my sister', 'my parents'). In French, possessive adjectives agree with the NOUN POSSESSED (not with the owner!): 'mon frère' (masculine), 'ma sœur' (feminine), 'mes parents' (plural).",
      "Here are the three sets you'll use most: My = 'mon / ma / mes'; Your (informal tu) = 'ton / ta / tes'; Your (polite vous) = 'votre / votre / vos'.",
      "Important pronunciation rule: before a feminine singular noun that starts with a vowel or mute h (like 'amie', 'histoire', 'adresse'), 'ma/ta/sa' switches to 'mon/ton/son' so the words flow smoothly: 'mon amie' (my female friend)!"
    ],
    keyPoints: [
      { fr: "mon père / ma mère / mes parents", en: "my father / my mother / my parents", note: "mon (m.), ma (f.), mes (pl.)" },
      { fr: "ton frère / ta sœur / tes amis", en: "your brother / your sister / your friends (tu)", note: "ton (m.), ta (f.), tes (pl.)" },
      { fr: "votre famille / vos enfants", en: "your family / your children (vous)", note: "votre (singular m./f.), vos (plural)" },
      { fr: "son mari / sa femme / ses enfants", en: "his or her husband / wife / children", note: "son/sa/ses depends on the noun's gender, not the owner!" },
      { fr: "mon amie (f.)", en: "my (female) friend", note: "Use mon/ton/son before feminine nouns starting with a vowel" }
    ],
    examples: [
      { fr: "Voici ma mère, mon père et mon frère Lucas.", en: "Here is my mother, my father, and my brother Lucas." },
      { fr: "Est-ce que ta sœur habite aussi à Paris ?", en: "Does your sister also live in Paris?" },
      { fr: "Comment s'appelle votre fille, Madame Rousseau ?", en: "What is your daughter's name, Madame Rousseau?" },
      { fr: "Je vais au parc avec mon amie Camille.", en: "I am going to the park with my friend Camille." }
    ],
    exercises: [
      {
        id: "w3d18_ex1",
        kind: "mcq",
        prompt: "Since 'sœur' (sister) is feminine, how do you say 'my sister'?",
        options: ["ma sœur", "mon sœur", "mes sœur", "la sœur"],
        answer: "ma sœur",
        explanation: "'Ma' is the feminine singular possessive for 'my'."
      },
      {
        id: "w3d18_ex2",
        kind: "gap",
        prompt: "Fill in 'my' before masculine 'frère': « ___ frère habite à Lyon. »",
        answer: "Mon",
        accept: ["mon"],
        explanation: "'Mon' is used before masculine singular nouns."
      },
      {
        id: "w3d18_ex3",
        kind: "mcq",
        prompt: "How do you say 'my (female) friend' ('amie' starts with a vowel)?",
        options: ["mon amie", "ma amie", "m'amie", "mes amie"],
        answer: "mon amie",
        explanation: "Before a feminine noun starting with a vowel, 'ma' changes to 'mon' for smooth pronunciation."
      },
      {
        id: "w3d18_ex4",
        kind: "gap",
        prompt: "Ask Madame Rousseau politely about 'your daughter' ('fille', singular): « Où habite ___ fille ? »",
        answer: "votre",
        explanation: "For polite 'vous', 'your' before any singular noun is 'votre'."
      },
      {
        id: "w3d18_ex5",
        kind: "tiles",
        prompt: "Arrange the words to say 'My parents live in the United States':",
        options: ["Mes", "parents", "habitent", "aux", "États-Unis."],
        answer: "Mes parents habitent aux États-Unis.",
        explanation: "'Mes parents' (plural) + 'habitent aux États-Unis'."
      },
      {
        id: "w3d18_ex6",
        kind: "listen",
        prompt: "Listen and identify who the speaker is talking about:",
        audioFr: "Mon frère a vingt-cinq ans et ma sœur a trente ans.",
        options: [
          "Their brother (25) and their sister (30)",
          "Their father (55) and their mother (50)",
          "Their son (15) and their daughter (13)",
          "Their two brothers in Paris"
        ],
        answer: "Their brother (25) and their sister (30)",
        explanation: "'Mon frère a vingt-cinq ans' (25) + 'ma sœur a trente ans' (30)."
      }
    ],
    useItPrompt: "Tell Madame Rousseau or a friend about a family member using 'mon/ma/mes', and ask about theirs using 'ton/ta/tes' or 'votre/vos'.",
    skills: ["smalltalk", "intro"],
    domains: ["family_people"]
  },
  {
    id: "w3d19_time_routines",
    day: 19,
    week: 3,
    title: "Telling Time, Days of the Week & Daily Routines (se lever, se coucher)",
    subtitle: "Scheduling meetups and describing your morning and evening routine",
    explanation: [
      "To tell time in French, use 'Il est + number + heure(s)': 'Il est huit heures' (It's 8:00), 'Il est neuf heures et demie' (It's 9:30), 'Il est midi' (It's noon), 'Il est minuit' (It's midnight). To say 'at' a specific time, use 'à': 'Rendez-vous à quatorze heures' (Meet at 2:00 PM / 14h00).",
      "Daily routines often use reflexive verbs — verbs with a little pronoun ('me, te, se, nous, vous') that shows you do the action to yourself: 'Je me lève à sept heures' (I get up at 7:00), 'Je me prépare' (I get ready), 'Je me couche à vingt-deux heures' (I go to bed at 10:00 PM).",
      "To talk about days of the week ('lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche'), use the day bare for 'on Monday' ('lundi') or with 'le' for a recurring habit ('le samedi, je vais au marché' = on Saturdays)."
    ],
    keyPoints: [
      { fr: "Quelle heure est-il ? — Il est huit heures.", en: "What time is it? — It is 8 o'clock.", note: "Use midi for noon and minuit for midnight" },
      { fr: "à midi / à dix-neuf heures / à huit heures et demie", en: "at noon / at 7 PM / at 8:30", note: "Use 'à' for 'at [time]'" },
      { fr: "Je me lève / Tu te lèves", en: "I get up / You get up", note: "Reflexive verb se lever" },
      { fr: "Je me couche tôt / tard", en: "I go to bed early / late", note: "Reflexive verb se coucher" },
      { fr: "ce matin / cet après-midi / ce soir", en: "this morning / this afternoon / this evening", note: "Essential for planning outings" }
    ],
    examples: [
      { fr: "Le matin, je me lève à sept heures et demie.", en: "In the morning, I get up at 7:30." },
      { fr: "On se retrouve au parc à quatorze heures ?", en: "Shall we meet at the park at 2:00 PM?" },
      { fr: "Le soir, nous dînons à vingt heures et je me couche tôt.", en: "In the evening, we eat dinner at 8:00 PM and I go to bed early." },
      { fr: "Samedi après-midi, je vais au cinéma.", en: "Saturday afternoon, I'm going to the movies." }
    ],
    exercises: [
      {
        id: "w3d19_ex1",
        kind: "mcq",
        prompt: "How do you say 'at 8 o'clock' in French?",
        options: [
          "à huit heures",
          "en huit heures",
          "sur huit heures",
          "il est huit heures"
        ],
        answer: "à huit heures",
        explanation: "'Il est huit heures' means 'It is 8:00', while 'à huit heures' means 'at 8:00'."
      },
      {
        id: "w3d19_ex2",
        kind: "gap",
        prompt: "Fill in the reflexive pronoun for 'je': « Le matin, je ___ lève à sept heures. »",
        answer: "me",
        explanation: "With 'je', the reflexive pronoun is 'me': 'je me lève'."
      },
      {
        id: "w3d19_ex3",
        kind: "mcq",
        prompt: "What does 'Il est midi et demi' mean?",
        options: [
          "It is 12:30 PM (half past noon).",
          "It is 12:30 AM (half past midnight).",
          "It is 12:15 PM.",
          "It is 2:30 PM."
        ],
        answer: "It is 12:30 PM (half past noon).",
        explanation: "'Midi' is noon (12 PM) and 'et demi' is half past."
      },
      {
        id: "w3d19_ex4",
        kind: "tiles",
        prompt: "Put the words in order to say 'In the evening, I go to bed at ten o'clock':",
        options: ["Le", "soir,", "je", "me", "couche", "à", "dix", "heures."],
        answer: "Le soir, je me couche à dix heures.",
        explanation: "'Le soir, je me couche à dix heures.'"
      },
      {
        id: "w3d19_ex5",
        kind: "listen",
        prompt: "Listen and identify when they are meeting at the café:",
        audioFr: "Rendez-vous samedi après-midi à quinze heures devant le bistro.",
        options: [
          "Saturday afternoon at 3:00 PM (15h00)",
          "Sunday morning at 10:00 AM",
          "Friday evening at 5:00 PM",
          "Saturday evening at 8:00 PM"
        ],
        answer: "Saturday afternoon at 3:00 PM (15h00)",
        explanation: "'samedi après-midi à quinze heures' = Saturday afternoon at 15h00 (3:00 PM)."
      },
      {
        id: "w3d19_ex6",
        kind: "translate",
        prompt: "Translate into French: 'this afternoon'",
        answer: "cet après-midi",
        accept: ["cet apres-midi", "cet apres midi"],
        explanation: "'Cet après-midi' (uses 'cet' because 'après-midi' starts with a vowel)."
      }
    ],
    useItPrompt: "Mention what time you wake up or propose a time for an outing ('cet après-midi', 'à quatorze heures', 'ce soir').",
    skills: ["smalltalk", "numbers"],
    domains: ["time_days_dates", "home_routine"]
  },
  {
    id: "w3d20_modals_invitations",
    day: 20,
    week: 3,
    title: "Modal Verbs (vouloir, pouvoir, devoir) & Accepting/Making Invitations",
    subtitle: "Inviting a friend to the park, cinema, or café and agreeing on a plan",
    explanation: [
      "Three modal verbs unlock social plans in French because they are followed directly by any infinitive verb: 'vouloir' (to want), 'pouvoir' (to be able to / can), and 'devoir' (to have to / must).",
      "Learn their 'je / tu / on / vous' forms by heart: 'je veux / tu veux / vous voulez' (want), 'je peux / tu peux / vous pouvez' (can), and 'je dois / tu dois / vous devez' (must).",
      "You can also use 'On + verb' ('On va au parc ?', 'On prend un café ?') to suggest 'Shall we…?'! When a friend at Speed Friending invites you to the park, cinema, or sport, accept warmly with 'Oui, avec plaisir !', 'Bonne idée !', or 'D'accord, j'aimerais bien !' to unlock the outing for the next morning!"
    ],
    keyPoints: [
      { fr: "Tu veux aller au parc ? / Vous voulez… ?", en: "Do you want to go to the park?", note: "vouloir + infinitive verb" },
      { fr: "Je peux venir demain matin.", en: "I can come tomorrow morning.", note: "pouvoir + infinitive verb" },
      { fr: "Je dois rentrer chez Madame Rousseau.", en: "I have to go back to Madame Rousseau's.", note: "devoir + infinitive verb" },
      { fr: "On va au cinéma demain ?", en: "Shall we go to the movies tomorrow?", note: "'On' is used constantly in spoken French for 'we'" },
      { fr: "Oui, avec plaisir ! / Bonne idée ! / D'accord !", en: "Yes, with pleasure! / Good idea! / Okay!", note: "Phrases that seal an outing invitation" }
    ],
    examples: [
      { fr: "Tu veux aller au parc avec moi demain matin ? — Oui, avec plaisir !", en: "Do you want to go to the park with me tomorrow morning? — Yes, with pleasure!" },
      { fr: "Est-ce que tu peux venir au cinéma cet après-midi ?", en: "Can you come to the movie theater this afternoon?" },
      { fr: "On fait du sport ensemble demain ? — Bonne idée, d'accord !", en: "Shall we play sports together tomorrow? — Good idea, deal!" },
      { fr: "Désolé, ce soir je dois cuisiner avec Madame Rousseau.", en: "Sorry, tonight I have to cook with Madame Rousseau." }
    ],
    exercises: [
      {
        id: "w3d20_ex1",
        kind: "mcq",
        prompt: "How do you ask a friend 'Do you want to go to the cinema?'",
        options: [
          "Tu veux aller au cinéma ?",
          "Tu veux vas au cinéma ?",
          "Tu peux allé au cinéma ?",
          "Tu dois aller le cinéma ?"
        ],
        answer: "Tu veux aller au cinéma ?",
        explanation: "'Tu veux' (you want) is followed by the infinitive 'aller'."
      },
      {
        id: "w3d20_ex2",
        kind: "gap",
        prompt: "Complete the sentence with 'can' (pouvoir) for 'je': « Oui, je ___ venir demain matin ! »",
        answer: "peux",
        explanation: "With 'je', 'pouvoir' is 'je peux'."
      },
      {
        id: "w3d20_ex3",
        kind: "mcq",
        prompt: "What does « Je dois acheter du pain » mean?",
        options: [
          "I have to buy some bread.",
          "I can buy some bread.",
          "I want to buy some bread.",
          "I like buying bread."
        ],
        answer: "I have to buy some bread.",
        explanation: "'Je dois' (from 'devoir') means 'I must / I have to'."
      },
      {
        id: "w3d20_ex4",
        kind: "tiles",
        prompt: "Put the words in order to enthusiastically accept an invitation:",
        options: ["Oui,", "avec", "plaisir,", "bonne", "idée !"],
        answer: "Oui, avec plaisir, bonne idée !",
        explanation: "'Oui, avec plaisir, bonne idée !'"
      },
      {
        id: "w3d20_ex5",
        kind: "listen",
        prompt: "Listen to the invitation and identify what the friend is proposing:",
        audioFr: "Dis, tu veux faire une promenade au parc avec moi demain matin ?",
        options: [
          "Going for a walk in the park together tomorrow morning",
          "Watching a movie tonight at 8 PM",
          "Having dinner at the Auberge on Sunday",
          "Shopping for groceries this afternoon"
        ],
        answer: "Going for a walk in the park together tomorrow morning",
        explanation: "'tu veux faire une promenade au parc avec moi demain matin ?'."
      },
      {
        id: "w3d20_ex6",
        kind: "translate",
        prompt: "Translate into French: 'Yes, with pleasure!'",
        answer: "Oui, avec plaisir !",
        accept: ["Oui, avec plaisir", "Oui avec plaisir !", "Oui avec plaisir"],
        explanation: "'Oui, avec plaisir !' is the warmest, most natural way to accept an invitation."
      }
    ],
    useItPrompt: "Go to Speed Friending today! Invite your partner or accept their invitation to the park, cinema, or sport using 'Tu veux aller… ?' and 'Oui, avec plaisir !'.",
    skills: ["smalltalk"],
    domains: ["hobbies_leisure", "time_days_dates"]
  },
  {
    id: "w3d21_week3_review",
    day: 21,
    week: 3,
    title: "Week 3 Consolidation: Friends, Places, Routines & Plans",
    subtitle: "Bringing together aller, faire, questions, possessives, time, and invitations",
    explanation: [
      "Félicitations ! By the end of Week 3, you can navigate village places ('aller au / à la / à l' / chez'), talk about hobbies and weather ('faire du…', 'jouer au…', 'il fait beau'), ask real questions ('Est-ce que', 'Où', 'Quand', 'Pourquoi'), introduce family ('mon/ma/mes'), tell time, and make plans with 'vouloir / pouvoir / devoir'.",
      "Notice how these pieces combine into a complete social conversation: greet someone, ask what they like to do ('Qu'est-ce que tu aimes faire ?'), suggest an outing ('Tu veux aller au parc demain à dix heures ?'), and confirm ('Oui, avec plaisir !').",
      "Complete this review to prepare for today's village outing and your Week 3 Exam."
    ],
    keyPoints: [
      { fr: "aller au / à la / à l' / chez", en: "going to places & people's homes", note: "je vais, tu vas, il/elle/on va, nous allons, vous allez" },
      { fr: "faire du vélo / jouer au tennis / il fait beau", en: "activities & weather", note: "je fais, tu fais, il fait, vous faites" },
      { fr: "Où / Quand / Pourquoi / Qu'est-ce que", en: "core question words", note: "Pair with 'est-ce que' for effortless word order" },
      { fr: "mon, ma, mes / ton, ta, tes / votre, vos", en: "possessive adjectives", note: "Matches the gender/number of the noun possessed" },
      { fr: "je veux / je peux / je dois + infinitive", en: "want / can / must + verb", note: "Accept plans with 'Oui, avec plaisir !'" }
    ],
    examples: [
      { fr: "Demain matin, il fait beau : tu veux aller au parc avec moi à dix heures ?", en: "Tomorrow morning the weather is nice: do you want to go to the park with me at 10:00?" },
      { fr: "Ma sœur aime faire du vélo et mon frère joue au foot.", en: "My sister likes cycling and my brother plays soccer." },
      { fr: "À quelle heure est-ce que tu te lèves le dimanche ?", en: "What time do you get up on Sundays?" },
      { fr: "Je dois aller chez le pharmacien avant midi.", en: "I have to go to the pharmacist's before noon." }
    ],
    exercises: [
      {
        id: "w3d21_ex1",
        kind: "mcq",
        prompt: "Complete the invitation: « Est-ce que tu ___ aller ___ cinéma avec moi ce soir ? »",
        options: [
          "veux / au",
          "vas / à le",
          "peux / à la",
          "fais / au"
        ],
        answer: "veux / au",
        explanation: "'Tu veux aller' (Do you want to go) + 'au cinéma' (à + le cinéma)."
      },
      {
        id: "w3d21_ex2",
        kind: "gap",
        prompt: "Fill in the possessive for 'my (female) friend': « Je prends un café avec ___ amie Chloé. »",
        answer: "mon",
        explanation: "Before feminine singular 'amie' (starts with a vowel), use 'mon'."
      },
      {
        id: "w3d21_ex3",
        kind: "gap",
        prompt: "Conjugate 'faire' for 'vous': « Qu'est-ce que vous ___ cet après-midi ? »",
        answer: "faites",
        explanation: "'Vous faites' is the polite/plural form of 'faire'."
      },
      {
        id: "w3d21_ex4",
        kind: "listen",
        prompt: "Listen and select the correct summary of the plan:",
        audioFr: "Il fait très beau ! On se retrouve au parc à quatorze heures pour faire une promenade ?",
        options: [
          "The weather is great; let's meet at the park at 2:00 PM for a walk.",
          "It's cold outside; let's meet at the cinema at 4:00 PM.",
          "They are meeting at the bakery at 8:00 AM for croissants.",
          "They have to stay home at 2:00 PM to cook."
        ],
        answer: "The weather is great; let's meet at the park at 2:00 PM for a walk.",
        explanation: "'Il fait très beau' + 'au parc à quatorze heures (2 PM) pour faire une promenade'."
      },
      {
        id: "w3d21_ex5",
        kind: "tiles",
        prompt: "Build the question 'Where do your parents live?':",
        options: ["Où", "est-ce", "que", "tes", "parents", "habitent ?"],
        answer: "Où est-ce que tes parents habitent ?",
        explanation: "'Où est-ce que tes parents habitent ?'"
      },
      {
        id: "w3d21_ex6",
        kind: "translate",
        prompt: "Translate into French: 'I have to go to the bakery.'",
        answer: "Je dois aller à la boulangerie.",
        accept: [
          "Je dois aller à la boulangerie",
          "Je dois aller a la boulangerie.",
          "Je dois aller a la boulangerie"
        ],
        explanation: "'Je dois aller' + 'à la boulangerie'."
      }
    ],
    useItPrompt: "Enjoy your outing or Speed Friending conversation today before sitting your Week 3 Exam!",
    skills: ["smalltalk", "numbers"],
    domains: ["hobbies_leisure", "time_days_dates", "family_people", "town_places_directions"]
  },

  // ============================================================================
  // WEEK 4 — PAST, FUTURE, HEALTH & MASTERY (Days 22–28)
  // ============================================================================
  {
    id: "w4d22_futur_proche",
    day: 22,
    week: 4,
    title: "The Near Future (Le Futur Proche: aller + infinitive)",
    subtitle: "Talking about what you are going to do tonight, tomorrow, and next week",
    explanation: [
      "Good news: because you already know the verb 'aller' ('je vais, tu vas, il/elle/on va, nous allons, vous allez, ils/elles vont'), you can immediately talk about the future in French!",
      "To form the 'futur proche' (near future), simply pair the present tense of 'aller' with any infinitive verb: 'Je vais cuisiner ce soir' (I am going to cook tonight), 'Tu vas adorer ce film' (You are going to love this movie), 'Nous allons dîner à l'Auberge' (We are going to have dinner at the Inn).",
      "To make a near-future sentence negative, wrap 'ne … pas' around the conjugated form of 'aller': 'Je ne vais pas sortir ce soir' (I'm not going to go out tonight)."
    ],
    keyPoints: [
      { fr: "Je vais + infinitive", en: "I am going to + verb", note: "Je vais manger, Je vais visiter, Je vais prendre" },
      { fr: "Tu vas / Il va / On va + infinitive", en: "You are going to / He is going to / We are going to", note: "On va préparer une salade" },
      { fr: "Nous allons / Vous allez + infinitive", en: "We are going to / You are going to", note: "Qu'est-ce que vous allez prendre ?" },
      { fr: "Je ne vais pas + infinitive", en: "I am not going to + verb", note: "ne … pas wraps around aller" },
      { fr: "demain / ce soir / bientôt / la semaine prochaine", en: "tomorrow / tonight / soon / next week", note: "Future time markers" }
    ],
    examples: [
      { fr: "Ce soir, nous allons préparer une soupe à l'oignon avec Madame Rousseau.", en: "Tonight, we are going to prepare an onion soup with Madame Rousseau." },
      { fr: "Demain matin, je vais acheter des croissants chauds.", en: "Tomorrow morning, I am going to buy warm croissants." },
      { fr: "Qu'est-ce que vous allez commander comme dessert ?", en: "What are you going to order for dessert?" },
      { fr: "Il va pleuvoir cet après-midi, je ne vais pas sortir.", en: "It is going to rain this afternoon; I am not going to go out." }
    ],
    exercises: [
      {
        id: "w4d22_ex1",
        kind: "mcq",
        prompt: "How do you say 'I am going to cook tonight'?",
        options: [
          "Je vais cuisiner ce soir.",
          "Je vais cuisine ce soir.",
          "J'allons cuisiner ce soir.",
          "Je cuisiner vais ce soir."
        ],
        answer: "Je vais cuisiner ce soir.",
        explanation: "Conjugated 'aller' ('Je vais') + infinitive ('cuisiner')."
      },
      {
        id: "w4d22_ex2",
        kind: "gap",
        prompt: "Complete the waiter's question ('What are you going to take?'): « Qu'est-ce que vous ___ prendre ? »",
        answer: "allez",
        explanation: "With 'vous', 'aller' is 'vous allez' + infinitive 'prendre'."
      },
      {
        id: "w4d22_ex3",
        kind: "mcq",
        prompt: "Where does 'ne … pas' go in the near future ('I am not going to eat')?",
        options: [
          "Je ne vais pas manger.",
          "Je vais ne manger pas.",
          "Je ne vais manger pas.",
          "Ne je vais pas manger."
        ],
        answer: "Je ne vais pas manger.",
        explanation: "'Ne … pas' wraps around the conjugated verb ('vais')."
      },
      {
        id: "w4d22_ex4",
        kind: "tiles",
        prompt: "Arrange the words to say 'Tomorrow, we are going to visit the village':",
        options: ["Demain,", "nous", "allons", "visiter", "le", "village."],
        answer: "Demain, nous allons visiter le village.",
        explanation: "'Demain, nous allons visiter le village.'"
      },
      {
        id: "w4d22_ex5",
        kind: "listen",
        prompt: "Listen and identify what the speaker is going to do tomorrow:",
        audioFr: "Demain soir, je vais dîner à l'Auberge avec mes amis.",
        options: [
          "Have dinner at the Inn with friends tomorrow evening",
          "Eat breakfast at home tomorrow morning",
          "Go to the supermarket tomorrow afternoon",
          "Cook pasta with Madame Rousseau tonight"
        ],
        answer: "Have dinner at the Inn with friends tomorrow evening",
        explanation: "'Demain soir, je vais dîner à l'Auberge avec mes amis.'"
      },
      {
        id: "w4d22_ex6",
        kind: "translate",
        prompt: "Translate into French: 'I am going to take a coffee.' (use 'prendre')",
        answer: "Je vais prendre un café.",
        accept: [
          "Je vais prendre un café",
          "Je vais prendre un cafe.",
          "Je vais prendre un cafe"
        ],
        explanation: "'Je vais prendre un café.'"
      }
    ],
    useItPrompt: "Tell Madame Rousseau or the waiter what you are going to do or order using 'Je vais + infinitive' and 'On va + infinitive'.",
    skills: ["smalltalk", "ordering"],
    domains: ["time_days_dates", "hobbies_leisure", "restaurant"]
  },
  {
    id: "w4d23_passe_compose_avoir",
    day: 23,
    week: 4,
    title: "The Past Tense (Passé Composé with avoir)",
    subtitle: "Telling Madame Rousseau what you ate, bought, saw, and did today",
    explanation: [
      "At dinner every evening, Madame Rousseau asks about your day! To talk about completed actions in the past, French uses the 'passé composé' (compound past), built from two parts: (1) the present tense of 'avoir' ('j'ai, tu as, il/elle/on a, nous avons, vous avez, ils/elles ont') + (2) the past participle.",
      "For all regular '-er' verbs, form the past participle by replacing '-er' with '-é' (pronounced exactly like '-er'!): 'manger' -> 'j'ai mangé' (I ate), 'acheter' -> 'j'ai acheté' (I bought), 'parler' -> 'j'ai parlé' (I spoke), 'visiter' -> 'j'ai visité' (I visited).",
      "Also learn four super-useful irregular past participles: 'faire' -> 'fait' ('j'ai fait' I did/made), 'prendre' -> 'pris' ('j'ai pris' I took/had), 'voir' -> 'vu' ('j'ai vu' I saw), and 'boire' -> 'bu' ('j'ai bu' I drank)."
    ],
    keyPoints: [
      { fr: "j'ai mangé / j'ai acheté / j'ai parlé", en: "I ate / I bought / I spoke", note: "-er verbs change to -é" },
      { fr: "tu as aimé ? / vous avez passé une bonne journée ?", en: "did you like? / did you have a good day?", note: "avoir + past participle" },
      { fr: "j'ai fait / j'ai pris", en: "I did (made) / I took (had)", note: "Key irregular participles: faire -> fait, prendre -> pris" },
      { fr: "j'ai vu / j'ai bu", en: "I saw / I drank", note: "voir -> vu, boire -> bu" },
      { fr: "hier / ce matin / cet après-midi", en: "yesterday / this morning / this afternoon", note: "Past time markers" }
    ],
    examples: [
      { fr: "Ce matin, j'ai acheté une baguette et j'ai parlé avec Marie.", en: "This morning, I bought a baguette and I spoke with Marie." },
      { fr: "À midi, j'ai pris le plat du jour au bistro.", en: "At noon, I had the daily special at the bistro." },
      { fr: "Nous avons vu un très bon film au cinéma.", en: "We saw a very good movie at the cinema." },
      { fr: "Qu'est-ce que tu as fait aujourd'hui ?", en: "What did you do today?" }
    ],
    exercises: [
      {
        id: "w4d23_ex1",
        kind: "mcq",
        prompt: "How do you say 'I bought a croissant' in the passé composé?",
        options: [
          "J'ai acheté un croissant.",
          "Je suis acheté un croissant.",
          "J'ai acheter un croissant.",
          "Je acheté un croissant."
        ],
        answer: "J'ai acheté un croissant.",
        explanation: "'J'ai' (present of avoir) + 'acheté' (past participle of acheter)."
      },
      {
        id: "w4d23_ex2",
        kind: "gap",
        prompt: "Write the past participle of 'manger': « À midi, j'ai ___ au bistro. »",
        answer: "mangé",
        accept: ["mange"],
        explanation: "Regular -er verbs drop '-er' and add '-é': 'mangé'."
      },
      {
        id: "w4d23_ex3",
        kind: "mcq",
        prompt: "What is the past participle of 'faire' in « Qu'est-ce que tu as ___ aujourd'hui ? »",
        options: ["fait", "fais", "fairé", "faisu"],
        answer: "fait",
        explanation: "The past participle of 'faire' is 'fait' ('j'ai fait', 'tu as fait')."
      },
      {
        id: "w4d23_ex4",
        kind: "gap",
        prompt: "Complete with the past participle of 'prendre': « J'ai ___ un café en terrasse. »",
        answer: "pris",
        explanation: "The past participle of 'prendre' is 'pris'."
      },
      {
        id: "w4d23_ex5",
        kind: "tiles",
        prompt: "Arrange the words to say 'I saw a good movie with my friend':",
        options: ["J'ai", "vu", "un", "bon", "film", "avec", "mon", "ami."],
        answer: "J'ai vu un bon film avec mon ami.",
        explanation: "'J'ai vu' (I saw) + 'un bon film avec mon ami'."
      },
      {
        id: "w4d23_ex6",
        kind: "listen",
        prompt: "Listen to what the speaker did this morning:",
        audioFr: "Ce matin, j'ai fait du vélo et j'ai acheté des tomates chez Gérard.",
        options: [
          "They rode a bike and bought tomatoes at Gérard's.",
          "They ate breakfast and went to the movies.",
          "They cooked soup and drank tea.",
          "They are going to buy tomatoes tomorrow."
        ],
        answer: "They rode a bike and bought tomatoes at Gérard's.",
        explanation: "'j'ai fait du vélo' (rode a bike) + 'j'ai acheté des tomates chez Gérard' (bought tomatoes)."
      }
    ],
    useItPrompt: "At dinner tonight, tell Madame Rousseau at least two things you did today using 'J'ai acheté…', 'J'ai parlé…', 'J'ai pris…', or 'J'ai fait…'.",
    skills: ["smalltalk"],
    domains: ["home_routine", "time_days_dates"]
  },
  {
    id: "w4d24_passe_compose_etre",
    day: 24,
    week: 4,
    title: "Passé Composé of Movement (être) & Describing Experiences (C'était…)",
    subtitle: "Saying where you went and how it was ('Je suis allé(e)… C'était super !')",
    explanation: [
      "While most verbs use 'avoir' in the past, a special group of movement verbs — going, arriving, leaving, entering, returning — uses 'être' ('je suis, tu es, il/elle est, nous sommes, vous êtes, ils/elles sont') as their helper verb!",
      "The #1 verb in this group is 'aller': 'Je suis allé(e) au parc' (I went to the park), 'Je suis arrivé(e)' (I arrived), 'Je suis parti(e)' (I left), 'Je suis rentré(e)' (I came back home). When conjugated with 'être', the past participle adds '-e' if the speaker is feminine and '-s' if plural.",
      "Whenever you tell someone where you went, pair it with 'C'était + adjective' (It was…) to share how you liked it: 'Je suis allé au bistro. C'était délicieux !', 'Nous sommes allés au parc. C'était très calme et agréable !'"
    ],
    keyPoints: [
      { fr: "Je suis allé(e) au parc / au cinéma.", en: "I went to the park / to the cinema.", note: "aller uses être in the passé composé!" },
      { fr: "Je suis arrivé(e) / Je suis parti(e) / Je suis rentré(e)", en: "I arrived / I left / I returned home", note: "Core movement verbs with être" },
      { fr: "Nous sommes allés / Vous êtes allé(e)(s)", en: "We went / You went", note: "Add -s for plural subjects" },
      { fr: "C'était super ! / C'était délicieux !", en: "It was great! / It was delicious!", note: "Always use 'C'était + masculine singular adjective' for 'It was…'" },
      { fr: "Il faisait beau.", en: "The weather was nice.", note: "Past weather description" }
    ],
    examples: [
      { fr: "Cet après-midi, je suis allé au cinéma avec Lucas. C'était génial !", en: "This afternoon, I went to the movies with Lucas. It was awesome!" },
      { fr: "Hier, nous sommes allés à l'Auberge et c'était délicieux.", en: "Yesterday, we went to the Inn and it was delicious." },
      { fr: "À quelle heure est-ce que tu es rentré hier soir ?", en: "What time did you get back home last night?" },
      { fr: "Je suis allée au marché ce matin ; il faisait très beau.", en: "I (f.) went to the market this morning; the weather was very nice." }
    ],
    exercises: [
      {
        id: "w4d24_ex1",
        kind: "mcq",
        prompt: "How do you say 'I went to the park' in French?",
        options: [
          "Je suis allé au parc.",
          "J'ai allé au parc.",
          "Je vais allé au parc.",
          "Je suis aller au parc."
        ],
        answer: "Je suis allé au parc.",
        explanation: "'Aller' uses 'être' in the passé composé: 'Je suis allé(e)'."
      },
      {
        id: "w4d24_ex2",
        kind: "gap",
        prompt: "Complete the reaction 'It was delicious!': « ___ délicieux ! »",
        answer: "C'était",
        accept: ["C etait", "C'etait", "c'était"],
        explanation: "'C'était' means 'It was'."
      },
      {
        id: "w4d24_ex3",
        kind: "mcq",
        prompt: "Which helper verb does 'rentrer' (to return home) take in « Je ___ rentré à vingt heures »?",
        options: ["suis", "ai", "vais", "fais"],
        answer: "suis",
        explanation: "'Rentrer' (to go back in/home) is a movement verb and takes 'être': 'Je suis rentré(e)'."
      },
      {
        id: "w4d24_ex4",
        kind: "tiles",
        prompt: "Arrange the words to say 'I went to the bistro and it was very good':",
        options: ["Je", "suis", "allé", "au", "bistro", "et", "c'était", "très", "bon."],
        answer: "Je suis allé au bistro et c'était très bon.",
        explanation: "'Je suis allé au bistro' + 'et c'était très bon.'"
      },
      {
        id: "w4d24_ex5",
        kind: "listen",
        prompt: "Listen and choose where the speaker went and how they found it:",
        audioFr: "Hier soir, nous sommes allés à l'Auberge. C'était magnifique !",
        options: [
          "They went to the Inn last night and it was wonderful.",
          "They are going to the Inn tomorrow night.",
          "They went to the cinema and it was boring.",
          "They stayed home last night because it rained."
        ],
        answer: "They went to the Inn last night and it was wonderful.",
        explanation: "'Hier soir, nous sommes allés à l'Auberge. C'était magnifique !'"
      },
      {
        id: "w4d24_ex6",
        kind: "translate",
        prompt: "Translate into French: 'It was very good!'",
        answer: "C'était très bon !",
        accept: [
          "C'était très bon",
          "C'etait tres bon !",
          "C'etait tres bon",
          "C'était très bien !"
        ],
        explanation: "'C'était très bon !'"
      }
    ],
    useItPrompt: "Tell Madame Rousseau where you went today using 'Je suis allé(e) au / à la…' and describe how it was with 'C'était… !'.",
    skills: ["smalltalk"],
    domains: ["hobbies_leisure", "time_days_dates"]
  },
  {
    id: "w4d25_health_avoir_mal",
    day: 25,
    week: 4,
    title: "Body, Health & Feeling Unwell (avoir mal à, il faut)",
    subtitle: "Helping someone who is sick, describing symptoms, and giving advice",
    explanation: [
      "What happens when someone in the house catches a cold or has a headache? In French, to say that a body part hurts, use the expression 'avoir mal à + definite article': 'J'ai mal à la tête' (I have a headache), 'J'ai mal à la gorge' (I have a sore throat), 'J'ai mal au ventre' (my stomach hurts), 'J'ai mal aux dents' (my teeth hurt).",
      "You can also describe general states with 'être' and 'avoir': 'Je suis fatigué(e)' (I'm tired), 'Je suis malade' (I'm sick), 'J'ai de la fièvre' (I have a fever), 'J'ai froid' (I feel cold), 'J'ai chaud' (I feel hot).",
      "To give caring advice or state what is needed, use 'Il faut + infinitive' or 'Il faut + noun': 'Il faut se reposer' (One must rest), 'Il faut boire une tisane chaude' (You need to drink hot herbal tea), 'Il faut du miel et du citron' (We need honey and lemon)."
    ],
    keyPoints: [
      { fr: "J'ai mal à la tête / à la gorge", en: "I have a headache / a sore throat", note: "avoir mal + à la (feminine body part)" },
      { fr: "J'ai mal au ventre / au dos", en: "My stomach / back hurts", note: "avoir mal + au (masculine body part)" },
      { fr: "Je suis fatigué(e) / Je suis malade", en: "I am tired / I am sick", note: "Adjectives with être" },
      { fr: "avoir froid / avoir chaud / avoir de la fièvre", en: "to feel cold / hot / to have a fever", note: "French uses avoir (not être!) for feeling cold/hot" },
      { fr: "Il faut se reposer / Il faut boire une tisane", en: "You need to rest / You need to drink herbal tea", note: "Il faut + infinitive or noun" }
    ],
    examples: [
      { fr: "Madame Rousseau est malade aujourd'hui : elle a mal à la gorge et elle a de la fièvre.", en: "Madame Rousseau is sick today: she has a sore throat and a fever." },
      { fr: "Il faut préparer une bonne soupe chaude et une tisane au miel.", en: "We need to prepare a good hot soup and a honey herbal tea." },
      { fr: "Comment vous sentez-vous ce soir ? — Ça va un peu mieux, merci.", en: "How do you feel this evening? — Doing a bit better, thank you." },
      { fr: "Reposez-vous bien, je vais faire la cuisine ce soir !", en: "Rest well, I am going to do the cooking tonight!" }
    ],
    exercises: [
      {
        id: "w4d25_ex1",
        kind: "mcq",
        prompt: "La tête (head) is feminine. How do you say 'I have a headache'?",
        options: [
          "J'ai mal à la tête.",
          "Je suis mal à la tête.",
          "J'ai mal au tête.",
          "Ma tête est mal."
        ],
        answer: "J'ai mal à la tête.",
        explanation: "'Avoir mal à la tête' = to have a headache."
      },
      {
        id: "w4d25_ex2",
        kind: "gap",
        prompt: "Le ventre (stomach) is masculine. Fill in the contracted preposition: « Il a mal ___ ventre. »",
        answer: "au",
        explanation: "'À + le' contracts to 'au': 'avoir mal au ventre'."
      },
      {
        id: "w4d25_ex3",
        kind: "mcq",
        prompt: "How do you say 'I feel cold' (of a person) in French?",
        options: [
          "J'ai froid.",
          "Je suis froid.",
          "Il fait froid à moi.",
          "Je fais froid."
        ],
        answer: "J'ai froid.",
        explanation: "People use 'avoir froid / avoir chaud' for feeling cold or hot ('Je suis froid' means having a cold personality!)."
      },
      {
        id: "w4d25_ex4",
        kind: "tiles",
        prompt: "Arrange the words to say 'You need to drink a hot herbal tea':",
        options: ["Il", "faut", "boire", "une", "tisane", "chaude."],
        answer: "Il faut boire une tisane chaude.",
        explanation: "'Il faut' + infinitive ('boire') + 'une tisane chaude'."
      },
      {
        id: "w4d25_ex5",
        kind: "listen",
        prompt: "Listen and identify what is wrong with Madame Rousseau:",
        audioFr: "Je suis un peu fatiguée et j'ai mal à la gorge ce matin.",
        options: [
          "She is a bit tired and has a sore throat this morning.",
          "She has a toothache and is going to the dentist.",
          "She feels great and is going to the market.",
          "She has a stomachache after dinner."
        ],
        answer: "She is a bit tired and has a sore throat this morning.",
        explanation: "'fatiguée' (tired) + 'j'ai mal à la gorge' (sore throat)."
      },
      {
        id: "w4d25_ex6",
        kind: "translate",
        prompt: "Translate into French: 'I am tired.'",
        answer: "Je suis fatigué.",
        accept: [
          "Je suis fatigué",
          "Je suis fatiguée.",
          "Je suis fatiguée",
          "Je suis fatigue",
          "Je suis fatiguee"
        ],
        explanation: "'Je suis fatigué(e).'"
      }
    ],
    useItPrompt: "Check on how people are feeling today and use 'avoir mal à…', 'fatigué(e)', or 'Il faut…' when caring for the household.",
    skills: ["smalltalk", "food"],
    domains: ["body_health", "kitchen_cooking"]
  },
  {
    id: "w4d26_dining_mastery",
    day: 26,
    week: 4,
    title: "Restaurant Mastery: Courses, Dietary Needs, Ordering & Paying the Bill",
    subtitle: "Handling the full 3-stage French restaurant ritual from table to l'addition",
    explanation: [
      "In a French bistro or auberge, dining has three distinct stages: (1) Ordering with the waiter ('En entrée, je vais prendre… Comme plat principal, je voudrais… Et comme boisson, une carafe d'eau'), (2) Enjoying your meal and commenting on the food ('C'est délicieux !'), and (3) Calling the waiter back to ask for the bill and pay ('Monsieur, s'il vous plaît ! L'addition, s'il vous plaît').",
      "You can ask for recommendations with 'Qu'est-ce que vous me conseillez ?' (What do you recommend?) or ask about ingredients with 'Est-ce qu'il y a de la viande dans ce plat ?' (Is there meat in this dish?).",
      "When paying, state the exact amount you are handing over ('Voici vingt euros') and say goodbye warmly ('Merci beaucoup, c'était très bon ! Bonne journée !')."
    ],
    keyPoints: [
      { fr: "En entrée / Comme plat principal / Comme dessert", en: "For the starter / As the main course / For dessert", note: "Structuring a multi-course order" },
      { fr: "Une carafe d'eau, s'il vous plaît.", en: "A pitcher of tap water, please.", note: "Free tap water at every French restaurant!" },
      { fr: "Qu'est-ce que vous conseillez ?", en: "What do you recommend?", note: "Great question for the waiter" },
      { fr: "Monsieur / Madame, s'il vous plaît !", en: "Excuse me, waiter!", note: "Polite way to call the waiter back to your table" },
      { fr: "L'addition, s'il vous plaît.", en: "The bill/check, please.", note: "Never 'le billet' (which means a banknote or ticket)" }
    ],
    examples: [
      { fr: "En entrée, je voudrais la soupe à l'oignon, et comme plat, le poulet rôti.", en: "For a starter, I would like the onion soup, and as a main course, the roast chicken." },
      { fr: "Est-ce que je peux avoir une carafe d'eau et un peu de pain ?", en: "May I have a pitcher of water and a little bread?" },
      { fr: "Monsieur, s'il vous plaît ! Nous voudrions l'addition.", en: "Sir, excuse me! We would like the bill." },
      { fr: "Voici vingt-cinq euros. Merci beaucoup, c'était délicieux !", en: "Here is twenty-five euros. Thank you very much, it was delicious!" }
    ],
    exercises: [
      {
        id: "w4d26_ex1",
        kind: "mcq",
        prompt: "What does 'une entrée' mean on a French restaurant menu?",
        options: [
          "A starter / appetizer (first course)",
          "The main course",
          "The restaurant entrance door",
          "A dessert"
        ],
        answer: "A starter / appetizer (first course)",
        explanation: "False friend alert: in France, 'une entrée' is the starter, while the main course is 'le plat principal'!"
      },
      {
        id: "w4d26_ex2",
        kind: "gap",
        prompt: "Ask for a free pitcher of tap water: « Une ___ d'eau, s'il vous plaît. »",
        answer: "carafe",
        explanation: "'Une carafe d'eau' is a pitcher of tap water."
      },
      {
        id: "w4d26_ex3",
        kind: "mcq",
        prompt: "When you have finished eating and want to pay, what do you ask the waiter?",
        options: [
          "L'addition, s'il vous plaît.",
          "La monnaie, s'il vous plaît.",
          "Le menu, s'il vous plaît.",
          "L'entrée, s'il vous plaît."
        ],
        answer: "L'addition, s'il vous plaît.",
        explanation: "'L'addition' is the restaurant bill."
      },
      {
        id: "w4d26_ex4",
        kind: "tiles",
        prompt: "Put the words in order to ask the waiter what they recommend:",
        options: ["Qu'est-ce", "que", "vous", "me", "conseillez ?"],
        answer: "Qu'est-ce que vous me conseillez ?",
        explanation: "'Qu'est-ce que vous me conseillez ?' = What do you recommend to me?"
      },
      {
        id: "w4d26_ex5",
        kind: "listen",
        prompt: "Listen to the customer's order and identify what they chose:",
        audioFr: "En entrée, je vais prendre la salade de chèvre chaud, et une carafe d'eau, s'il vous plaît.",
        options: [
          "Warm goat cheese salad as a starter, plus a pitcher of water",
          "Onion soup as a main course, plus red wine",
          "Roast chicken and apple tart for dessert",
          "Only a coffee and the bill"
        ],
        answer: "Warm goat cheese salad as a starter, plus a pitcher of water",
        explanation: "'En entrée, je vais prendre la salade de chèvre chaud, et une carafe d'eau'."
      },
      {
        id: "w4d26_ex6",
        kind: "translate",
        prompt: "Translate into French: 'The bill, please.'",
        answer: "L'addition, s'il vous plaît.",
        accept: [
          "L'addition, s'il vous plaît",
          "L'addition s'il vous plaît",
          "L'addition, s'il vous plait.",
          "L'addition s'il vous plait",
          "L addition s il vous plait"
        ],
        explanation: "'L'addition, s'il vous plaît.'"
      }
    ],
    useItPrompt: "Dine at Le Petit Bistro or L'Auberge du Pont today: order your meal politely, eat, call the waiter back, ask for 'l'addition', and pay the exact bill.",
    skills: ["ordering", "food", "numbers", "register"],
    domains: ["restaurant", "numbers_prices"]
  },
  {
    id: "w4d27_connectors_opinions",
    day: 27,
    week: 4,
    title: "Connectors, Opinions & Longer Answers (parce que, mais, donc, je pense que)",
    subtitle: "Linking your ideas into rich, natural French sentences",
    explanation: [
      "The difference between a hesitant beginner and a confident A1 speaker is the ability to connect two short thoughts into one smooth sentence! Instead of stopping after three words, use connectors: 'et' (and), 'mais' (but), 'ou' (or), 'parce que' (because), 'donc' (so/therefore), and 'ensuite / après' (then/afterward).",
      "To share your opinion about a film, a dish, or life in the village, start with 'Je pense que…' (I think that…), 'Je trouve que…' (I find that…), or 'À mon avis…' (In my opinion…).",
      "Notice how easy it is to build a 15-word answer: 'J'aime beaucoup ce village parce que les gens sont très sympathiques et la cuisine est délicieuse !'"
    ],
    keyPoints: [
      { fr: "mais / donc / parce que", en: "but / so (therefore) / because", note: "Core logical connectors" },
      { fr: "d'abord … ensuite … enfin", en: "first … then … finally", note: "Great for telling Madame about your day" },
      { fr: "Je pense que c'est très intéressant.", en: "I think that it's very interesting.", note: "que contracts to qu' before a vowel: Je pense qu'il fait beau" },
      { fr: "Je trouve que la soupe est excellente.", en: "I find that the soup is excellent.", note: "Expressing personal taste" },
      { fr: "surtout / aussi / ensemble", en: "especially / also / together", note: "Adds nuance to any sentence" }
    ],
    examples: [
      { fr: "D'abord, je suis allé à la boulangerie, et ensuite j'ai pris un café au bistro.", en: "First, I went to the bakery, and then I had a coffee at the bistro." },
      { fr: "Je pense que ce village est magnifique parce que tout le monde est très gentil.", en: "I think that this village is wonderful because everyone is very kind." },
      { fr: "Il pleut aujourd'hui, donc nous allons aller au cinéma.", en: "It's raining today, so we are going to go to the movies." },
      { fr: "J'aime toute la cuisine française, surtout le pain chaud et le fromage !", en: "I like all French food, especially warm bread and cheese!" }
    ],
    exercises: [
      {
        id: "w4d27_ex1",
        kind: "mcq",
        prompt: "Which connector means 'so / therefore' in « Il fait froid, ___ je prends une soupe chaude »?",
        options: ["donc", "mais", "ou", "surtout"],
        answer: "donc",
        explanation: "'Donc' means 'so / therefore'."
      },
      {
        id: "w4d27_ex2",
        kind: "gap",
        prompt: "Complete the opinion phrase 'I think that…': « Je ___ que ce film est super. »",
        answer: "pense",
        accept: ["trouve"],
        explanation: "'Je pense que…' (I think that…) or 'Je trouve que…' (I find that…)."
      },
      {
        id: "w4d27_ex3",
        kind: "mcq",
        prompt: "What does « d'abord … et ensuite … » mean when telling a story?",
        options: [
          "first … and then …",
          "never … and always …",
          "before … and why …",
          "maybe … and however …"
        ],
        answer: "first … and then …",
        explanation: "'D'abord' = first of all; 'ensuite' = next / then."
      },
      {
        id: "w4d27_ex4",
        kind: "tiles",
        prompt: "Arrange the words to say 'I love this village because it is very calm':",
        options: ["J'aime", "ce", "village", "parce", "qu'il", "est", "très", "calme."],
        answer: "J'aime ce village parce qu'il est très calme.",
        explanation: "'Parce que' contracts to 'parce qu'' before 'il'."
      },
      {
        id: "w4d27_ex5",
        kind: "listen",
        prompt: "Listen and identify the two activities the speaker did in sequence:",
        audioFr: "D'abord, j'ai acheté du fromage chez Gérard, et ensuite je suis rentré cuisiner.",
        options: [
          "First bought cheese at Gérard's, and then went home to cook",
          "First cooked dinner, and then went to the cinema",
          "First went to the park, and then ate at the bistro",
          "First drank coffee, and then went to sleep"
        ],
        answer: "First bought cheese at Gérard's, and then went home to cook",
        explanation: "'D'abord, j'ai acheté du fromage… et ensuite je suis rentré cuisiner.'"
      },
      {
        id: "w4d27_ex6",
        kind: "translate",
        prompt: "Translate into French: 'I think that it is very good.'",
        answer: "Je pense que c'est très bon.",
        accept: [
          "Je pense que c'est très bon",
          "Je pense que c est tres bon",
          "Je pense que c'est tres bon.",
          "Je pense que c'est très bien."
        ],
        explanation: "'Je pense que c'est très bon.'"
      }
    ],
    useItPrompt: "In every conversation today, link at least two clauses using 'parce que', 'mais', 'donc', 'ensuite', or 'je pense que'.",
    skills: ["smalltalk", "register"],
    domains: ["greetings_politeness", "hobbies_leisure"]
  },
  {
    id: "w4d28_final_synthesis",
    day: 28,
    week: 4,
    title: "Day 28 Grand Synthesis: Complete A1 Mastery",
    subtitle: "Bringing together present, past, and future French for your final day and Week 4 Exam",
    explanation: [
      "Félicitations ! You have reached Day 28 of your four-week stay in the village. Think back to Day 1 when you learned 'Bonjour' and 'un croissant' — today you can introduce yourself, shop at the bakery and grocery store, cook with Madame Rousseau, make friends, schedule outings, dine at a restaurant, and talk across past ('passé composé'), present, and future ('futur proche')!",
      "In your final conversations today and on your Week 4 Final Exam, aim to combine all three time frames naturally: (1) Present habits & feelings ('J'habite…, j'aime…'), (2) Past experiences ('Hier / Ce matin, j'ai acheté…, je suis allé(e)…, c'était…'), and (3) Future plans ('Ce soir / Demain, je vais…').",
      "Complete this final warm-up, enjoy your farewell celebration in the village, and take your Week 4 Final Exam!"
    ],
    keyPoints: [
      { fr: "Présent : Je suis, j'ai, je vais, je fais, je prends, je parle", en: "Present tense foundation", note: "Core irregulars + regular -er verbs" },
      { fr: "Passé composé : J'ai mangé / J'ai fait / Je suis allé(e)", en: "Past events & experiences", note: "Pair with 'C'était super / délicieux !'" },
      { fr: "Futur proche : Je vais cuisiner / Nous allons fêter ça", en: "Upcoming plans", note: "aller + infinitive" },
      { fr: "Articles : un/une/des, le/la/les, du/de la/de l' -> pas de", en: "Complete article system", note: "Remember 'aimer + le/la/les' and 'pas de' in negation" },
      { fr: "Connecteurs : parce que, mais, donc, d'abord, ensuite", en: "Fluid multi-clause speaking", note: "Express reasons and sequences" }
    ],
    examples: [
      { fr: "J'ai passé quatre semaines magnifiques ici, et j'ai beaucoup appris !", en: "I spent four wonderful weeks here, and I learned a lot!" },
      { fr: "Ce matin, je suis allé à la boulangerie, et ce soir nous allons dîner ensemble.", en: "This morning I went to the bakery, and tonight we are going to have dinner together." },
      { fr: "Merci pour tout, Madame Rousseau : votre cuisine est délicieuse et vous êtes très gentille.", en: "Thank you for everything, Madame Rousseau: your cooking is delicious and you are very kind." },
      { fr: "Je vais revenir en France l'année prochaine parce que j'adore ce village !", en: "I am going to come back to France next year because I love this village!" }
    ],
    exercises: [
      {
        id: "w4d28_ex1",
        kind: "mcq",
        prompt: "Choose the sentence that correctly combines past ('this morning') and near future ('tonight'):",
        options: [
          "Ce matin, je suis allé au marché, et ce soir je vais cuisiner.",
          "Ce matin, j'ai allé au marché, et ce soir je cuisine vais.",
          "Ce matin, je vais aller au marché, et ce soir j'ai cuisiné.",
          "Ce matin, je suis aller au marché, et ce soir je vais cuisiné."
        ],
        answer: "Ce matin, je suis allé au marché, et ce soir je vais cuisiner.",
        explanation: "'Je suis allé' (passé composé with être) + 'je vais cuisiner' (futur proche)."
      },
      {
        id: "w4d28_ex2",
        kind: "gap",
        prompt: "Fill in the negative article: « J'aime le café, mais je ne bois pas ___ café le soir. »",
        answer: "de",
        explanation: "After 'ne … pas', partitive 'du café' becomes 'de café'."
      },
      {
        id: "w4d28_ex3",
        kind: "gap",
        prompt: "Complete the thank-you to Madame Rousseau: « J'___ passé un séjour magnifique chez vous ! »",
        answer: "ai",
        explanation: "'J'ai passé' (I spent / had) uses 'avoir' in the passé composé."
      },
      {
        id: "w4d28_ex4",
        kind: "listen",
        prompt: "Listen to the speaker's farewell message and select the accurate summary:",
        audioFr: "Merci beaucoup Madame Rousseau ! J'ai adoré mon séjour dans le village et je vais revenir bientôt.",
        options: [
          "They loved their stay in the village and are going to come back soon.",
          "They just arrived in the village this morning and are looking for the bakery.",
          "They are sick today and cannot come to dinner.",
          "They didn't like the food and are leaving early."
        ],
        answer: "They loved their stay in the village and are going to come back soon.",
        explanation: "'J'ai adoré mon séjour' (loved my stay) + 'je vais revenir bientôt' (going to come back soon)."
      },
      {
        id: "w4d28_ex5",
        kind: "tiles",
        prompt: "Arrange the words to say 'Thank you for everything, it was delicious!':",
        options: ["Merci", "pour", "tout,", "c'était", "délicieux !"],
        answer: "Merci pour tout, c'était délicieux !",
        explanation: "'Merci pour tout, c'était délicieux !'"
      },
      {
        id: "w4d28_ex6",
        kind: "translate",
        prompt: "Translate into French: 'I learned a lot.' (use 'J'ai beaucoup appris')",
        answer: "J'ai beaucoup appris.",
        accept: [
          "J'ai beaucoup appris",
          "J ai beaucoup appris",
          "J'ai appris beaucoup",
          "J'ai appris beaucoup."
        ],
        explanation: "'J'ai beaucoup appris !' (from 'apprendre', past participle 'appris')."
      }
    ],
    useItPrompt: "Celebrate your final day in the village using past, present, and future tenses, then complete your Week 4 Final A1 Exam!",
    skills: ["register", "smalltalk", "food", "ordering", "intro", "numbers", "listening"],
    domains: [
      "greetings_politeness",
      "self_intro",
      "bakery_cafe",
      "food_grocery",
      "kitchen_cooking",
      "restaurant",
      "hobbies_leisure",
      "home_routine"
    ]
  }
];

export const GRAMMAR_BY_ID: Record<string, GrammarLesson> = Object.fromEntries(
  GRAMMAR_LESSONS.map((lesson) => [lesson.id, lesson])
);

export const GRAMMAR_BY_DAY: Record<number, GrammarLesson> = Object.fromEntries(
  GRAMMAR_LESSONS.map((lesson) => [lesson.day, lesson])
);
