import type {
  Command,
  FactionId,
  GameState,
  ResolveOptions,
  TurnEvent,
  TurnResult,
} from "@wargame/shared";
import type { NodeAdjudicatorFn } from "./contested.js";
import { GameGraph } from "./graph.js";
import {
  applyDigIn,
  applyReinforceFromMoves,
  buildOrderMap,
  recordDisengageVotes,
  resolveContestedNodes,
  resolveDisengage,
  resolveRetreats,
} from "./contested.js";
import { extractMoveOrders, resolveMovement } from "./movement.js";
import { resolveInterceptFire } from "./intercept.js";
import { applyMoraleAndRout } from "./morale.js";
import { clearArrivedFlags, syncEngagements } from "./node-utils.js";
import {
  enrichMoveCommand,
  getDeniedNodes,
  validateOrders,
} from "./validator.js";

export interface FactionOrders {
  factionId: FactionId;
  commands: Command[];
}

export function createInitialState(
  map: GameState["map"],
  scenario: {
    id: string;
    capitalNodes: Record<FactionId, string>;
    units: Array<{
      id: string;
      name: string;
      factionId: FactionId;
      nodeId: string;
      attack: number;
      defense: number;
      strength: number;
      morale?: number;
      tiredness?: number;
      unitType?: import("@wargame/shared").UnitType;
    }>;
  }
): GameState {
  const units: GameState["units"] = {};
  const graph = new GameGraph(map);
  for (const t of scenario.units) {
    const node = graph.getNode(t.nodeId);
    const fortified =
      node?.tags.includes("fortified") || node?.tags.includes("stronghold");
    units[t.id] = {
      id: t.id,
      templateId: t.id,
      name: t.name,
      factionId: t.factionId,
      nodeId: t.nodeId,
      attack: t.attack,
      defense: t.defense,
      strength: t.strength,
      tiredness: t.tiredness ?? 0,
      dugIn: fortified ? 0.3 : 0,
      morale: t.morale ?? 80,
      engaged: false,
      ...(t.unitType ? { unitType: t.unitType } : {}),
    };
  }
  const factions = Object.keys(scenario.capitalNodes) as FactionId[];
  const abandonCapitalUsed = Object.fromEntries(
    factions.map((f) => [f, false])
  ) as Record<FactionId, boolean>;
  const state: GameState = {
    map,
    meta: {
      scenarioId: scenario.id,
      capitalNodes: { ...scenario.capitalNodes },
      abandonCapitalUsed,
      winnerFactionId: null,
    },
    units,
    engagements: {},
    turn: 1,
    phase: "planning",
  };
  return syncEngagements(state);
}

export function checkVictory(state: GameState): FactionId | null {
  const allFactions = [
    ...new Set(Object.values(state.units).map((u) => u.factionId)),
  ] as FactionId[];
  for (const faction of allFactions) {
    const enemies = allFactions.filter((f) => f !== faction);
    const allEnemiesDead = enemies.every((enemy) =>
      Object.values(state.units).every(
        (u) => u.factionId !== enemy || u.strength <= 0
      )
    );
    if (allEnemiesDead) return faction;
  }
  return null;
}

function defaultAttackCommands(state: GameState, factionId: FactionId): Command[] {
  const cmds: Command[] = [];
  for (const u of Object.values(state.units)) {
    if (u.factionId !== factionId) continue;
    if (!u.engaged) continue;
    const hasEnemy = Object.values(state.units).some(
      (x) => x.nodeId === u.nodeId && x.factionId !== factionId
    );
    if (!hasEnemy) continue;

    // Retain previous stance; reset one-off intentions (assault/breakthrough) to plain attack
    const stance = u.lastStance ?? "balanced";
    const intention: import("@wargame/shared").AttackIntention =
      u.lastAttackIntention === "assault" || u.lastAttackIntention === "breakthrough"
        ? "attack"
        : (u.lastAttackIntention ?? "attack");

    cmds.push({
      type: "attack",
      unitId: u.id,
      stance,
      intention,
    });
  }
  return cmds;
}

export interface AdjudicatedResolveOptions extends ResolveOptions {
  adjudicator?: NodeAdjudicatorFn;
}

