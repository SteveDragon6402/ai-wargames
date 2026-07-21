import { useReducer } from "react";
import type {
  GameState,
  GameAction,
  Faction,
  MoveOrder,
  Army,
  ArmyActivity,
  BattleContext,
  BattleReport,
  RetreatEntry,
  Casualty,
  FallenFigure,
  Hold,
  ArmyConditionUpdate,
  SplitConfig,
} from "../types";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { HOLDS_MAP } from "../data/holds";

function getAdjacentHolds(holdId: string): string[] {
  return HOLDS_MAP.get(holdId)?.links ?? [];
}

function determineTerritory(army: Army, hold: Hold): "home" | "neutral" {
  const holdHouse = hold.house.toLowerCase();

  const leaderHouses = army.leaders.map((leader) => {
    const nameParts = leader.name.split(" ");
    return nameParts[nameParts.length - 1].toLowerCase();
  });

  const unitHouses = army.units.map((unit) => unit.house.toLowerCase());

  const allHouses = [...leaderHouses, ...unitHouses];

  for (const house of allHouses) {
    if (holdHouse.includes(house) || house.includes(holdHouse)) {
      return "home";
    }
  }

  return "neutral";
}

function getFactionOrders(state: GameState, faction: Faction) {
  return faction === "north" ? state.north : state.westerlands;
}

function setFactionOrders(
  state: GameState,
  faction: Faction,
  patch: Partial<typeof state.north>
): GameState {
  if (faction === "north") {
    return { ...state, north: { ...state.north, ...patch } };
  }
  return { ...state, westerlands: { ...state.westerlands, ...patch } };
}

/** After moves are applied, find holds with armies from both factions. */
function detectBattles(
  armies: Army[],
  allOrders: MoveOrder[],
  armyOrdersMap: Record<string, "march" | "rest" | "fortify">
): BattleContext[] {
  const byHold = new Map<string, Army[]>();
  for (const army of armies) {
    const list = byHold.get(army.holdId) ?? [];
    list.push(army);
    byHold.set(army.holdId, list);
  }

  const battles: BattleContext[] = [];
  for (const [holdId, armiesHere] of byHold) {
    const northHere = armiesHere.filter((a) => a.faction === "north");
    const westHere = armiesHere.filter((a) => a.faction === "westerlands");
    if (northHere.length === 0 || westHere.length === 0) continue;

    const northFrom = allOrders.find(
      (o) => northHere.some((a) => a.id === o.armyId) && o.toHoldId === holdId
    )?.fromHoldId;
    const westFrom = allOrders.find(
      (o) => westHere.some((a) => a.id === o.armyId) && o.toHoldId === holdId
    )?.fromHoldId;

    battles.push({
      holdId,
      northArmies: northHere,
      westArmies: westHere,
      northFromHoldId: northFrom,
      westFromHoldId: westFrom,
      armyOrders: armyOrdersMap,
    });
  }
  return battles;
}

/** Apply casualties to the army list. Returns updated armies (removes depleted units). */
function applyCasualties(armies: Army[], casualties: Casualty[]): Army[] {
  return armies
    .map((army) => {
      const armyCasualties = casualties.filter((c) => c.armyId === army.id);
      if (armyCasualties.length === 0) return army;

      const updatedUnits = army.units
        .map((unit) => {
          const loss = armyCasualties.find(
            (c) => c.unitType === unit.type && c.house === unit.house
          );
          if (!loss) return unit;
          return { ...unit, count: Math.max(0, unit.count - loss.count) };
        })
        .filter((u) => u.count > 0);

      return { ...army, units: updatedUnits };
    })
    .filter((army) => army.units.length > 0);
}

/** Remove fallen leaders and notables from armies.
 *
 * Robustness:
 * 1. Matches by name against BOTH leaders and notables regardless of isLeader flag —
 *    Claude sometimes returns isLeader:false for an actual leader, which would leave
 *    them alive if we only removed from notables[].
 * 2. If a fallen figure's armyId doesn't match any surviving army, searches all armies
 *    by name so a wrong ID from Claude doesn't silently drop the death.
 */
