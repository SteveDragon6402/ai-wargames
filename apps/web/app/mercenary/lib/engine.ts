import { KINGDOM_SPECIAL, NODES, isSettlement, neighbors, type NodeId } from "../data/map";
import {
  APPROACH_WORDS,
  BANDIT_COUNT,
  CONVERT_CAP,
  MAX_WEEK,
  PRICE,
  RETREAT_FIGHT_CHANCE,
  REWARD_FULL,
  REWARD_RECRUIT,
  STARTING,
  UNIT_CAP,
} from "../data/constants";
import {
  BASE_TYPES,
  WIKI,
  isBaseType,
  isSpecialType,
  type BaseTypeId,
  type UnitTypeId,
} from "../data/wiki";
import {
  REPUTATION_KEYS,
  type Aftermath,
  type ForceComparison,
  type GameState,
  type ReputationKey,
  type Result,
  type Step,
  type Unit,
  type ValidatedBattle,
  type WeekAction,
} from "./types";

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function headcount(units: Unit[]): number {
  return units.reduce((sum, unit) => sum + unit.count, 0);
}

export function freshGame(): GameState {
  return {
    version: 1,
    phase: "name",
    screen: "dashboard",
    companyName: "",
    chosenTypes: [],
    week: 1,
    location: "millcross",
    cameFrom: null,
    morale: "They are untried, and waiting to see what sort of company this is.",
    stance: "They hold together and wait for orders.",
    condition: "They are rested.",
    moraleFromBattle: false,
    money: STARTING.money,
    basicFood: STARTING.basicFood,
    goodFood: STARTING.goodFood,
    supply: STARTING.supply,
    ration: "plain",
    units: [],
    nextUnitId: 1,
    reputation: { holt: "", ashmarch: "", mere: "", nobles: "", peasants: "" },
    decisions: [],
    queue: [],
    resolveIndex: 0,
    movedThisWeek: false,
    notices: [],
    villageWork: false,
    rewardClaimed: false,
    rewardPurse: null,
    bandits: {
      count: BANDIT_COUNT,
      origin: WIKI.bandit.origin,
      lines: [...WIKI.bandit.start],
      morale: "Wary, and sure of these trees.",
      stance: "They watch the paths and decline a fight they dislike.",
    },
    leader: {
      name: "Harl the Reed",
      blurb:
        "Harl the Reed keeps the Blackwood band. They are somewhat aware, and they know this forest. They will not set on a host that clearly outnumbers them. They will set on a company they clearly outnumber.",
      generalHistory:
        "Harl the Reed has led about twenty poorly armed men in Blackwood for years. They are somewhat experienced in this forest. They rob small parties and let large ones pass.",
      withCompany: [],
    },
    elderTalk: [],
    villageDeeds: [],
    pendingBattle: null,
    lastBrief: null,
    lastChronicle: null,
    banditSurvivors: null,
  };
}

function fail(error: string): Result {
  return { ok: false, error };
}

function notice(state: GameState, text: string): GameState {
  return { ...state, notices: [...state.notices, text] };
}

function decide(state: GameState, text: string): GameState {
  return { ...state, decisions: [...state.decisions, { week: state.week, text }] };
}

export function rememberLeader(state: GameState, text: string): GameState {
  return {
    ...state,
    leader: {
      ...state.leader,
      withCompany: [...state.leader.withCompany, `Week ${state.week}: ${text}`],
    },
  };
}

function makeUnit(state: GameState, type: UnitTypeId, count: number, name: string): { state: GameState; unit: Unit } {
  const entry = WIKI[type];
  const unit: Unit = {
    id: `u${state.nextUnitId}`,
    name,
    type,
    count,
    origin: entry.origin,
    lines: [...entry.start],
    battles: [],
  };
  return { state: { ...state, nextUnitId: state.nextUnitId + 1 }, unit };
}

export function setCompanyName(state: GameState, name: string): Result {
  const trimmed = name.trim();
  if (state.phase !== "name") return fail("The company already has a name.");
  if (!trimmed || trimmed.length > 40) return fail("Give the company a name, forty characters or fewer.");
  return { ok: true, state: { ...state, companyName: trimmed, phase: "types" } };
}

