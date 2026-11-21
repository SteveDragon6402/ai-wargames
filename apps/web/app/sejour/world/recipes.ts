import type { Line } from "@/app/epicerie/lib/shop";

export type UtensilId = "poele" | "casserole" | "saladier" | "assiette" | "planche" | "bol";

export interface Utensil {
  id: UtensilId;
  fr: string;
  en: string;
  icon: string;
  image?: string;
}

export const UTENSILS: Record<UtensilId, Utensil> = {
  poele: { id: "poele", fr: "la poêle", en: "the frying pan", icon: "🍳", image: "/sejour/v2/items/poele.png" },
  casserole: { id: "casserole", fr: "la casserole", en: "the saucepan", icon: "🍲", image: "/sejour/v2/items/casserole.png" },
  saladier: { id: "saladier", fr: "le saladier", en: "the salad bowl", icon: "🥗", image: "/sejour/v2/items/saladier.png" },
  assiette: { id: "assiette", fr: "l'assiette", en: "the plate", icon: "🍽️" },
  planche: { id: "planche", fr: "la planche", en: "the cutting board", icon: "🪵" },
  bol: { id: "bol", fr: "le bol", en: "the soup bowl", icon: "🥣" },
};

export interface CookingStep {
  /** What Madame says in French. */
  say: string;
  /** Plain English gloss shown if the player asks or needs a hint. */
  en: string;
  /** The item id the player drags (matches an ingredient or a utensil that now holds something). */
  item: string;
  itemFr: string;
  /** The utensil id they drop it onto. */
  into: UtensilId;
  /** Id of the resulting state on that utensil. */
  result: string;
  resultFr: string;
  resultIcon: string;
}

export type RecipeId = "tartines" | "eggs" | "tomatoes" | "omelette" | "soup";

export interface Recipe {
  id: RecipeId;
  name: string;
  fr: string;
  lines: Line[];
  /** How she writes the shopping list, in English. */
  note: string[];
  utensils: UtensilId[];
  steps: CookingStep[];
  /** Words to talk about while eating together. */
  mealWords: { fr: string; en: string }[];
}

