import { useReducer } from "react";
import type {
  GameState,
  GameAction,
  Faction,
  MoveOrder,
  Army,
  ArmyActivity,
  ArmyApproach,
  BattleContext,
  BattleReport,
  RetreatEntry,
  Casualty,
  FallenFigure,
  Hold,
  ArmyConditionUpdate,
  SplitConfig,
  CharacterState,
  NpcAgentState,
  NpcRuntimePatch,
  ChatMessage,
  Leader,
  Notable,
  GarrisonTransfer,
  HoldRuntime,
  FactionEvent,
  GarrisonConditionUpdate,
} from "../types";
import { INITIAL_GAME_STATE } from "../data/initial-state";
import { HOLDS_MAP } from "../data/holds";
import { getCastleSeed } from "../data/castles";
import { getPathwayRoute } from "../data/pathways";
import { findCharacterIdByName } from "../data/characters";
import {
  eventFromSpeech,
  eventsFromBattleReports,
  eventsFromResolvedOrders,
} from "../lib/faction-events";
import { armyNameForCommander } from "../lib/army-naming";
import {
  applyFriendlyPresenceRefill,
  freeCapacity,
  garrisonHeadcount,
  isGarrisonable,
  isFriendlyTo,
  mergeUnits,
  normalizeGarrison,
  refillToDefault,
  subtractUnits,
} from "../lib/hold-runtime";
import {
  applyGarrisonCasualties,
  detectSiegeBattles,
  holdIdFromGarrisonArmyId,
  isGarrisonArmyId,
  liftSiegeRecovery,
  reconcileSieges,
  tickSieges,
} from "../lib/siege";
import {
  syncCastellansWithSieges,
  removeEphemeralCastellan,
  protectedTalkCharacterIds,
  pruneOrphanCastellans,
} from "../lib/castellan";

/** Appoint lead commander (or clear). Promotes notables into leaders and syncs NPC roles. */
function appointLeadCommander(
  army: Army,
  leaderName: string | null,
  characters: Record<string, CharacterState>
): { army: Army; characters: Record<string, CharacterState> } {
  let leaders = [...army.leaders];
  let notables = [...(army.notables ?? [])];
  let nextChars = { ...characters };

  if (leaderName) {
    const asLeader = leaders.find((l) => l.name === leaderName);
    const asNotable = notables.find((n) => n.name === leaderName);

    if (asNotable && !asLeader) {
      notables = notables.filter((n) => n.name !== leaderName);
      leaders = [{ name: asNotable.name }, ...leaders];
    } else if (asLeader) {
      leaders = [asLeader, ...leaders.filter((l) => l.name !== leaderName)];
    } else {
      // Unknown name — still allow naming the host after them
      leaders = [{ name: leaderName }, ...leaders];
    }

    // NPC role: appointed person becomes commander; prior commanders on this army demote
    for (const [id, c] of Object.entries(nextChars)) {
      if (c.kind !== "npc" || !c.alive) continue;
      if (c.armyId !== army.id) continue;
      if (c.name === leaderName) {
        nextChars[id] = { ...c, role: "commander", armyId: army.id };
      } else if (c.role === "commander") {
        nextChars[id] = { ...c, role: "notable" };
      }
    }

    // If character exists but wasn't on this army yet, attach them
    const cid = findCharacterIdByName(nextChars, leaderName);
    if (cid) {
      const c = nextChars[cid];
      if (c?.kind === "npc") {
        nextChars[cid] = { ...c, role: "commander", armyId: army.id };
      } else if (c?.kind === "player") {
        nextChars[cid] = { ...c, armyId: army.id };
      }
    }
  } else {
    // No commander — demote NPC commanders on this host to notables
    for (const [id, c] of Object.entries(nextChars)) {
      if (c.kind !== "npc" || !c.alive) continue;
      if (c.armyId === army.id && c.role === "commander") {
        nextChars[id] = { ...c, role: "notable" };
      }
    }
  }

  const updated: Army = {
    ...army,
    leaders,
    notables,
    name: armyNameForCommander(
      leaderName,
      army.units,
      army.faction,
      army.name
    ),
  };

  return { army: updated, characters: nextChars };
}

function resolveSplitHalf(
  source: Army,
  half: SplitConfig["army1"]
): { leaders: Leader[]; notables: Notable[] } {
  const leaders: Leader[] = [];
  for (const name of half.leaderNames) {
    const fromLeader = source.leaders.find((l) => l.name === name);
    if (fromLeader) {
      leaders.push(fromLeader);
      continue;
    }
    const fromNotable = source.notables?.find((n) => n.name === name);
    if (fromNotable) {
      leaders.push({ name: fromNotable.name });
    }
  }
  const notables = (source.notables ?? []).filter(
    (n) =>
      half.notableNames.includes(n.name) && !half.leaderNames.includes(n.name)
  );
  return { leaders, notables };
}

function syncCharactersAfterSplit(
  characters: Record<string, CharacterState>,
  army1: Army,
  army2: Army,
  sourceArmyId: string
): Record<string, CharacterState> {
  const next = { ...characters };

  const place = (army: Army) => {
    const names = new Set([
      ...army.leaders.map((l) => l.name),
      ...(army.notables ?? []).map((n) => n.name),
    ]);
    const lead = army.leaders[0]?.name ?? null;
    for (const [id, c] of Object.entries(next)) {
      if (!c.alive || !names.has(c.name)) continue;
      if (c.kind === "npc") {
        const role =
          lead && c.name === lead
            ? "commander"
            : c.role === "commander"
              ? "notable"
              : c.role;
        next[id] = { ...c, armyId: army.id, role };
      } else {
        next[id] = { ...c, armyId: army.id };
      }
    }
  };

  place(army1);
  place(army2);

  for (const [id, c] of Object.entries(next)) {
    if (c.armyId !== sourceArmyId) continue;
    if (c.kind === "npc") {
      next[id] = {
        ...c,
        armyId: null,
        role: c.role === "commander" ? "notable" : c.role,
      };
    } else {
      next[id] = { ...c, armyId: null };
    }
  }
  return next;
}

function applyCharacterPatches(
  characters: Record<string, CharacterState>,
  patches: NpcRuntimePatch[]
): Record<string, CharacterState> {
  if (patches.length === 0) return characters;
  const next = { ...characters };
  for (const p of patches) {
    const cur = next[p.id];
    if (!cur || cur.kind !== "npc") continue;
    const updated: NpcAgentState = {
      ...cur,
      ...(p.notepad !== undefined ? { notepad: p.notepad } : {}),
      ...(p.mood !== undefined ? { mood: p.mood } : {}),
      ...(p.dispositionToward !== undefined
        ? { dispositionToward: p.dispositionToward }
        : {}),
      ...(p.inviteHistory !== undefined ? { inviteHistory: p.inviteHistory } : {}),
      ...(p.alive !== undefined ? { alive: p.alive } : {}),
      ...(p.armyId !== undefined ? { armyId: p.armyId } : {}),
      ...(p.adviceGivenIds !== undefined
        ? { adviceGivenIds: p.adviceGivenIds }
        : {}),
      ...(p.role !== undefined ? { role: p.role } : {}),
    };
    next[p.id] = updated;
  }
  return next;
}

