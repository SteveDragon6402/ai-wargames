export type ShelfUnit = "left" | "right";

export interface ShopItem {
  id: string;
  /** What Gérard calls it, with the article he would use. */
  fr: string;
  /** The plain noun a learner writes in their carnet. */
  word: string;
  en: string;
  /** Price of one unit, in cents. */
  price: number;
  /** One unit, as Gérard sells it. */
  unitFr: string;
  /** Normalised word stems that count as Gérard naming the item. */
  keywords: string[];
  unit: ShelfUnit;
  shelf: 0 | 1 | 2;
  slot: number;
  /** Where on the shelf a customer would describe it. */
  look: string;
}

const RAW: Omit<ShopItem, "unit" | "shelf" | "slot">[][] = [
  [
    { id: "candle", fr: "une bougie", word: "la bougie", en: "a candle", price: 150, unitFr: "la bougie", keywords: ["bougie"], look: "a white candle" },
    { id: "envelope", fr: "une enveloppe", word: "l'enveloppe", en: "an envelope", price: 50, unitFr: "l'enveloppe", keywords: ["enveloppe"], look: "a white envelope" },
    { id: "soap", fr: "un savon de Marseille", word: "le savon", en: "a bar of Marseille soap", price: 280, unitFr: "le savon", keywords: ["savon"], look: "a bar of soap with bubbles" },
  ],
  [
    { id: "honey", fr: "un pot de miel", word: "le miel", en: "a jar of honey", price: 650, unitFr: "le pot", keywords: ["miel"], look: "a honey pot" },
    { id: "sardines", fr: "une boîte de sardines", word: "les sardines", en: "a tin of sardines", price: 290, unitFr: "la boîte", keywords: ["sardine"], look: "a tin can" },
    { id: "chocolate", fr: "une tablette de chocolat", word: "le chocolat", en: "a bar of chocolate", price: 230, unitFr: "la tablette", keywords: ["chocolat"], look: "a bar of chocolate" },
  ],
  [
    { id: "wine", fr: "une bouteille de vin rouge", word: "le vin rouge", en: "a bottle of red wine", price: 750, unitFr: "la bouteille", keywords: ["vin"], look: "a glass of red wine" },
    { id: "milk", fr: "une bouteille de lait", word: "le lait", en: "a bottle of milk", price: 140, unitFr: "la bouteille", keywords: ["lait"], look: "a glass of milk" },
    { id: "garlic", fr: "une tête d'ail", word: "l'ail", en: "a head of garlic", price: 80, unitFr: "la tête", keywords: ["ail"], look: "a head of garlic" },
  ],
  [
    { id: "baguette", fr: "une baguette", word: "la baguette", en: "a baguette", price: 110, unitFr: "la baguette", keywords: ["baguette"], look: "a long loaf of bread" },
    { id: "croissant", fr: "un croissant", word: "le croissant", en: "a croissant", price: 120, unitFr: "le croissant", keywords: ["croissant"], look: "a croissant" },
    { id: "eggs", fr: "une boîte de six œufs", word: "les œufs", en: "a box of six eggs", price: 260, unitFr: "la boîte de six", keywords: ["oeuf"], look: "an egg" },
  ],
  [
    { id: "camembert", fr: "un camembert", word: "le camembert", en: "a Camembert cheese", price: 380, unitFr: "le camembert", keywords: ["camembert", "fromage"], look: "a wedge of yellow cheese" },
    { id: "onion", fr: "un oignon", word: "l'oignon", en: "an onion", price: 50, unitFr: "l'oignon", keywords: ["oignon"], look: "a brown onion" },
    { id: "mushrooms", fr: "une barquette de champignons", word: "les champignons", en: "a punnet of mushrooms", price: 250, unitFr: "la barquette", keywords: ["champignon"], look: "a mushroom" },
  ],
  [
    { id: "apples", fr: "un kilo de pommes", word: "les pommes", en: "a kilo of apples", price: 290, unitFr: "le kilo", keywords: ["pomme"], look: "a red apple" },
    { id: "lemon", fr: "un citron", word: "le citron", en: "a lemon", price: 60, unitFr: "le citron", keywords: ["citron"], look: "a lemon" },
    { id: "tomatoes", fr: "des tomates", word: "les tomates", en: "half a kilo of tomatoes", price: 180, unitFr: "le demi-kilo", keywords: ["tomate"], look: "a red tomato" },
  ],
];

export const ITEMS: ShopItem[] = RAW.flatMap((row, index) =>
  row.map((item, slot) => ({
    ...item,
    unit: (index < 3 ? "left" : "right") as ShelfUnit,
    shelf: (index % 3) as 0 | 1 | 2,
    slot,
  })),
);

export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

export function itemIcon(id: string): string {
  return `/epicerie/items/${id}.png`;
}

const SHELF_NAMES = ["top", "middle", "bottom"] as const;

export function shelfPosition(item: ShopItem): string {
  const side = item.unit === "left" ? "left-hand" : "right-hand";
  const along = item.slot === 0 ? "left" : item.slot === 1 ? "middle" : "right";
  return `${SHELF_NAMES[item.shelf]} shelf of the ${side} shelves, ${along}`;
}
