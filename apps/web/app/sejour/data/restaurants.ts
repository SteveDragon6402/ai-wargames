export interface Dish {
  id: string;
  fr: string;
  en: string;
  price: number;
  kind: "food" | "drink";
}

export interface Restaurant {
  id: string;
  stopId: string;
  name: string;
  waiter: string;
  older: boolean;
  room: string;
  menu: Dish[];
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: "auberge",
    stopId: "auberge",
    name: "L'Auberge",
    waiter: "Serge",
    older: true,
    room: "A low room, a zinc bar, and the smell of butter.",
    menu: [
      { id: "soupe", fr: "la soupe du jour", en: "the soup", price: 700, kind: "food" },
      { id: "steak", fr: "le steak frites", en: "steak and chips", price: 1600, kind: "food" },
      { id: "tarte", fr: "la tarte aux pommes", en: "apple tart", price: 650, kind: "food" },
      { id: "rouge", fr: "un verre de rouge", en: "a glass of red", price: 400, kind: "drink" },
      { id: "eau", fr: "une carafe d'eau", en: "a carafe of water", price: 0, kind: "drink" },
      { id: "cafe", fr: "un café", en: "a coffee", price: 180, kind: "drink" },
    ],
  },
  {
    id: "quai",
    stopId: "quai",
    name: "Le Quai",
    waiter: "Amina",
    older: false,
    room: "A narrow place on the river, paper tablecloths.",
    menu: [
      { id: "moules", fr: "les moules", en: "mussels", price: 1400, kind: "food" },
      { id: "salade", fr: "la salade de chèvre", en: "a goat cheese salad", price: 1100, kind: "food" },
      { id: "glace", fr: "deux boules", en: "two scoops", price: 500, kind: "food" },
      { id: "blanc", fr: "un verre de blanc", en: "a glass of white", price: 450, kind: "drink" },
      { id: "sirop", fr: "un diabolo menthe", en: "mint syrup and lemonade", price: 300, kind: "drink" },
      { id: "eau", fr: "une carafe d'eau", en: "a carafe of water", price: 0, kind: "drink" },
    ],
  },
  {
    id: "terrasse",
    stopId: "terrasse",
    name: "La Terrasse",
    waiter: "Joël",
    older: true,
    room: "Tables on the square, under a plane tree.",
    menu: [
      { id: "omelette", fr: "l'omelette", en: "an omelette", price: 900, kind: "food" },
      { id: "croque", fr: "le croque-monsieur", en: "a toasted ham and cheese", price: 850, kind: "food" },
      { id: "fromage", fr: "l'assiette de fromage", en: "a plate of cheese", price: 1000, kind: "food" },
      { id: "biere", fr: "une bière", en: "a beer", price: 400, kind: "drink" },
      { id: "cafe", fr: "un café", en: "a coffee", price: 180, kind: "drink" },
      { id: "eau", fr: "une carafe d'eau", en: "a carafe of water", price: 0, kind: "drink" },
    ],
  },
];

export const RESTAURANT_BY_ID: Record<string, Restaurant> = Object.fromEntries(
  RESTAURANTS.map((restaurant) => [restaurant.id, restaurant]),
);

export function dishById(restaurantId: string, dishId: string): Dish | null {
  return RESTAURANT_BY_ID[restaurantId]?.menu.find((dish) => dish.id === dishId) ?? null;
}
