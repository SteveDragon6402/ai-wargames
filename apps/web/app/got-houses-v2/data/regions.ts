import type { Faction, Region } from "../types";

/**
 * Region identity: each of the four regions marches and fights differently.
 *
 * Hybrid by design (see docs/soft-mechanics.md). `blurb` is the only part the
 * player ever sees — a short statement of the region's character, deliberately
 * with no numbers attached. `marchSoft` / `fightSoft` / `favours` are
 * adjudicator-only inputs, so the effects stay soft and judgmental rather than
 * becoming a modifier table to min-max against.
 */
export interface RegionTrait {
  region: Region;
  /** Display name for UI. */
  name: string;
  /** Shown to the player — character, not numbers. */
  blurb: string;
  /** Adjudicator-only: how marching through this country feels. */
  marchSoft: string;
  /** Adjudicator-only: how a fight on this country tends to go. */
  fightSoft: string;
  /** Adjudicator-only: which faction is bred for this country, if either. */
  favours: Faction | null;
}

export const REGION_TRAITS: Record<Region, RegionTrait> = {
  north: {
    region: "north",
    name: "The North",
    blurb:
      "Vast, cold and thinly held. Northern hosts shelter and recover well here; southern hosts wear down. Long marches between few strongholds.",
    marchSoft:
      "Enormous distances between seats, few good roads, thin forage and hard cold. Northern-bred troops march it without complaint; hosts raised in the warm south lose men to cold, footrot and straggling long before they lose them to battle. Rest is genuinely restorative for northerners and barely restorative for anyone else.",
    fightSoft:
      "Open, exposed, freezing ground with little cover and little to plunder. Cold and fatigue matter more than clever manoeuvre; a host that arrived tired arrives beaten. Defenders who know the country pick their ground; attackers who do not wander into bog and blizzard.",
    favours: "north",
  },
  riverlands: {
    region: "riverlands",
    name: "The Riverlands",
    blurb:
      "The crossroads of the realm. Rich forage and good roads, but river crossings punish a disordered arrival and nothing here stays defensible for long.",
    marchSoft:
      "Short hops on decent roads through well-farmed country, so hosts move fast and eat well and neither side gains much from fatigue. The cost is the water: fords, bridges and ferry crossings string a column out badly, and a host that marched hard arrives in pieces on the far bank rather than in line.",
    fightSoft:
      "Open farmland broken by rivers and ditches. Whoever is already formed up when the other side is still crossing has an enormous advantage; approach order and posture matter more here than raw numbers. Nothing is naturally defensible, so ground rarely saves a beaten host — but neither side is worn down before it starts.",
    favours: null,
  },
  westerlands: {
    region: "westerlands",
    name: "The Westerlands",
    blurb:
      "Hill country and mine roads, wealthy and cramped. Narrow approaches favour whoever is already dug in; poor ground for massed cavalry.",
    marchSoft:
      "Steep, stony hill roads through mining country. Marches are slow and hard on horses and wagons, but villages are wealthy and supply is never the problem. Westermen know every pass; outsiders find the roads longer than the map suggests.",
    fightSoft:
      "Narrow valleys and defiles where a line cannot be extended and cavalry cannot be used properly. Numbers count for less than position: a smaller force holding a pass is genuinely dangerous, and a large host attacking into one cannot bring its weight to bear. Fortified defenders are very hard to shift.",
    favours: "westerlands",
  },
  crownlands: {
    region: "crownlands",
    name: "The Crownlands",
    blurb:
      "Dense, rich, roads everywhere. Fat garrisons behind strong walls, but everything is close, so a counterattack is never more than a march away.",
    marchSoft:
      "The best-roaded country in the realm — short marches, mild weather, abundant supply, and almost no attrition on either side. Hosts arrive fresh and in good order regardless of where they came from, which cuts both ways: so does the enemy.",
    fightSoft:
      "Close, cultivated, heavily settled ground with walls and towns everywhere. Field fights here are decided quickly and rarely turn into long pursuits, because a broken host is never far from somewhere to shelter. Garrisons are large and well provisioned but garrison troops are town levies, steadier behind walls than in the open.",
    favours: null,
  },
};

export function regionTrait(region: Region): RegionTrait {
  return REGION_TRAITS[region];
}

/**
 * Adjudicator-only summary of how this region treats the given faction.
 * Kept as one line so it slots into a prompt beside `ground` and `route`.
 */
export function regionSoftFor(region: Region, faction: Faction): string {
  const t = REGION_TRAITS[region];
  const fit =
    t.favours === null
      ? "This country favours neither side."
      : t.favours === faction
        ? "These men are bred for this country."
        : "These men are strangers to this country.";
  return `${t.name}: ${fit}`;
}