export function chooseTypes(state: GameState, types: BaseTypeId[]): Result {
  if (state.phase !== "types") return fail("The company's trades are already chosen.");
  if (types.length !== 2 || types[0] === types[1]) return fail("Pick two different base types.");
  if (!types.every((type) => (BASE_TYPES as string[]).includes(type))) return fail("Only swordsmen, spearmen, and archers are on offer.");
  let next = state;
  const units: Unit[] = [];
  for (const type of types) {
    const made = makeUnit(next, type, 5, "");
    next = made.state;
    units.push(made.unit);
  }
  return { ok: true, state: { ...next, chosenTypes: types, units, phase: "unit-names" } };
}

export function nameStartingUnits(state: GameState, names: [string, string]): Result {
  if (state.phase !== "unit-names") return fail("The units are already named.");
  const cleaned = names.map((name) => name.trim()) as [string, string];
  if (cleaned.some((name) => !name || name.length > 40)) return fail("Each unit needs a name, forty characters or fewer.");
  if (cleaned[0].toLowerCase() === cleaned[1].toLowerCase()) return fail("Give the two units different names.");
  return {
    ok: true,
    state: {
      ...state,
      phase: "reputation",
      units: state.units.map((unit, index) => ({ ...unit, name: cleaned[index] ?? unit.name })),
    },
  };
}

export function applyOpeningReputation(state: GameState, reputation: Record<ReputationKey, string>): Result {
  if (state.phase !== "reputation") return fail("Reputation is not waiting on you.");
  for (const key of REPUTATION_KEYS) {
    if (!reputation[key]?.trim()) return fail(`No standing came back for ${key}.`);
  }
  const named = decide(
    { ...state, reputation, phase: "play", screen: "dashboard" },
    `Founded ${state.companyName}, a new mercenary company.`
  );
  return { ok: true, state: named };
}

export function unitsNeeded(units: Unit[], type: UnitTypeId, adding: number): { fills: { id: string; add: number }[]; fresh: number[] } {
  let left = adding;
  const fills: { id: string; add: number }[] = [];
  for (const unit of units) {
    if (unit.type !== type || left <= 0) continue;
    const room = UNIT_CAP - unit.count;
    if (room <= 0) continue;
    const add = Math.min(room, left);
    fills.push({ id: unit.id, add });
    left -= add;
  }
  const fresh: number[] = [];
  while (left > 0) {
    const count = Math.min(UNIT_CAP, left);
    fresh.push(count);
    left -= count;
  }
  return { fills, fresh };
}

export function recruitableTypes(location: NodeId): UnitTypeId[] {
  const node = NODES[location];
  if (node.kind === "wild") return [];
  const types: UnitTypeId[] = [...BASE_TYPES];
  if (node.kind === "capital") types.push(KINGDOM_SPECIAL[node.kingdom]);
  return types;
}

export function manPrice(type: UnitTypeId): number {
  if (isSpecialType(type)) return PRICE.specialMan;
  if (isBaseType(type)) return PRICE.baseMan;
  return 0;
}

interface Projected {
  money: number;
  basicFood: number;
  goodFood: number;
  supply: number;
  location: NodeId;
  moved: boolean;
}