/** Insert a turn separator into every living conversation thread. */
function withTurnBreaks(state: GameState, newTurn: number): ConversationThreadLike[] {
  const msg = (threadId: string): ChatMessage => ({
    id: `turn-${newTurn}-${threadId}`,
    speakerId: "system",
    speakerName: "",
    text: `— Turn ${newTurn} —`,
    at: Date.now(),
    kind: "turn_break",
  });
  return state.conversations.map((t) => {
    if (t.status === "closed" && t.messages.length === 0) return t;
    // Skip empty brand-new threads with no history
    if (t.messages.length === 0) return t;
    const last = t.messages[t.messages.length - 1];
    if (last?.kind === "turn_break" && last.text.includes(`Turn ${newTurn}`)) {
      return t;
    }
    return { ...t, messages: [...t.messages, msg(t.id)] };
  });
}

// Local alias so the helper stays typed without a circular import dance
type ConversationThreadLike = GameState["conversations"][number];

function advanceToPlanning(
  state: GameState,
  patch: Partial<GameState>
): GameState {
  const newTurn = state.turn + 1;
  return {
    ...state,
    ...patch,
    turn: newTurn,
    phase: "planning",
    conversations: withTurnBreaks(state, newTurn),
    speechesThisTurn: [],
    speechArmyId: null,
  };
}

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

    const armyApproaches: Record<string, ArmyApproach> = {};
    for (const order of allOrders) {
      if (order.toHoldId !== holdId) continue;
      if (!armiesHere.some((a) => a.id === order.armyId)) continue;
      const fromHold = HOLDS_MAP.get(order.fromHoldId);
      armyApproaches[order.armyId] = {
        fromHoldId: order.fromHoldId,
        fromHoldName: fromHold?.name ?? order.fromHoldId,
        route: getPathwayRoute(order.fromHoldId, order.toHoldId),
      };
    }

    battles.push({
      holdId,
      northArmies: northHere,
      westArmies: westHere,
      northFromHoldId: northFrom,
      westFromHoldId: westFrom,
      armyApproaches,
      armyOrders: armyOrdersMap,
    });
  }
  return battles;
}

