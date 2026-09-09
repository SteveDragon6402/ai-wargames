import type {
  Army,
  BattleContext,
  Faction,
  ForceSummary,
  SideForce,
  UnitType,
} from "../types";

/**
 * Deterministic force arithmetic for a battle.
 *
 * The adjudicating models are good at judgement and bad at arithmetic, so every
 * number they might otherwise have to infer — side totals, per-type totals, the
 * strength ratio — is computed here in TypeScript and handed to them as a fact.
 * This is also what the fallback outcome and the "what mattered" strip read, so
 * it must stay pure and side-effect free.
 */

const UNIT_TYPES: UnitType[] = ["cavalry", "infantry", "archers"];

export function armyStrength(army: Army): number {
  return army.units.reduce((sum, u) => sum + u.count, 0);
}

function sideForce(armies: Army[], faction: Faction | "garrison"): SideForce {
  const byType: Record<UnitType, number> = { cavalry: 0, infantry: 0, archers: 0 };
  for (const army of armies) {
    for (const unit of army.units) {
      if (UNIT_TYPES.includes(unit.type)) byType[unit.type] += unit.count;
    }
  }
  const total = byType.cavalry + byType.infantry + byType.archers;
  return {
    faction,
    armyCount: armies.length,
    total,
    byType,
    cavalryShare: total > 0 ? byType.cavalry / total : 0,
  };
}

/**
 * Ratio of the stronger side to the weaker, plus who that is.
 * Guarded so a wiped-out side does not produce Infinity in a prompt.
 */
export function buildForceSummary(battle: BattleContext): ForceSummary {
  const north = sideForce(battle.northArmies, "north");
  const west = sideForce(battle.westArmies, "westerlands");

  const stronger =
    north.total === west.total ? null : north.total > west.total ? "north" : "westerlands";
  const larger = Math.max(north.total, west.total);
  const smaller = Math.min(north.total, west.total);
  const ratio = smaller > 0 ? larger / smaller : larger > 0 ? Infinity : 1;

  return {
    north,
    west,
    stronger,
    /** Rounded to 2dp; Infinity becomes null so it serialises cleanly. */
    ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null,
  };
}

/** One-line human description of the ratio, for prompts and the UI strip. */
export function describeForceRatio(summary: ForceSummary): string {
  const { north, west, stronger, ratio } = summary;
  const counts = `North ${north.total.toLocaleString()} vs Westerlands ${west.total.toLocaleString()}`;
  if (stronger === null) return `${counts} — evenly matched`;
  if (ratio === null) return `${counts} — one side has no men left in the field`;
  const label = stronger === "north" ? "The North" : "The Westerlands";
  if (ratio < 1.15) return `${counts} — near parity`;
  if (ratio < 1.5) return `${counts} — ${label} holds a modest edge (${ratio}:1)`;
  if (ratio < 2.5) return `${counts} — ${label} is clearly stronger (${ratio}:1)`;
  return `${counts} — ${label} overwhelmingly outnumbers the enemy (${ratio}:1)`;
}

/**
 * Which side the deterministic fallback awards the field to.
 *
 * Symmetric on purpose: the old fallback handed every API failure to the North,
 * so a flaky key silently rewrote the campaign. Posture is the tiebreaker at
 * near parity because a dug-in defender should not lose a coin flip.
 */
export function fallbackOutcome(
  battle: BattleContext,
  _summary: ForceSummary
): { holdResult: Faction | "abandoned"; lossShare: Record<Faction, number> } {
  const orders = battle.armyOrders ?? {};
  const posture = (armies: Army[]): number => {
    let score = 0;
    for (const a of armies) {
      const order = orders[a.id] ?? "march";
      if (order === "fortify") score += 2;
      else if (order === "rest") score -= 1;
      // A defender who was already standing here holds the local ground.
      if (!battle.armyApproaches?.[a.id]) score += 1;
    }
    return armies.length > 0 ? score / armies.length : 0;
  };

  const committed = (armies: Army[]) =>
    armies.reduce((s, a) => {
      const n = armyStrength(a);
      return s + (battle.armyCommitments?.[a.id] === "hold_back" ? n * 0.4 : n);
    }, 0);

  const northScore = committed(battle.northArmies) * (1 + 0.12 * posture(battle.northArmies));
  const westScore = committed(battle.westArmies) * (1 + 0.12 * posture(battle.westArmies));

  // Within 6% is genuinely indecisive — both sides pull back.
  const spread = Math.abs(northScore - westScore);
  const scale = Math.max(northScore, westScore, 1);
  if (spread / scale < 0.06) {
    return { holdResult: "abandoned", lossShare: { north: 0.1, westerlands: 0.1 } };
  }

  const winner: Faction = northScore > westScore ? "north" : "westerlands";
  const loser: Faction = winner === "north" ? "westerlands" : "north";
  // A lopsided win is cheap for the winner and expensive for the loser.
  const dominance = Math.min(scale / Math.max(Math.min(northScore, westScore), 1), 4);
  const winnerLoss = Math.max(0.02, 0.11 / dominance);
  const loserLoss = Math.min(0.45, 0.1 * dominance + 0.08);

  return {
    holdResult: winner,
    lossShare: {
      [winner]: winnerLoss,
      [loser]: loserLoss,
    } as Record<Faction, number>,
  };
}
