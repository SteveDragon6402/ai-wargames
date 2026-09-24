import { CONTRACTS } from "../data/contracts";
import { KINGDOM_SPECIAL, NODES, isForest, isSettlement, neighbors, type NodeId } from "../data/map";
import {
  APPROACH_WORDS,
  BANDIT_COUNT,
  CONVERT_CAP,
  DESCRIPTION_MAX,
  DESCRIPTION_START,
  FORAGE_CHANCE,
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
  type DeedOrder,
  type LineDiff,
  type MovementOrder,
  type Result,
  type Step,
  type Unit,
  type ValidatedBattle,
  type WeekAction,
  type WeekOrder,
  type WeekPlan,
} from "./types";

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function headcount(units: Unit[]): number {
  return units.reduce((sum, unit) => sum + unit.count, 0);
}

export function foodWeeks(state: GameState): number {
  const men = headcount(state.units);
  if (men < 1) return 0;
  return Math.floor((state.basicFood + state.goodFood) / men);
}

export function defaultWeekPlan(): WeekPlan {
  return { movement: { kind: "rest" }, deed: { kind: "rest" }, order: "action-first" };
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
    lateBasic: 0,
    lateGood: 0,
    supply: STARTING.supply,
    ration: "plain",
    units: [],
    nextUnitId: 1,
    reputation: { holt: "", ashmarch: "", mere: "", nobles: "", peasants: "" },
    decisions: [],
    weekPlan: defaultWeekPlan(),
    queue: [],
    resolveIndex: 0,
    movedThisWeek: false,
    weeksSinceRest: 0,
    weeksDoubleRest: 0,
    bandAt: "blackwood",
    payAt: "millcross",
    contract: null,
    contractStep: 0,
    hungerNote: null,
    weekScene: null,
    drillDiffs: [],
    reputationShift: [],
    yearClosing: null,
    notices: [],
    villageWork: false,
    rewardClaimed: false,
    rewardPurse: null,
    bandits: {
      count: BANDIT_COUNT,
      origin: WIKI.bandit.origin,
      lines: startingDescription("bandit"),
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
    lines: startingDescription(type),
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

export function recruitmentPlan(
  units: Unit[],
  type: UnitTypeId,
  count: number,
  into?: string | "new"
): { fills: { id: string; add: number }[]; fresh: number[] } {
  if (into === "new") return unitsNeeded([], type, count);
  if (into) {
    const target = units.find((unit) => unit.id === into && unit.type === type);
    if (target) return unitsNeeded([target], type, count);
  }
  return unitsNeeded(units, type, count);
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

export const DEFAULT_COMPANY_NAME = "The Free Company";
export const DEFAULT_APPROACH = "We go straight at them.";
export const DEFAULT_DRILL = "The ordinary drill";

const DEFAULT_UNIT_NAME: Record<UnitTypeId, string> = {
  swordsmen: "The File",
  spearmen: "The Hedge",
  archers: "The Bows",
  light_cavalry: "The Outriders",
  heavy_cavalry: "The Hammer",
  berserkers: "The Mad",
  bandit: "The Taken",
};

export function defaultUnitName(type: UnitTypeId, taken: string[]): string {
  const base = DEFAULT_UNIT_NAME[type];
  const used = new Set(taken.map((name) => name.trim().toLowerCase()).filter(Boolean));
  if (!used.has(base.toLowerCase())) return base;
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

export function defaultNamesFor(type: UnitTypeId, count: number, taken: string[]): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) names.push(defaultUnitName(type, [...taken, ...names]));
  return names;
}

export function startingDescription(type: UnitTypeId): string[] {
  const entry = WIKI[type];
  return [entry.origin, ...entry.start].slice(0, DESCRIPTION_START);
}

/** The model may rewrite, drop, or add lines. The card starts at four and stops at ten. */
export function clampDescription(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean).slice(0, DESCRIPTION_MAX);
}

export function fallbackForageMeals(men: number, roll: () => number = Math.random): number {
  let meals = 0;
  const count = Math.max(0, Math.floor(men));
  for (let i = 0; i < count; i += 1) {
    if (roll() < FORAGE_CHANCE) meals += 1;
  }
  return meals;
}

interface Projected {
  money: number;
  basicFood: number;
  goodFood: number;
  supply: number;
  location: NodeId;
  moved: boolean;
  foraged: boolean;
}

function movementAction(movement: MovementOrder): WeekAction {
  return movement.kind === "rest" ? { kind: "rest" } : { kind: "move", to: movement.to };
}

function deedAction(deed: DeedOrder): WeekAction {
  return deed.kind === "rest" ? { kind: "rest" } : deed;
}

export function composeQueue(plan: WeekPlan): WeekAction[] {
  const deed = deedAction(plan.deed);
  const movement = movementAction(plan.movement);
  return plan.order === "movement-first" ? [movement, deed] : [deed, movement];
}

function project(state: GameState): Projected | { error: string } {
  const projected: Projected = {
    money: state.money,
    basicFood: state.basicFood,
    goodFood: state.goodFood,
    supply: state.supply,
    location: state.location,
    moved: state.movedThisWeek,
    foraged: false,
  };
  const counts = state.units.map((unit) => ({ ...unit }));
  const actions = state.resolveIndex > 0 ? state.queue : composeQueue(state.weekPlan);
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
      const plan = recruitmentPlan(counts, action.type, action.count, action.into);
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
          lines: [],
          battles: [],
        });
      }
    } else if (action.kind === "forage") {
      if (!isForest(projected.location)) return { error: "There is no forest here to forage." };
      if (projected.foraged) return { error: "The company is already foraging this week." };
      projected.foraged = true;
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

function weekOpen(state: GameState): string | null {
  if (state.phase !== "play" || state.resolveIndex > 0 || state.pendingBattle) return "The week is already in motion.";
  return null;
}

export function setMovement(state: GameState, movement: MovementOrder): Result {
  const closed = weekOpen(state);
  if (closed) return fail(closed);
  const next = { ...state, weekPlan: { ...state.weekPlan, movement } };
  const projected = project(next);
  if ("error" in projected) return fail(projected.error);
  return { ok: true, state: next };
}

export function setDeed(state: GameState, deed: DeedOrder): Result {
  const closed = weekOpen(state);
  if (closed) return fail(closed);
  const next = { ...state, weekPlan: { ...state.weekPlan, deed } };
  const projected = project(next);
  if ("error" in projected) return fail(projected.error);
  return { ok: true, state: next };
}

export function setWeekOrder(state: GameState, order: WeekOrder): Result {
  const closed = weekOpen(state);
  if (closed) return fail(closed);
  const next = { ...state, weekPlan: { ...state.weekPlan, order } };
  const projected = project(next);
  if ("error" in projected) return fail(projected.error);
  return { ok: true, state: next };
}

export function canEnqueue(state: GameState, action: WeekAction): string | null {
  const closed = weekOpen(state);
  if (closed) return closed;
  if (action.kind === "move") {
    if (state.weekPlan.movement.kind === "march") return "The company can march once this week.";
    const result = setMovement(state, { kind: "march", to: action.to });
    return result.ok ? null : result.error;
  }
  if (state.weekPlan.deed.kind !== "rest") return "One action this week.";
  if (action.kind === "rest") return null;
  const result = setDeed(state, action);
  return result.ok ? null : result.error;
}

export function enqueue(state: GameState, action: WeekAction): Result {
  const error = canEnqueue(state, action);
  if (error) return fail(error);
  if (action.kind === "move") return setMovement(state, { kind: "march", to: action.to });
  if (action.kind === "rest") return setDeed(state, { kind: "rest" });
  return setDeed(state, action);
}

export function dequeue(state: GameState, index: number): Result {
  if (state.resolveIndex > 0) return fail("The week has already started.");
  const slot = state.weekPlan.order === "movement-first" ? (index === 0 ? "movement" : index === 1 ? "deed" : null) : index === 0 ? "deed" : index === 1 ? "movement" : null;
  if (!slot) return fail("That action is gone.");
  if (slot === "movement") return { ok: true, state: { ...state, weekPlan: { ...state.weekPlan, movement: { kind: "rest" } } } };
  return { ok: true, state: { ...state, weekPlan: { ...state.weekPlan, deed: { kind: "rest" } } } };
}

export function setRation(state: GameState, ration: "hearty" | "plain"): GameState {
  return { ...state, ration };
}

export function beginResolution(state: GameState): GameState {
  if (state.resolveIndex > 0) return state;
  return {
    ...state,
    queue: composeQueue(state.weekPlan),
    notices: [],
    drillDiffs: [],
    weekScene: null,
    reputationShift: [],
    hungerNote: null,
  };
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
    if (action.store === "basic") {
      next.basicFood += action.amount;
      if (state.movedThisWeek) next.lateBasic += action.amount;
    }
    if (action.store === "good") {
      next.goodFood += action.amount;
      if (state.movedThisWeek) next.lateGood += action.amount;
    }
    if (action.store === "supply") next.supply += action.amount;
    return next;
  }
  if (action.kind === "recruit") {
    if (!isSettlement(state.location) || !recruitableTypes(state.location).includes(action.type)) {
      return notice(state, "No one of that trade would take service here.");
    }
    const cost = manPrice(action.type) * action.count;
    if (state.money < cost) return notice(state, "The coin was short, and the hiring failed.");
    const plan = recruitmentPlan(state.units, action.type, action.count, action.into);
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
  if (action.kind === "forage") return { kind: "forage", state };
  const applied = applyListed(state, action);
  const advanced = { ...applied, resolveIndex: state.resolveIndex + 1 };
  if (action.kind === "move" && state.bandits && action.to === state.bandAt && advanced.location === state.bandAt) {
    return { kind: "forest", state: { ...advanced, screen: "forest" } };
  }
  return { kind: "continue", state: advanced };
}

export function applyTraining(state: GameState, linesByUnit: Record<string, string[]>): Result {
  const action = state.queue[state.resolveIndex];
  if (!action || action.kind !== "train") return fail("No drill is waiting.");
  for (const id of action.unitIds) {
    const lines = linesByUnit[id];
    if (!lines || lines.every((line) => !line.trim())) return fail("The drill came back without lines for both units.");
  }
  const drillDiffs: LineDiff[] = [];
  const units = state.units.map((unit) => {
    const lines = linesByUnit[unit.id];
    if (!lines) return unit;
    const next = clampDescription(lines);
    if (next.length < 1) return unit;
    drillDiffs.push({ unitId: unit.id, name: unit.name, before: [...unit.lines], after: next });
    return { ...unit, lines: next };
  });
  return {
    ok: true,
    state: { ...state, resolveIndex: state.resolveIndex + 1, units, drillDiffs },
  };
}

export function applyForage(state: GameState, meals: number, account: string): Result {
  const action = state.queue[state.resolveIndex];
  if (!action || action.kind !== "forage") return fail("No forage is waiting.");
  const men = headcount(state.units);
  const found = Math.max(0, Math.min(men, Math.round(Number.isFinite(meals) ? meals : 0)));
  const told = account.trim() || `They foraged and brought back ${found} rations.`;
  return {
    ok: true,
    state: notice(
      {
        ...state,
        basicFood: state.basicFood + found,
        resolveIndex: state.resolveIndex + 1,
      },
      told
    ),
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
  const lateBasic = state.lateBasic ?? 0;
  const lateGood = state.lateGood ?? 0;
  const eatableBasic = Math.max(0, state.basicFood - lateBasic);
  const eatableGood = Math.max(0, state.goodFood - lateGood);
  let basic = eatableBasic;
  let good = eatableGood;
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
  if (men > 0 && basic === eatableBasic && good === eatableGood && missing === men) {
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
      ? "They ate well."
      : hunger === "mixed"
        ? "The good food ran out. The rest ate plain."
        : hunger === "hungry"
          ? "They are hungry. The missing rations have soured them."
          : hunger === "starving"
            ? "They are starving."
            : "They ate plain.";
  const hungry = hunger === "hungry" || hunger === "starving";
  const doubleRest = state.weekPlan.movement.kind === "rest" && state.weekPlan.deed.kind === "rest" && !state.movedThisWeek;
  const marched = state.weekPlan.movement.kind === "march" || state.movedThisWeek;

  const closed: GameState = {
    ...next,
    units,
    basicFood: basic + lateBasic,
    goodFood: good + lateGood,
    lateBasic: 0,
    lateGood: 0,
    morale: hungry ? `${state.morale} ${foodLine}`.trim() : state.morale,
    condition: hungry ? `${state.condition} ${foodLine}`.trim() : state.condition,
    hungerNote: foodLine,
    moraleFromBattle: false,
    weeksSinceRest: marched ? state.weeksSinceRest + 1 : 0,
    weeksDoubleRest: doubleRest ? state.weeksDoubleRest + 1 : 0,
    weekPlan: defaultWeekPlan(),
    queue: [],
    resolveIndex: 0,
    movedThisWeek: false,
    cameFrom: null,
    pendingBattle: null,
    screen: next.phase === "wiped" ? next.screen : "dashboard",
  };
  if (headcount(closed.units) === 0) return { ...closed, phase: "wiped" };
  if (state.week >= MAX_WEEK) return { ...closed, phase: "year-end" };
  return { ...closed, week: state.week + 1 };
}

export function retreatStartsFight(roll: number): boolean {
  return roll < RETREAT_FIGHT_CHANCE;
}

export function cancelRest(state: GameState): GameState {
  return state;
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

export function takeForestForage(state: GameState, meals: number, account: string): GameState {
  const men = headcount(state.units);
  const found = Math.max(0, Math.min(men, Math.round(Number.isFinite(meals) ? meals : 0)));
  const told = account.trim() || `They foraged and brought back ${found} rations.`;
  return notice(
    rememberLeader(
      { ...state, basicFood: state.basicFood + found, screen: "dashboard" },
      "The company foraged in the forest and did not seek a fight."
    ),
    told
  );
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.max(0, Math.round(Number(value)));
  return null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "yes", "held", "company", "player", "win", "won"].includes(text)) return true;
    if (["false", "no", "lost", "bandits", "bandit", "loss"].includes(text)) return false;
  }
  return null;
}

function unitByToken(state: GameState, token: string): Unit | undefined {
  const key = token.trim().toLowerCase();
  return state.units.find((unit) => unit.id.toLowerCase() === key || unit.name.toLowerCase() === key);
}

export function clipWords(text: string, max: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ")}…`;
}

export function parseReport(text: string): { brief: string; chronicle: string } | null {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
  if (cleaned.length < 40) return null;
  const labelled = cleaned.match(/(?:^|\n)\s*brief\s*[:\-—]\s*([\s\S]+)/i);
  let brief = "";
  let chronicle = cleaned;
  if (labelled?.[1]) {
    const body = labelled[1].trim();
    const stop = body.search(/\n\s*\n|\n\s*(?:phase|chronicle|report)\b/i);
    brief = (stop === -1 ? body : body.slice(0, stop)).replace(/\s+/g, " ").trim();
    const without = cleaned.replace(labelled[0], "").trim();
    chronicle = without.length > 40 ? without : cleaned;
  }
  if (wordCount(brief) < 8) brief = clipWords(cleaned, 50);
  else if (wordCount(brief) > 70) brief = clipWords(brief, 60);
  return { brief, chronicle };
}

export function validateOutcome(state: GameState, raw: unknown): { ok: true; value: ValidatedBattle } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "The executor returned nothing usable." };
  const body = raw as Record<string, unknown>;
  const knownKeys = ["playerHoldsField", "holdsField", "winner", "banditDeaths", "enemyDeaths", "deaths", "casualties", "morale", "lines", "descriptions"];
  if (!knownKeys.some((key) => key in body)) return { ok: false, error: "The executor returned no battle fields." };

  const deaths = new Map<string, number>();
  const deathSource = body.deaths ?? body.casualties;
  const noteDeath = (token: string, count: number) => {
    const unit = unitByToken(state, token);
    if (!unit) return;
    deaths.set(unit.id, Math.min(unit.count, (deaths.get(unit.id) ?? 0) + count));
  };
  if (Array.isArray(deathSource)) {
    for (const row of deathSource) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const count = asInt(record.count ?? record.deaths ?? record.dead ?? record.losses) ?? 0;
      const token = [record.unitId, record.id, record.unit, record.name].find((item) => typeof item === "string") as string | undefined;
      if (token) noteDeath(token, count);
    }
  } else if (deathSource && typeof deathSource === "object") {
    for (const [key, value] of Object.entries(deathSource as Record<string, unknown>)) noteDeath(key, asInt(value) ?? 0);
  }

  const banditCount = state.bandits?.count ?? 0;
  const banditDeaths = Math.min(banditCount, asInt(body.banditDeaths ?? body.enemyDeaths ?? body.bandit_deaths) ?? 0);
  const playerDeaths = [...deaths.values()].reduce((sum, count) => sum + count, 0);
  let holds = asBool(body.playerHoldsField ?? body.holdsField);
  if (holds === null && typeof body.winner === "string") {
    const winner = body.winner.toLowerCase();
    if (winner.includes("bandit")) holds = false;
    else holds = true;
  }
  if (holds === null) {
    const playerGone = playerDeaths >= headcount(state.units) && headcount(state.units) > 0;
    if (playerGone) holds = false;
    else if (banditCount > 0 && banditDeaths >= banditCount) holds = true;
    else holds = banditDeaths >= playerDeaths;
  }

  const lines: ValidatedBattle["lines"] = [];
  const lineSource = body.lines ?? body.descriptions;
  if (Array.isArray(lineSource)) {
    for (const row of lineSource) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const token = [record.unitId, record.id, record.unit, record.name].find((item) => typeof item === "string") as string | undefined;
      const unit = token ? unitByToken(state, token) : undefined;
      if (!unit) continue;
      const bundle = Array.isArray(record.lines)
        ? record.lines.filter((item): item is string => typeof item === "string")
        : [record.line2, record.line3, record.line4].filter((item): item is string => typeof item === "string");
      const nextLines = clampDescription(bundle);
      lines.push({ unitId: unit.id, lines: nextLines.length ? nextLines : [...unit.lines] });
    }
  }
  for (const unit of state.units) {
    if ((deaths.get(unit.id) ?? 0) >= unit.count) continue;
    if (!lines.some((row) => row.unitId === unit.id)) {
      lines.push({ unitId: unit.id, lines: [...unit.lines] });
    }
  }

  return {
    ok: true,
    value: {
      playerHoldsField: holds,
      banditDeaths,
      deaths: [...deaths.entries()].map(([unitId, count]) => ({ unitId, count })),
      morale: nonEmpty(body.morale) ?? state.morale,
      stance: nonEmpty(body.stance) ?? state.stance,
      condition: nonEmpty(body.condition) ?? state.condition,
      lines,
    },
  };
}