export async function resolveTurn(
  state: GameState,
  allOrders: FactionOrders[],
  options: AdjudicatedResolveOptions
): Promise<TurnResult> {
  const graph = new GameGraph(state.map);
  const config = options.combat;
  const events: TurnEvent[] = [];
  let next: GameState = { ...state, phase: "resolving" };

  const allCommands: Command[] = [];
  for (const fo of allOrders) {
    validateOrders(next, graph, fo.factionId, fo.commands);
    allCommands.push(...fo.commands);
  }

  // Record the last attack stance/intention on each unit for default ordering next turn
  const unitsWithLastOrder = { ...next.units };
  for (const cmd of allCommands) {
    if (cmd.type === "attack") {
      const u = unitsWithLastOrder[cmd.unitId];
      if (u) {
        unitsWithLastOrder[cmd.unitId] = {
          ...u,
          lastStance: cmd.stance,
          lastAttackIntention: cmd.intention,
        };
      }
    }
  }
  next = { ...next, units: unitsWithLastOrder };

  for (const fo of allOrders) {
    const defaults = defaultAttackCommands(next, fo.factionId);
    const existing = new Set(
      fo.commands.filter((c) => "unitId" in c).map((c) => (c as { unitId: string }).unitId)
    );
    for (const d of defaults) {
      if (d.type === "attack" && !existing.has(d.unitId)) {
        allCommands.push(d);
        fo.commands.push(d);
      }
    }
  }

  next = recordDisengageVotes(next, allCommands);
  const disengageResult = resolveDisengage(next);
  next = disengageResult.state;
  events.push(...disengageResult.events);

  const deniedNodes = getDeniedNodes(next, allCommands, config.dugInThreshold);

  const moveOrders = allCommands
    .filter((c) => c.type === "move")
    .map((c) => enrichMoveCommand(graph, next, c));

  const preMove = next;
  const moveResult = resolveMovement(
    next,
    moveOrders,
    graph,
    config,
    deniedNodes
  );
  next = moveResult.state;
  events.push(...moveResult.events);

  const interceptResult = resolveInterceptFire(
    preMove,
    next,
    allCommands,
    moveResult.arrivals,
    graph,
    config
  );
  next = interceptResult.state;
  events.push(...interceptResult.events);

  const reinforceResult = applyReinforceFromMoves(
    next,
    moveOrders,
    moveResult.arrivals
  );
  next = reinforceResult.state;
  events.push(...reinforceResult.events);

  const digResult = applyDigIn(next, allCommands, config);
  next = digResult.state;
  events.push(...digResult.events);

  const speedDefenseByUnit = new Map(moveResult.speedDefenseByUnit);

  const retreatResult = resolveRetreats(
    next,
    allCommands,
    graph,
    config,
    speedDefenseByUnit
  );
  next = retreatResult.state;
  events.push(...retreatResult.events);

  // Increment turnsInContact for all currently engaged units before combat resolution
  const unitsWithContact = { ...next.units };
  for (const [id, u] of Object.entries(unitsWithContact)) {
    if (u.engaged) {
      unitsWithContact[id] = {
        ...u,
        turnsInContact: (u.turnsInContact ?? 0) + 1,
      };
    }
  }
  next = { ...next, units: unitsWithContact };

  const contestedResult = await resolveContestedNodes(
    next,
    allCommands,
    graph,
    config,
    speedDefenseByUnit,
    moveOrders,
    options.adjudicator,
    next.turn
  );
  next = contestedResult.state;
  events.push(...contestedResult.events);

  const moraleResult = applyMoraleAndRout(next, graph, config);
  next = moraleResult.state;
  events.push(...moraleResult.events);

  // Idle recovery: units not in contact with enemies regain tiredness and morale
  const recUnits = { ...next.units };
  for (const [id, u] of Object.entries(recUnits)) {
    const hasEnemy = Object.values(recUnits).some(
      (x) => x.nodeId === u.nodeId && x.factionId !== u.factionId
    );
    if (!hasEnemy && !u.engaged) {
      recUnits[id] = {
        ...u,
        tiredness: Math.max(0, u.tiredness - 0.08),
        morale: Math.min(100, u.morale + 1),
      };
    }
  }
  next = { ...next, units: recUnits };

  next = syncEngagements(next);
  next = clearArrivedFlags(next);

  // Reset turnsInContact for units that are no longer in contact
  const resetContactUnits = { ...next.units };
  for (const [id, u] of Object.entries(resetContactUnits)) {
    if (!u.engaged && (u.turnsInContact ?? 0) > 0) {
      resetContactUnits[id] = { ...u, turnsInContact: 0 };
    }
  }
  next = { ...next, units: resetContactUnits };

  const winner = checkVictory(next);
  if (winner) {
    next = {
      ...next,
      meta: { ...next.meta, winnerFactionId: winner },
      phase: "planning",
      turn: next.turn,
    };
    events.push({ type: "victory", factionId: winner, reason: "annihilation" });
  } else {
    next = {
      ...next,
      phase: "planning",
      turn: next.turn + 1,
    };
  }

  return { state: next, events };
}
