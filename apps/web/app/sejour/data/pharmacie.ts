export interface PharmacieItem {
  id: string;
  fr: string;
  en: string;
  symptomFr: string;
  price: number;
  icon: string;
  neededForSickEvent: boolean;
}

export const PHARMACIE_ITEMS: PharmacieItem[] = [
  { id: "sirop", fr: "un sirop pour la toux", en: "cough syrup", symptomFr: "la toux (a cough)", price: 480, icon: "🧴", neededForSickEvent: true },
  { id: "pastilles", fr: "des pastilles pour la gorge", en: "throat lozenges", symptomFr: "mal à la gorge (sore throat)", price: 360, icon: "🍬", neededForSickEvent: true },
  { id: "tisane", fr: "une tisane au thym", en: "thyme herbal tea", symptomFr: "le rhume (a cold)", price: 290, icon: "🍵", neededForSickEvent: false },
  { id: "aspirine", fr: "du paracétamol", en: "paracetamol tablets", symptomFr: "la fièvre / mal à la tête", price: 220, icon: "💊", neededForSickEvent: false },
];

export const PHARMACIE_BY_ID: Record<string, PharmacieItem> = Object.fromEntries(PHARMACIE_ITEMS.map((item) => [item.id, item]));
