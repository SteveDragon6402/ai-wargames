import type {
  Army,
  ArmyConditionUpdate,
  ArmyUnit,
  BattleContext,
  Casualty,
  DefeatType,
  FallenFigure,
  Faction,
  UnitType,
  ValidationNote,
} from "../types";

/**
 * Stage 3 of battle resolution: weak, purely deterministic validation of what
 * the executor model returned.
 *
 * The rule is reject the impossible, not second-guess the judgement. A model
 * saying a small force beat a large one is a legitimate call and passes through
 * untouched. A model naming an army that is not in this battle, returning a
 * negative casualty count (which used to *heal* armies), or killing more men
 * than a unit has is impossible, and is corrected here with a note so the
 * correction is visible rather than silent.
 */

export const DEFEAT_TYPES: DefeatType[] = [
  "structured_withdrawal",
  "rout",
  "shattering",
  "pyrrhic_win",
  "last_stand",
];

const UNIT_TYPES: UnitType[] = ["cavalry", "infantry", "archers"];

export interface ExecutorOutput {
  defeatType?: string;
  holdResult?: string;
  casualties?: unknown;
  fallen?: unknown;
  retreatingArmyIds?: unknown;
  conditionUpdates?: unknown;
}

export interface ValidatedOutcome {
  defeatType?: DefeatType;
  holdResult: Faction | "abandoned";
  casualties: Casualty[];
  fallen: FallenFigure[];
  retreatingArmyIds: string[];
  conditionUpdates: ArmyConditionUpdate[];
  notes: ValidationNote[];
}

/** Strip the "House " prefix and normalise case so fuzzy matching is stable. */
function normHouse(house: string): string {
  return house.toLowerCase().replace(/^house\s+/, "").trim();
}

function participants(battle: BattleContext): Map<string, Army> {
  const map = new Map<string, Army>();
  for (const a of [...battle.northArmies, ...battle.westArmies]) map.set(a.id, a);
  return map;
}

function factionOf(battle: BattleContext, armyId: string): Faction | null {
  if (battle.northArmies.some((a) => a.id === armyId)) return "north";
  if (battle.westArmies.some((a) => a.id === armyId)) return "westerlands";
  return null;
}

/**
 * Distribute `total` losses across `units` in proportion to their size, never
 * exceeding any unit's headcount and never losing men to rounding.
 *
 * The old implementation used a bare `Math.round` per unit, which both dropped
 * casualties (remainder never applied) and could over-allocate past a stack's
 * strength. This uses largest-remainder allocation and then sweeps whatever is
 * left over into units with room, so the returned rows always sum to
 * `min(total, capacity)`.
 */
