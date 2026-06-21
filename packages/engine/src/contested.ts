import type {
  AttackCommand,
  Command,
  CombatConfig,
  FactionId,
  GameState,
  MoveCommand,
  RetreatCommand,
  Stance,
  TurnEvent,
} from "@wargame/shared";
import { GameGraph } from "./graph.js";
import {
  resolveClash,
  type UnitCombatOrder,
  applyCasualty,
  bumpMorale,
  dropMorale,
} from "./combat.js";
import {
  bucketByNode,
  isContested,
  nodeAcrossEntryEdge,
  recordEntryEdge,
  syncEngagements,
  unitsAtNode,
} from "./node-utils.js";
import type { ArrivalRecord } from "./movement.js";
import { speedDefenseBonus, speedTier } from "./terrain.js";

// ─── AI adjudicator interface ────────────────────────────────────────────────
// Defined here so the engine package has no Anthropic dependency.
// The real implementation lives in packages/server and is injected via resolveContestedNodes.

export interface BattleUnitContext {
  id: string;
  name: string;
  faction: string;
  templateId: string;
  strengthFraction: number;
  strengthLabel: string;
  morale: number;
  moraleLabel: string;
  fatigueLabel: string;
  dugInLabel: string;
  dugInValue: number;
  turnsInContact: number;
  arrivedThisTurn: boolean;
  stance: string;
  intention: string;
  intentionDescription: string;
  isAssault: boolean;
  unitType?: string;
  isFlanked?: boolean;
  isFlankingAttacker?: boolean;
}

export interface NodeBattleSide {
  factionId: FactionId;
  units: BattleUnitContext[];
}

export interface NodeBattleContext {
  turnNumber: number;
  location: {
    nodeId: string;
    name: string;
    tags: string[];
  };
  sides: [NodeBattleSide, NodeBattleSide];
  flankedFaction?: string;
}

export interface UnitBattleOutcome {
  unitId: string;
  strengthLossPct: number;
  moraleDelta: number;
  expelled: boolean;
  breaksThrough?: boolean;
}

export interface NodeBattleResult {
  narrative: string;
  reasoning: string;
  overallWinner: "side1" | "side2" | "draw";
  unitOutcomes: UnitBattleOutcome[];
}

export type NodeAdjudicatorFn = (ctx: NodeBattleContext) => Promise<NodeBattleResult | null>;

export interface OrderMap {
  byUnit: Map<string, Command>;
}

export function buildOrderMap(commands: Command[]): OrderMap {
  const byUnit = new Map<string, Command>();
  for (const c of commands) {
    if ("unitId" in c) {
      byUnit.set(c.unitId, c);
    }
  }
  return { byUnit };
}

export function resolveDisengage(state: GameState): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  let next = { ...state, engagements: { ...state.engagements } };

  for (const [nodeId, eng] of Object.entries(next.engagements)) {
    const votes = eng.disengageVotes;
    const factionsAtNode = [
      ...new Set(unitsAtNode(next, nodeId).map((u) => u.factionId)),
    ];
    if (factionsAtNode.length > 0 && factionsAtNode.every((f) => votes[f])) {
      delete next.engagements[nodeId];
      const units = { ...next.units };
      for (const u of unitsAtNode(next, nodeId)) {
        units[u.id] = { ...u, engaged: false };
      }
      next = { ...next, units };
      events.push({ type: "disengage", nodeId });
    }
  }

  return { state: syncEngagements(next), events };
}

export function applyDigIn(
  state: GameState,
  commands: Command[],
  config: CombatConfig
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const units = { ...state.units };

  for (const cmd of commands) {
    if (cmd.type !== "dig_in") continue;
    const u = units[cmd.unitId];
    if (!u) continue;
    const alone = unitsAtNode(state, u.nodeId).every((x) => x.factionId === u.factionId);
    if (!alone) continue;

    const delta = cmd.intention === "deny" ? 0.25 : 0.35;
    units[cmd.unitId] = {
      ...u,
      dugIn: Math.min(1, u.dugIn + delta),
      morale: Math.min(100, u.morale + config.morale.digIn),
    };
    events.push({
      type: "dig_in",
      unitId: cmd.unitId,
      nodeId: u.nodeId,
      intention: cmd.intention,
    });
    events.push({
      type: "morale_change",
      unitId: cmd.unitId,
      delta: config.morale.digIn,
      newMorale: units[cmd.unitId]!.morale,
    });
  }

  return { state: { ...state, units }, events };
}

