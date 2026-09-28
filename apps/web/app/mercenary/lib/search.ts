export type SearchFound = "nothing" | "bandits" | "camp";

export const SEARCH_SYSTEM = `You are judging a search through wild ground. You are not with either side.
A company is trying to find a band, and to find the camp where that band keeps what it has taken.
Give two whole numbers from 0 to 100: the chance they find the band, and the chance they find the camp.
If no band is left in the ground, the chance of finding the band is 0. The camp can still be hidden.
If they have searched this ground before, both chances should be higher than a first search. Each earlier search makes this one more likely. The chances compound. Give new numbers for this search.
Do not decide what they find. Call give_chances.`;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.floor(value)));
}

/**
 * One d100, three results. The camp occupies 1..camp, the band the next band-width, and the rest is nothing.
 * If the two chances sum past 100 they are scaled down so the roll still has a single face.
 * A band that is already gone cannot be found. That does not find the camp.
 */
export function resolveSearchRoll(roll: number, findBandits: number, findCamp: number, bandAlive: boolean): SearchFound {
  let camp = clamp(findCamp);
  let band = bandAlive ? clamp(findBandits) : 0;
  if (camp + band > 100) {
    const scale = 100 / (camp + band);
    camp = Math.floor(camp * scale);
    band = Math.floor(band * scale);
  }
  const face = Math.min(100, Math.max(1, Math.floor(roll)));
  if (face <= camp) return "camp";
  if (face <= camp + band) return "bandits";
  return "nothing";
}
