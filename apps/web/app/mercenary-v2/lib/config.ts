/** Tuning defaults from the spec. Change numbers here, not in the engine. */
export const CONFIG = {
  maxWeeks: 12,
  startGold: 120,
  startBread: 280,
  unitCap: 10,
  slotCount: 10,
  rationPerWeek: 7,
  defaultWage: 2,
  cavalryWage: 4,
  maxWage: 4,
  desertionMorale: 30,
  hungerMorale: 12,
  shortPayMorale: 8,
  fullPayMorale: 12,
  idleCondition: 3,
  restMorale: 10,
  restCondition: 12,
  restHeal: 2,
  freeloadAfter: 2,
  freeloadScore: -8,
  trainBread: 6,
  trainCondition: 8,
  trainMorale: 4,
  masterGold: 15,
  masterCondition: 8,
  repairGold: 12,
  repairCondition: 18,
  drinkGold: 2,
  innMessages: 6,
  workFieldBread: 8,
  workMerchantGold: 1,
  workVillageGoldHalf: 1,
  workCityGold: 1,
  wolfBread: 40,
  thornbackKillsMin: 1,
  thornbackKillsMax: 2,
  raidBreadShare: 0.35,
  pillageShare: 0.4,
  peasantKillOnPillage: 3,
  pursuitGuardMax: 15,
  pursuitLevyMax: 20,
  banditWeeksOfBread: 2,
  findClamp: [5, 95] as const,
  breadwinner: 1000,
  crownmarketRate: 2,
  winnerKill: 0.42,
  loserKill: 0.62,
  campFindOdds: 78,
  fennBread: 1100,
  raidScrap: 0.2,
} as const;

export const UNIT_TYPES = [
  { key: "spearmen", strengths: "Hold a line; beat charges and cavalry", weaknesses: "Slow; exposed to missiles in the open", wage: 2 },
  { key: "swordsmen", strengths: "Win close fights in woods and streets", weaknesses: "Lose to a braced spear line head-on", wage: 2 },
  { key: "archers", strengths: "Damage before contact; good from cover", weaknesses: "Fragile if caught in melee", wage: 2 },
  { key: "crossbowmen", strengths: "Punch through armour; easy to train from raw recruits", weaknesses: "Slow to reload; poor in rain", wage: 2 },
  { key: "cavalry", strengths: "Fast; flank and pursue; scout", weaknesses: "Useless in dense forest; costly to feed", wage: 4 },
] as const;

export const BANNER_COLORS = [
  { id: "azure", label: "Azure", hex: "#2C4C7C" },
  { id: "purpure", label: "Purpure", hex: "#5C3D6E" },
  { id: "sable", label: "Sable", hex: "#2B2622" },
  { id: "tenne", label: "Tenné", hex: "#8C5A2A" },
  { id: "murrey", label: "Murrey", hex: "#6E3048" },
] as const;

export const SIGILS = ["sword", "tower", "stag", "sun", "wolf", "ship", "tree", "star"] as const;

export const BACKGROUNDS = ["Deserter", "Noble's Bastard", "Former Quartermaster"] as const;

export const RECRUIT_STATS: Record<string, { morale: number; condition: number; trait?: string; readiness: number }> = {
  peasants: { morale: 55, condition: 60, trait: "untrained", readiness: -1 },
  "village-guards": { morale: 50, condition: 65, readiness: 1 },
  "crown-guards": { morale: 65, condition: 85, trait: "shield wall", readiness: 1 },
  nobles: { morale: 50, condition: 85, readiness: 0 },
};