export function applyReinforceFromMoves(
  state: GameState,
  moveOrders: MoveCommand[],
  arrivals: ArrivalRecord[]
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const units = { ...state.units };
  const arrivalSet = new Set(
    arrivals.filter((a) => {
      const order = moveOrders.find((m) => m.unitId === a.unitId);
      return order?.intention === "reinforce";
    }).map((a) => a.unitId)
  );

  for (const unitId of arrivalSet) {
    const u = units[unitId];
    if (!u) continue;
    const allies = unitsAtNode(state, u.nodeId).filter(
      (x) => x.factionId === u.factionId && x.id !== unitId
    );
    if (allies.length === 0) continue;

    units[unitId] = {
      ...u,
      morale: Math.min(100, u.morale + 3),
      strength: Math.min(1, u.strength + 0.02),
    };
    for (const ally of allies) {
      if (units[ally.id]) {
        units[ally.id] = { ...units[ally.id]!, reinforced: true };
      }
    }
    events.push({ type: "reinforce", unitId, nodeId: u.nodeId });
  }

  return { state: { ...state, units }, events };
}

function getCombatOrder(
  cmd: Command | undefined,
  unit: import("@wargame/shared").UnitState,
  digInCmd: Command | undefined,
  speedDefenseMult?: number,
  flanking?: { flanked?: boolean; flanking?: boolean }
): UnitCombatOrder {
  const defaultStance: Stance = "balanced";
  const flankFields = {
    unitType: unit.unitType,
    flanked: flanking?.flanked,
    flanking: flanking?.flanking,
  };

  if (cmd?.type === "attack") {
    return {
      stance: cmd.stance,
      attackIntention: cmd.intention,
      targetUnitId: cmd.targetUnitId,
      breakthroughTargetNodeId: cmd.breakthroughTargetNodeId,
      isAssault: cmd.intention === "assault",
      speedDefenseMult,
      reinforceDefenseMult: unit.reinforced ? 1.1 : undefined,
      arrivedThisTurn: unit.arrivedThisTurn,
      ...flankFields,
    };
  }

  if (cmd?.type === "move") {
    return {
      stance: cmd.stance,
      moveIntention: cmd.intention,
      isAssault: cmd.intention === "assault",
      speedDefenseMult,
      reinforceDefenseMult: unit.reinforced ? 1.1 : undefined,
      arrivedThisTurn: unit.arrivedThisTurn,
      ...flankFields,
    };
  }

  if (cmd?.type === "cover") {
    return {
      stance: "defensive",
      reinforceDefenseMult: 1.15,
      ...flankFields,
    };
  }

  if (digInCmd?.type === "dig_in") {
    return {
      stance: "defensive",
      digInIntention: digInCmd.intention,
      reinforceDefenseMult: unit.reinforced ? 1.1 : undefined,
      ...flankFields,
    };
  }

  return {
    stance: defaultStance,
    attackIntention: "attack",
    reinforceDefenseMult: unit.reinforced ? 1.1 : undefined,
    arrivedThisTurn: unit.arrivedThisTurn,
    ...flankFields,
  };
}

function findDigInOrder(
  orderMap: OrderMap,
  unitId: string,
  state: GameState
): Command | undefined {
  const cmd = orderMap.byUnit.get(unitId);
  if (cmd?.type === "dig_in") return cmd;
  const u = state.units[unitId];
  if (!u || u.dugIn < 0.2) return undefined;
  return { type: "dig_in", unitId, intention: "hold" as const };
}