function project(state: GameState, extra?: WeekAction): Projected | { error: string } {
  const projected: Projected = {
    money: state.money,
    basicFood: state.basicFood,
    goodFood: state.goodFood,
    supply: state.supply,
    location: state.location,
    moved: state.movedThisWeek,
  };
  const counts = state.units.map((unit) => ({ ...unit }));
  const actions = extra ? [...state.queue, extra] : state.queue;
  for (const action of actions) {
    if (action.kind === "move") {
      if (projected.moved) return { error: "The company can march once this week." };
      if (!neighbors(projected.location).includes(action.to)) return { error: "That place is more than a week away." };
      projected.moved = true;
      projected.location = action.to;
    } else if (action.kind === "buy") {
      if (!isSettlement(projected.location)) return { error: "Nobody is selling there." };
      if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 100) return { error: "Buy a sensible amount." };
      const cost = PRICE[action.store] * action.amount;
      if (projected.money < cost) return { error: "Not enough coin." };
      projected.money -= cost;
      if (action.store === "basic") projected.basicFood += action.amount;
      if (action.store === "good") projected.goodFood += action.amount;
      if (action.store === "supply") projected.supply += action.amount;
    } else if (action.kind === "recruit") {
      if (!isSettlement(projected.location)) return { error: "Nobody here will take the coin." };
      if (!recruitableTypes(projected.location).includes(action.type)) return { error: "That trade is not hired here." };
      if (!Number.isInteger(action.count) || action.count < 1 || action.count > 40) return { error: "Hire a sensible number." };
      const plan = unitsNeeded(counts, action.type, action.count);
      if (action.names.length !== plan.fresh.length) return { error: "Each new unit needs a name." };
      if (action.names.some((name) => !name.trim() || name.trim().length > 40)) return { error: "Name each new unit, forty characters or fewer." };
      const cost = manPrice(action.type) * action.count;
      if (projected.money < cost) return { error: "Not enough coin to hire them." };
      projected.money -= cost;
      for (const fill of plan.fills) {
        const unit = counts.find((item) => item.id === fill.id);
        if (unit) unit.count += fill.add;
      }
      for (const count of plan.fresh) {
        counts.push({
          id: `preview-${counts.length}`,
          name: "",
          type: action.type,
          count,
          origin: "",
          lines: ["", "", ""],
          battles: [],
        });
      }
    } else if (action.kind === "convert") {
      if (action.direction === "to-good") {
        const pairs = Math.min(CONVERT_CAP, Math.floor(projected.basicFood / 2));
        if (pairs < 1) return { error: "Not enough plain food to improve." };
        projected.basicFood -= pairs * 2;
        projected.goodFood += pairs;
      } else {
        const meals = Math.min(CONVERT_CAP, projected.goodFood);
        if (meals < 1) return { error: "No good food to break down." };
        projected.goodFood -= meals;
        projected.basicFood += meals * 2;
      }
    } else if (action.kind === "train") {
      if (!action.drill.trim()) return { error: "Say what the drill is." };
      if (action.unitIds[0] === action.unitIds[1]) return { error: "Pick two different units." };
      if (action.unitIds.some((id) => !state.units.some((unit) => unit.id === id && unit.count > 0))) {
        return { error: "Both units have to be in the company." };
      }
    }
  }
  return projected;
}

export function canEnqueue(state: GameState, action: WeekAction): string | null {
  if (state.phase !== "play" || state.resolveIndex > 0 || state.pendingBattle) return "The week is already in motion.";
  if (state.queue.length >= 2) return "Two actions, no more.";
  const projected = project(state, action);
  if ("error" in projected) return projected.error;
  return null;
}

export function enqueue(state: GameState, action: WeekAction): Result {
  const error = canEnqueue(state, action);
  if (error) return fail(error);
  return { ok: true, state: { ...state, queue: [...state.queue, action] } };
}

export function dequeue(state: GameState, index: number): Result {
  if (state.resolveIndex > 0) return fail("The week has already started.");
  if (!state.queue[index]) return fail("That action is gone.");
  return { ok: true, state: { ...state, queue: state.queue.filter((_, i) => i !== index) } };
}

export function setRation(state: GameState, ration: "hearty" | "plain"): GameState {
  return { ...state, ration };
}

export function setStance(state: GameState, stance: string): GameState {
  const trimmed = stance.trim().slice(0, 240);
  if (!trimmed) return state;
  return { ...state, stance: trimmed };
}

export function beginResolution(state: GameState): GameState {
  if (state.resolveIndex > 0) return state;
  return { ...state, notices: [] };
}

