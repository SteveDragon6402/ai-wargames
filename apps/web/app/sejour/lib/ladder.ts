import type { Line } from "@/app/epicerie/lib/shop";

export interface Recipe {
  id: "eggs" | "tartines" | "omelette" | "soup";
  name: string;
  fr: string;
  /** 1-based morning this dish can first be suggested. */
  minDay: number;
  /** The dish that must already have been cooked. */
  needs?: Recipe["id"];
  lines: Line[];
  /** How she writes the list, in English. */
  note: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: "eggs",
    name: "fried eggs",
    fr: "des œufs au plat",
    minDay: 1,
    lines: [
      { itemId: "eggs", qty: 1 },
      { itemId: "butter", qty: 1 },
    ],
    note: ["A box of eggs", "Butter"],
  },
  {
    id: "tartines",
    name: "tartines",
    fr: "des tartines au miel",
    minDay: 3,
    needs: "eggs",
    lines: [
      { itemId: "baguette", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "honey", qty: 1 },
    ],
    note: ["A baguette", "Butter", "A jar of honey"],
  },
  {
    id: "omelette",
    name: "a mushroom omelette",
    fr: "une omelette aux champignons",
    minDay: 5,
    needs: "tartines",
    lines: [
      { itemId: "eggs", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "mushrooms", qty: 1 },
      { itemId: "onion", qty: 1 },
      { itemId: "garlic", qty: 1 },
    ],
    note: ["A box of eggs", "Butter", "Mushrooms", "An onion", "Garlic"],
  },
  {
    id: "soup",
    name: "onion soup",
    fr: "une soupe à l'oignon",
    minDay: 7,
    needs: "omelette",
    lines: [
      { itemId: "onion", qty: 3 },
      { itemId: "garlic", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "oil", qty: 1 },
      { itemId: "baguette", qty: 1 },
      { itemId: "camembert", qty: 1 },
      { itemId: "bay", qty: 1 },
    ],
    note: ["Three onions", "Garlic", "Butter", "Oil", "A baguette", "A camembert", "A bay leaf"],
  },
];

/** The highest dish whose day has arrived and whose previous dish has been cooked. */
export function suggestRecipe(day: number, cooked: readonly string[]): Recipe {
  const have = new Set(cooked);
  let best = RECIPES[0];
  for (const recipe of RECIPES) {
    if (day < recipe.minDay) continue;
    if (recipe.needs && !have.has(recipe.needs)) continue;
    best = recipe;
  }
  return best;
}