/** Rations the company can eat this week. A purchase after the march does not count. */
export function carriedRations(state: GameState): number {
  let basic = state.basicFood;
  let good = state.goodFood;
  let money = state.money;
  let location = state.location;
  let marched = state.movedThisWeek;
  const actions = state.resolveIndex > 0 ? state.queue.slice(state.resolveIndex) : composeQueue(state.weekPlan);
  for (const action of actions) {
    if (action.kind === "move" && !marched && neighbors(location).includes(action.to)) {
      marched = true;
      location = action.to;
      continue;
    }
    if (marched) continue;
    if (action.kind === "buy" && isSettlement(location)) {
      const cost = PRICE[action.store] * action.amount;
      if (money >= cost && action.amount > 0) {
        money -= cost;
        if (action.store === "basic") basic += action.amount;
        if (action.store === "good") good += action.amount;
      }
    } else if (action.kind === "convert") {
      if (action.direction === "to-good") {
        const pairs = Math.min(CONVERT_CAP, Math.floor(basic / 2));
        basic -= pairs * 2;
        good += pairs;
      } else {
        const meals = Math.min(CONVERT_CAP, good);
        good -= meals;
        basic += meals * 2;
      }
    }
  }
  return basic + good;
}

export function foodWarning(state: GameState): string | null {
  if (state.phase !== "play" || state.resolveIndex > 0) return null;
  const need = headcount(state.units);
  const have = carriedRations(state);
  if (have >= need) return null;
  const short = need - have;
  const rations = `Short ${short} ration${short === 1 ? "" : "s"}.`;
  const planned = state.resolveIndex > 0 ? state.queue : composeQueue(state.weekPlan);
  if (planned.some((action) => action.kind === "forage")) {
    return `${rations} The forest may feed them. It is not promised.`;
  }
  return `${rations} You can still march. Buy before the march if you want them fed this week.`;
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
            place: NODES[state.location].name,
            foe: state.leader.name,
            approach,
            result: brief,
            deaths,
          },
        ],
      };
      if (rewritten && next.count > 0 && rewritten.lines.length > 0) {
        next.lines = linesTouchedByChronicle(unit.lines, rewritten.lines, `${brief}\n${chronicle}`);
      }
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
  const contracted = state.contract?.status === "taken" ? state.contract : null;
  let next: GameState = {
    ...state,
    bandits: null,
    banditSurvivors: null,
    screen: "dashboard",
    contract: null,
    contractStep: contracted ? state.contractStep + 1 : state.contractStep,
  };
  if (choice === "kill") {
    next = decide(next, "After the fight, the company killed whoever was left.");
    next.rewardPurse = contracted ? contracted.purse : REWARD_FULL;
    next.villageDeeds = [...next.villageDeeds, "Killed the Blackwood bandits."];
  } else if (choice === "justice") {
    next = decide(next, "After the fight, the company brought the survivors in for justice.");
    next.rewardPurse = contracted ? contracted.purse : REWARD_FULL;
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
    next.rewardPurse = contracted ? Math.min(contracted.purse, REWARD_RECRUIT) : REWARD_RECRUIT;
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
    state.location === state.payAt &&
    !state.rewardClaimed &&
    state.rewardPurse !== null &&
    (!state.bandits || state.bandits.count <= 0)
  );
}