/** Apply casualties to the army list. Returns updated armies (removes depleted units). */
function applyCasualties(armies: Army[], casualties: Casualty[]): Army[] {
  // Normalise a house name for fuzzy matching:
  // strips the "House " prefix and lowercases so "House Stark" == "stark" == "Stark"
  const norm = (s: string) => s.toLowerCase().replace(/^\s*house\s+/i, "").trim();

  return armies
    .map((army) => {
      const armyCasualties = casualties.filter((c) => c.armyId === army.id);
      if (armyCasualties.length === 0) return army;

      // Track which casualty entries have been claimed by a specific unit
      const claimed = new Set<number>();

      const updatedUnits = army.units
        .map((unit) => {
          // 1. Try exact match (armyId + unitType + house)
          // 2. Fallback: case-insensitive + strip "House " prefix
          const matchingIndices = armyCasualties
            .map((c, i) => ({ c, i }))
            .filter(({ c }) => {
              if (c.unitType !== unit.type) return false;
              return c.house === unit.house || norm(c.house) === norm(unit.house);
            })
            .map(({ i }) => i);

          if (matchingIndices.length === 0) return unit;

          // Sum all matching entries (Claude sometimes emits multiple rows for same unit)
          const totalLoss = matchingIndices.reduce(
            (sum, i) => sum + armyCasualties[i].count,
            0
          );
          matchingIndices.forEach((i) => claimed.add(i));
          return { ...unit, count: Math.max(0, unit.count - totalLoss) };
        })
        .filter((u) => u.count > 0);

      // Proportional fallback for any remaining unclaimed casualties
      // (Claude used a house name that doesn't match any real unit in this army —
      // distribute them across units of the matching type, proportional to size)
      const unclaimed = armyCasualties.filter((_, i) => !claimed.has(i));
      if (unclaimed.length > 0) {
        const byType = new Map<string, number>();
        for (const c of unclaimed) {
          byType.set(c.unitType, (byType.get(c.unitType) ?? 0) + c.count);
        }
        for (const [unitType, totalLoss] of byType) {
          const typeUnits = updatedUnits.filter((u) => u.type === unitType);
          if (typeUnits.length === 0) continue;
          const totalOfType = typeUnits.reduce((s, u) => s + u.count, 0);
          for (const unit of typeUnits) {
            const share = Math.round((unit.count / totalOfType) * totalLoss);
            unit.count = Math.max(0, unit.count - share);
          }
        }
        // Remove any units zeroed out in the proportional pass
        for (let i = updatedUnits.length - 1; i >= 0; i--) {
          if (updatedUnits[i].count <= 0) updatedUnits.splice(i, 1);
        }
      }

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
    .filter((id) => !isGarrisonArmyId(id))
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
        // Map selection takes the right rail back from Talk
        talkPickerOpen: action.holdId ? false : state.talkPickerOpen,
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
      const army = state.armies.find((a) => a.id === action.armyId);
      return {
        ...state,
        selectedArmyIds: next,
        selectedHoldId: army?.holdId ?? state.selectedHoldId,
        moveMode: { active: false, validTargets: [] },
        talkPickerOpen: false,
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
        talkPickerOpen: false,
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
        speechArmyId: null,
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
        // Clear any stance / storm order for this army since it's now moving
        const newStanceOrders = { ...existing.stanceOrders };
        delete newStanceOrders[order.armyId];
        nextState = setFactionOrders(nextState, faction, {
          orders: [...filtered, order],
          stanceOrders: newStanceOrders,
          stormArmyIds: existing.stormArmyIds.filter((id) => id !== order.armyId),
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
        stormArmyIds: factionOrders.stormArmyIds.filter(
          (id) => id !== action.armyId
        ),
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

      const pendingField = detectBattles(updatedArmies, allOrders, armyOrdersMap);
      const fieldHoldIds = new Set(pendingField.map((b) => b.holdId));

      const stormArmyIds = [
        ...state.north.stormArmyIds,
        ...state.westerlands.stormArmyIds,
      ];
      const sallyHoldIds = [
        ...state.north.sallyHoldIds,
        ...state.westerlands.sallyHoldIds,
      ];

      const siegeTick = tickSieges(
        state.turn,
        updatedArmies,
        state.holdStates ?? {},
        state.holdStates ?? {}
      );

      const refilledHolds = applyFriendlyPresenceRefill(
        updatedArmies,
        siegeTick.holdStates
      );

      const protectIds = protectedTalkCharacterIds(state.conversations);
      const castellanSync = syncCastellansWithSieges(
        state.holdStates ?? {},
        refilledHolds,
        state.characters,
        protectIds
      );

      const siegeBattles = detectSiegeBattles(
        updatedArmies,
        castellanSync.holdStates,
        fieldHoldIds,
        stormArmyIds,
        sallyHoldIds,
        armyOrdersMap
      );

      const pendingBattles = [...pendingField, ...siegeBattles];

      const orderEvents = eventsFromResolvedOrders(
        state.turn,
        state.armies,
        state.north.orders,
        state.westerlands.orders,
        state.north.stanceOrders,
        state.westerlands.stanceOrders
      );

      // Storm / sally order events
      const siegeOrderEvents: FactionEvent[] = [];
      for (const armyId of stormArmyIds) {
        const army = updatedArmies.find((a) => a.id === armyId);
        if (!army) continue;
        const hold = HOLDS_MAP.get(army.holdId)?.name ?? army.holdId;
        siegeOrderEvents.push({
          id: `ev-storm-${armyId}-${state.turn}`,
          turn: state.turn,
          faction: army.faction,
          kind: "storm",
          armyId,
          holdIds: [army.holdId],
          summary: `${army.name} storms the gates at ${hold}`,
          detail: `Turn ${state.turn}: ${army.name} ordered to storm ${hold}.`,
        });
      }
        for (const holdId of sallyHoldIds) {
        const hs = castellanSync.holdStates[holdId];
        const hold = HOLDS_MAP.get(holdId)?.name ?? holdId;
        const faction =
          hs?.garrison.faction === "north" || hs?.garrison.faction === "westerlands"
            ? hs.garrison.faction
            : hs?.controller === "north" || hs?.controller === "westerlands"
              ? hs.controller
              : null;
        if (!faction) continue;
        siegeOrderEvents.push({
          id: `ev-sally-${holdId}-${state.turn}`,
          turn: state.turn,
          faction,
          kind: "sally",
          holdIds: [holdId],
          summary: `Garrison of ${hold} sallies out`,
          detail: `Turn ${state.turn}: defenders of ${hold} ordered a sally.`,
        });
      }

      return {
        ...state,
        phase: "resolving",
        armies: updatedArmies,
        characters: castellanSync.characters,
        holdStates: castellanSync.holdStates,
        north: {
          orders: [],
          stanceOrders: {},
          stormArmyIds: [],
          sallyHoldIds: [],
          submitted: false,
        },
        westerlands: {
          orders: [],
          stanceOrders: {},
          stormArmyIds: [],
          sallyHoldIds: [],
          submitted: false,
        },
        selectedHoldId: null,
        selectedArmyIds: [],
        moveMode: { active: false, validTargets: [] },
        speechArmyId: null,
        garrisonPanel: null,
        pendingBattles,
        turnHistory: [...(state.turnHistory ?? []), newTurnHistory],
        factionEvents: [
          ...state.factionEvents,
          ...orderEvents,
          ...siegeTick.events,
          ...siegeOrderEvents,
        ].slice(-400),
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
        retreating = retreating.filter((id) => !isGarrisonArmyId(id));
        return { ...report, retreatingArmyIds: retreating };
      });

      const allConditionUpdates = correctedReports.flatMap((r) => r.conditionUpdates ?? []);

      // Apply casualties and fallen figures
      let updatedArmies = applyCasualties(state.armies, allCasualties);
      updatedArmies = applyFallen(updatedArmies, allFallen);

      // Apply garrison casualties / control flips for siege engagements
      let holdStates: Record<string, HoldRuntime> = {
        ...(state.holdStates ?? {}),
      };
      const siegeOutcomeEvents: FactionEvent[] = [];

      for (const report of correctedReports) {
        const battle = state.pendingBattles.find((b) => b.holdId === report.holdId);
        if (!battle?.garrisonHoldId) continue;
        const holdId = battle.garrisonHoldId;
        let hs = holdStates[holdId];
        if (!hs) continue;

        const gArmyId = `garrison:${holdId}`;
        const gCas = report.casualties.filter(
          (c) => c.armyId === gArmyId || holdIdFromGarrisonArmyId(c.armyId) === holdId
        );
        let garrison = applyGarrisonCasualties(hs.garrison, gCas);
        const gFallenNames = new Set(
          report.fallen
            .filter(
              (f) =>
                f.armyId === gArmyId || holdIdFromGarrisonArmyId(f.armyId) === holdId
            )
            .map((f) => f.name)
        );
        if (gFallenNames.size > 0) {
          garrison = {
            ...garrison,
            leaders: garrison.leaders.filter((l) => !gFallenNames.has(l.name)),
            notables: (garrison.notables ?? []).filter(
              (n) => !gFallenNames.has(n.name)
            ),
          };
        }

        const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
        const eng = battle.engagement ?? "field";
        const menLeft = garrisonHeadcount(garrison);

        if (eng === "storm") {
          const besieger = hs.siege?.besiegerFaction;
          if (besieger && report.holdResult === besieger) {
            // Walls taken — garrison broken; seat empty until conqueror peels men in
            garrison = normalizeGarrison({
              faction: null,
              units: [],
              leaders: [],
              notables: [],
              morale: "Broken — the walls are lost",
              tiredness: "Scattered or dead",
              stance: "None — hold vacant",
            });
            hs = {
              ...hs,
              controller: null,
              garrison,
              siege: null,
              postSiegeTurnsLeft: 3,
              scar: "Stormed and broken.",
              supplies: "Gates forced; the seat lies open.",
              foodDaysRemaining: null,
              skipUpdates: false,
            };
            siegeOutcomeEvents.push({
              id: `ev-storm-win-${holdId}-${state.turn}`,
              turn: state.turn,
              faction: besieger,
              kind: "storm",
              holdIds: [holdId],
              summary: `${holdName} stormed — walls taken`,
              detail: `Turn ${state.turn}: ${besieger} stormed ${holdName}. Garrison broken; hold vacant until garrisoned.`,
            });
          } else {
            // Storm failed — keep depleted garrison, siege continues
            hs = { ...hs, garrison };
            if (menLeft <= 0) {
              hs = {
                ...hs,
                controller: null,
                garrison: normalizeGarrison({
                  faction: null,
                  units: [],
                  leaders: [],
                  notables: [],
                  morale: "Broken",
                  tiredness: "Gone",
                  stance: "None",
                }),
                siege: null,
                postSiegeTurnsLeft: 3,
                scar: "Garrison destroyed in the assault.",
                supplies: "Empty walls after the failed storm.",
                foodDaysRemaining: null,
                skipUpdates: false,
              };
            } else {
              hs = { ...hs, skipUpdates: false };
            }
          }
        } else if (eng === "sally") {
          const besieger = hs.siege?.besiegerFaction;
          const defender =
            garrison.faction === "north" || garrison.faction === "westerlands"
              ? garrison.faction
              : hs.controller === "north" || hs.controller === "westerlands"
                ? hs.controller
                : null;

          if (defender && report.holdResult === defender) {
            // Sally success — siege broken; refill + scar, no soft snap
            hs = liftSiegeRecovery({ ...hs, garrison }, holdId);
            hs = {
              ...hs,
              supplies: "Sally broke the investment; stores thin but free.",
            };
            siegeOutcomeEvents.push({
              id: `ev-sally-win-${holdId}-${state.turn}`,
              turn: state.turn,
              faction: defender,
              kind: "sally",
              holdIds: [holdId],
              summary: `Sally from ${holdName} broke the siege`,
              detail: `Turn ${state.turn}: defenders of ${holdName} sallied and lifted the investment.`,
            });
          } else {
            hs = { ...hs, garrison, skipUpdates: false };
            if (menLeft <= 0) {
              hs = {
                ...hs,
                controller: null,
                garrison: normalizeGarrison({
                  faction: null,
                  units: [],
                  leaders: [],
                  notables: [],
                  morale: "Broken",
                  tiredness: "Gone",
                  stance: "None",
                }),
                siege: null,
                postSiegeTurnsLeft: 3,
                scar: "Garrison destroyed in the sally.",
                supplies: "Empty walls after a failed sortie.",
                foodDaysRemaining: null,
                skipUpdates: false,
              };
            }
          }
          void besieger;
        } else {
          hs = { ...hs, garrison };
        }

        holdStates[holdId] = hs;
      }

      // Tear down ephemeral castellans when sieges end mid-battle resolve
      // (keep if an open parley thread still references them)
      const protectIds = protectedTalkCharacterIds(state.conversations);
      const castellanSync = syncCastellansWithSieges(
        state.holdStates ?? {},
        holdStates,
        state.characters,
        protectIds
      );
      holdStates = castellanSync.holdStates;

      // Mark character agents dead when they fall
      let characters = castellanSync.characters;
      for (const f of allFallen) {
        const cid = findCharacterIdByName(characters, f.name);
        if (!cid) continue;
        const cur = characters[cid];
        if (!cur) continue;
        characters = {
          ...characters,
          [cid]: { ...cur, alive: false, armyId: null },
        };
      }

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

        // Garrison soft wear from storm/sally adjudication
        for (const upd of allConditionUpdates) {
          const gHoldId = holdIdFromGarrisonArmyId(upd.armyId);
          if (!gHoldId) continue;
          const hs = holdStates[gHoldId];
          if (!hs || garrisonHeadcount(hs.garrison) <= 0) continue;
          holdStates[gHoldId] = {
            ...hs,
            skipUpdates: false,
            garrison: {
              ...hs.garrison,
              morale: upd.morale,
              tiredness: upd.tiredness,
              stance: upd.stance ?? hs.garrison.stance,
            },
          };
        }
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
              northFromHoldId: battle.northFromHoldId,
              westFromHoldId: battle.westFromHoldId,
              armyApproaches: battle.armyApproaches,
              armyOrders: battle.armyOrders,
              lastStand: true,
            });
            processedHolds.add(battle.holdId);
          }
        }
      }

      const nonTrappedRetreats = retreats.filter((r) => r.validTargets.length > 0);
      const newBattleReports = [...state.battleReports, ...correctedReports];

      const battleEvents = eventsFromBattleReports(
        state.turn,
        correctedReports,
        { ...state, armies: updatedArmies, characters }
      );

      // After casualties: sole hostile host vs living garrison → invest now
      // (covers "field fight cleared the other army" without waiting a turn)
      const afterBattleSiege = reconcileSieges(
        state.turn,
        updatedArmies,
        holdStates
      );
      holdStates = afterBattleSiege.holdStates;
      const postBattleCastellan = syncCastellansWithSieges(
        state.holdStates ?? {},
        holdStates,
        characters,
        protectIds
      );
      holdStates = postBattleCastellan.holdStates;
      characters = postBattleCastellan.characters;

      const factionEvents = [
        ...state.factionEvents,
        ...battleEvents,
        ...siegeOutcomeEvents,
        ...afterBattleSiege.events,
      ].slice(-400);

      // If there are last-stand battles, re-enter resolving with them as pendingBattles
      if (lastStandBattles.length > 0) {
        return {
          ...state,
          phase: "resolving",
          armies: updatedArmies,
          characters,
          holdStates,
          pendingBattles: lastStandBattles,
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames,
          factionEvents,
        };
      }

      if (pendingRenames.length > 0) {
        return {
          ...state,
          phase: "rename_commanders",
          armies: updatedArmies,
          characters,
          holdStates,
          pendingBattles: [],
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames,
          factionEvents,
        };
      }

      if (nonTrappedRetreats.length > 0) {
        return {
          ...state,
          phase: "retreat",
          armies: updatedArmies,
          characters,
          holdStates,
          pendingBattles: [],
          battleReports: newBattleReports,
          retreats: nonTrappedRetreats,
          pendingRenames: [],
          factionEvents,
        };
      }

      return advanceToPlanning(state, {
        armies: updatedArmies,
        characters,
        holdStates,
        pendingBattles: [],
        battleReports: newBattleReports,
        retreats: [],
        pendingRenames: [],
        factionEvents,
      });
    }

    case "OPEN_COMMANDER_CHANGE": {
      return { ...state, voluntaryCommanderChange: action.armyId };
    }

    case "CLOSE_COMMANDER_CHANGE": {
      return { ...state, voluntaryCommanderChange: null };
    }

    case "SELECT_LEAD_COMMANDER": {
      const target = state.armies.find((a) => a.id === action.armyId);
      if (!target) return state;

      const { army: appointed, characters } = appointLeadCommander(
        target,
        action.leaderName,
        state.characters
      );
      const updatedArmies = state.armies.map((a) =>
        a.id === action.armyId ? appointed : a
      );

      if (state.voluntaryCommanderChange === action.armyId) {
        return {
          ...state,
          armies: updatedArmies,
          characters,
          voluntaryCommanderChange: null,
        };
      }

      const newPendingRenames = state.pendingRenames.filter(
        (id) => id !== action.armyId
      );

      if (newPendingRenames.length > 0) {
        return {
          ...state,
          armies: updatedArmies,
          characters,
          pendingRenames: newPendingRenames,
        };
      }

      if (state.retreats.length > 0) {
        return {
          ...state,
          phase: "retreat",
          armies: updatedArmies,
          characters,
          pendingRenames: [],
        };
      }

      return advanceToPlanning(state, {
        armies: updatedArmies,
        characters,
        pendingRenames: [],
      });
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
      const retreatOrders: MoveOrder[] = [];
      const armyOrdersMap: Record<string, "march" | "rest" | "fortify"> = {};

      for (const retreat of state.retreats) {
        const dest =
          retreat.chosenHoldId ??
          retreat.validTargets[0] ??
          null;
        if (!dest) continue;

        const army = updatedArmies.find((a) => a.id === retreat.armyId);
        if (!army) continue;
        const fromHoldId = army.holdId;

        updatedArmies = updatedArmies.map((a) =>
          a.id === retreat.armyId
            ? { ...a, holdId: dest, lastHoldId: fromHoldId }
            : a
        );
        retreatOrders.push({
          armyId: retreat.armyId,
          fromHoldId,
          toHoldId: dest,
        });
        armyOrdersMap[retreat.armyId] = "march";
      }

      // Retreat destinations / vacated holds may open or lift investments
      const siegeSync = reconcileSieges(
        state.turn,
        updatedArmies,
        state.holdStates ?? {}
      );
      const protectIds = protectedTalkCharacterIds(state.conversations);
      const castellanSync = syncCastellansWithSieges(
        state.holdStates ?? {},
        siegeSync.holdStates,
        state.characters,
        protectIds
      );

      const factionEvents = [
        ...state.factionEvents,
        ...siegeSync.events,
      ].slice(-400);

      // Opposing armies that retreated into the same hold fight immediately
      const clashBattles = detectBattles(
        updatedArmies,
        retreatOrders,
        armyOrdersMap
      );
      if (clashBattles.length > 0) {
        return {
          ...state,
          phase: "resolving",
          armies: updatedArmies,
          characters: castellanSync.characters,
          holdStates: castellanSync.holdStates,
          pendingBattles: clashBattles,
          retreats: [],
          factionEvents,
        };
      }

      return advanceToPlanning(state, {
        armies: updatedArmies,
        characters: castellanSync.characters,
        holdStates: castellanSync.holdStates,
        retreats: [],
        factionEvents,
      });
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

      // Capture each source army's qualitative state before merge, so the
      // tiredness API can describe the heterogeneous state of the new force.
      const mergedFrom: import("../types").MergeSourceRecord[] = selected.map((a) => ({
        name: a.name,
        morale: a.morale,
        tiredness: a.tiredness,
        stance: a.stance,
      }));

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
        mergedFrom,
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

      // Both halves need troops; commanders are optional
      const a1Troops = config.army1.units.reduce((s, u) => s + u.count, 0);
      const a2Troops = config.army2.units.reduce((s, u) => s + u.count, 0);
      if (a1Troops <= 0 || a2Troops <= 0) return state;

      const splitActivity: ArmyActivity = {
        turnsResting: 0,
        turnsFortiying: 0,
        turnsMarching: 0,
        turnsSinceMerge: sourceArmy.activity.turnsSinceMerge,
        turnsSinceSplit: 0,
      };

      function buildSplitArmy(half: SplitConfig["army1"]): Army {
        const { leaders, notables } = resolveSplitHalf(sourceArmy!, half);
        const leadName = leaders[0]?.name ?? null;
        return {
          id: crypto.randomUUID(),
          name: armyNameForCommander(
            leadName,
            half.units,
            sourceArmy!.faction,
            sourceArmy!.name
          ),
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

      const army1 = buildSplitArmy(config.army1);
      const army2 = buildSplitArmy(config.army2);
      const characters = syncCharactersAfterSplit(
        state.characters,
        army1,
        army2,
        sourceArmy.id
      );

      const updatedArmies = state.armies
        .filter((a) => a.id !== config.sourceArmyId)
        .concat([army1, army2]);

      return {
        ...state,
        armies: updatedArmies,
        characters,
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
            // mergedFrom is a one-turn field — clear it after the tiredness
            // update so the next tiredness call sees a normal single army.
            mergedFrom: undefined,
          };
        }),
      };
    }

    case "UPDATE_GARRISON_CONDITION": {
      return applyGarrisonConditionUpdates(state, action.updates);
    }

    case "TOGGLE_TALK_PICKER": {
      const open = !state.talkPickerOpen;
      return {
        ...state,
        talkPickerOpen: open,
        // Talk and army panel share the right rail
        ...(open
          ? { moveMode: { active: false, validTargets: [] }, speechArmyId: null }
          : {}),
      };
    }

    case "OPEN_CONVERSATION": {
      const ids = state.openConversationIds.includes(action.threadId)
        ? state.openConversationIds
        : [...state.openConversationIds, action.threadId];
      return {
        ...state,
        openConversationIds: ids,
        focusedConversationId: action.threadId,
        talkPickerOpen: true,
      };
    }

    case "FOCUS_CONVERSATION": {
      return {
        ...state,
        focusedConversationId: action.threadId,
        talkPickerOpen: true,
      };
    }

    case "CLOSE_CONVERSATION_DOCK": {
      const openConversationIds = state.openConversationIds.filter(
        (id) => id !== action.threadId
      );
      const focusedConversationId =
        state.focusedConversationId === action.threadId
          ? openConversationIds[openConversationIds.length - 1] ?? null
          : state.focusedConversationId;
      // Mark closed thread so protect set drops it, then prune orphan castellans
      const conversations = state.conversations.map((t) =>
        t.id === action.threadId && t.status !== "closed"
          ? {
              ...t,
              status: "closed" as const,
              closedReason: t.closedReason ?? "Conversation closed.",
            }
          : t
      );
      const protectIds = protectedTalkCharacterIds(
        conversations.filter((t) => openConversationIds.includes(t.id) || t.status === "pending_invite" || t.status === "active")
      );
      // Protect any participant still in an open dock or active/pending thread
      const dockProtect = new Set(protectIds);
      for (const tid of openConversationIds) {
        const t = conversations.find((c) => c.id === tid);
        if (!t) continue;
        for (const pid of t.participantIds) dockProtect.add(pid);
      }
      const pruned = pruneOrphanCastellans(
        state.holdStates ?? {},
        state.characters,
        dockProtect
      );
      return {
        ...state,
        conversations,
        characters: pruned.characters,
        holdStates: pruned.holdStates,
        openConversationIds,
        focusedConversationId,
        // Keep hub open so you can start another talk
        talkPickerOpen: true,
      };
    }

    case "UPSERT_CONVERSATION": {
      const exists = state.conversations.some((t) => t.id === action.thread.id);
      const conversations = exists
        ? state.conversations.map((t) =>
            t.id === action.thread.id ? action.thread : t
          )
        : [...state.conversations, action.thread];
      const shouldOpen =
        action.thread.status === "active" ||
        action.thread.status === "pending_invite";
      const open =
        shouldOpen && !state.openConversationIds.includes(action.thread.id)
          ? [...state.openConversationIds, action.thread.id]
          : state.openConversationIds;
      return {
        ...state,
        conversations,
        openConversationIds: open,
        focusedConversationId: shouldOpen
          ? action.thread.id
          : state.focusedConversationId,
        talkPickerOpen: true,
      };
    }

    case "APPEND_MESSAGES": {
      return {
        ...state,
        conversations: state.conversations.map((t) =>
          t.id === action.threadId
            ? { ...t, messages: [...t.messages, ...action.messages] }
            : t
        ),
      };
    }

    case "PATCH_CHARACTERS": {
      return {
        ...state,
        characters: applyCharacterPatches(state.characters, action.patches),
      };
    }

    case "OPEN_SPEECH": {
      if (state.phase !== "planning") return state;
      if (state.speechesThisTurn.includes(action.armyId)) return state;
      return {
        ...state,
        speechArmyId: action.armyId,
        moveMode: { active: false, validTargets: [] },
      };
    }

    case "CLOSE_SPEECH": {
      return { ...state, speechArmyId: null };
    }

    case "APPLY_SPEECH": {
      const { armyId, speech, reaction, condition, impliedOrder, commanderPatch } =
        action;
      const army = state.armies.find((a) => a.id === armyId);
      const faction = army?.faction;
      if (!faction || !army) return state;

      const armies = state.armies.map((a) =>
        a.id === armyId
          ? {
              ...a,
              morale: condition.morale,
              tiredness: condition.tiredness,
              ...(condition.stance ? { stance: condition.stance } : {}),
            }
          : a
      );

      // Clear queued move — speech is what this army is doing this turn
      const clearOrders = (orders: typeof state.north) => ({
        ...orders,
        orders: orders.orders.filter((o) => o.armyId !== armyId),
        stanceOrders: {
          ...orders.stanceOrders,
          ...(impliedOrder === "rest" || impliedOrder === "fortify"
            ? { [armyId]: impliedOrder }
            : {}),
        },
      });

      const north =
        faction === "north" ? clearOrders(state.north) : state.north;
      const westerlands =
        faction === "westerlands"
          ? clearOrders(state.westerlands)
          : state.westerlands;

      const speechEvent = eventFromSpeech(
        state.turn,
        army,
        speech,
        reaction
      );

      const base = {
        ...state,
        armies,
        north,
        westerlands,
        speechesThisTurn: [...state.speechesThisTurn, armyId],
        speechArmyId: null,
        factionEvents: [...state.factionEvents, speechEvent].slice(-400),
        characters: commanderPatch
          ? applyCharacterPatches(state.characters, [commanderPatch])
          : state.characters,
      };

      if (impliedOrder === "none") {
        const strip = (fo: typeof state.north) => ({
          ...fo,
          orders: fo.orders.filter((o) => o.armyId !== armyId),
          stanceOrders: { ...fo.stanceOrders },
        });
        return {
          ...base,
          north: faction === "north" ? strip(state.north) : state.north,
          westerlands:
            faction === "westerlands"
              ? strip(state.westerlands)
              : state.westerlands,
        };
      }

      return base;
    }

    case "APPEND_FACTION_EVENTS": {
      if (action.events.length === 0) return state;
      return {
        ...state,
        factionEvents: [...state.factionEvents, ...action.events].slice(-400),
      };
    }

    case "APPEND_ADVICE": {
      if (action.records.length === 0) return state;
      const adviceLog = [...state.adviceLog, ...action.records].slice(-200);
      let characters = state.characters;
      for (const r of action.records) {
        const cur = characters[r.fromCharacterId];
        if (!cur || cur.kind !== "npc") continue;
        characters = {
          ...characters,
          [r.fromCharacterId]: {
            ...cur,
            adviceGivenIds: [...cur.adviceGivenIds, r.id].slice(-40),
          },
        };
      }
      return { ...state, adviceLog, characters };
    }

    case "APPEND_TURN_BREAKS": {
      return {
        ...state,
        conversations: withTurnBreaks(state, action.turn),
      };
    }

    case "MARK_CHARACTERS_FALLEN": {
      let characters = state.characters;
      for (const name of action.names) {
        const cid = findCharacterIdByName(characters, name);
        if (!cid) continue;
        characters = {
          ...characters,
          [cid]: { ...characters[cid], alive: false, armyId: null },
        };
      }
      return { ...state, characters };
    }

    case "OPEN_GARRISON_PANEL": {
      return {
        ...state,
        garrisonPanel: {
          holdId: action.holdId,
          mode: action.mode,
          armyId: action.armyId,
        },
        splitPanelArmyId: null,
        speechArmyId: null,
      };
    }

    case "CLOSE_GARRISON_PANEL": {
      return { ...state, garrisonPanel: null };
    }

    case "GARRISON_TRANSFER": {
      return applyGarrisonTransfer(state, action.transfer);
    }

    case "ABANDON_HOLD": {
      return applyAbandonHold(state, action.holdId, action.armyId);
    }

    case "SET_STORM_ORDER": {
      const army = state.armies.find((a) => a.id === action.armyId);
      if (!army) return state;
      const key = army.faction === "north" ? "north" : "westerlands";
      const fo = state[key];
      const stormArmyIds = action.active
        ? fo.stormArmyIds.includes(action.armyId)
          ? fo.stormArmyIds
          : [...fo.stormArmyIds, action.armyId]
        : fo.stormArmyIds.filter((id) => id !== action.armyId);
      // Clear conflicting stance / sally when storming
      const sallyHoldIds = action.active
        ? fo.sallyHoldIds.filter((h) => h !== army.holdId)
        : fo.sallyHoldIds;
      const stanceOrders = { ...fo.stanceOrders };
      if (action.active) delete stanceOrders[action.armyId];
      return {
        ...state,
        [key]: { ...fo, stormArmyIds, sallyHoldIds, stanceOrders },
      };
    }

    case "SET_SALLY_ORDER": {
      const hs = state.holdStates?.[action.holdId];
      if (!hs) return state;
      const faction =
        hs.controller === "north" || hs.controller === "westerlands"
          ? hs.controller
          : hs.garrison.faction === "north" || hs.garrison.faction === "westerlands"
            ? hs.garrison.faction
            : null;
      if (!faction) return state;
      const key = faction === "north" ? "north" : "westerlands";
      const fo = state[key];
      const sallyHoldIds = action.active
        ? fo.sallyHoldIds.includes(action.holdId)
          ? fo.sallyHoldIds
          : [...fo.sallyHoldIds, action.holdId]
        : fo.sallyHoldIds.filter((id) => id !== action.holdId);
      // Clear storm orders at this hold when sallying
      const stormArmyIds = action.active
        ? fo.stormArmyIds.filter((id) => {
            const a = state.armies.find((x) => x.id === id);
            return a?.holdId !== action.holdId;
          })
        : fo.stormArmyIds;
      return {
        ...state,
        [key]: { ...fo, sallyHoldIds, stormArmyIds },
      };
    }

    case "APPLY_NEGOTIATOR_ENSURE": {
      return {
        ...state,
        characters: action.characters,
        holdStates: action.holdStates,
      };
    }

    case "REMOVE_EPHEMERAL_CASTELLAN": {
      const removed = removeEphemeralCastellan(
        action.holdId,
        state.holdStates ?? {},
        state.characters
      );
      // Close open threads with the removed castellan
      let conversations = state.conversations;
      if (removed.removedId) {
        conversations = conversations.map((t) =>
          t.participantIds.includes(removed.removedId!)
            ? {
                ...t,
                status: "closed" as const,
                closedReason: "Castellan dismissed — the siege is over.",
              }
            : t
        );
      }
      return {
        ...state,
        characters: removed.characters,
        holdStates: removed.holdStates,
        conversations,
      };
    }

    default:
      return state;
  }
}