function applyListed(state: GameState, action: WeekAction): GameState {
  if (action.kind === "move") {
    if (state.movedThisWeek || !neighbors(state.location).includes(action.to)) {
      return notice(state, "The march could not be made.");
    }
    return {
      ...state,
      cameFrom: state.location,
      location: action.to,
      movedThisWeek: true,
    };
  }
  if (action.kind === "buy") {
    if (!isSettlement(state.location)) return notice(state, "Nobody was selling, and the purchase was lost.");
    const cost = PRICE[action.store] * action.amount;
    if (state.money < cost) return notice(state, "The coin ran out, and the purchase was lost.");
    const next = { ...state, money: state.money - cost };
    if (action.store === "basic") next.basicFood += action.amount;
    if (action.store === "good") next.goodFood += action.amount;
    if (action.store === "supply") next.supply += action.amount;
    return next;
  }
  if (action.kind === "recruit") {
    if (!isSettlement(state.location) || !recruitableTypes(state.location).includes(action.type)) {
      return notice(state, "No one of that trade would take service here.");
    }
    const cost = manPrice(action.type) * action.count;
    if (state.money < cost) return notice(state, "The coin was short, and the hiring failed.");
    const plan = unitsNeeded(state.units, action.type, action.count);
    if (plan.fresh.length !== action.names.length) return notice(state, "A new unit had no name, and the hiring failed.");
    let next: GameState = { ...state, money: state.money - cost, units: state.units.map((unit) => ({ ...unit })) };
    next.units = next.units.map((unit) => {
      const fill = plan.fills.find((item) => item.id === unit.id);
      return fill ? { ...unit, count: unit.count + fill.add } : unit;
    });
    plan.fresh.forEach((count, index) => {
      const made = makeUnit(next, action.type, count, action.names[index].trim());
      next = made.state;
      next = { ...next, units: [...next.units, made.unit] };
    });
    return next;
  }
  if (action.kind === "convert") {
    if (action.direction === "to-good") {
      const pairs = Math.min(CONVERT_CAP, Math.floor(state.basicFood / 2));
      if (pairs < 1) return notice(state, "There was not enough plain food to improve.");
      return { ...state, basicFood: state.basicFood - pairs * 2, goodFood: state.goodFood + pairs };
    }
    const meals = Math.min(CONVERT_CAP, state.goodFood);
    if (meals < 1) return notice(state, "There was no good food to break down.");
    return { ...state, goodFood: state.goodFood - meals, basicFood: state.basicFood + meals * 2 };
  }
  return state;
}

export function stepQueue(state: GameState): Step {
  if (state.resolveIndex >= state.queue.length) return { kind: "done", state };
  const action = state.queue[state.resolveIndex];
  if (action.kind === "train") {
    return { kind: "train", state, unitIds: action.unitIds, drill: action.drill };
  }
  const applied = applyListed(state, action);
  const advanced = { ...applied, resolveIndex: state.resolveIndex + 1 };
  if (action.kind === "move" && action.to === "blackwood" && advanced.location === "blackwood" && advanced.bandits) {
    return { kind: "forest", state: { ...advanced, screen: "forest" } };
  }
  return { kind: "continue", state: advanced };
}

export function applyTraining(
  state: GameState,
  linesByUnit: Record<string, [string, string, string]>
): Result {
  const action = state.queue[state.resolveIndex];
  if (!action || action.kind !== "train") return fail("No drill is waiting.");
  for (const id of action.unitIds) {
    const lines = linesByUnit[id];
    if (!lines || lines.some((line) => !line.trim())) return fail("The drill came back without lines for both units.");
  }
  return {
    ok: true,
    state: {
      ...state,
      resolveIndex: state.resolveIndex + 1,
      units: state.units.map((unit) => {
        const lines = linesByUnit[unit.id];
        if (!lines) return unit;
        return { ...unit, lines: [lines[0].trim(), lines[1].trim(), lines[2].trim()] };
      }),
    },
  };
}

