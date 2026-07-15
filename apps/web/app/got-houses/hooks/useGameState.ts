import { useReducer } from "react";
import type { GameState, GameAction, Faction, MoveOrder, Army } from "../types";
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

/** Execute all queued move orders and advance the turn. */
function adjudicate(state: GameState): GameState {
  const allOrders: MoveOrder[] = [
    ...state.north.orders,
    ...state.westerlands.orders,
  ];

  const updatedArmies = state.armies.map((army) => {
    const order = allOrders.find((o) => o.armyId === army.id);
    if (order) return { ...army, holdId: order.toHoldId };
    return army;
  });

  return {
    ...state,
    turn: state.turn + 1,
    armies: updatedArmies,
    north: { orders: [], submitted: false },
    westerlands: { orders: [], submitted: false },
    selectedHoldId: null,
    selectedArmyIds: [],
    moveMode: { active: false, validTargets: [] },
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
      // In non-admin mode, can only select own armies
      if (!state.adminMode && armyFaction !== state.activeFaction) return state;
      // Can't select if faction has already submitted
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

      // Collect valid targets = holds adjacent to ALL selected armies' current holds
      // (they may be at different holds — the intersection is what's reachable by all)
      const selectedArmies = state.selectedArmyIds
        .map((id) => state.armies.find((a) => a.id === id))
        .filter(Boolean) as Army[];

      if (selectedArmies.length === 0) return state;

      // For multi-hold selection: valid target = adjacent to at least one selected army
      // (each army moves independently — we validate per-army at QUEUE_MOVE)
      const allAdjacentSets = selectedArmies.map((a) =>
        new Set(getAdjacentHolds(a.holdId))
      );
      const union = new Set<string>();
      allAdjacentSets.forEach((s) => s.forEach((id) => union.add(id)));

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

      // Build orders for armies that can actually reach the target
      const newOrders: MoveOrder[] = selectedArmies
        .filter((army) => getAdjacentHolds(army.holdId).includes(action.toHoldId))
        .map((army) => ({
          armyId: army.id,
          fromHoldId: army.holdId,
          toHoldId: action.toHoldId,
        }));

      if (newOrders.length === 0) return state;

      // Group by faction and add to pending orders (replace if army already has order)
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
      return {
        ...state,
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "SUBMIT_FACTION": {
      const nextState = setFactionOrders(state, action.faction, { submitted: true });
      // Auto-adjudicate if both factions have submitted
      if (nextState.north.submitted && nextState.westerlands.submitted) {
        return adjudicate(nextState);
      }
      return nextState;
    }

    case "ADJUDICATE": {
      return adjudicate(state);
    }

    case "COMBINE_ARMIES": {
      if (state.selectedArmyIds.length < 2) return state;

      const selected = state.selectedArmyIds
        .map((id) => state.armies.find((a) => a.id === id))
        .filter(Boolean) as Army[];

      // Must all be at same hold, same faction
      const holdId = selected[0].holdId;
      const faction = selected[0].faction;
      if (!selected.every((a) => a.holdId === holdId && a.faction === faction)) {
        return state;
      }

      // Largest army is the base (most total units)
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

      const mergedLeaders = [
        ...base.leaders,
        ...rest.flatMap((a) => a.leaders),
      ];

      const merged: Army = {
        ...base,
        units: mergedUnits,
        leaders: mergedLeaders,
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

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  return { state, dispatch };
}