export function claimReward(state: GameState): Result {
  if (!canClaimReward(state) || state.rewardPurse === null) return fail("There is nothing to pay yet.");
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
      `Claimed ${purse} coins for the work.`
    ),
  };
}

export function nextContractTemplate(state: GameState) {
  if (state.phase !== "play" || state.bandits || state.contract) return null;
  return CONTRACTS[state.contractStep] ?? null;
}

export function offerContract(state: GameState, offer: string): Result {
  const template = nextContractTemplate(state);
  if (!template) return fail("No one is offering work.");
  const text =
    offer.trim() ||
    `${template.leaderName} is at ${NODES[template.place].name}. The purse is ${template.purse} coins, paid at ${NODES[template.payAt].name}.`;
  return { ok: true, state: { ...state, contract: { ...template, offer: text, status: "offered" } } };
}

export function takeContract(state: GameState): Result {
  if (!state.contract || state.contract.status !== "offered") return fail("There is no offer to take.");
  if (state.bandits) return fail("A band is already in the field.");
  const contract = state.contract;
  return {
    ok: true,
    state: decide(
      {
        ...state,
        contract: { ...contract, status: "taken" },
        bandAt: contract.place,
        payAt: contract.payAt,
        rewardClaimed: false,
        rewardPurse: null,
        bandits: {
          count: contract.count,
          origin: WIKI.bandit.origin,
          lines: startingDescription("bandit"),
          morale: "Wary, and sure of this ground.",
          stance: "They watch and decline a fight they dislike.",
        },
        leader: {
          name: contract.leaderName,
          blurb: contract.blurb,
          generalHistory: `${contract.leaderName} keeps ${contract.bandName} at ${NODES[contract.place].name}.`,
          withCompany: [],
        },
      },
      `Took the offer against ${contract.bandName} at ${NODES[contract.place].name}. The purse is ${contract.purse} coins at ${NODES[contract.payAt].name}.`
    ),
  };
}