function applyGarrisonConditionUpdates(
  state: GameState,
  updates: GarrisonConditionUpdate[]
): GameState {
  if (updates.length === 0) return state;
  const holdStates = { ...(state.holdStates ?? {}) };
  for (const upd of updates) {
    const hs = holdStates[upd.holdId];
    if (!hs) continue;
    holdStates[upd.holdId] = {
      ...hs,
      skipUpdates:
        upd.skipUpdates !== undefined ? upd.skipUpdates : hs.skipUpdates,
      scar: upd.scar !== undefined ? upd.scar : hs.scar,
      garrison: {
        ...hs.garrison,
        morale: upd.morale,
        tiredness: upd.tiredness,
        stance: upd.stance,
      },
    };
  }
  return { ...state, holdStates };
}

function applyGarrisonTransfer(
  state: GameState,
  transfer: GarrisonTransfer
): GameState {
  const seed = getCastleSeed(transfer.holdId);
  if (!isGarrisonable(seed)) return state;
  const hs = state.holdStates?.[transfer.holdId];
  if (!hs) return state;

  const takeMen = transfer.units.reduce((s, u) => s + u.count, 0);
  if (takeMen <= 0 && transfer.leaderNames.length === 0 && transfer.notableNames.length === 0) {
    return state;
  }

  let holdStates = { ...state.holdStates };
  let characters = { ...state.characters };
  let garrison = {
    ...normalizeGarrison(hs.garrison),
    units: hs.garrison.units.map((u) => ({ ...u })),
    leaders: [...hs.garrison.leaders],
    notables: [...(hs.garrison.notables ?? [])],
  };
  const events: FactionEvent[] = [];
  const holdName = HOLDS_MAP.get(transfer.holdId)?.name ?? transfer.holdId;

  if (transfer.mode === "deposit") {
    if (!transfer.armyId) return state;
    const army = state.armies.find((a) => a.id === transfer.armyId);
    if (!army || army.holdId !== transfer.holdId) return state;
    let updatedArmy = { ...army };

    const free = freeCapacity(transfer.holdId, hs);
    if (takeMen > free) return state;

    // Peel from army
    updatedArmy = {
      ...updatedArmy,
      units: subtractUnits(updatedArmy.units, transfer.units),
      leaders: updatedArmy.leaders.filter(
        (l) => !transfer.leaderNames.includes(l.name)
      ),
      notables: (updatedArmy.notables ?? []).filter(
        (n) => !transfer.notableNames.includes(n.name)
      ),
    };

    const peeledLeaders = army.leaders.filter((l) =>
      transfer.leaderNames.includes(l.name)
    );
    const peeledNotables = (army.notables ?? []).filter((n) =>
      transfer.notableNames.includes(n.name)
    );

    garrison = {
      ...garrison,
      faction: army.faction,
      units: mergeUnits(garrison.units, transfer.units),
      leaders: [...garrison.leaders, ...peeledLeaders],
      notables: [...(garrison.notables ?? []), ...peeledNotables],
    };

    // Claiming / liberating
    let nextHs: HoldRuntime = { ...hs, garrison };
    const liberating =
      hs.homeFaction === army.faction &&
      hs.controller !== army.faction;

    if (liberating) {
      // Drive out foreign garrison, refill native default, then keep peeled extras
      nextHs = refillToDefault(transfer.holdId, {
        ...hs,
        controller: army.faction,
        garrison: normalizeGarrison({
          faction: army.faction,
          units: [],
          leaders: [],
          notables: [],
          morale: garrison.morale,
          tiredness: garrison.tiredness,
          stance: garrison.stance,
        }),
      });
      nextHs = {
        ...nextHs,
        garrison: {
          ...normalizeGarrison(nextHs.garrison),
          faction: army.faction,
          units: mergeUnits(nextHs.garrison.units, transfer.units),
          leaders: [...peeledLeaders],
          notables: [...peeledNotables],
        },
      };
      events.push({
        id: `ev-lib-${transfer.holdId}-${Date.now()}`,
        turn: state.turn,
        faction: army.faction,
        kind: "liberate",
        holdIds: [transfer.holdId],
        armyId: army.id,
        summary: `Liberated ${holdName}`,
        detail: `${army.name} liberated ${holdName}; default garrison refilled.`,
      });
    } else if (
      hs.controller !== army.faction &&
      (hs.controller === null ||
        hs.controller === "hostile" ||
        garrisonHeadcount(hs.garrison) === 0)
    ) {
      // Claim empty / hostile seat with peeled troops only
      nextHs = {
        ...hs,
        controller: army.faction,
        garrison: normalizeGarrison({
          faction: army.faction,
          units: transfer.units.map((u) => ({ ...u })),
          leaders: peeledLeaders,
          notables: peeledNotables,
          morale: army.morale,
          tiredness: army.tiredness,
          stance: "Holding the keep",
        }),
        siege: null,
        supplies: "Claimed and manned.",
        foodDaysRemaining:
          hs.foodDaysRemaining ?? seed.defaultFoodDays,
      };
      events.push({
        id: `ev-claim-${transfer.holdId}-${Date.now()}`,
        turn: state.turn,
        faction: army.faction,
        kind: "claim",
        holdIds: [transfer.holdId],
        armyId: army.id,
        summary: `Claimed ${holdName}`,
        detail: `${army.name} garrisoned and claimed ${holdName}.`,
      });
    } else if (hs.controller === army.faction) {
      events.push({
        id: `ev-gar-${transfer.holdId}-${Date.now()}`,
        turn: state.turn,
        faction: army.faction,
        kind: "garrison",
        holdIds: [transfer.holdId],
        armyId: army.id,
        summary: `Reinforced garrison at ${holdName}`,
        detail: `${army.name} deposited ${takeMen} men into ${holdName}.`,
      });
    } else {
      return state; // cannot deposit into an enemy-held garrison
    }

    // Sync characters into garrison (armyId null while in castle)
    for (const name of [...transfer.leaderNames, ...transfer.notableNames]) {
      const cid = findCharacterIdByName(characters, name);
      if (!cid) continue;
      const c = characters[cid];
      if (!c) continue;
      characters[cid] = {
        ...c,
        armyId: null,
        ...(c.kind === "npc" ? { holdId: transfer.holdId } : {}),
      };
    }

    holdStates[transfer.holdId] = nextHs;

    let armies = state.armies.map((a) =>
      a.id === army.id ? updatedArmy : a
    );
    if (updatedArmy.units.reduce((s, u) => s + u.count, 0) <= 0) {
      armies = armies.filter((a) => a.id !== army.id);
    } else {
      // Rename if lead commander left
      const lead = updatedArmy.leaders[0]?.name ?? null;
      armies = armies.map((a) =>
        a.id === army.id
          ? {
              ...updatedArmy,
              name: armyNameForCommander(
                lead,
                updatedArmy.units,
                updatedArmy.faction,
                updatedArmy.name
              ),
            }
          : a
      );
    }

    return {
      ...state,
      armies,
      characters,
      holdStates,
      garrisonPanel: null,
      selectedArmyIds: armies.some((a) => a.id === army.id)
        ? [army.id]
        : [],
      factionEvents: [...state.factionEvents, ...events].slice(-400),
    };
  }

  // withdraw — into selected army, or form a new impromptu host
  const targetArmy = transfer.armyId
    ? state.armies.find((a) => a.id === transfer.armyId)
    : null;
  if (transfer.armyId && (!targetArmy || targetArmy.holdId !== transfer.holdId)) {
    return state;
  }

  const faction: Faction | null =
    targetArmy?.faction ??
    (hs.controller === "north" || hs.controller === "westerlands"
      ? hs.controller
      : hs.garrison.faction === "north" || hs.garrison.faction === "westerlands"
        ? hs.garrison.faction
        : null);
  if (!faction) return state;

  const currentMen = garrisonHeadcount(garrison);
  const floor = isFriendlyTo(hs, faction) ? seed.defaultGarrison : 0;
  // Friendly holder: never below default. Non-home uses abandon instead.
  if (!isFriendlyTo(hs, faction)) return state;
  if (currentMen - takeMen < floor) return state;

  garrison = {
    ...garrison,
    units: subtractUnits(garrison.units, transfer.units),
    leaders: garrison.leaders.filter(
      (l) => !transfer.leaderNames.includes(l.name)
    ),
    notables: (garrison.notables ?? []).filter(
      (n) => !transfer.notableNames.includes(n.name)
    ),
  };

  const addLeaders = hs.garrison.leaders.filter((l) =>
    transfer.leaderNames.includes(l.name)
  );
  const addNotables = (hs.garrison.notables ?? []).filter((n) =>
    transfer.notableNames.includes(n.name)
  );

  const leadName = addLeaders[0]?.name ?? null;
  let armies: Army[];
  let hostArmyId: string;

  if (targetArmy) {
    const updatedArmy: Army = {
      ...targetArmy,
      units: mergeUnits(targetArmy.units, transfer.units),
      leaders: [...targetArmy.leaders, ...addLeaders],
      notables: [...(targetArmy.notables ?? []), ...addNotables],
    };
    hostArmyId = targetArmy.id;
    armies = state.armies.map((a) => (a.id === targetArmy.id ? updatedArmy : a));
  } else {
    const newArmy: Army = {
      id: crypto.randomUUID(),
      name: armyNameForCommander(leadName, transfer.units, faction),
      holdId: transfer.holdId,
      faction,
      units: transfer.units.map((u) => ({ ...u })),
      leaders: addLeaders,
      notables: addNotables,
      morale: hs.garrison.morale,
      tiredness: hs.garrison.tiredness,
      stance: "Forming outside the gates",
      activity: {
        turnsResting: 0,
        turnsFortiying: 0,
        turnsMarching: 0,
        turnsSinceMerge: null,
        turnsSinceSplit: 0,
      },
      movesSinceRest: 0,
    };
    hostArmyId = newArmy.id;
    armies = [...state.armies, newArmy];
  }

  for (const name of [...transfer.leaderNames, ...transfer.notableNames]) {
    const cid = findCharacterIdByName(characters, name);
    if (!cid) continue;
    const c = characters[cid];
    if (!c) continue;
    characters[cid] = {
      ...c,
      armyId: hostArmyId,
      ...(c.kind === "npc" ? { holdId: null } : {}),
    };
  }

  holdStates[transfer.holdId] = { ...hs, garrison };
  const hostName =
    armies.find((a) => a.id === hostArmyId)?.name ?? "new host";
  events.push({
    id: `ev-ungar-${transfer.holdId}-${Date.now()}`,
    turn: state.turn,
    faction,
    kind: "garrison",
    holdIds: [transfer.holdId],
    armyId: hostArmyId,
    summary: `Withdrew men from ${holdName} garrison`,
    detail: `${hostName} withdrew ${takeMen} men from ${holdName} (floor ${floor}).`,
  });

  return {
    ...state,
    armies,
    characters,
    holdStates,
    garrisonPanel: null,
    selectedArmyIds: [hostArmyId],
    factionEvents: [...state.factionEvents, ...events].slice(-400),
  };
}

