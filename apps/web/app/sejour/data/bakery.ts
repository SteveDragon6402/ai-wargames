export interface BakeryItem {
  id: string;
  fr: string;
  en: string;
  price: number;
  icon: string;
  image?: string;
}

export const BAKERY_ITEMS: BakeryItem[] = [
  { id: "baguette", fr: "une baguette tradition", en: "a traditional baguette", price: 120, icon: "🥖", image: "/epicerie/items/baguette.png" },
  { id: "pain_de_campagne", fr: "un pain de campagne", en: "a round country loaf", price: 240, icon: "🍞", image: "/sejour/v2/items/pain_de_campagne.png" },
  { id: "croissant", fr: "un croissant au beurre", en: "a butter croissant", price: 130, icon: "🥐", image: "/epicerie/items/croissant.png" },
  { id: "pain_au_chocolat", fr: "un pain au chocolat", en: "a chocolate pastry", price: 140, icon: "🍫", image: "/sejour/v2/items/pain_au_chocolat.png" },
  { id: "brioche", fr: "une brioche dorée", en: "a golden brioche", price: 280, icon: "🧁", image: "/sejour/v2/items/brioche.png" },
  { id: "tarte_pommes", fr: "une tartelette aux pommes", en: "an apple tartlet", price: 320, icon: "🥧", image: "/sejour/v2/items/tarte_pommes.png" },
];

export const BAKERY_BY_ID: Record<string, BakeryItem> = Object.fromEntries(BAKERY_ITEMS.map((item) => [item.id, item]));