export function distributeProportional(
  units: ArmyUnit[],
  total: number
): Map<ArmyUnit, number> {
  const out = new Map<ArmyUnit, number>();
  for (const u of units) out.set(u, 0);

  const capacity = units.reduce((s, u) => s + u.count, 0);
  const target = Math.min(Math.max(0, Math.floor(total)), capacity);
  if (target === 0 || capacity === 0) return out;

  const exact = units.map((u) => ({ u, want: (u.count / capacity) * target }));
  let assigned = 0;
  for (const e of exact) {
    const floorShare = Math.min(e.u.count, Math.floor(e.want));
    out.set(e.u, floorShare);
    assigned += floorShare;
  }

  // Largest fractional remainder first, then any unit with room.
  const order = [...exact].sort(
    (a, b) => (b.want - Math.floor(b.want)) - (a.want - Math.floor(a.want))
  );
  let cursor = 0;
  while (assigned < target) {
    let progressed = false;
    for (let i = 0; i < order.length; i++) {
      const e = order[(cursor + i) % order.length];
      const current = out.get(e.u) ?? 0;
      if (current < e.u.count) {
        out.set(e.u, current + 1);
        assigned++;
        cursor = (cursor + i + 1) % order.length;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  return out;
}

/**
 * Turn arbitrary executor casualty rows into rows that are guaranteed
 * applicable: participant armies only, non-negative, and never more than the
 * targeted units actually contain.
 */
function validateCasualties(
  battle: BattleContext,
  raw: unknown,
  notes: ValidationNote[]
): Casualty[] {
  if (!Array.isArray(raw)) return [];
  const armies = participants(battle);

  // Group requested losses per army, then per unit type, so we can reconcile
  // against real headcounts instead of trusting each row in isolation.
  const perArmy = new Map<string, Map<UnitType, { house: string; count: number }[]>>();

  for (const row of raw as Casualty[]) {
    if (!row || typeof row !== "object") continue;
    const armyId = String(row.armyId ?? "");
    const army = armies.get(armyId);
    if (!army) {
      notes.push({
        kind: "dropped_unknown_army",
        detail: `Casualties for "${armyId}" ignored — not a participant in this battle`,
      });
      continue;
    }
    const count = Number(row.count);
    if (!Number.isFinite(count) || count <= 0) {
      if (Number.isFinite(count) && count < 0) {
        notes.push({
          kind: "dropped_negative",
          detail: `Negative casualty count (${count}) for ${army.name} ignored`,
        });
      }
      continue;
    }
    const unitType = UNIT_TYPES.includes(row.unitType) ? row.unitType : null;
    if (!unitType) continue;

    let byType = perArmy.get(armyId);
    if (!byType) {
      byType = new Map();
      perArmy.set(armyId, byType);
    }
    const rows = byType.get(unitType) ?? [];
    rows.push({ house: String(row.house ?? ""), count: Math.floor(count) });
    byType.set(unitType, rows);
  }

  const out: Casualty[] = [];

  for (const [armyId, byType] of perArmy) {
    const army = armies.get(armyId);
    if (!army) continue;
    const faction = factionOf(battle, armyId);
    if (!faction) continue;

    // Remaining headcount per unit, decremented as we allocate.
    const remaining = new Map<ArmyUnit, number>(army.units.map((u) => [u, u.count]));
    const add = (unit: ArmyUnit, n: number) => {
      if (n <= 0) return;
      out.push({
        faction,
        armyId,
        unitType: unit.type,
        house: unit.house,
        count: n,
      });
    };

    for (const [unitType, rows] of byType) {
      const typeUnits = army.units.filter((u) => u.type === unitType);
      const requested = rows.reduce((s, r) => s + r.count, 0);

      if (typeUnits.length === 0) {
        // The army has no units of this type. Rather than dropping the
        // casualties (which used to happen silently and made the narrative and
        // the numbers disagree), spread them across what the army does have.
        const spread = army.units.filter((u) => (remaining.get(u) ?? 0) > 0);
        if (spread.length === 0) continue;
        const alloc = distributeProportional(
          spread.map((u) => ({ ...u, count: remaining.get(u) ?? 0 })),
          requested
        );
        let i = 0;
        let applied = 0;
        for (const [, n] of alloc) {
          const unit = spread[i++];
          const take = Math.min(n, remaining.get(unit) ?? 0);
          remaining.set(unit, (remaining.get(unit) ?? 0) - take);
          add(unit, take);
          applied += take;
        }
        notes.push({
          kind: "redistributed_unit_type",
          detail: `${army.name} has no ${unitType}; ${applied.toLocaleString()} of ${requested.toLocaleString()} losses spread across its other units`,
        });
        continue;
      }

      // Exact house match first, so a named stack takes its own losses.
      let unmatched = 0;
      for (const row of rows) {
        const target = typeUnits.find((u) => normHouse(u.house) === normHouse(row.house));
        if (!target) {
          unmatched += row.count;
          continue;
        }
        const avail = remaining.get(target) ?? 0;
        const take = Math.min(row.count, avail);
        if (take < row.count) {
          notes.push({
            kind: "clamped_to_available",
            detail: `${row.count.toLocaleString()} ${row.house} ${unitType} losses for ${army.name} clamped to the ${avail.toLocaleString()} present`,
          });
        }
        remaining.set(target, avail - take);
        add(target, take);
      }

      // Anything whose house did not match gets spread across the type.
      if (unmatched > 0) {
        const spread = typeUnits.filter((u) => (remaining.get(u) ?? 0) > 0);
        if (spread.length === 0) {
          notes.push({
            kind: "redistribution_remainder",
            detail: `${unmatched.toLocaleString()} ${unitType} losses for ${army.name} could not be applied — no men of that type left`,
          });
          continue;
        }
        const alloc = distributeProportional(
          spread.map((u) => ({ ...u, count: remaining.get(u) ?? 0 })),
          unmatched
        );
        let i = 0;
        let applied = 0;
        for (const [, n] of alloc) {
          const unit = spread[i++];
          const take = Math.min(n, remaining.get(unit) ?? 0);
          remaining.set(unit, (remaining.get(unit) ?? 0) - take);
          add(unit, take);
          applied += take;
        }
        if (applied < unmatched) {
          notes.push({
            kind: "redistribution_remainder",
            detail: `${(unmatched - applied).toLocaleString()} ${unitType} losses for ${army.name} exceeded the men available`,
          });
        }
      }
    }
  }

  return out;
}

/** A named figure must actually be in this battle to fall in it. */
function validateFallen(
  battle: BattleContext,
  raw: unknown,
  notes: ValidationNote[]
): FallenFigure[] {
  if (!Array.isArray(raw)) return [];
  const armies = participants(battle);
  const out: FallenFigure[] = [];
  const seen = new Set<string>();

  for (const row of raw as FallenFigure[]) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name ?? "").trim();
    if (!name) continue;

    // Trust the name over the army id — models often attribute correctly but
    // put the figure on the wrong army.
    let hostId: string | null = null;
    let isLeader = false;
    for (const [id, army] of armies) {
      if (army.leaders.some((l) => l.name === name)) {
        hostId = id;
        isLeader = true;
        break;
      }
      if (army.notables?.some((n) => n.name === name)) {
        hostId = id;
        isLeader = false;
        break;
      }
    }

    if (!hostId) {
      notes.push({
        kind: "dropped_unknown_fallen",
        detail: `"${name}" reported fallen but is not present in this battle`,
      });
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ armyId: hostId, name, isLeader });
  }

  return out;
}