function killFromLargest(units: Unit[], deaths: number): Unit[] {
  let left = deaths;
  const counts = new Map(units.map((unit) => [unit.id, unit.count]));
  const order = [...units].sort((a, b) => b.count - a.count);
  for (const unit of order) {
    if (left <= 0) break;
    const have = counts.get(unit.id) ?? 0;
    const take = Math.min(have, left);
    counts.set(unit.id, have - take);
    left -= take;
  }
  return units
    .map((unit) => ({ ...unit, count: counts.get(unit.id) ?? unit.count }))
    .filter((unit) => unit.count > 0);
}

function starveCount(count: number): number {
  return Math.max(1, Math.floor(count / 4));
}

export function finishWeek(state: GameState): GameState {
  const men = headcount(state.units);
  let basic = state.basicFood;
  let good = state.goodFood;
  let need = men;
  let ateGood = 0;
  let ateBasic = 0;
  const take = (kind: "good" | "basic") => {
    const have = kind === "good" ? good : basic;
    const used = Math.min(have, need);
    if (kind === "good") {
      good -= used;
      ateGood += used;
    } else {
      basic -= used;
      ateBasic += used;
    }
    need -= used;
  };
  if (state.ration === "hearty") {
    take("good");
    take("basic");
  } else {
    take("basic");
    take("good");
  }
  const missing = need;
  let units = state.units;
  let hunger: "well" | "plain" | "mixed" | "hungry" | "starving" = "plain";
  let next = state;
  if (men > 0 && basic === state.basicFood && good === state.goodFood && missing === men) {
    units = units
      .map((unit) => ({ ...unit, count: unit.count - starveCount(unit.count) }))
      .filter((unit) => unit.count > 0);
    const buried = men - headcount(units);
    hunger = "starving";
    if (buried > 0) next = notice(next, `${buried} died with nothing to eat.`);
  } else if (missing > 0) {
    units = killFromLargest(units, missing);
    hunger = "hungry";
    next = notice(next, `${missing} went unfed.`);
  } else if (ateGood > 0 && ateBasic === 0) {
    hunger = "well";
  } else if (ateGood > 0 && ateBasic > 0) {
    hunger = "mixed";
  } else {
    hunger = "plain";
  }

  const foodLine =
    hunger === "well"
      ? "Good food has them in high spirits."
      : hunger === "mixed"
        ? "The good food ran out. The rest ate plain, and they know it."
        : hunger === "hungry"
          ? "They are hungry. The missing rations have soured them."
          : hunger === "starving"
            ? "They are starving."
            : "They are fed. It does little for their spirits.";

  const morale =
    hunger === "hungry" || hunger === "starving"
      ? foodLine
      : state.moraleFromBattle
        ? `${state.morale} ${foodLine}`
        : foodLine;

  const condition = state.movedThisWeek
    ? `They are road-worn from the week's march. ${foodLine}`
    : foodLine;

  const closed: GameState = {
    ...next,
    units,
    basicFood: basic,
    goodFood: good,
    morale,
    condition,
    moraleFromBattle: false,
    queue: [],
    resolveIndex: 0,
    movedThisWeek: false,
    cameFrom: null,
    pendingBattle: null,
    screen: "dashboard",
  };
  if (headcount(closed.units) === 0) return { ...closed, phase: "wiped" };
  if (state.week >= MAX_WEEK) return { ...closed, phase: "year-end" };
  return { ...closed, week: state.week + 1 };
}

export function retreatStartsFight(roll: number): boolean {
  return roll < RETREAT_FIGHT_CHANCE;
}

export function cancelRest(state: GameState): GameState {
  return { ...state, queue: state.queue.slice(0, state.resolveIndex) };
}

export function retreatQuiet(state: GameState): GameState {
  const back = state.cameFrom ?? state.location;
  return rememberLeader(
    { ...cancelRest(state), location: back, screen: "dashboard" },
    "The company turned back before his band closed."
  );
}

export function openBattle(state: GameState, reason: PendingBattleReason, sneakNote: string | null): GameState {
  const from = state.cameFrom ?? "millcross";
  return {
    ...cancelRest(state),
    screen: "approach",
    pendingBattle: { reason, sneakNote, from, approach: "", supplySpent: 0 },
  };
}