export function resolveRetreats(
  state: GameState,
  allCommands: Command[],
  graph: GameGraph,
  config: CombatConfig,
  speedDefenseByUnit: Map<string, number>
): { state: GameState; events: TurnEvent[] } {
  const events: TurnEvent[] = [];
  let next = state;
  const orderMap = buildOrderMap(allCommands);

  const retreats: RetreatCommand[] = allCommands.filter(
    (c): c is RetreatCommand => c.type === "retreat"
  );

  for (const r of retreats) {
    const u = next.units[r.unitId];
    if (!u || !isContested(next, u.nodeId)) continue;
    if (!graph.isAdjacent(u.nodeId, r.targetNodeId)) continue;

    const eng = next.engagements[u.nodeId];

    // Flanked faction cannot retreat — their entry edge is cut off by the flanker
    if (eng?.flankedFaction === u.factionId) continue;

    const entryEdge = eng?.entryEdgeByFaction?.[u.factionId];
    if (entryEdge) {
      const required = nodeAcrossEntryEdge(graph, u.nodeId, entryEdge);
      if (required && r.targetNodeId !== required) continue;
    }

    let mult = 1;
    const enemies = unitsAtNode(next, u.nodeId).filter((e) => e.factionId !== u.factionId);
    for (const e of enemies) {
      const eCmd = orderMap.byUnit.get(e.id);
      if (eCmd?.type === "attack" && eCmd.stance === "aggressive") {
        mult = config.retreatLossMultiplier;
        break;
      }
      if (eCmd?.type === "move" && eCmd.stance === "aggressive") {
        mult = config.retreatLossMultiplier;
        break;
      }
    }

    let casualtyMult = 0.5 * mult;
    const coverCmd = [...orderMap.byUnit.values()].find(
      (c) =>
        c.type === "cover" &&
        c.coverUnitId === r.unitId &&
        next.units[c.unitId]?.nodeId === u.nodeId
    );
    if (coverCmd?.type === "cover") {
      const coverUnit = next.units[coverCmd.unitId];
      if (coverUnit) {
        let maxEnemyAtk = 0;
        for (const e of enemies) {
          const eOrder = getCombatOrder(orderMap.byUnit.get(e.id), e, undefined);
          maxEnemyAtk = Math.max(
            maxEnemyAtk,
            e.attack * (eOrder.stance === "aggressive" ? 1.25 : 1)
          );
        }
        const coverDef = coverUnit.defense * 1.15;
        if (coverDef >= maxEnemyAtk * 0.9) {
          casualtyMult *= 0.5;
        }
      }
    }

    const retreatSpeed = speedTier(r.speed);
    let pursuitBonus = 1;
    for (const e of enemies) {
      const eCmd = orderMap.byUnit.get(e.id);
      if (eCmd?.type === "move" && eCmd.targetNodeId === r.targetNodeId) {
        const eSpeed = speedTier(eCmd.speed);
        if (eSpeed > retreatSpeed) {
          pursuitBonus = config.retreatLossMultiplier;
        } else if (retreatSpeed > eSpeed) {
          speedDefenseByUnit.set(
            r.unitId,
            speedDefenseBonus(r.speed, eCmd.speed, config.speedDefenseBonus)
          );
        }
      }
    }
    casualtyMult *= pursuitBonus > 1 ? pursuitBonus : 1;

    const units = { ...next.units };
    applyCasualty(units, r.unitId, config.casualtyRate * casualtyMult, {});
    dropMorale(units, r.unitId, config.morale.loss);

    if (units[r.unitId]) {
      units[r.unitId] = {
        ...units[r.unitId]!,
        nodeId: r.targetNodeId,
        engaged: false,
        dugIn: 0,
        arrivedThisTurn: true,
      };
      events.push({
        type: "move",
        unitId: r.unitId,
        from: u.nodeId,
        to: r.targetNodeId,
      });
      const edge = graph.findEdge(u.nodeId, r.targetNodeId);
      if (edge) {
        next = recordEntryEdge({ ...next, units }, r.targetNodeId, u.factionId, edge.id);
      } else {
        next = { ...next, units };
      }
    } else {
      next = { ...next, units };
    }
  }

  return { state: syncEngagements(next), events };
}

// ─── Labels (mirrored from @wargame/shared/labels to avoid import cycle) ────

function strengthLabel(s: number): string {
  if (s >= 0.85) return "at full strength";
  if (s >= 0.65) return "bloodied";
  if (s >= 0.40) return "weakened";
  if (s >= 0.20) return "badly mauled";
  return "on the verge of collapse";
}

function moraleLabel(m: number): string {
  if (m >= 80) return "high morale";
  if (m >= 60) return "steady";
  if (m >= 40) return "wavering";
  if (m >= 20) return "shaken";
  return "on the verge of rout";
}

