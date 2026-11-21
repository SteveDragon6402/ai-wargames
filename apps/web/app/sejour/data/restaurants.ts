export interface Dish {
  id: string;
  fr: string;
  en: string;
  price: number;
  kind: "food" | "drink";
  icon: string;
}

export interface Restaurant {
  id: "bistro" | "auberge";
  tier: "casual" | "formal";
  name: string;
  waiter: string;
  voice: string;
  portrait: string;
  scene: string;
  older: boolean;
  room: string;
  menu: Dish[];
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: "bistro",
    tier: "casual",
    name: "Le Petit Bistro",
    waiter: "Théo",
    voice: "theo",
    portrait: "/sejour/v2/people/theo.jpg",
    scene: "/sejour/v2/scenes/bistro.jpg",
    older: false,
    room: "Small wooden tables, a chalkboard menu, and espresso steam from the bar.",
    menu: [
      { id: "croque", fr: "un croque-monsieur", en: "toasted ham and cheese", price: 950, kind: "food", icon: "🥪" },
      { id: "salade", fr: "une salade verte", en: "green salad", price: 650, kind: "food", icon: "🥗" },
      { id: "omelette_bistro", fr: "une omelette aux fines herbes", en: "herb omelette", price: 1100, kind: "food", icon: "🍳" },
      { id: "tarte", fr: "une part de tarte aux pommes", en: "slice of apple tart", price: 550, kind: "food", icon: "🥧" },
      { id: "cafe", fr: "un café express", en: "an espresso", price: 220, kind: "drink", icon: "☕" },
      { id: "limonade", fr: "une limonade fraîche", en: "a cold lemonade", price: 350, kind: "drink", icon: "🍋" },
      { id: "eau", fr: "une carafe d'eau", en: "a jug of tap water", price: 0, kind: "drink", icon: "💧" },
    ],
  },
  {
    id: "auberge",
    tier: "formal",
    name: "L'Auberge de la Loire",
    waiter: "Serge",
    voice: "serge",
    portrait: "/sejour/v2/people/serge.jpg",
    scene: "/sejour/v2/scenes/auberge.jpg",
    older: true,
    room: "White tablecloths, beeswax candles, dark wood panelling, and the quiet clink of silverware.",
    menu: [
      { id: "soupe", fr: "la soupe à l'oignon gratinée", en: "French onion soup", price: 950, kind: "food", icon: "🥣" },
      { id: "steak", fr: "le steak frites au poivre", en: "peppercorn steak and fries", price: 1850, kind: "food", icon: "🥩" },
      { id: "poisson", fr: "le filet de sandre au beurre blanc", en: "pike-perch fillet in butter sauce", price: 2100, kind: "food", icon: "🐟" },
      { id: "creme", fr: "la crème brûlée à la vanille", en: "vanilla crème brûlée", price: 800, kind: "food", icon: "🍮" },
      { id: "vin", fr: "un verre de Chinon rouge", en: "a glass of red Chinon wine", price: 650, kind: "drink", icon: "🍷" },
      { id: "eau_minerale", fr: "une bouteille d'eau minérale", en: "a bottle of mineral water", price: 400, kind: "drink", icon: "🍾" },
      { id: "cafe_allonge", fr: "un café allongé", en: "a long black coffee", price: 300, kind: "drink", icon: "☕" },
    ],
  },
];

export const RESTAURANT_BY_ID: Record<string, Restaurant> = Object.fromEntries(RESTAURANTS.map((place) => [place.id, place]));

export function dishById(restaurantId: string, dishId: string): Dish | undefined {
  return RESTAURANT_BY_ID[restaurantId]?.menu.find((dish) => dish.id === dishId);
}