function applyFallen(armies: Army[], fallen: FallenFigure[]): Army[] {
  // Resolve armyId: if it doesn't exist in the army list, find the army by name match
  const resolvedFallen = fallen.map((f) => {
    const armyExists = armies.some((a) => a.id === f.armyId);
    if (armyExists) return f;
    // Fallback: find by name in leaders or notables of any army
    for (const army of armies) {
      const inLeaders = army.leaders.some((l) => l.name === f.name);
      const inNotables = army.notables?.some((n) => n.name === f.name) ?? false;
      if (inLeaders || inNotables) {
        return { ...f, armyId: army.id };
      }
    }
    return f; // unresolvable — will be a no-op below
  });

  return armies.map((army) => {
    const armyFallen = resolvedFallen.filter((f) => f.armyId === army.id);
    if (armyFallen.length === 0) return army;

    // Match by name against both lists — don't trust isLeader flag from Claude
    const fallenNames = new Set(armyFallen.map((f) => f.name));

    return {
      ...army,
      leaders: army.leaders.filter((l) => !fallenNames.has(l.name)),
      notables: army.notables?.filter((n) => !fallenNames.has(n.name)) ?? [],
    };
  });
}

/**
 * Build retreat entries. Filters out:
 *  1. The last hold the enemy army came from (lastHoldId)
 *  2. Any hold currently occupied by an enemy army
 */
function buildRetreats(
  retreatingArmyIds: string[],
  armies: Army[],
  battles: BattleContext[]
): RetreatEntry[] {
  return retreatingArmyIds
    .map((armyId) => {
      const army = armies.find((a) => a.id === armyId);
      if (!army) return null;

      const battle = battles.find(
        (b) =>
          b.northArmies.some((a) => a.id === armyId) ||
          b.westArmies.some((a) => a.id === armyId)
      );
      if (!battle) return null;

      const isNorth = army.faction === "north";

      // Filter 1: last hold the enemy came from (persistent, not just this turn).
      // Exception: the retreating army's OWN lastHoldId is never blocked by this rule —
      // if I marched A→B and lost, I can always retreat to A even if the enemy also
      // has lastHoldId=A (they marched A→B some turns ago). Filter 2 (occupied) still
      // applies, so if the enemy actually has a live army at A, it stays forbidden.
      const enemyArmies = isNorth ? battle.westArmies : battle.northArmies;
      const lastHoldForbidden = enemyArmies
        .map((a) => a.lastHoldId)
        .filter((h): h is string => !!h && h !== army.lastHoldId); // own origin always allowed

      // Filter 2: any hold currently occupied by an enemy army (any enemy, not just battle participants)
      const occupiedForbidden = armies
        .filter((a) => a.faction !== army.faction)
        .map((a) => a.holdId);

      const forbiddenHoldIds = [...new Set([...lastHoldForbidden, ...occupiedForbidden])];

      const adjacentHolds = getAdjacentHolds(army.holdId);
      const validTargets = adjacentHolds.filter(
        (h) => !forbiddenHoldIds.includes(h)
      );

      return {
        armyId,
        fromHoldId: army.holdId,
        forbiddenHoldIds,
        validTargets,
        chosenHoldId: validTargets.length === 1 ? validTargets[0] : null,
      } satisfies RetreatEntry;
    })
    .filter(Boolean) as RetreatEntry[];
}

