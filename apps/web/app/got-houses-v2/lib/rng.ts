/**
 * Seeded randomness.
 *
 * The reducer runs on both clients in a two-browser game, so anything random
 * has to land the same way in each. Every roll is keyed on facts both sides
 * already agree on — turn, hold, a man's name — rather than on a clock or a
 * call counter.
 */

/** FNV-1a over the seed string. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for deciding a man's luck. */
export function makeRng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One draw from a stable key. Same key, same answer, on every client. */
export function rollFor(key: string): number {
  return makeRng(key)();
}

/** True with probability `chance`, decided stably by `key`. */
export function chanceFor(key: string, chance: number): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return rollFor(key) < chance;
}
