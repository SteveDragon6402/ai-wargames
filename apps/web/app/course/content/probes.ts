import type { ProbeSpec } from "@/app/course/types";

export const PROBES: ProbeSpec[] = [
  // ============================================================================
  // Speed-friending probes
  // ============================================================================
  {
    id: "sf_self_intro",
    scene: "speedfriending",
    days: [2, 10],
    unlessDomain: "self_intro",
    targetSlot: 1,
    note: "Start by warmly asking the guest their name, what they do in life, and where they live right now (« Comment tu t'appelles ? Qu'est-ce que tu fais dans la vie ? »).",
    description: "Probes basic self-introduction (name, occupation, living place) in speed-friending slot 1.",
  },
  {
    id: "sf_origin",
    scene: "speedfriending",
    days: [4, 14],
    unlessDomain: "countries_nationality",
    targetSlot: 2,
    note: "Early in the conversation, ask the guest where they are from (« Tu viens d'où ? ») and what their nationality is. If they hesitate, help them say « Je viens de… » or « Je suis… ».",
    description: "Probes country of origin and nationality in speed-friending slot 2.",
  },
  {
    id: "sf_hobbies",
    scene: "speedfriending",
    days: [6, 20],
    unlessDomain: "hobbies_leisure",
    targetSlot: 3,
    note: "Ask the guest what they like to do in their free time (« Qu'est-ce que tu aimes faire ? Tu fais du sport ou tu aimes le cinéma ? »).",
    description: "Probes hobbies, leisure activities, cinema, and sports in speed-friending slot 3.",
  },

  // ============================================================================
  // Bakery & Grocery probes
  // ============================================================================
  {
    id: "bakery_politeness",
    scene: "boulangerie",
    days: [1, 7],
    unlessDomain: "greetings_politeness",
    targetRole: "baker",
    note: "Wait for a polite greeting (« Bonjour Madame ») before serving, and gently prompt the customer to use « s'il vous plaît » and « merci, bonne journée » during the exchange.",
    description: "Probes polite greetings and courtesy formulas at the bakery.",
  },
  {
    id: "bakery_pastry_choice",
    scene: "boulangerie",
    days: [2, 9],
    unlessDomain: "bakery_cafe",
    targetRole: "baker",
    note: "After the customer asks for bread, enthusiastically offer warm pastries from the oven (« J'ai des croissants chauds, des pains au chocolat et une belle brioche aujourd'hui — qu'est-ce qui vous ferait plaisir ? »).",
    description: "Probes bakery items and ordering with « je voudrais » at the bakery.",
  },
  {
    id: "bakery_price",
    scene: "boulangerie",
    days: [3, 10],
    unlessDomain: "numbers_prices",
    targetRole: "baker",
    note: "Say the total price aloud in French words and ask the customer to repeat or confirm the amount in euros before paying.",
    description: "Probes numbers and euro prices when paying at the bakery.",
  },
  {
    id: "epicerie_ingredients",
    scene: "epicerie",
    days: [6, 16],
    unlessDomain: "food_grocery",
    targetRole: "grocer",
    note: "Ask the customer which fresh vegetables, dairy, or cheeses they need for dinner tonight (« Il vous faut des tomates, du beurre, des œufs ou un bon morceau de comté ? ») and have them name each item.",
    description: "Probes grocery and food items with Gérard at the counter grocery.",
  },

  // ============================================================================
  // Host, Meal, Cooking & Family probes
  // ============================================================================
  {
    id: "host_avoir_hunger_age",
    scene: "host",
    days: [5, 12],
    unlessGrammar: "w1d5_avoir",
    targetRole: "host",
    expect: "\\b(j'ai|je n'ai|faim|soif|ans)\\b",
    note: "Ask the guest if they are hungry or thirsty (« Tu as faim ? Tu as soif ? ») and naturally ask how old they are (« Au fait, tu as quel âge ? ») to practice expressions with avoir.",
    description: "Probes expressions with avoir (avoir faim/soif, age) with Madame.",
  },
  {
    id: "meal_cooking_tools",
    scene: "meal",
    days: [7, 16],
    unlessDomain: "kitchen_cooking",
    targetRole: "host",
    note: "Talk about how you prepared the meal together and ask the guest to pass or name items at the table and in the kitchen (« Peux-tu me passer le couteau et la cuillère ? Comment on a coupé et cuit les légumes dans la poêle ? »).",
    description: "Probes kitchen utensils and cooking verbs during a meal with Madame.",
  },
  {
    id: "host_negation_check",
    scene: "host",
    days: [11, 18],
    unlessGrammar: "w2d11_negation",
    targetRole: "host",
    expect: "\\b(ne |n'|pas|plus)\\b",
    note: "Ask two or three questions where the guest is likely to say no (« Est-ce que tu travailles aujourd'hui ? Est-ce qu'il reste du lait dans le frigo ? ») and encourage full negative sentences with « ne … pas ».",
    description: "Probes negation (ne...pas / ne...plus) in conversation with Madame.",
  },
  {
    id: "host_directions_aller",
    scene: "host",
    days: [15, 22],
    unlessGrammar: "w3d15_aller_places",
    targetRole: "host",
    expect: "\\b(je vais|on va|tu vas|vais au|vais à)\\b",
    note: "Ask the guest where they are going in the village today (« Où est-ce que tu vas cet après-midi ? Tu vas au parc, à la pharmacie ou au cinéma ? ») and ask how to get there from the house.",
    description: "Probes aller + au/à la/à l'/aux and village places with Madame.",
  },
  {
    id: "host_town_directions",
    scene: "host",
    days: [15, 24],
    unlessDomain: "town_places_directions",
    targetRole: "host",
    note: "Pretend a delivery person asked for directions and quiz the guest on how to get from the house to the place du village and the pharmacie using « tout droit », « à gauche », « à droite », and « à côté de ».",
    description: "Probes town places and giving directions in the village.",
  },
  {
    id: "family_sunday_lunch",
    scene: "family",
    days: [14, 25],
    unlessDomain: "family_people",
    targetRole: "family",
    note: "Introduce the family members at the table and ask the guest about their own family (« Tu as des frères et sœurs ? Comment s'appellent tes parents ? »).",
    description: "Probes family member vocabulary during the family lunch scene.",
  },
  {
    id: "meal_daily_routine",
    scene: "meal",
    days: [21, 28],
    unlessDomain: "home_routine",
    targetRole: "host",
    note: "Over breakfast or dinner, ask the guest about their daily routine at home (« À quelle heure tu te lèves le matin ? Qu'est-ce que tu fais avant de te coucher ? »).",
    description: "Probes daily routine and reflexive verbs around the home.",
  },

  // ============================================================================
  // Outings (Parc, Cinema, Sport)
  // ============================================================================
  {
    id: "parc_weather_describing",
    scene: "parc",
    days: [10, 28],
    unlessDomain: "weather_describing",
    targetRole: "friend",
    note: "Comment on the weather in the park and ask the guest to describe the weather and surroundings today (« Il fait beau aujourd'hui, non ? Comment est le temps chez toi d'habitude ? »).",
    description: "Probes weather expressions and descriptive adjectives during the park outing.",
  },
  {
    id: "cinema_time_schedule",
    scene: "cinema",
    days: [12, 28],
    unlessDomain: "time_days_dates",
    targetRole: "friend",
    note: "Discuss the movie screening schedule and ask what time it is, when the film starts, and which days of the week they are free (« À quelle heure commence la séance ? Quel jour on se revoit cette semaine ? »).",
    description: "Probes telling time, days of the week, and schedules at the cinema.",
  },
  {
    id: "sport_team_hobbies",
    scene: "sport",
    days: [12, 28],
    unlessDomain: "hobbies_leisure",
    targetRole: "friend",
    note: "Welcome the guest to the five-a-side football match, talk about the team (« notre équipe »), and ask what sports or games they like playing.",
    description: "Probes sports and team vocabulary during the football outing.",
  },

  // ============================================================================
  // Bistro, Auberge & Pharmacie probes
  // ============================================================================
  {
    id: "bistro_order_menu",
    scene: "bistro",
    days: [10, 26],
    unlessDomain: "restaurant",
    targetRole: "waiter",
    note: "Present the bistro's daily specials (« Aujourd'hui, nous avons la salade chèvre chaud et le steak-frites »), ask what they would like to order and drink (« Une carafe d'eau ? »), and prompt them to ask for « l'addition » at the end.",
    description: "Probes restaurant ordering, dishes, and asking for the bill at Le Petit Bistro.",
  },
  {
    id: "auberge_formal_dining",
    scene: "auberge",
    days: [20, 28],
    unlessDomain: "restaurant",
    targetRole: "waiter",
    note: "Address the guest formally with « vous », recommend the « soupe à l'oignon », « bœuf bourguignon », « magret de canard », and « crème brûlée », and ask for their full three-course order.",
    description: "Probes formal restaurant dining and classic French dishes at L'Auberge.",
  },
  {
    id: "pharmacie_symptoms_remedies",
    scene: "pharmacie",
    days: [18, 28],
    unlessDomain: "body_health",
    targetRole: "pharmacist",
    note: "Ask the customer to describe all of Madame's symptoms (« Qu'est-ce qui ne va pas ? Elle a mal à la gorge, mal à la tête ou de la fièvre ? ») before recommending « le sirop pour la toux », « les pastilles pour la gorge », « une tisane », and « un thermomètre ».",
    description: "Probes body parts, symptoms, and pharmacy remedies at the pharmacy.",
  },
];