export const RECIPES: Recipe[] = [
  {
    id: "tartines",
    name: "tartines with honey",
    fr: "des tartines au miel",
    lines: [
      { itemId: "baguette", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "honey", qty: 1 },
    ],
    note: ["A baguette", "Butter", "A jar of honey"],
    utensils: ["planche", "assiette"],
    steps: [
      {
        say: "Posez la baguette sur la planche, s'il vous plaît.",
        en: "Put the baguette on the cutting board, please.",
        item: "baguette",
        itemFr: "la baguette",
        into: "planche",
        result: "tranches",
        resultFr: "les tranches de pain",
        resultIcon: "🥖",
      },
      {
        say: "Maintenant, mettez le pain sur l'assiette.",
        en: "Now put the bread on the plate.",
        item: "tranches",
        itemFr: "les tranches de pain",
        into: "assiette",
        result: "pain_assiette",
        resultFr: "le pain sur l'assiette",
        resultIcon: "🍞",
      },
      {
        say: "Ajoutez le beurre sur le pain.",
        en: "Add the butter onto the bread.",
        item: "butter",
        itemFr: "le beurre",
        into: "assiette",
        result: "tartine_beurre",
        resultFr: "la tartine beurrée",
        resultIcon: "🧈",
      },
      {
        say: "Et enfin, mettez le miel sur l'assiette.",
        en: "And finally, put the honey on the plate.",
        item: "honey",
        itemFr: "le miel",
        into: "assiette",
        result: "tartine_miel",
        resultFr: "les tartines au miel",
        resultIcon: "🍯",
      },
    ],
    mealWords: [
      { fr: "C'est sucré.", en: "It's sweet." },
      { fr: "Le pain est frais.", en: "The bread is fresh." },
      { fr: "J'aime le miel.", en: "I like honey." },
    ],
  },
  {
    id: "eggs",
    name: "fried eggs",
    fr: "des œufs au plat",
    lines: [
      { itemId: "eggs", qty: 1 },
      { itemId: "butter", qty: 1 },
    ],
    note: ["A box of eggs", "Butter"],
    utensils: ["poele", "assiette"],
    steps: [
      {
        say: "Mettez le beurre dans la poêle.",
        en: "Put the butter in the frying pan.",
        item: "butter",
        itemFr: "le beurre",
        into: "poele",
        result: "beurre_poele",
        resultFr: "le beurre fondu",
        resultIcon: "🧈",
      },
      {
        say: "Cassez les œufs dans la poêle.",
        en: "Crack the eggs into the frying pan.",
        item: "eggs",
        itemFr: "les œufs",
        into: "poele",
        result: "oeufs_poele",
        resultFr: "les œufs qui cuisent",
        resultIcon: "🍳",
      },
      {
        say: "Servez les œufs sur l'assiette.",
        en: "Serve the eggs onto the plate.",
        item: "oeufs_poele",
        itemFr: "les œufs au plat",
        into: "assiette",
        result: "oeufs_assiette",
        resultFr: "les œufs au plat",
        resultIcon: "🍽️",
      },
    ],
    mealWords: [
      { fr: "C'est chaud.", en: "It's hot." },
      { fr: "C'est très bon.", en: "It's very good." },
      { fr: "Les œufs sont parfaits.", en: "The eggs are perfect." },
    ],
  },
  {
    id: "tomatoes",
    name: "tomato salad",
    fr: "une salade de tomates",
    lines: [
      { itemId: "tomatoes", qty: 1 },
      { itemId: "onion", qty: 1 },
      { itemId: "oil", qty: 1 },
    ],
    note: ["Tomatoes", "An onion", "Olive oil"],
    utensils: ["planche", "saladier"],
    steps: [
      {
        say: "Coupez les tomates sur la planche.",
        en: "Cut the tomatoes on the board.",
        item: "tomatoes",
        itemFr: "les tomates",
        into: "planche",
        result: "tomates_coupees",
        resultFr: "les tomates coupées",
        resultIcon: "🍅",
      },
      {
        say: "Mettez les tomates dans le saladier.",
        en: "Put the tomatoes into the salad bowl.",
        item: "tomates_coupees",
        itemFr: "les tomates coupées",
        into: "saladier",
        result: "saladier_tomates",
        resultFr: "les tomates dans le saladier",
        resultIcon: "🥗",
      },
      {
        say: "Ajoutez l'oignon dans le saladier.",
        en: "Add the onion into the salad bowl.",
        item: "onion",
        itemFr: "l'oignon",
        into: "saladier",
        result: "saladier_oignon",
        resultFr: "les tomates et l'oignon",
        resultIcon: "🧅",
      },
      {
        say: "Versez l'huile dans le saladier.",
        en: "Pour the oil into the salad bowl.",
        item: "oil",
        itemFr: "l'huile",
        into: "saladier",
        result: "salade_tomates",
        resultFr: "la salade de tomates",
        resultIcon: "🥗",
      },
    ],
    mealWords: [
      { fr: "Les tomates sont mûres.", en: "The tomatoes are ripe." },
      { fr: "C'est frais.", en: "It's fresh." },
      { fr: "Passez-moi le pain, s'il vous plaît.", en: "Pass me the bread, please." },
    ],
  },
  {
    id: "omelette",
    name: "a mushroom omelette",
    fr: "une omelette aux champignons",
    lines: [
      { itemId: "eggs", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "mushrooms", qty: 1 },
      { itemId: "onion", qty: 1 },
      { itemId: "garlic", qty: 1 },
    ],
    note: ["A box of eggs", "Butter", "Mushrooms", "An onion", "Garlic"],
    utensils: ["planche", "poele", "assiette"],
    steps: [
      {
        say: "Coupez les champignons sur la planche.",
        en: "Slice the mushrooms on the board.",
        item: "mushrooms",
        itemFr: "les champignons",
        into: "planche",
        result: "champignons_coupes",
        resultFr: "les champignons coupés",
        resultIcon: "🍄",
      },
      {
        say: "Mettez le beurre dans la poêle.",
        en: "Put the butter in the frying pan.",
        item: "butter",
        itemFr: "le beurre",
        into: "poele",
        result: "beurre_poele",
        resultFr: "le beurre dans la poêle",
        resultIcon: "🧈",
      },
      {
        say: "Ajoutez les champignons coupés dans la poêle.",
        en: "Add the sliced mushrooms into the frying pan.",
        item: "champignons_coupes",
        itemFr: "les champignons coupés",
        into: "poele",
        result: "poele_champignons",
        resultFr: "les champignons dorés",
        resultIcon: "🍄",
      },
      {
        say: "Ajoutez l'oignon et l'ail dans la poêle.",
        en: "Add the onion into the frying pan.",
        item: "onion",
        itemFr: "l'oignon",
        into: "poele",
        result: "poele_oignon",
        resultFr: "l'oignon doré",
        resultIcon: "🧅",
      },
      {
        say: "Mettez l'ail dans la poêle.",
        en: "Put the garlic into the frying pan.",
        item: "garlic",
        itemFr: "l'ail",
        into: "poele",
        result: "poele_ail",
        resultFr: "la garniture parfumée",
        resultIcon: "🧄",
      },
      {
        say: "Versez les œufs dans la poêle.",
        en: "Pour the eggs into the frying pan.",
        item: "eggs",
        itemFr: "les œufs",
        into: "poele",
        result: "omelette_poele",
        resultFr: "l'omelette dans la poêle",
        resultIcon: "🍳",
      },
      {
        say: "Glissez l'omelette sur l'assiette.",
        en: "Slide the omelette onto the plate.",
        item: "omelette_poele",
        itemFr: "l'omelette",
        into: "assiette",
        result: "omelette_assiette",
        resultFr: "l'omelette aux champignons",
        resultIcon: "🍽️",
      },
    ],
    mealWords: [
      { fr: "Ça sent bon.", en: "That smells good." },
      { fr: "J'aime les champignons.", en: "I like mushrooms." },
      { fr: "On a bien cuisiné.", en: "We cooked well." },
    ],
  },
  {
    id: "soup",
    name: "onion soup",
    fr: "une soupe à l'oignon",
    lines: [
      { itemId: "onion", qty: 3 },
      { itemId: "garlic", qty: 1 },
      { itemId: "butter", qty: 1 },
      { itemId: "baguette", qty: 1 },
      { itemId: "camembert", qty: 1 },
    ],
    note: ["Three onions", "Garlic", "Butter", "A baguette", "Camembert"],
    utensils: ["planche", "casserole", "bol"],
    steps: [
      {
        say: "Coupez les oignons sur la planche.",
        en: "Chop the onions on the cutting board.",
        item: "onion",
        itemFr: "les oignons",
        into: "planche",
        result: "oignons_coupes",
        resultFr: "les oignons coupés",
        resultIcon: "🧅",
      },
      {
        say: "Mettez le beurre dans la casserole.",
        en: "Put the butter in the saucepan.",
        item: "butter",
        itemFr: "le beurre",
        into: "casserole",
        result: "beurre_casserole",
        resultFr: "le beurre fondu",
        resultIcon: "🧈",
      },
      {
        say: "Mettez les oignons dans la casserole.",
        en: "Put the chopped onions into the saucepan.",
        item: "oignons_coupes",
        itemFr: "les oignons coupés",
        into: "casserole",
        result: "soupe_casserole",
        resultFr: "la soupe qui mijote",
        resultIcon: "🍲",
      },
      {
        say: "Ajoutez l'ail dans la casserole.",
        en: "Add the garlic into the saucepan.",
        item: "garlic",
        itemFr: "l'ail",
        into: "casserole",
        result: "soupe_ail",
        resultFr: "le bouillon à l'ail",
        resultIcon: "🧄",
      },
      {
        say: "Versez la soupe dans le bol.",
        en: "Pour the soup into the bowl.",
        item: "soupe_casserole",
        itemFr: "la soupe",
        into: "bol",
        result: "soupe_bol",
        resultFr: "la soupe dans le bol",
        resultIcon: "🥣",
      },
      {
        say: "Posez la baguette sur le bol.",
        en: "Place the baguette on the bowl.",
        item: "baguette",
        itemFr: "la baguette",
        into: "bol",
        result: "soupe_croutons",
        resultFr: "les croûtons sur la soupe",
        resultIcon: "🥖",
      },
      {
        say: "Ajoutez le fromage sur le bol.",
        en: "Add the cheese onto the bowl.",
        item: "camembert",
        itemFr: "le camembert",
        into: "bol",
        result: "soupe_gratin",
        resultFr: "la soupe à l'oignon gratinée",
        resultIcon: "🧀",
      },
    ],
    mealWords: [
      { fr: "Attention, c'est très chaud.", en: "Careful, it's very hot." },
      { fr: "C'est délicieux.", en: "It's delicious." },
      { fr: "Encore un peu ?", en: "A little more?" },
    ],
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Next recipe to cook: the first one not yet cooked, or cycle through in order. */
export function suggestRecipe(cooked: readonly string[]): Recipe {
  const unseen = RECIPES.find((recipe) => !cooked.includes(recipe.id));
  if (unseen) return unseen;
  return RECIPES[cooked.length % RECIPES.length];
}

export function basketCovers(basket: readonly Line[], needed: readonly Line[]): boolean {
  return needed.every((need) => {
    const have = basket.reduce((sum, line) => (line.itemId === need.itemId ? sum + line.qty : sum), 0);
    return have >= need.qty;
  });
}
