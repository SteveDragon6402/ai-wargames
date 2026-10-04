import type { GameState } from "./types";

export function breadNow(state: GameState): number {
  const people = state.people.reduce((sum, person) => sum + person.bread, 0);
  const pools = state.groups.reduce((sum, group) => sum + group.poolBread, 0);
  const stores = state.stores.reduce((sum, store) => sum + store.bread, 0);
  const npcs = state.npcs.reduce((sum, npc) => sum + npc.bread, 0);
  const forces = state.forces.reduce((sum, force) => sum + force.supplyBread, 0);
  return people + pools + stores + npcs + forces + state.company.bread;
}

export function goldNow(state: GameState): number {
  const people = state.people.reduce((sum, person) => sum + person.gold, 0);
  const pools = state.groups.reduce((sum, group) => sum + group.poolGold, 0);
  const stores = state.stores.reduce((sum, store) => sum + store.gold, 0);
  const npcs = state.npcs.reduce((sum, npc) => sum + npc.gold, 0);
  return people + pools + stores + npcs + state.company.gold;
}

export function peopleNow(state: GameState): number {
  return state.people.length;
}

export function aliveCount(state: GameState, groupId?: string): number {
  return state.people.filter((person) => person.alive && (groupId === undefined || person.groupId === groupId) && !person.inForceId).length;
}

export function livingMembers(state: GameState, groupId: string): number {
  return state.people.filter((person) => person.alive && person.groupId === groupId && !person.inForceId).length;
}

export function takeBread(pool: { bread: number }, amount: number): number {
  const taken = Math.max(0, Math.min(pool.bread, Math.floor(amount)));
  pool.bread -= taken;
  return taken;
}

export function takeGold(pool: { gold: number }, amount: number): number {
  const taken = Math.max(0, Math.min(pool.gold, Math.floor(amount)));
  pool.gold -= taken;
  return taken;
}

export function giveBread(pool: { bread: number }, amount: number) {
  pool.bread += Math.max(0, Math.floor(amount));
}

export function giveGold(pool: { gold: number }, amount: number) {
  pool.gold += Math.max(0, Math.floor(amount));
}
