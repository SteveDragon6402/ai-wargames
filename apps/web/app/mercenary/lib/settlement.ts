import { freshSettlements } from "../data/millcross";
import { HARVEST_WEEK, REWARD_FULL, REWARD_RECRUIT, UNIT_CAP } from "../data/constants";
import { WIKI } from "../data/wiki";
import type { Debt, GameState, MusterOffer, Note, Party, Result, Settlement, SettlementId, TownTrigger, Unit } from "./types";

const TRIGGERS: TownTrigger[] = ["bandits-defeated"];

export function isTownTrigger(value: unknown): value is TownTrigger {
  return TRIGGERS.includes(value as TownTrigger);
}

export function placeOf(state: GameState, id: SettlementId): Settlement {
  return state.settlements[id];
}

function put(state: GameState, place: Settlement): GameState {
  return { ...state, settlements: { ...state.settlements, [place.id]: place } };
}

export function mouthsAtHome(state: GameState, place: Settlement): number {
  const away = state.units.filter((unit) => unit.home === place.id).reduce((sum, unit) => sum + unit.count, 0);
  return Math.max(0, place.mouths - away);
}

export function weeksOfFood(state: GameState, place: Settlement): number {
  const mouths = mouthsAtHome(state, place);
  if (mouths <= 0) return place.granary > 0 ? place.granary : 0;
  return Math.floor(place.granary / mouths);
}

export function eatGranaries(state: GameState): GameState {
  if (state.week > HARVEST_WEEK) return state;
  let next = state;
  for (const place of Object.values(state.settlements)) {
    if (!place.populated) continue;
    const eat = Math.min(place.granary, mouthsAtHome(state, place));
    next = put(next, { ...placeOf(next, place.id), granary: place.granary - eat });
  }
  return next;
}

export function writeNote(state: GameState, id: SettlementId, who: "elder" | "merchant", text: string): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "Nobody there keeps a book." };
  const line = text.trim();
  if (!line || line.length > 240) return { ok: false, error: "A note is one or two sentences." };
  const note: Note = { week: state.week, text: line };
  if (who === "elder") return { ok: true, state: put(state, { ...place, elder: { ...place.elder, notes: [...place.elder.notes, note] } }) };
  return { ok: true, state: put(state, { ...place, merchant: { ...place.merchant, notes: [...place.merchant.notes, note] } }) };
}

function addDebt(place: Settlement, debt: Omit<Debt, "id" | "status">): Settlement {
  const next: Debt = { ...debt, id: `d${place.nextDebtId}`, status: "open" };
  return { ...place, nextDebtId: place.nextDebtId + 1, debts: [...place.debts, next] };
}

export function grantGrain(state: GameState, id: SettlementId, amount: number): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "There is no granary here." };
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, error: "Give a whole number of grain." };
  if (amount > place.granary) return { ok: false, error: "The granary does not have that much." };
  return {
    ok: true,
    state: {
      ...put(state, { ...place, granary: place.granary - amount }),
      basicFood: state.basicFood + amount,
      notices: [...state.notices, `${place.elder.name} gave ${amount} grain. It is gone from the village.`],
    },
  };
}

export function setMerchantPrice(state: GameState, id: SettlementId, price: number): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "Nobody is selling there." };
  if (!Number.isInteger(price)) return { ok: false, error: "The price is a whole number of coins." };
  return { ok: true, state: put(state, { ...place, merchant: { ...place.merchant, price } }) };
}