function fatigueLabel(t: number): string {
  if (t <= 0.1) return "fresh";
  if (t <= 0.3) return "lightly fatigued";
  if (t <= 0.5) return "tired";
  if (t <= 0.7) return "exhausted";
  return "spent";
}

function dugInLabel(d: number): string {
  if (d <= 0.05) return "no cover";
  if (d <= 0.2) return "light cover";
  if (d <= 0.4) return "improved position";
  if (d <= 0.7) return "well entrenched";
  return "heavily fortified";
}

function intentionDescription(intention: string | undefined, isAssault: boolean): string {
  if (isAssault || intention === "assault") return "assault — all-out push to drive the enemy off the position";
  if (intention === "breakthrough") return "breakthrough — punch through to exploit the territory beyond";
  if (intention === "attack") return "coordinated attack";
  if (intention === "defend") return "defensive stand";
  if (intention === "hold") return "hold at all costs";
  if (intention === "deny") return "deny passage — fortify to block movement";
  if (intention === "reinforce") return "reinforce — arriving to support allies";
  return "standard engagement";
}

function buildBattleUnitContext(
  unit: import("@wargame/shared").UnitState,
  order: UnitCombatOrder,
  extra?: { isFlanked?: boolean; isFlankingAttacker?: boolean }
): BattleUnitContext {
  const isAssault =
    order.isAssault ||
    order.moveIntention === "assault" ||
    order.attackIntention === "assault";
  const intention = order.attackIntention ?? order.moveIntention ?? order.digInIntention;
  return {
    id: unit.id,
    name: unit.name,
    faction: unit.factionId,
    templateId: unit.templateId,
    strengthFraction: unit.strength,
    strengthLabel: strengthLabel(unit.strength),
    morale: unit.morale,
    moraleLabel: moraleLabel(unit.morale),
    fatigueLabel: fatigueLabel(unit.tiredness),
    dugInLabel: dugInLabel(unit.dugIn),
    dugInValue: unit.dugIn,
    turnsInContact: unit.turnsInContact ?? 0,
    arrivedThisTurn: unit.arrivedThisTurn ?? false,
    stance: order.stance,
    intention: intention ?? "attack",
    intentionDescription: intentionDescription(intention, isAssault ?? false),
    isAssault: isAssault ?? false,
    unitType: unit.unitType,
    isFlanked: extra?.isFlanked,
    isFlankingAttacker: extra?.isFlankingAttacker,
  };
}

// ─── Node-level battle context builder ───────────────────────────────────────

function buildNodeBattleContext(
  state: GameState,
  nodeId: string,
  byFaction: Map<FactionId, string[]>,
  orderMap: OrderMap,
  speedDefenseByUnit: Map<string, number>,
  flankedFaction: FactionId | undefined,
  turnNumber: number,
  node: import("@wargame/shared").NodeDef
): NodeBattleContext {
  const factions = [...byFaction.keys()] as [FactionId, FactionId];

  const buildSide = (factionId: FactionId): NodeBattleSide => {
    const unitIds = byFaction.get(factionId) ?? [];
    const units: BattleUnitContext[] = unitIds.flatMap((id) => {
      const u = state.units[id];
      if (!u) return [];
      const isFlanked = flankedFaction === factionId;
      const isFlankingAttacker = flankedFaction !== undefined && flankedFaction !== factionId;
      const cmd = orderMap.byUnit.get(id);
      const order = getCombatOrder(
        cmd, u,
        findDigInOrder(orderMap, id, state),
        speedDefenseByUnit.get(id),
        { flanked: isFlanked, flanking: isFlankingAttacker }
      );
      return [buildBattleUnitContext(u, order, { isFlanked, isFlankingAttacker })];
    });
    return { factionId, units };
  };

  return {
    turnNumber,
    location: { nodeId: node.id, name: node.name, tags: node.tags },
    sides: [buildSide(factions[0]), buildSide(factions[1])],
    flankedFaction,
  };
}

// ─── Apply AI node battle result ─────────────────────────────────────────────