export function linesTouchedByChronicle(previous: string[], proposed: string[], chronicle: string): string[] {
  const hay = chronicle.toLowerCase();
  const next = previous.map((line) => line.trim()).filter(Boolean);
  for (const raw of proposed) {
    const line = raw.trim();
    if (!line) continue;
    const words = line.toLowerCase().split(/[^a-z0-9']+/).filter((word) => word.length > 3);
    const snippet = line.toLowerCase().split(/\s+/).slice(0, 6).join(" ");
    if (snippet.length < 12 || !hay.includes(snippet)) continue;
    const index = next.findIndex((old) => {
      const oldWords = new Set(old.toLowerCase().split(/[^a-z0-9']+/).filter((word) => word.length > 4));
      return words.filter((word) => word.length > 4 && oldWords.has(word)).length >= 2;
    });
    if (index >= 0) next[index] = line;
    else if (!next.some((old) => old.toLowerCase() === line.toLowerCase())) next.push(line);
  }
  const clamped = clampDescription(next);
  return clamped.length ? clamped : previous;
}

export function describeAction(action: WeekAction): string {
  if (action.kind === "rest") return "Rest";
  if (action.kind === "move") return `March to ${NODES[action.to].name}`;
  if (action.kind === "train") return `Drill two units: ${action.drill}`;
  if (action.kind === "forage") return "Forage in the forest";
  if (action.kind === "convert") return action.direction === "to-good" ? "Improve plain food" : "Break good food down";
  if (action.kind === "recruit") {
    const asNew = action.into === "new" ? " as a new unit" : "";
    return `Hire ${action.count} ${WIKI[action.type].title.toLowerCase()}${asNew}`;
  }
  return `Buy ${action.amount} ${action.store === "basic" ? "plain food" : action.store === "good" ? "good food" : "supply"}`;
}

export function companyDescription(state: GameState): string {
  const lines = state.units.map(
    (unit) =>
      `${unit.name}: ${unit.count} ${WIKI[unit.type].title}. ${unit.lines.join(" ")} Morale of the company: ${state.morale} Stance: ${state.stance}`
  );
  return `${state.companyName}, ${headcount(state.units)} men.\n${lines.join("\n")}`;
}

export function banditDescription(state: GameState): string {
  if (!state.bandits) return "The bandits are gone.";
  return `${state.leader.name}'s band, ${state.bandits.count} bandits. ${state.bandits.lines.join(" ")} ${WIKI.bandit.worth}`;
}

export function comparisonSentence(comparison: ForceComparison): string {
  if (comparison === "larger") return "This company clearly outnumbers the band. You will not attack.";
  if (comparison === "smaller") return "The band clearly outnumbers this company. You will attack.";
  return "The two sides are close in number. Decide from your history with them and from what you know of yourself.";
}