export function sellGrain(state: GameState, id: SettlementId, amount: number, payNow: number, due: Debt["due"]): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "Nobody is selling there." };
  const merchant = place.merchant;
  if (merchant.price === null) return { ok: false, error: "He has not posted a price." };
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, error: "Buy a whole number of grain." };
  if (amount > merchant.grain) return { ok: false, error: "He does not have that much grain." };
  if (!Number.isInteger(payNow) || payNow < 0) return { ok: false, error: "Say how much is paid now." };
  const bill = merchant.price * amount;
  let next = state;
  let book = merchant;
  if (bill >= 0) {
    const now = Math.min(payNow, bill);
    if (next.money < now) return { ok: false, error: "Not enough coin." };
    next = { ...next, money: next.money - now, basicFood: next.basicFood + amount };
    book = { ...book, coins: book.coins + now, grain: book.grain - amount };
    const rest = bill - now;
    let placeNext = { ...place, merchant: book };
    if (rest > 0) placeNext = addDebt(placeNext, { from: "company", to: "merchant", coins: rest, why: `Grain, ${amount} at ${merchant.price}.`, due });
    next = put(next, placeNext);
  } else {
    const payout = -bill;
    next = { ...next, money: next.money + payout, basicFood: next.basicFood + amount };
    book = { ...book, coins: book.coins - payout, grain: book.grain - amount };
    next = put(next, { ...place, merchant: book });
  }
  return { ok: true, state: next };
}

export function agreePurse(state: GameState, id: SettlementId, coins: number, why: string): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "There is no chest here." };
  if (!Number.isInteger(coins) || coins < 1) return { ok: false, error: "The purse is a whole number of coins." };
  const reason = why.trim();
  if (!reason) return { ok: false, error: "Say why the purse is owed." };
  const debts = place.debts.filter((debt) => !(debt.status === "open" && debt.from === "elder" && debt.to === "company" && debt.due.kind === "trigger"));
  const cleared = { ...place, debts };
  return {
    ok: true,
    state: put(state, addDebt(cleared, { from: "elder", to: "company", coins, why: reason, due: { kind: "trigger", trigger: "bandits-defeated" } })),
  };
}

export function ensureWorkPurse(state: GameState, id: SettlementId): GameState {
  const place = placeOf(state, id);
  if (!place?.populated) return state;
  const open = place.debts.some((debt) => debt.status === "open" && debt.from === "elder" && debt.to === "company" && debt.due.kind === "trigger");
  if (open) return state;
  return put(state, addDebt(place, { from: "elder", to: "company", coins: REWARD_FULL, why: "The Blackwood road.", due: { kind: "trigger", trigger: "bandits-defeated" } }));
}

export function cutPurse(state: GameState, id: SettlementId): GameState {
  const place = placeOf(state, id);
  if (!place) return state;
  return put(state, {
    ...place,
    debts: place.debts.map((debt) =>
      debt.status === "open" && debt.from === "elder" && debt.to === "company" && debt.due.kind === "trigger"
        ? { ...debt, coins: Math.min(debt.coins, REWARD_RECRUIT) }
        : debt
    ),
  });
}

function takeCoins(state: GameState, place: Settlement, party: Party, coins: number): { state: GameState; place: Settlement } {
  if (party === "company") return { state: { ...state, money: state.money - coins }, place };
  if (party === "elder") return { state, place: { ...place, elder: { ...place.elder, coins: place.elder.coins - coins } } };
  return { state, place: { ...place, merchant: { ...place.merchant, coins: place.merchant.coins - coins } } };
}

function giveCoins(state: GameState, place: Settlement, party: Party, coins: number): { state: GameState; place: Settlement } {
  if (party === "company") return { state: { ...state, money: state.money + coins }, place };
  if (party === "elder") return { state, place: { ...place, elder: { ...place.elder, coins: place.elder.coins + coins } } };
  return { state, place: { ...place, merchant: { ...place.merchant, coins: place.merchant.coins + coins } } };
}

export function settleTrigger(state: GameState, trigger: TownTrigger): GameState {
  let next = state;
  for (const id of Object.keys(next.settlements) as SettlementId[]) {
    let place = placeOf(next, id);
    for (const debt of place.debts) {
      if (debt.status !== "open" || debt.due.kind !== "trigger" || debt.due.trigger !== trigger) continue;
      let moved = takeCoins(next, place, debt.from, debt.coins);
      moved = giveCoins(moved.state, moved.place, debt.to, debt.coins);
      place = {
        ...moved.place,
        debts: moved.place.debts.map((item) => (item.id === debt.id ? { ...item, status: "settled" } : item)),
      };
      next = put({ ...moved.state, notices: [...moved.state.notices, `${debt.coins} coins settled: ${debt.why}`] }, place);
    }
  }
  return next;
}