function applyNodeBattleResult(
  state: GameState,
  nodeId: string,
  result: NodeBattleResult,
  side1FactionId: string,
  side2FactionId: string,
  graph: GameGraph,
  events: TurnEvent[],
  orderMap: OrderMap
): GameState {
  const units = { ...state.units };

  for (const outcome of result.unitOutcomes) {
    if (!units[outcome.unitId]) continue;
    if (outcome.strengthLossPct > 0) {
      applyCasualty(units, outcome.unitId, outcome.strengthLossPct / 100, {});
    }
    if (outcome.moraleDelta > 0) {
      bumpMorale(units, outcome.unitId, outcome.moraleDelta);
    } else if (outcome.moraleDelta < 0) {
      dropMorale(units, outcome.unitId, outcome.moraleDelta);
    }
  }

  events.push({
    type: "node_battle",
    nodeId,
    narrative: result.narrative,
    overallWinner: result.overallWinner,
    side1FactionId,
    side2FactionId,
    unitOutcomes: result.unitOutcomes.map((o) => ({
      unitId: o.unitId,
      strengthLossPct: o.strengthLossPct,
      moraleDelta: o.moraleDelta,
      expelled: o.expelled,
    })),
  });

  let next: GameState = { ...state, units };

  // Push expelled units off the node
  for (const outcome of result.unitOutcomes) {
    if (!outcome.expelled) continue;
    const u = next.units[outcome.unitId];
    if (!u || u.nodeId !== nodeId) continue;
    const enemy = Object.values(next.units).find(
      (x) => x.nodeId === nodeId && x.factionId !== u.factionId
    );
    next = pushDefender(next, graph, nodeId, outcome.unitId, enemy?.id ?? null, events);
  }

  // Advance breakthrough units to their target node
  for (const outcome of result.unitOutcomes) {
    if (!outcome.breaksThrough) continue;
    const cmd = orderMap.byUnit.get(outcome.unitId);
    if (cmd?.type !== "attack" || cmd.intention !== "breakthrough" || !cmd.breakthroughTargetNodeId) continue;
    const u = next.units[outcome.unitId];
    if (!u) continue;
    if (!graph.isAdjacent(nodeId, cmd.breakthroughTargetNodeId)) continue;
    const from = nodeId;
    const to = cmd.breakthroughTargetNodeId;
    const unitsMap = { ...next.units };
    unitsMap[outcome.unitId] = { ...u, nodeId: to, dugIn: 0, engaged: false, arrivedThisTurn: true };
    events.push({ type: "move", unitId: outcome.unitId, from, to });
    const edge = graph.findEdge(from, to);
    next = edge
      ? recordEntryEdge({ ...next, units: unitsMap }, to, u.factionId, edge.id)
      : { ...next, units: unitsMap };
  }

  console.info(
    `[adjudicator] @ ${nodeId}: ${result.overallWinner}\n  ${result.narrative}`
  );
  return next;
}

// ─── Deterministic pairwise fallback ─────────────────────────────────────────

