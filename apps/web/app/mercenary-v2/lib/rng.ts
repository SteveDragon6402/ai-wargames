/** Mulberry32. The game seed advances on `game.rng`, so a week can be replayed. */
export function nextRng(state: number): { value: number; next: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const next = (t ^ (t >>> 14)) >>> 0;
  return { value: next / 4294967296, next };
}

export function rollInt(state: number, min: number, max: number): { roll: number; next: number } {
  const span = max - min + 1;
  const drawn = nextRng(state);
  return { roll: min + Math.floor(drawn.value * span), next: drawn.next };
}

export function rollD100(state: number): { roll: number; next: number } {
  return rollInt(state, 1, 100);
}