export function offerMuster(state: GameState, id: SettlementId, offer: MusterOffer): Result {
  const place = placeOf(state, id);
  if (!place?.populated) return { ok: false, error: "There are no men to muster here." };
  if (!Number.isInteger(offer.count) || offer.count < 1 || offer.count > place.able) return { ok: false, error: "That many men are not at home." };
  if (offer.term !== "permanent" && offer.term !== "temporary") return { ok: false, error: "They join for good, or only until the bandits are gone." };
  if (!Number.isInteger(offer.salary) || offer.salary < 0) return { ok: false, error: "The wage is a whole number of coins, or nothing." };
  return { ok: true, state: put(state, { ...place, muster: offer }) };
}

export function acceptMuster(state: GameState, id: SettlementId, name: string): Result {
  const place = placeOf(state, id);
  const offer = place?.muster;
  if (!place?.populated || !offer) return { ok: false, error: "Nobody has offered to come." };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) return { ok: false, error: "Name the unit, forty characters or fewer." };
  if (offer.count > place.able) return { ok: false, error: "That many men are not at home." };
  let next = state;
  let left = offer.count;
  let index = 0;
  const units = [...next.units];
  while (left > 0) {
    const count = Math.min(UNIT_CAP, left);
    const unitName = index === 0 ? trimmed : `${trimmed} ${index + 1}`;
    if (units.some((unit) => unit.name.toLowerCase() === unitName.toLowerCase())) return { ok: false, error: "That name is already in the company." };
    const unit: Unit = {
      id: `u${next.nextUnitId}`,
      name: unitName,
      type: "militia",
      count,
      origin: WIKI.militia.origin,
      lines: [...WIKI.militia.start],
      raw: true,
      salary: offer.salary,
      term: offer.term,
      home: id,
      battles: [],
    };
    units.push(unit);
    next = { ...next, nextUnitId: next.nextUnitId + 1 };
    left -= count;
    index += 1;
  }
  return {
    ok: true,
    state: put(
      {
        ...next,
        units,
        decisions: [...next.decisions, { week: next.week, text: `${offer.count} of ${place.elder.name}'s men joined, ${offer.term}, ${offer.salary} coin a week.` }],
      },
      { ...place, able: place.able - offer.count, muster: null }
    ),
  };
}

export function dismissTemporary(state: GameState, id: SettlementId): GameState {
  const place = placeOf(state, id);
  if (!place) return state;
  let able = place.able;
  const units = state.units.filter((unit) => {
    if (unit.term === "temporary" && unit.home === id) {
      able += unit.count;
      return false;
    }
    return true;
  });
  return put({ ...state, units }, { ...place, able });
}

export function wageDue(units: Unit[]): number {
  return units.reduce((sum, unit) => sum + Math.max(0, unit.salary ?? 1) * unit.count, 0);
}

export function dropUnpaid(units: Unit[], unpaidCoins: number): { units: Unit[]; gone: number } {
  let left = unpaidCoins;
  const counts = new Map(units.map((unit) => [unit.id, unit.count]));
  const order = [...units].filter((unit) => (unit.salary ?? 1) > 0).sort((a, b) => (b.salary ?? 1) - (a.salary ?? 1) || b.count - a.count);
  let gone = 0;
  for (const unit of order) {
    const wage = unit.salary ?? 1;
    while (left > 0 && (counts.get(unit.id) ?? 0) > 0) {
      counts.set(unit.id, (counts.get(unit.id) ?? 0) - 1);
      left -= wage;
      gone += 1;
    }
  }
  return {
    units: units.map((unit) => ({ ...unit, count: counts.get(unit.id) ?? unit.count })).filter((unit) => unit.count > 0),
    gone,
  };
}

export function openingSettlements(): Record<SettlementId, Settlement> {
  return freshSettlements();
}