function applyDeterministicBattle(
  state: GameState,
  nodeId: string,
  byFaction: Map<FactionId, string[]>,
  orderMap: OrderMap,
  config: CombatConfig,
  graph: GameGraph,
  events: TurnEvent[],
  deniedNodes: Set<string>,
  speedDefenseByUnit: Map<string, number>
): GameState {
  let next = state;
  const factions = [...byFaction.keys()];
  const eng = state.engagements[nodeId];
  const flankedFaction = eng?.flankedFaction;

  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < factions.length; i++) {
    for (let j = i + 1; j < factions.length; j++) {
      for (const a of byFaction.get(factions[i]!)!) {
        for (const d of byFaction.get(factions[j]!)!) {
          pairs.push([a, d]);
        }
      }
    }
  }

  for (const [idA, idB] of pairs) {
    if (!next.units[idA] || !next.units[idB]) continue;

    const cmdA = orderMap.byUnit.get(idA);
    const cmdB = orderMap.byUnit.get(idB);

    let atkId = idA;
    let defId = idB;
    let atkCmd: Command | undefined = cmdA;
    let defCmd: Command | undefined = cmdB;

    const aAttacks =
      cmdA?.type === "attack" ||
      (cmdA?.type === "move" && (cmdA.intention === "attack" || cmdA.intention === "assault"));
    const bAttacks =
      cmdB?.type === "attack" ||
      (cmdB?.type === "move" && (cmdB.intention === "attack" || cmdB.intention === "assault"));

    if (!aAttacks && bAttacks) {
      atkId = idB;
      defId = idA;
      atkCmd = cmdB;
      defCmd = cmdA;
    } else if (!aAttacks && !bAttacks) {
      continue;
    }

    const atkUnit = next.units[atkId];
    const defUnit = next.units[defId];
    if (!atkUnit || !defUnit) continue;

    const atkIsFlanking = flankedFaction !== undefined && flankedFaction !== atkUnit.factionId;
    const defIsFlanked = flankedFaction === defUnit.factionId;

    const atkOrder = getCombatOrder(atkCmd, atkUnit, undefined, speedDefenseByUnit.get(atkId), { flanking: atkIsFlanking });
    const defOrder = getCombatOrder(
      defCmd, defUnit,
      findDigInOrder(orderMap, defId, next),
      speedDefenseByUnit.get(defId),
      { flanked: defIsFlanked }
    );

    const denyDig = findDigInOrder(orderMap, defId, next);
    const isBreakthrough = atkCmd?.type === "attack" && atkCmd.intention === "breakthrough";

    const clashOpts = isBreakthrough
      ? { attackerCasualtyRate: config.casualtyRate * 1.2, defenderCasualtyRate: config.casualtyRate }
      : undefined;

    const result = resolveClash(next, nodeId, atkId, defId, atkOrder, defOrder, config, graph, clashOpts);
    next = result.state;
    events.push(...result.events);

    const assaultWin =
      result.outcome === "win" &&
      (atkCmd?.type === "attack"
        ? atkCmd.intention === "assault"
        : atkCmd?.type === "move" && atkCmd.intention === "assault");

    if (assaultWin) {
      next = pushDefender(next, graph, nodeId, defId, atkId, events);
    }

    if (
      result.outcome === "win" &&
      atkCmd?.type === "attack" &&
      atkCmd.intention === "breakthrough" &&
      atkCmd.breakthroughTargetNodeId
    ) {
      const units = { ...next.units };
      const attacker = units[atkId];
      if (attacker && graph.isAdjacent(nodeId, atkCmd.breakthroughTargetNodeId)) {
        const from = nodeId;
        const to = atkCmd.breakthroughTargetNodeId;
        units[atkId] = { ...attacker, nodeId: to, dugIn: 0, engaged: false, arrivedThisTurn: true };
        events.push({ type: "move", unitId: atkId, from, to });
        const edge = graph.findEdge(from, to);
        next = edge
          ? recordEntryEdge({ ...next, units }, to, attacker.factionId, edge.id)
          : { ...next, units };
      }
    }

    if (denyDig?.type === "dig_in" && denyDig.intention === "deny" && result.outcome === "win" && next.units[defId]) {
      events.push({ type: "deny_blocked", nodeId, unitId: defId });
    } else if (denyDig?.type === "dig_in" && denyDig.intention === "deny" && result.outcome === "loss") {
      deniedNodes.delete(nodeId);
    }
  }

  return next;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveContestedNodes(
  state: GameState,
  allCommands: Command[],
  graph: GameGraph,
  config: CombatConfig,
  speedDefenseByUnit: Map<string, number>,
  moveOrders: MoveCommand[],
  adjudicator?: NodeAdjudicatorFn,
  turnNumber?: number
): Promise<{ state: GameState; events: TurnEvent[]; deniedNodes: Set<string> }> {
  const events: TurnEvent[] = [];
  let next = state;
  const deniedNodes = new Set<string>();
  const orderMap = buildOrderMap(allCommands);

  next = syncEngagements(next);
  const buckets = bucketByNode(next);

  // ── Phase 1: collect all contested nodes ─────────────────────────────────
  const contested: Array<{
    nodeId: string;
    byFaction: Map<FactionId, string[]>;
    ctx: NodeBattleContext | null;
    side1FactionId: string;
    side2FactionId: string;
  }> = [];

  for (const [nodeId, unitIds] of buckets) {
    if (!isContested(next, nodeId)) continue;
    const eng = next.engagements[nodeId];
    if (!eng) continue;
    const factionsHere = [...new Set(unitIds.map((id) => next.units[id]?.factionId).filter(Boolean))];
    if (factionsHere.length > 0 && factionsHere.every((f) => eng.disengageVotes[f as FactionId])) continue;

    const byFaction = new Map<FactionId, string[]>();
    for (const id of unitIds) {
      const u = next.units[id];
      if (!u) continue;
      const list = byFaction.get(u.factionId) ?? [];
      list.push(id);
      byFaction.set(u.factionId, list);
    }

    const factions = [...byFaction.keys()];
    if (factions.length < 2) continue;

    // Pre-compute deny nodes for fallback path
    for (const [, ids] of byFaction) {
      for (const id of ids) {
        const denyDig = findDigInOrder(orderMap, id, next);
        if (denyDig?.type === "dig_in" && denyDig.intention === "deny" && (next.units[id]?.dugIn ?? 0) >= config.dugInThreshold) {
          deniedNodes.add(nodeId);
        }
      }
    }

    const node = graph.getNode(nodeId);
    const flankedFaction = eng.flankedFaction;
    const ctx: NodeBattleContext | null =
      adjudicator && node
        ? buildNodeBattleContext(next, nodeId, byFaction, orderMap, speedDefenseByUnit, flankedFaction, turnNumber ?? 0, node)
        : null;

    contested.push({
      nodeId,
      byFaction,
      ctx,
      side1FactionId: factions[0]!,
      side2FactionId: factions[1]!,
    });
  }

  // ── Phase 2: fire all AI calls in parallel (one per node) ────────────────
  const aiResults: Array<NodeBattleResult | null> = await Promise.all(
    contested.map(async ({ ctx }) => {
      if (!adjudicator || !ctx) return null;
      try {
        return await adjudicator(ctx);
      } catch (err) {
        console.error("[engine] node adjudicator threw, falling back to deterministic:", err);
        return null;
      }
    })
  );

  // ── Phase 3: apply results ────────────────────────────────────────────────
  for (let i = 0; i < contested.length; i++) {
    const { nodeId, byFaction, ctx, side1FactionId, side2FactionId } = contested[i]!;
    const aiResult = aiResults[i]!;

    if (aiResult && ctx) {
      next = applyNodeBattleResult(next, nodeId, aiResult, side1FactionId, side2FactionId, graph, events, orderMap);
    } else {
      next = applyDeterministicBattle(next, nodeId, byFaction, orderMap, config, graph, events, deniedNodes, speedDefenseByUnit);
    }
  }

  return { state: syncEngagements(next), events, deniedNodes };
}

