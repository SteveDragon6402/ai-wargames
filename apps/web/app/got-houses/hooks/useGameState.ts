import { useReducer } from "react";
import type {
  GameState,
  GameAction,
  Faction,
  MoveOrder,
  Army,
  BattleContext,
  BattleReport,
  RetreatEntry,
  Casualty,
  FallenFigure,
} from "../types";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { HOLDS_MAP } from "../data/holds";

function getAdjacentHolds(holdId: string): string[] {
  return HOLDS_MAP.get(holdId)?.links ?? [];
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
  allOrders: MoveOrder[]
): BattleContext[] {
  // Group armies by holdId
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

    // Determine where each army came from
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
    });
  }
  return battles;
}

/** Apply casualties to the army list. Returns updated armies (removes depleted units/armies). */
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

/** Remove fallen leaders and notables from armies. */
function applyFallen(armies: Army[], fallen: FallenFigure[]): Army[] {
  return armies.map((army) => {
    const armyFallen = fallen.filter((f) => f.armyId === army.id);
    if (armyFallen.length === 0) return army;

    const leaderNames = new Set(
      armyFallen.filter((f) => f.isLeader).map((f) => f.name)
    );
    const notableNames = new Set(
      armyFallen.filter((f) => !f.isLeader).map((f) => f.name)
    );

    return {
      ...army,
      leaders: army.leaders.filter((l) => !leaderNames.has(l.name)),
      notables: army.notables?.filter((n) => !notableNames.has(n.name)) ?? [],
    };
  });
}

/** Build retreat entries for armies that must retreat after battles. */
function buildRetreats(
  retreatingArmyIds: string[],
  armies: Army[],
  battles: BattleContext[]
): RetreatEntry[] {
  return retreatingArmyIds
    .map((armyId) => {
      const army = armies.find((a) => a.id === armyId);
      if (!army) return null;

      // Find which battle this army was involved in
      const battle = battles.find(
        (b) =>
          b.northArmies.some((a) => a.id === armyId) ||
          b.westArmies.some((a) => a.id === armyId)
      );
      if (!battle) return null;

      const isNorth = army.faction === "north";

      // Forbidden: the hold the opposing faction's armies came from
      const forbiddenHoldIds: string[] = [];
      if (isNorth && battle.westFromHoldId) forbiddenHoldIds.push(battle.westFromHoldId);
      if (!isNorth && battle.northFromHoldId) forbiddenHoldIds.push(battle.northFromHoldId);

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
        nextState = setFactionOrders(nextState, faction, {
          orders: [...filtered, order],
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

    case "SUBMIT_FACTION": {
      const nextState = setFactionOrders(state, action.faction, { submitted: true });
      if (nextState.north.submitted && nextState.westerlands.submitted) {
        // Both submitted — trigger move application and battle detection
        return gameReducer(nextState, { type: "ADJUDICATE_MOVES" });
      }
      return nextState;
    }

    case "ADJUDICATE_MOVES": {
      const allOrders: MoveOrder[] = [
        ...state.north.orders,
        ...state.westerlands.orders,
      ];

      // Apply moves
      const updatedArmies = state.armies.map((army) => {
        const order = allOrders.find((o) => o.armyId === army.id);
        if (order) return { ...army, holdId: order.toHoldId };
        return army;
      });

      // Detect battles
      const pendingBattles = detectBattles(updatedArmies, allOrders);

      if (pendingBattles.length === 0) {
        // No battles — advance turn immediately
        return {
          ...state,
          turn: state.turn + 1,
          phase: "planning",
          armies: updatedArmies,
          north: { orders: [], submitted: false },
          westerlands: { orders: [], submitted: false },
          selectedHoldId: null,
          selectedArmyIds: [],
          moveMode: { active: false, validTargets: [] },
          pendingBattles: [],
        };
      }

      // Battles to resolve — enter resolving phase
      return {
        ...state,
        phase: "resolving",
        armies: updatedArmies,
        north: { orders: [], submitted: false },
        westerlands: { orders: [], submitted: false },
        selectedHoldId: null,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
        pendingBattles,
      };
    }

    case "BATTLES_RESOLVED": {
      const { reports } = action;

      // Gather all casualties and fallen across all battles
      const allCasualties = reports.flatMap((r) => r.casualties);
      const allFallen = reports.flatMap((r) => r.fallen);

      // Enforce retreat logic from holdResult — no enemies may share a location
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
          // abandoned (or any unknown/contested value) → both retreat
          retreating = [...northIds, ...westIds];
        }
        return { ...report, retreatingArmyIds: retreating };
      });

      const allRetreatingIds = correctedReports.flatMap((r) => r.retreatingArmyIds);

      // Apply casualties and fallen figures
      let updatedArmies = applyCasualties(state.armies, allCasualties);
      updatedArmies = applyFallen(updatedArmies, allFallen);

      // Build retreat entries
      const retreats = buildRetreats(allRetreatingIds, updatedArmies, state.pendingBattles);

      const newBattleReports = [...state.battleReports, ...correctedReports];

      if (retreats.length === 0) {
        return {
          ...state,
          turn: state.turn + 1,
          phase: "planning",
          armies: updatedArmies,
          pendingBattles: [],
          battleReports: newBattleReports,
          retreats: [],
        };
      }

      return {
        ...state,
        phase: "retreat",
        armies: updatedArmies,
        pendingBattles: [],
        battleReports: newBattleReports,
        retreats,
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

      const merged: Army = {
        ...base,
        units: mergedUnits,
        leaders: [...base.leaders, ...rest.flatMap((a) => a.leaders)],
        notables: [
          ...(base.notables ?? []),
          ...rest.flatMap((a) => a.notables ?? []),
        ],
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

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  return { state, dispatch };
}
