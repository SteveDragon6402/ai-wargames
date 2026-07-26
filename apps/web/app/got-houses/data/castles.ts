import type { Faction, Region } from "../types";
import { HOLDS } from "./holds";

export type SiteKind = "castle" | "ruin" | "open";

export interface CastleSeed {
  holdId: string;
  siteKind: SiteKind;
  /** Max men the walls can hold */
  capacity: number;
  /** Native / refill level (ruins = 0) */
  defaultGarrison: number;
  /** Rough days of food at default garrison under siege */
  defaultFoodDays: number;
}

/** Home allegiance from region seed. */
export function homeFactionForRegion(
  region: Region
): Faction | "hostile" {
  if (region === "north" || region === "riverlands") return "north";
  if (region === "westerlands" || region === "crownlands") return "westerlands";
  return "hostile";
}

function seed(
  holdId: string,
  siteKind: SiteKind,
  defaultGarrison: number,
  capacity: number,
  defaultFoodDays: number
): CastleSeed {
  return { holdId, siteKind, defaultGarrison, capacity, defaultFoodDays };
}

/**
 * Lore-tuned castle table. Ruins: Moat Cailin, Harrenhal (default 0).
 * Open: Clegane's Keep. All others castles with default < capacity.
 */
const OVERRIDES: Record<string, Omit<CastleSeed, "holdId">> = {
  // North
  "01": { siteKind: "castle", defaultGarrison: 1200, capacity: 4000, defaultFoodDays: 90 }, // Winterfell
  "02": { siteKind: "castle", defaultGarrison: 800, capacity: 2500, defaultFoodDays: 60 }, // Dreadfort
  "03": { siteKind: "castle", defaultGarrison: 1500, capacity: 5000, defaultFoodDays: 75 }, // White Harbor
  "04": { siteKind: "castle", defaultGarrison: 500, capacity: 1500, defaultFoodDays: 45 }, // Karhold
  "05": { siteKind: "castle", defaultGarrison: 600, capacity: 1800, defaultFoodDays: 40 }, // Last Hearth
  "06": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 35 }, // Deepwood Motte
  "07": { siteKind: "castle", defaultGarrison: 450, capacity: 1400, defaultFoodDays: 40 }, // Barrowton
  "08": { siteKind: "ruin", defaultGarrison: 0, capacity: 2000, defaultFoodDays: 20 }, // Moat Cailin
  // Vale
  "09": { siteKind: "castle", defaultGarrison: 1000, capacity: 3000, defaultFoodDays: 120 }, // Eyrie
  "10": { siteKind: "castle", defaultGarrison: 700, capacity: 2200, defaultFoodDays: 50 }, // Gates of the Moon
  "11": { siteKind: "castle", defaultGarrison: 500, capacity: 1500, defaultFoodDays: 45 },
  "12": { siteKind: "castle", defaultGarrison: 900, capacity: 3500, defaultFoodDays: 55 },
  "13": { siteKind: "castle", defaultGarrison: 450, capacity: 1400, defaultFoodDays: 40 },
  "14": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "15": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  // Riverlands
  "16": { siteKind: "castle", defaultGarrison: 900, capacity: 2800, defaultFoodDays: 70 }, // Riverrun
  "17": { siteKind: "castle", defaultGarrison: 800, capacity: 2400, defaultFoodDays: 55 }, // Twins
  "18": { siteKind: "ruin", defaultGarrison: 0, capacity: 3500, defaultFoodDays: 25 }, // Harrenhal
  "19": { siteKind: "castle", defaultGarrison: 500, capacity: 1600, defaultFoodDays: 45 },
  "20": { siteKind: "castle", defaultGarrison: 400, capacity: 1300, defaultFoodDays: 40 },
  "21": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  "22": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  // Westerlands
  "23": { siteKind: "castle", defaultGarrison: 2000, capacity: 6000, defaultFoodDays: 100 }, // Casterly Rock
  "24": { siteKind: "castle", defaultGarrison: 1800, capacity: 5500, defaultFoodDays: 70 }, // Lannisport
  "25": { siteKind: "castle", defaultGarrison: 700, capacity: 2000, defaultFoodDays: 60 }, // Golden Tooth
  "26": { siteKind: "castle", defaultGarrison: 500, capacity: 1500, defaultFoodDays: 45 },
  "27": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "28": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  "29": { siteKind: "open", defaultGarrison: 0, capacity: 0, defaultFoodDays: 0 }, // Clegane's Keep
  // Crownlands
  "30": { siteKind: "castle", defaultGarrison: 3000, capacity: 10000, defaultFoodDays: 80 }, // King's Landing
  "31": { siteKind: "castle", defaultGarrison: 800, capacity: 2500, defaultFoodDays: 90 }, // Dragonstone
  "32": { siteKind: "castle", defaultGarrison: 300, capacity: 900, defaultFoodDays: 30 },
  "33": { siteKind: "castle", defaultGarrison: 300, capacity: 900, defaultFoodDays: 30 },
  "34": { siteKind: "castle", defaultGarrison: 500, capacity: 1600, defaultFoodDays: 40 },
  "35": { siteKind: "castle", defaultGarrison: 250, capacity: 800, defaultFoodDays: 25 },
  "36": { siteKind: "castle", defaultGarrison: 280, capacity: 850, defaultFoodDays: 30 },
  // Stormlands
  "37": { siteKind: "castle", defaultGarrison: 1200, capacity: 3500, defaultFoodDays: 85 },
  "38": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  "39": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "40": { siteKind: "castle", defaultGarrison: 450, capacity: 1400, defaultFoodDays: 40 },
  "41": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "42": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "43": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 45 },
  // Reach
  "44": { siteKind: "castle", defaultGarrison: 1500, capacity: 4500, defaultFoodDays: 75 },
  "45": { siteKind: "castle", defaultGarrison: 2000, capacity: 6000, defaultFoodDays: 80 },
  "46": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  "47": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  "48": { siteKind: "castle", defaultGarrison: 500, capacity: 1500, defaultFoodDays: 45 },
  "49": { siteKind: "castle", defaultGarrison: 450, capacity: 1400, defaultFoodDays: 40 },
  "50": { siteKind: "castle", defaultGarrison: 400, capacity: 1200, defaultFoodDays: 40 },
  // Dorne
  "51": { siteKind: "castle", defaultGarrison: 1200, capacity: 3500, defaultFoodDays: 70 },
  "52": { siteKind: "castle", defaultGarrison: 500, capacity: 1500, defaultFoodDays: 45 },
  "53": { siteKind: "castle", defaultGarrison: 700, capacity: 2200, defaultFoodDays: 55 },
  "54": { siteKind: "castle", defaultGarrison: 300, capacity: 900, defaultFoodDays: 30 },
  "55": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
  "56": { siteKind: "castle", defaultGarrison: 300, capacity: 900, defaultFoodDays: 30 },
  "57": { siteKind: "castle", defaultGarrison: 350, capacity: 1100, defaultFoodDays: 35 },
};

export const CASTLE_SEEDS: CastleSeed[] = HOLDS.map((h) => {
  const o = OVERRIDES[h.id];
  if (o) return { holdId: h.id, ...o };
  return seed(h.id, "castle", 400, 1200, 40);
});

export const CASTLE_SEED_MAP = new Map(
  CASTLE_SEEDS.map((s) => [s.holdId, s])
);

export function getCastleSeed(holdId: string): CastleSeed {
  return (
    CASTLE_SEED_MAP.get(holdId) ??
    seed(holdId, "castle", 400, 1200, 40)
  );
}