function pushDefender(
  state: GameState,
  graph: GameGraph,
  nodeId: string,
  defId: string,
  atkId: string | null,
  events: TurnEvent[]
): GameState {
  const units = { ...state.units };
  const pushed = units[defId];
  if (!pushed) return state;
  const attacker = atkId ? units[atkId] : null;

  const eng = state.engagements[nodeId];
  const entryEdge = attacker ? eng?.entryEdgeByFaction?.[attacker.factionId] : undefined;
  let pushTarget: string | null = null;

  if (entryEdge) {
    const edge = graph.getEdge(entryEdge);
    if (edge) {
      const fromNode = edge.from === nodeId ? edge.to : edge.from;
      const neighbors = graph.neighbors(nodeId);
      pushTarget = neighbors.find((n) => n !== fromNode) ?? neighbors[0] ?? null;
    }
  }

  if (!pushTarget) {
    const neighbors = graph.neighbors(nodeId).filter((n) => n !== nodeId);
    pushTarget = neighbors[0] ?? null;
  }

  if (pushTarget) {
    units[defId] = { ...pushed, nodeId: pushTarget, engaged: false, dugIn: 0 };
    events.push({
      type: "move",
      unitId: defId,
      from: nodeId,
      to: pushTarget,
    });
    const edge = graph.findEdge(nodeId, pushTarget);
    if (edge) {
      return recordEntryEdge(
        { ...state, units },
        pushTarget,
        pushed.factionId,
        edge.id
      );
    }
    return { ...state, units };
  }
  return state;
}

export function recordDisengageVotes(
  state: GameState,
  commands: Command[]
): GameState {
  const engagements = { ...state.engagements };
  for (const cmd of commands) {
    if (cmd.type !== "disengage") continue;
    const u = state.units[cmd.unitId];
    if (!u) continue;
    const eng = engagements[u.nodeId] ?? {
      nodeId: u.nodeId,
      disengageVotes: {},
      entryEdgeByFaction: {},
    };
    eng.disengageVotes[u.factionId] = true;
    engagements[u.nodeId] = eng;
  }
  return { ...state, engagements };
}
