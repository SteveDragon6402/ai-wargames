import { linesTotal, makeChange, sumCoins } from "@/app/epicerie/lib/shop";
import type { OutingId, PlaceId } from "./places";
import type { Recipe } from "./recipes";

export function targetCentsFor(target: PlaceId | OutingId | "pharmacie", recipe?: Recipe | null): number {
  if (target === "boulangerie") return 600;
  if (target === "epicerie" || target === "supermarche") return (recipe ? linesTotal(recipe.lines) : 800) + 400;
  if (target === "bistro") return 2600;
  if (target === "auberge") return 4200;
  if (target === "pharmacie") return 1400;
  return 800;
}

/**
 * Madame hands over enough coins/notes for the outing. Any change left in the player's
 * purse stays with them and carries over between days.
 */
export function topUpWallet(current: readonly number[], target: PlaceId | OutingId | "pharmacie", recipe?: Recipe | null): { wallet: number[]; added: number } {
  const have = sumCoins([...current]);
  const needed = targetCentsFor(target, recipe);
  if (have >= needed) return { wallet: [...current], added: 0 };
  const diff = needed - have;
  // Round up to a neat 1€ or 2€ coin/note top-up
  const rounded = Math.ceil(diff / 100) * 100;
  const fresh = makeChange(rounded);
  return {
    wallet: [...current, ...fresh].sort((a, b) => b - a),
    added: rounded,
  };
}