type PendingBattleReason = "fight" | "retreat" | "leader";

export function commitApproach(state: GameState, approach: string, supply: number): Result {
  if (!state.pendingBattle) return fail("No fight is waiting.");
  const words = wordCount(approach);
  if (words < 1 || words > APPROACH_WORDS) return fail(`The approach must be ${APPROACH_WORDS} words or fewer.`);
  if (!Number.isInteger(supply) || supply < 0 || supply > state.supply) return fail("Spend only the supply you have.");
  return {
    ok: true,
    state: {
      ...state,
      supply: state.supply - supply,
      pendingBattle: { ...state.pendingBattle, approach: approach.trim(), supplySpent: supply },
    },
  };
}

export function refundApproach(state: GameState): GameState {
  if (!state.pendingBattle) return state;
  return {
    ...state,
    supply: state.supply + state.pendingBattle.supplySpent,
    pendingBattle: { ...state.pendingBattle, approach: "", supplySpent: 0 },
  };
}

export function forceComparison(playerMen: number, banditMen: number): ForceComparison {
  if (playerMen >= banditMen * 1.5) return "larger";
  if (banditMen >= playerMen * 1.5) return "smaller";
  return "close";
}

export function settleLeaderAttack(comparison: ForceComparison, modelWantsAttack: boolean): boolean {
  if (comparison === "larger") return false;
  if (comparison === "smaller") return true;
  return modelWantsAttack;
}

export function slipPast(state: GameState, line: string): GameState {
  return rememberLeader({ ...state, screen: "dashboard" }, line);
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function validateOutcome(state: GameState, raw: unknown): { ok: true; value: ValidatedBattle } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "The executor returned nothing usable." };
  const body = raw as Record<string, unknown>;
  if (typeof body.playerHoldsField !== "boolean") return { ok: false, error: "The executor did not say who held the field." };
  if (typeof body.banditDeaths !== "number" || !Number.isInteger(body.banditDeaths) || body.banditDeaths < 0) {
    return { ok: false, error: "Bandit deaths were not a whole number." };
  }
  const banditCount = state.bandits?.count ?? 0;
  if (body.banditDeaths > banditCount) return { ok: false, error: "The executor killed more bandits than there were." };
  if (!Array.isArray(body.deaths)) return { ok: false, error: "The executor listed no deaths." };
  const known = new Set(state.units.map((unit) => unit.id));
  const deaths: { unitId: string; count: number }[] = [];
  for (const row of body.deaths) {
    if (!row || typeof row !== "object") return { ok: false, error: "A death row was unreadable." };
    const unitId = (row as { unitId?: unknown }).unitId;
    const count = (row as { count?: unknown }).count;
    if (typeof unitId !== "string" || !known.has(unitId)) return { ok: false, error: "The executor named a unit that is not in the company." };
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return { ok: false, error: "A death count was not a whole number." };
    const unit = state.units.find((item) => item.id === unitId);
    if (!unit || count > unit.count) return { ok: false, error: "The executor killed more men than a unit has." };
    deaths.push({ unitId, count });
  }
  const morale = nonEmpty(body.morale);
  const stance = nonEmpty(body.stance);
  const condition = nonEmpty(body.condition);
  if (!morale || !stance || !condition) return { ok: false, error: "Morale, stance, or condition came back empty." };
  if (!Array.isArray(body.lines)) return { ok: false, error: "The living lines were missing." };
  const lines: ValidatedBattle["lines"] = [];
  for (const row of body.lines) {
    if (!row || typeof row !== "object") return { ok: false, error: "A description row was unreadable." };
    const unitId = (row as { unitId?: unknown }).unitId;
    const line2 = nonEmpty((row as { line2?: unknown }).line2);
    const line3 = nonEmpty((row as { line3?: unknown }).line3);
    const line4 = nonEmpty((row as { line4?: unknown }).line4);
    if (typeof unitId !== "string" || !known.has(unitId) || !line2 || !line3 || !line4) {
      return { ok: false, error: "A unit's new lines were incomplete." };
    }
    lines.push({ unitId, line2, line3, line4 });
  }
  const deadIds = new Set(deaths.filter((row) => {
    const unit = state.units.find((item) => item.id === row.unitId);
    return unit && row.count >= unit.count;
  }).map((row) => row.unitId));
  for (const unit of state.units) {
    if (deadIds.has(unit.id)) continue;
    if (!lines.some((row) => row.unitId === unit.id)) return { ok: false, error: `No new lines for ${unit.name}.` };
  }
  return {
    ok: true,
    value: {
      playerHoldsField: body.playerHoldsField,
      banditDeaths: body.banditDeaths,
      deaths,
      morale,
      stance,
      condition,
      lines,
    },
  };
}

