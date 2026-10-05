import type { World } from "../data/hollowmere";

/** Bread and gold that exist. A transfer does not change the totals. Eating and the wolves do. */
export function books(world: World): { bread: number; gold: number } {
  let bread = world.pack.bread;
  let gold = world.pack.gold;
  for (const person of world.people) {
    bread += person.bread;
    gold += person.gold;
  }
  for (const store of world.stores) {
    bread += store.bread;
    gold += store.gold;
  }
  if (world.company) {
    bread += world.company.bread;
    gold += world.company.gold;
  }
  return { bread, gold };
}

export function storeOf(world: World, id: World["stores"][number]["id"]) {
  const store = world.stores.find((item) => item.id === id);
  if (!store) throw new Error(`Missing store ${id}`);
  return store;
}