/**
 * Reconcile holdResult and retreatingArmyIds so they cannot contradict.
 * The loser's armies all retreat; the winner's never do.
 */
function validateOutcome(
  battle: BattleContext,
  rawHoldResult: string | undefined,
  rawRetreats: unknown,
  notes: ValidationNote[]
): { holdResult: Faction | "abandoned"; retreatingArmyIds: string[] } {
  const northIds = battle.northArmies.map((a) => a.id);
  const westIds = battle.westArmies.map((a) => a.id);

  let holdResult: Faction | "abandoned";
  if (rawHoldResult === "north" || rawHoldResult === "westerlands" || rawHoldResult === "abandoned") {
    holdResult = rawHoldResult;
  } else {
    // Infer from the retreat list rather than defaulting to "abandoned", which
    // used to force both intact sides off a hold nobody had lost.
    const declared = Array.isArray(rawRetreats) ? (rawRetreats as string[]) : [];
    const northRetreating = northIds.some((id) => declared.includes(id));
    const westRetreating = westIds.some((id) => declared.includes(id));
    if (northRetreating && !westRetreating) holdResult = "westerlands";
    else if (westRetreating && !northRetreating) holdResult = "north";
    else holdResult = "abandoned";
    notes.push({
      kind: "corrected_hold_result",
      detail: `holdResult "${rawHoldResult ?? "missing"}" was not a valid outcome; inferred "${holdResult}" from the retreat list`,
    });
  }

  const expected =
    holdResult === "north" ? westIds : holdResult === "westerlands" ? northIds : [...northIds, ...westIds];

  const declared = Array.isArray(rawRetreats) ? (rawRetreats as string[]).map(String) : [];
  const same =
    declared.length === expected.length && expected.every((id) => declared.includes(id));
  if (!same && declared.length > 0) {
    notes.push({
      kind: "corrected_retreats",
      detail: `Retreat list did not match holdResult "${holdResult}" and was rebuilt from it`,
    });
  }

  // Synthetic garrison armies never retreat — they hold or they die.
  let retreatingArmyIds = expected.filter((id) => !id.startsWith("garrison:"));
  // A failed storm leaves the investor in camp. The walls held; nobody yields the tile.
  if ((battle.engagement ?? "field") === "storm") {
    const garrisonOnNorth = battle.northArmies.some((a) =>
      a.id.startsWith("garrison:")
    );
    const garrisonOnWest = battle.westArmies.some((a) =>
      a.id.startsWith("garrison:")
    );
    const taken =
      (garrisonOnNorth && holdResult === "westerlands") ||
      (garrisonOnWest && holdResult === "north");
    if (!taken) retreatingArmyIds = [];
  }
  return {
    holdResult,
    retreatingArmyIds,
  };
}

function validateConditions(
  battle: BattleContext,
  raw: unknown,
  notes: ValidationNote[]
): ArmyConditionUpdate[] {
  if (!Array.isArray(raw)) return [];
  const armies = participants(battle);
  const out: ArmyConditionUpdate[] = [];
  const seen = new Set<string>();

  for (const row of raw as ArmyConditionUpdate[]) {
    if (!row || typeof row !== "object") continue;
    const armyId = String(row.armyId ?? "");
    if (!armies.has(armyId)) {
      notes.push({
        kind: "dropped_unknown_condition",
        detail: `Condition update for "${armyId}" ignored — not a participant`,
      });
      continue;
    }
    if (seen.has(armyId)) continue;
    seen.add(armyId);
    out.push({
      armyId,
      morale: String(row.morale ?? "").trim(),
      tiredness: String(row.tiredness ?? "").trim(),
      ...(row.stance ? { stance: String(row.stance).trim() } : {}),
    });
  }

  return out;
}

/** Run every Stage 3 check. Pure: same input always yields the same outcome. */
export function validateBattleOutcome(
  battle: BattleContext,
  raw: ExecutorOutput
): ValidatedOutcome {
  const notes: ValidationNote[] = [];

  const casualties = validateCasualties(battle, raw.casualties, notes);
  const fallen = validateFallen(battle, raw.fallen, notes);
  const { holdResult, retreatingArmyIds } = validateOutcome(
    battle,
    raw.holdResult,
    raw.retreatingArmyIds,
    notes
  );
  const conditionUpdates = validateConditions(battle, raw.conditionUpdates, notes);

  const defeatType = DEFEAT_TYPES.includes(raw.defeatType as DefeatType)
    ? (raw.defeatType as DefeatType)
    : battle.lastStand
      ? "last_stand"
      : undefined;

  return {
    defeatType,
    holdResult,
    casualties,
    fallen,
    retreatingArmyIds,
    conditionUpdates,
    notes,
  };
}