export function applyOutcome(state: GameState, outcome: ValidatedBattle, brief: string, chronicle: string): { state: GameState; result: "victory" | "defeat" } {
  const approach = state.pendingBattle?.approach ?? "";
  const deathOf = new Map(outcome.deaths.map((row) => [row.unitId, row.count]));
  const lineOf = new Map(outcome.lines.map((row) => [row.unitId, row]));
  const units = state.units
    .map((unit) => {
      const deaths = deathOf.get(unit.id) ?? 0;
      const rewritten = lineOf.get(unit.id);
      const next: Unit = {
        ...unit,
        count: unit.count - deaths,
        battles: [
          ...unit.battles,
          {
            week: state.week,
            place: "Blackwood",
            foe: "the Blackwood bandits",
            approach,
            result: brief,
            deaths,
          },
        ],
      };
      if (rewritten && next.count > 0) next.lines = [rewritten.line2, rewritten.line3, rewritten.line4];
      return next;
    })
    .filter((unit) => unit.count > 0);

  const remaining = state.bandits ? state.bandits.count - outcome.banditDeaths : 0;
  const bandits = state.bandits && remaining > 0 ? { ...state.bandits, count: remaining } : null;
  const playerAlive = headcount(units) > 0;
  const victory = playerAlive && (bandits === null || outcome.playerHoldsField);
  const base: GameState = {
    ...state,
    units,
    bandits,
    morale: outcome.morale,
    stance: outcome.stance,
    condition: outcome.condition,
    moraleFromBattle: true,
    lastBrief: brief,
    lastChronicle: chronicle,
  };
  if (!victory) {
    const from = state.pendingBattle?.from ?? state.cameFrom ?? "millcross";
    const beaten = rememberLeader(
      { ...base, location: from, screen: "dashboard", pendingBattle: null, banditSurvivors: null },
      `He fought ${state.companyName} and beat them. ${brief}`
    );
    return { state: playerAlive ? beaten : { ...beaten, phase: "wiped" }, result: "defeat" };
  }
  const won = rememberLeader(
    { ...base, screen: "choice", pendingBattle: null, banditSurvivors: remaining },
    `He fought ${state.companyName} and lost the field. ${brief}`
  );
  return { state: won, result: "victory" };
}

export function namesForSurvivors(survivors: number): number {
  if (survivors <= 0) return 0;
  return Math.ceil(survivors / UNIT_CAP);
}