/** Tick ArmyActivity counters based on what the army did this turn. */
function tickActivity(
  activity: ArmyActivity,
  order: "march" | "rest" | "fortify"
): ArmyActivity {
  return {
    turnsResting: order === "rest" ? activity.turnsResting + 1 : 0,
    turnsFortiying: order === "fortify" ? activity.turnsFortiying + 1 : 0,
    turnsMarching: order === "march" ? activity.turnsMarching + 1 : 0,
    turnsSinceMerge: activity.turnsSinceMerge !== null ? activity.turnsSinceMerge + 1 : null,
    turnsSinceSplit: activity.turnsSinceSplit !== null ? activity.turnsSinceSplit + 1 : null,
  };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SELECT_HOLD": {
      return {
        ...state,
        selectedHoldId: action.holdId,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "SELECT_ARMY": {
      const armyFaction = state.armies.find((a) => a.id === action.armyId)?.faction;
      if (!state.adminMode && armyFaction !== state.activeFaction) return state;
      if (armyFaction && getFactionOrders(state, armyFaction).submitted) return state;

      let next: string[];
      if (action.shift) {
        next = state.selectedArmyIds.includes(action.armyId)
          ? state.selectedArmyIds.filter((id) => id !== action.armyId)
          : [...state.selectedArmyIds, action.armyId];
      } else {
        next = [action.armyId];
      }
      return {
        ...state,
        selectedArmyIds: next,
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "SELECT_ALL_AT_HOLD": {
      const armiesHere = state.armies
        .filter((a) => {
          if (a.holdId !== action.holdId) return false;
          if (!state.adminMode && a.faction !== state.activeFaction) return false;
          if (getFactionOrders(state, a.faction).submitted) return false;
          return true;
        })
        .map((a) => a.id);
      return {
        ...state,
        selectedHoldId: action.holdId,
        selectedArmyIds: armiesHere,
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "BEGIN_MOVE": {
      if (state.selectedArmyIds.length === 0) return state;

      const selectedArmies = state.selectedArmyIds
        .map((id) => state.armies.find((a) => a.id === id))
        .filter(Boolean) as Army[];

      if (selectedArmies.length === 0) return state;

      const union = new Set<string>();
      selectedArmies.forEach((a) =>
        getAdjacentHolds(a.holdId).forEach((h) => union.add(h))
      );

      return {
        ...state,
        moveMode: { active: true, validTargets: Array.from(union) },
      };
    }

    case "QUEUE_MOVE": {
      if (!state.moveMode.active || state.selectedArmyIds.length === 0) return state;

      const selectedArmies = state.selectedArmyIds
        .map((id) => state.armies.find((a) => a.id === id))
        .filter(Boolean) as Army[];

      const newOrders: MoveOrder[] = selectedArmies
        .filter((army) => getAdjacentHolds(army.holdId).includes(action.toHoldId))
        .map((army) => ({
          armyId: army.id,
          fromHoldId: army.holdId,
          toHoldId: action.toHoldId,
        }));

      if (newOrders.length === 0) return state;

      let nextState = state;
      for (const order of newOrders) {
        const army = state.armies.find((a) => a.id === order.armyId)!;
        const faction = army.faction;
        const existing = getFactionOrders(nextState, faction);
        if (existing.submitted) continue;
        const filtered = existing.orders.filter((o) => o.armyId !== order.armyId);
        // Clear any stance order for this army since it's now moving
        const newStanceOrders = { ...existing.stanceOrders };
        delete newStanceOrders[order.armyId];
        nextState = setFactionOrders(nextState, faction, {
          orders: [...filtered, order],
          stanceOrders: newStanceOrders,
        });
      }

      return {
        ...nextState,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "CANCEL_MOVE": {
      return { ...state, moveMode: { active: false, validTargets: [] } };
    }

    case "SET_STANCE_ORDER": {
      const army = state.armies.find((a) => a.id === action.armyId);
      if (!army) return state;

      const faction = army.faction;
      const factionOrders = getFactionOrders(state, faction);
      if (factionOrders.submitted) return state;

      const currentOrder = factionOrders.stanceOrders[action.armyId];
      const newStanceOrders = { ...factionOrders.stanceOrders };

      if (action.order === null || currentOrder === action.order) {
        // Toggle off
        delete newStanceOrders[action.armyId];
      } else {
        newStanceOrders[action.armyId] = action.order;
      }

      // Clear any move order for this army (can't march and rest/fortify)
      const newOrders = factionOrders.orders.filter((o) => o.armyId !== action.armyId);

      return setFactionOrders(state, faction, {
        orders: newOrders,
        stanceOrders: newStanceOrders,
      });
    }

    case "SUBMIT_FACTION": {
      const nextState = setFactionOrders(state, action.faction, { submitted: true });
      if (nextState.north.submitted && nextState.westerlands.submitted) {
        return gameReducer(nextState, { type: "ADJUDICATE_MOVES" });
      }
      return nextState;
    }

    case "ADJUDICATE_MOVES": {
      const allOrders: MoveOrder[] = [
        ...state.north.orders,
        ...state.westerlands.orders,
      ];

      const movedArmyIds = new Set(allOrders.map((o) => o.armyId));

      // Build the armyOrders map: march / rest / fortify for every army
      const armyOrdersMap: Record<string, "march" | "rest" | "fortify"> = {};
      for (const army of state.armies) {
        if (movedArmyIds.has(army.id)) {
          armyOrdersMap[army.id] = "march";
        } else {
          const northStance = state.north.stanceOrders[army.id];
          const westStance = state.westerlands.stanceOrders[army.id];
          const stanceOrder = northStance ?? westStance;
          armyOrdersMap[army.id] = stanceOrder ?? "rest";
        }
      }

      const updatedArmies = state.armies.map((army) => {
        const order = allOrders.find((o) => o.armyId === army.id);
        const moved = !!order;
        const movesSinceRest = moved
          ? (army.movesSinceRest ?? 0) + 1
          : 0;

        const effectiveOrder = armyOrdersMap[army.id] ?? "rest";
        const updatedActivity = tickActivity(army.activity, effectiveOrder);

        if (order) {
          return {
            ...army,
            holdId: order.toHoldId,
            lastHoldId: army.holdId, // stamp last position before moving
            movesSinceRest,
            activity: updatedActivity,
          };
        }
        return {
          ...army,
          movesSinceRest,
          activity: updatedActivity,
        };
      });

      const newTurnHistory = {
        turn: state.turn,
        armyMoves: state.armies.map((army) => ({
          armyId: army.id,
          moved: movedArmyIds.has(army.id),
        })),
      };

      const pendingBattles = detectBattles(updatedArmies, allOrders, armyOrdersMap);

      return {
        ...state,
        phase: "resolving",
        armies: updatedArmies,
        north: { orders: [], stanceOrders: {}, submitted: false },
        westerlands: { orders: [], stanceOrders: {}, submitted: false },
        selectedHoldId: null,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
        pendingBattles,
        turnHistory: [...(state.turnHistory ?? []), newTurnHistory],
      };
    }

    case "BATTLES_RESOLVED": {
      const { reports } = action;

      const allCasualties = reports.flatMap((r) => r.casualties);
      const allFallen = reports.flatMap((r) => r.fallen);

      const correctedReports = reports.map((report) => {
        const battle = state.pendingBattles.find((b) => b.holdId === report.holdId);
        if (!battle) return report;

        const northIds = battle.northArmies.map((a) => a.id);
        const westIds = battle.westArmies.map((a) => a.id);
        let retreating = [...report.retreatingArmyIds];

        if (report.holdResult === "north") {
          for (const id of westIds) if (!retreating.includes(id)) retreating.push(id);
          retreating = retreating.filter((id) => !northIds.includes(id));
        } else if (report.holdResult === "westerlands") {
          for (const id of northIds) if (!retreating.includes(id)) retreating.push(id);
          retreating = retreating.filter((id) => !westIds.includes(id));
        } else {
          retreating = [...northIds, ...westIds];
        }
        return { ...report, retreatingArmyIds: retreating };
      });

      const allConditionUpdates = correctedReports.flatMap((r) => r.conditionUpdates ?? []);

      // Apply casualties and fallen figures
      let updatedArmies = applyCasualties(state.armies, allCasualties);
      updatedArmies = applyFallen(updatedArmies, allFallen);

      // Apply post-battle condition updates (morale, tiredness, stance)
      if (allConditionUpdates.length > 0) {
        updatedArmies = updatedArmies.map((army) => {
          const upd = allConditionUpdates.find((u: ArmyConditionUpdate) => u.armyId === army.id);
          if (!upd) return army;
          return {
            ...army,
            morale: upd.morale,
            tiredness: upd.tiredness,
            ...(upd.stance ? { stance: upd.stance } : {}),
          };
        });
      }

      // Determine which armies need a commander rename:
      // Any army that had at least one isLeader fallen figure
      const armiesWithFallenLeaders = new Set(
        allFallen.filter((f) => f.isLeader).map((f) => f.armyId)
      );
      // Only include armies that still exist (weren't destroyed)
      const pendingRenames = updatedArmies
        .filter((a) => armiesWithFallenLeaders.has(a.id))
        .map((a) => a.id);

      // Build retreats — armies that need to move but have no retreat get a last-stand battle
      const allRetreatingIds = correctedReports.flatMap((r) => r.retreatingArmyIds);
      const retreats = buildRetreats(allRetreatingIds, updatedArmies, state.pendingBattles);

      // Detect trapped armies (retreating but validTargets is empty) → trigger last-stand
      const trappedArmyIds = retreats
        .filter((r) => r.validTargets.length === 0)
        .map((r) => r.armyId);

      let lastStandBattles: BattleContext[] = [];
      if (trappedArmyIds.length > 0) {
        // Build last-stand BattleContext entries for each battle containing a trapped army
        const processedHolds = new Set<string>();
        for (const battle of state.pendingBattles) {
          if (processedHolds.has(battle.holdId)) continue;
          const battleArmyIds = [
            ...battle.northArmies.map((a) => a.id),
            ...battle.westArmies.map((a) => a.id),
          ];
          if (!battleArmyIds.some((id) => trappedArmyIds.includes(id))) continue;

          // Get surviving armies for this hold
          const northSurvivors = updatedArmies.filter(
            (a) => a.faction === "north" && a.holdId === battle.holdId
          );
          const westSurvivors = updatedArmies.filter(
            (a) => a.faction === "westerlands" && a.holdId === battle.holdId
          );
          if (northSurvivors.length > 0 && westSurvivors.length > 0) {
            lastStandBattles.push({
              holdId: battle.holdId,
              northArmies: northSurvivors,
              westArmies: westSurvivors,
              armyOrders: battle.armyOrders,
              lastStand: true,
            });
            processedHolds.add(battle.holdId);
          }
        }
      }

      const nonTrappedRetreats = retreats.filter((r) => r.validTargets.length > 0);
      const newBattleReports = [...state.battleReports, ...correctedReports];

      // If there are last-stand battles, re-enter resolving with them as pendingBattles
      if (lastStandBattles.length > 0) {
        return {
          ...state,
          phase: "resolving",
          armies: updatedArmies,
          pendingBattles: lastStandBattles,
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames,
        };
      }

      if (pendingRenames.length > 0) {
        return {
          ...state,
          phase: "rename_commanders",
          armies: updatedArmies,
          pendingBattles: [],
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames,
        };
      }

      if (nonTrappedRetreats.length > 0) {
        return {
          ...state,
          phase: "retreat",
          armies: updatedArmies,
          pendingBattles: [],
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames: [],
        };
      }

      return {
        ...state,
        turn: state.turn + 1,
        phase: "planning",
        armies: updatedArmies,
        pendingBattles: [],
        battleReports: newBattleReports,
        retreats: [],
        pendingRenames: [],
      };
    }

    case "SELECT_LEAD_COMMANDER": {
      const updatedArmies = state.armies.map((army) => {
        if (army.id !== action.armyId) return army;

        // Derive a suffix from the old army name (e.g. "Host", "Vanguard", "Spearmen", etc.)
        const oldWords = army.name.split(" ");
        const suffix = oldWords.length >= 2 ? oldWords[oldWords.length - 1] : "Host";

        return {
          ...army,
          name: `${action.leaderName}'s ${suffix}`,
        };
      });

      const newPendingRenames = state.pendingRenames.filter((id) => id !== action.armyId);

      if (newPendingRenames.length > 0) {
        return {
          ...state,
          armies: updatedArmies,
          pendingRenames: newPendingRenames,
        };
      }

      // All renames done — move to retreat or planning
      if (state.retreats.length > 0) {
        return {
          ...state,
          phase: "retreat",
          armies: updatedArmies,
          pendingRenames: [],
        };
      }

      return {
        ...state,
        turn: state.turn + 1,
        phase: "planning",
        armies: updatedArmies,
        pendingRenames: [],
      };
    }

    case "SET_RETREAT": {
      return {
        ...state,
        retreats: state.retreats.map((r) =>
          r.armyId === action.armyId ? { ...r, chosenHoldId: action.toHoldId } : r
        ),
      };
    }

    case "COMMIT_RETREATS": {
      let updatedArmies = [...state.armies];

      for (const retreat of state.retreats) {
        const dest =
          retreat.chosenHoldId ??
          retreat.validTargets[0] ??
          null;
        if (!dest) continue;

        updatedArmies = updatedArmies.map((a) =>
          a.id === retreat.armyId ? { ...a, holdId: dest } : a
        );
      }

      return {
        ...state,
        turn: state.turn + 1,
        phase: "planning",
        armies: updatedArmies,
        retreats: [],
      };
    }

    case "COMBINE_ARMIES": {
      if (state.selectedArmyIds.length < 2) return state;

      const selected = state.selectedArmyIds
        .map((id) => state.armies.find((a) => a.id === id))
        .filter(Boolean) as Army[];

      const holdId = selected[0].holdId;
      const faction = selected[0].faction;
      if (!selected.every((a) => a.holdId === holdId && a.faction === faction)) {
        return state;
      }

      const totalUnits = (a: Army) => a.units.reduce((s, u) => s + u.count, 0);
      const [base, ...rest] = [...selected].sort((a, b) => totalUnits(b) - totalUnits(a));

      const mergedUnits = [...base.units];
      for (const army of rest) {
        for (const unit of army.units) {
          const existing = mergedUnits.find(
            (u) => u.house === unit.house && u.type === unit.type
          );
          if (existing) {
            existing.count += unit.count;
          } else {
            mergedUnits.push({ ...unit });
          }
        }
      }

      const mergedActivity: ArmyActivity = {
        turnsResting: 0,
        turnsFortiying: 0,
        turnsMarching: 0,
        turnsSinceMerge: 0, // just merged this turn
        turnsSinceSplit: base.activity.turnsSinceSplit,
      };

      const merged: Army = {
        ...base,
        units: mergedUnits,
        leaders: [...base.leaders, ...rest.flatMap((a) => a.leaders)],
        notables: [
          ...(base.notables ?? []),
          ...rest.flatMap((a) => a.notables ?? []),
        ],
        activity: mergedActivity,
        stance: "Disorganised — units still integrating after the merger",
      };

      const remainingIds = new Set(rest.map((a) => a.id));
      const updatedArmies = state.armies
        .filter((a) => !remainingIds.has(a.id))
        .map((a) => (a.id === base.id ? merged : a));

      return {
        ...state,
        armies: updatedArmies,
        selectedArmyIds: [base.id],
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "OPEN_SPLIT": {
      return { ...state, splitPanelArmyId: action.armyId };
    }

    case "CLOSE_SPLIT": {
      return { ...state, splitPanelArmyId: null };
    }

    case "SPLIT_ARMY": {
      const { config } = action;
      const sourceArmy = state.armies.find((a) => a.id === config.sourceArmyId);
      if (!sourceArmy) return state;

      const splitActivity: ArmyActivity = {
        turnsResting: 0,
        turnsFortiying: 0,
        turnsMarching: 0,
        turnsSinceMerge: sourceArmy.activity.turnsSinceMerge,
        turnsSinceSplit: 0, // just split this turn
      };

      function buildSplitArmy(
        half: SplitConfig["army1"],
        nameSuffix: string
      ): Army {
        const leaders = sourceArmy!.leaders.filter((l) =>
          half.leaderNames.includes(l.name)
        );
        const notables = sourceArmy!.notables?.filter((n) =>
          half.notableNames.includes(n.name)
        ) ?? [];
        const leadName = leaders[0]?.name ?? nameSuffix;
        // Derive suffix from source army name
        const srcWords = sourceArmy!.name.split(" ");
        const suffix = srcWords.length >= 2 ? srcWords[srcWords.length - 1] : "Host";

        return {
          id: crypto.randomUUID(),
          name: `${leadName}'s ${suffix}`,
          holdId: sourceArmy!.holdId,
          faction: sourceArmy!.faction,
          units: half.units,
          leaders,
          notables,
          morale: sourceArmy!.morale,
          tiredness: sourceArmy!.tiredness,
          stance: "Uncertain — formations still settling after the split",
          activity: { ...splitActivity },
          movesSinceRest: sourceArmy!.movesSinceRest ?? 0,
          lastHoldId: sourceArmy!.lastHoldId,
        };
      }

      const army1 = buildSplitArmy(config.army1, "First");
      const army2 = buildSplitArmy(config.army2, "Second");

      const updatedArmies = state.armies
        .filter((a) => a.id !== config.sourceArmyId)
        .concat([army1, army2]);

      return {
        ...state,
        armies: updatedArmies,
        splitPanelArmyId: null,
        selectedArmyIds: [army1.id],
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "TOGGLE_ADMIN": {
      return { ...state, adminMode: !state.adminMode };
    }

    case "SWITCH_FACTION": {
      return {
        ...state,
        activeFaction: action.faction,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "TOGGLE_BATTLE_LOG": {
      return { ...state, battleLogOpen: !state.battleLogOpen };
    }

    case "UPDATE_TIREDNESS": {
      return {
        ...state,
        armies: state.armies.map((army) => {
          const update = action.updates.find((u) => u.armyId === army.id);
          if (!update) return army;
          return {
            ...army,
            tiredness: update.tiredness,
            ...(update.morale ? { morale: update.morale } : {}),
            ...(update.stance ? { stance: update.stance } : {}),
          };
        }),
      };
    }

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  return { state, dispatch };
}

export { determineTerritory };