function applyAbandonHold(
  state: GameState,
  holdId: string,
  armyId: string
): GameState {
  const seed = getCastleSeed(holdId);
  if (!isGarrisonable(seed)) return state;
  const army = state.armies.find((a) => a.id === armyId);
  if (!army || army.holdId !== holdId) return state;
  const hs = state.holdStates?.[holdId];
  if (!hs) return state;
  // Only non-home occupier may fully abandon
  if (hs.controller !== army.faction) return state;
  if (hs.homeFaction === army.faction) return state;

  const men = garrisonHeadcount(hs.garrison);
  const updatedArmy: Army = {
    ...army,
    units: mergeUnits(army.units, hs.garrison.units),
    leaders: [...army.leaders, ...hs.garrison.leaders],
    notables: [...(army.notables ?? []), ...(hs.garrison.notables ?? [])],
  };

  let characters = { ...state.characters };
  for (const fig of [...hs.garrison.leaders, ...(hs.garrison.notables ?? [])]) {
    const cid = findCharacterIdByName(characters, fig.name);
    if (!cid) continue;
    const c = characters[cid];
    if (!c) continue;
    characters[cid] = {
      ...c,
      armyId: army.id,
      ...(c.kind === "npc" ? { holdId: null } : {}),
    };
  }

  let nextHs: HoldRuntime = {
    ...hs,
    controller: hs.homeFaction,
    garrison: normalizeGarrison({
      faction: hs.homeFaction === "hostile" ? null : hs.homeFaction,
      units: [],
      leaders: [],
      notables: [],
      morale: hs.garrison.morale,
      tiredness: hs.garrison.tiredness,
      stance: hs.garrison.stance,
    }),
    siege: null,
    supplies: "Abandoned by the conqueror; home forces reclaiming.",
  };
  nextHs = refillToDefault(holdId, nextHs);

  // Drop ephemeral castellan if abandoning
  const afterAbandon = removeEphemeralCastellan(
    holdId,
    { ...state.holdStates, [holdId]: nextHs },
    characters
  );
  characters = afterAbandon.characters;
  nextHs = afterAbandon.holdStates[holdId] ?? nextHs;

  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const event: FactionEvent = {
    id: `ev-abandon-${holdId}-${Date.now()}`,
    turn: state.turn,
    faction: army.faction,
    kind: "abandon",
    holdIds: [holdId],
    armyId: army.id,
    summary: `Abandoned ${holdName}`,
    detail: `${army.name} abandoned ${holdName} (${men} men withdrawn); home refilled to default.`,
  };

  return {
    ...state,
    armies: state.armies.map((a) => (a.id === armyId ? updatedArmy : a)),
    characters,
    holdStates: { ...state.holdStates, [holdId]: nextHs },
    garrisonPanel: null,
    factionEvents: [...state.factionEvents, event].slice(-400),
  };
}

export function useGameState(initialState: GameState = INITIAL_GAME_STATE) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return { state, dispatch };
}

export { determineTerritory };