export function applyAftermath(state: GameState, choice: Aftermath, names: string[]): Result {
  if (state.screen !== "choice") return fail("There is no choice waiting.");
  const survivors = state.banditSurvivors ?? 0;
  if (survivors <= 0 && choice !== "kill") return fail("No one lived to be spared.");
  let next: GameState = { ...state, bandits: null, banditSurvivors: null, screen: "dashboard" };
  if (choice === "kill") {
    next = decide(next, "After the fight, the company killed whoever was left.");
    next.rewardPurse = REWARD_FULL;
    next.villageDeeds = [...next.villageDeeds, "Killed the Blackwood bandits."];
  } else if (choice === "justice") {
    next = decide(next, "After the fight, the company brought the survivors to Millcross for justice.");
    next.rewardPurse = REWARD_FULL;
    next.villageDeeds = [...next.villageDeeds, "Brought the Blackwood survivors to Millcross for justice."];
  } else {
    const needed = namesForSurvivors(survivors);
    const cleaned = names.map((name) => name.trim());
    if (cleaned.length !== needed || cleaned.some((name) => !name || name.length > 40)) {
      return fail(needed === 1 ? "Name the unit of former bandits." : `Name ${needed} units.`);
    }
    const plan = unitsNeeded(next.units, "bandit", survivors);
    if (plan.fresh.length !== cleaned.length) return fail("The new units do not match the survivors.");
    plan.fresh.forEach((count, index) => {
      const made = makeUnit(next, "bandit", count, cleaned[index]);
      next = made.state;
      next = { ...next, units: [...next.units, made.unit] };
    });
    next = decide(next, "After the fight, the company recruited the surviving bandits.");
    next.rewardPurse = REWARD_RECRUIT;
    next.villageDeeds = [...next.villageDeeds, "Recruited the Blackwood survivors instead of hanging them."];
  }
  next = rememberLeader(next, `The company chose to ${choice} whoever remained.`);
  return { ok: true, state: next };
}

export function acceptWork(state: GameState): Result {
  if (state.phase !== "play") return fail("The company is not in the field.");
  if (state.location !== "millcross") return fail("The elder is in Millcross.");
  if (state.villageWork) return fail("The work is already accepted.");
  if (!state.bandits) return fail("The bandits are already gone.");
  return {
    ok: true,
    state: decide(
      {
        ...state,
        villageWork: true,
        villageDeeds: [...state.villageDeeds, "Accepted Millcross's request to deal with the Blackwood bandits."],
      },
      "Accepted Millcross's request to deal with the Blackwood bandits."
    ),
  };
}

export function canClaimReward(state: GameState): boolean {
  return (
    state.phase === "play" &&
    state.location === "millcross" &&
    !state.rewardClaimed &&
    state.rewardPurse !== null &&
    (!state.bandits || state.bandits.count <= 0)
  );
}

export function claimReward(state: GameState): Result {
  if (!canClaimReward(state) || state.rewardPurse === null) return fail("Millcross has nothing to pay yet.");
  const purse = state.rewardPurse;
  return {
    ok: true,
    state: decide(
      {
        ...state,
        money: state.money + purse,
        rewardClaimed: true,
        villageDeeds: [...state.villageDeeds, `Paid ${purse} coins for clearing the Blackwood road.`],
      },
      `Claimed Millcross's reward of ${purse} coins for the Blackwood bandits.`
    ),
  };
}

export function describeAction(action: WeekAction): string {
  if (action.kind === "move") return `March to ${NODES[action.to].name}`;
  if (action.kind === "train") return `Drill two units: ${action.drill}`;
  if (action.kind === "convert") return action.direction === "to-good" ? "Improve plain food" : "Break good food down";
  if (action.kind === "recruit") return `Hire ${action.count} ${WIKI[action.type].title.toLowerCase()}`;
  return `Buy ${action.amount} ${action.store === "basic" ? "plain food" : action.store === "good" ? "good food" : "supply"}`;
}

export function companyDescription(state: GameState): string {
  const lines = state.units.map(
    (unit) =>
      `${unit.name}: ${unit.count} ${WIKI[unit.type].title}. ${unit.origin} ${unit.lines.join(" ")} Morale of the company: ${state.morale} Stance: ${state.stance}`
  );
  return `${state.companyName}, ${headcount(state.units)} men.\n${lines.join("\n")}`;
}

export function banditDescription(state: GameState): string {
  if (!state.bandits) return "The bandits are gone.";
  return `${state.leader.name}'s band, ${state.bandits.count} bandits. ${state.bandits.origin} ${state.bandits.lines.join(" ")} ${WIKI.bandit.worth}`;
}

export function comparisonSentence(comparison: ForceComparison): string {
  if (comparison === "larger") return "This company clearly outnumbers the band. You will not attack.";
  if (comparison === "smaller") return "The band clearly outnumbers this company. You will attack.";
  return "The two sides are close in number. Decide from your history with them and from what you know of yourself.";
}
