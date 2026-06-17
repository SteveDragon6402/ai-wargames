import type {
  AttackIntention,
  MoveIntention,
  Speed,
  Stance,
  UnitType,
} from "@wargame/shared";

const NODE_DEFENSE: Record<string, number> = {
  fortified: 1.25,
  stronghold: 1.35,
  easy_defend: 1.15,
  hard_defend: 0.9,
  rugged: 1.1,
  open: 1.0,
  river_crossing: 0.95,
  fast_march: 1.0,
  industrial: 1.05,
  ambush: 1.12,
  capital_rohan: 1.2,
  capital_isengard: 1.2,
};

export function nodeDefenseMultiplier(tags: string[]): number {
  let mult = 1;
  for (const tag of tags) {
    const v = NODE_DEFENSE[tag];
    if (v && v > mult) mult = v;
  }
  return mult;
}

export function speedTier(speed: Speed): number {
  switch (speed) {
    case "forced":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
}

export function stanceAttackMult(stance: Stance): number {
  switch (stance) {
    case "aggressive":
      return 1.25;
    case "defensive":
      return 0.85;
    default:
      return 1;
  }
}

export function stanceDefenseMult(stance: Stance): number {
  switch (stance) {
    case "defensive":
      return 1.3;
    case "aggressive":
      return 0.85;
    default:
      return 1;
  }
}

export function moveIntentionAttackMult(intention: MoveIntention): number {
  switch (intention) {
    case "assault":
      return 1.15;
    case "attack":
      return 1.05;
    case "reinforce":
      return 0.95;
    default:
      return 1;
  }
}

export function attackIntentionAttackMult(intention: AttackIntention): number {
  switch (intention) {
    case "assault":
      return 1.15;
    case "breakthrough":
      return 1.2;
    case "defend":
      return 0.85;
    default:
      return 1;
  }
}

export function attackIntentionDefenseMult(intention: AttackIntention): number {
  switch (intention) {
    case "defend":
      return 1.25;
    default:
      return 1;
  }
}

export function speedDefenseBonus(faster: Speed, slower: Speed, bonus: number): number {
  if (speedTier(faster) > speedTier(slower)) return 1 + bonus;
  return 1;
}

// Thin fallback multiplier for unit type × terrain — only used when AI adjudication is unavailable.
// Values are modest nudges, not decisive outcomes.
export function unitTypeTerrainMult(unitType: UnitType | undefined, tags: string[]): number {
  if (!unitType) return 1;

  const isCavalry =
    unitType === "heavy_cavalry" ||
    unitType === "medium_cavalry" ||
    unitType === "light_cavalry";

  if (isCavalry) {
    if (tags.includes("plains") || tags.includes("open") || tags.includes("fast_march")) return 1.2;
    if (tags.includes("rugged") || tags.includes("ambush") || tags.includes("river_crossing")) return 0.8;
  }

  if (unitType === "shock_infantry") {
    if (tags.includes("rugged") || tags.includes("hard_defend")) return 1.1;
    if (tags.includes("plains") || tags.includes("open")) return 0.9;
  }

  if (unitType === "heavy_infantry") {
    if (tags.includes("fortified") || tags.includes("stronghold") || tags.includes("easy_defend")) return 1.1;
    if (tags.includes("plains") || tags.includes("open")) return 0.95;
  }

  return 1;
}
