import { CONFIG, RECRUIT_STATS, UNIT_TYPES } from "./config";
import {
  applyUnitHarm,
  clamp,
  companyStacks,
  fightStacks,
  forceStack,
  groupStack,
  killForcePeople,
  killInGroup,
  shiftStance,
  terrainOf,
  type Stack,
} from "./combat";
import { rollD100, rollInt } from "./rng";
import { breadNow, goldNow, livingMembers, peopleNow, takeBread, takeGold } from "./resources";
import { companyHeadcount, createGame } from "./seed";
import type {
  Deal,
  Disposition,
  DispositionLevel,
  GameEvent,
  GameState,
  PendingAction,
  Quest,
  Rumour,
  Stance,
  Unit,
  Volunteer,
  WeeklyReport,
} from "./types";

export function levelFor(score: number): DispositionLevel {
  if (score >= 25) return "friendly";
  if (score <= -25) return "hostile";
  return "neutral";
}

export function disposition(state: GameState, holderId: string, towardId = "company"): Disposition | undefined {
  return state.dispositions.find((item) => item.holderId === holderId && item.towardId === towardId);
}

export function scoreOf(state: GameState, holderId: string, towardId = "company"): number {
  return disposition(state, holderId, towardId)?.score ?? 0;
}

export function isHostile(state: GameState, holderId: string, towardId = "company"): boolean {
  return disposition(state, holderId, towardId)?.level === "hostile";
}

function pushEvent(state: GameState, event: GameEvent) {
  state.events.push(event);
}

function storeFor(state: GameState, locationId: string) {
  return state.stores.find((store) => store.locationId === locationId);
}

function groupAt(state: GameState, groupId: string) {
  return state.groups.find((group) => group.id === groupId);
}

export function reachable(state: GameState): string[] {
  if (state.moveUsed || state.actionUsed || state.lost || state.ended) return [];
  const here = state.locations.find((location) => location.id === state.locationId);
  return here?.links ?? [];
}

export function move(state: GameState, locationId: string): GameState {
  const next = structuredClone(state);
  if (!reachable(next).includes(locationId)) return state;
  next.locationId = locationId;
  next.moveUsed = true;
  next.company.hidden = false;
  next.company.ambushReady = false;
  next.company.sheltered = false;
  const force = next.forces.find((item) => item.id === next.company.forceId);
  if (force) force.locationId = locationId;
  pushEvent(next, { week: next.week, type: "move", locationId, significant: false, payload: {} });
  refreshFlags(next);
  return next;
}

export function setWage(state: GameState, unitId: string, wage: number): GameState {
  const next = structuredClone(state);
  const unit = next.company.units.find((item) => item.id === unitId);
  if (!unit || unit.headcount <= 0) return state;
  unit.wageBreadPerDay = Math.max(0, Math.min(CONFIG.maxWage, Math.round(wage)));
  return next;
}

export function setStance(state: GameState, unitId: string, stance: Stance): GameState {
  const next = structuredClone(state);
  const unit = next.company.units.find((item) => item.id === unitId);
  if (!unit || unit.headcount <= 0) return state;
  unit.stance = stance;
  return next;
}

export function trade(state: GameState, npcId: string, bread: number, side: "buy" | "sell"): { state: GameState; note: string } {
  const next = structuredClone(state);
  const npc = next.npcs.find((item) => item.id === npcId);
  const location = next.locations.find((item) => item.id === next.locationId);
  if (!npc || !location?.exchangeRate || bread <= 0) return { state, note: "There is nothing to trade." };
  if (isHostile(next, npc.id)) return { state, note: `${npc.name} will not trade.` };
  const rate = location.exchangeRate;
  if (side === "buy") {
    const loaves = Math.min(bread, npc.bread);
    const gold = Math.ceil(loaves / rate);
    if (loaves <= 0 || next.company.gold < gold) return { state, note: "The price is more gold than you are carrying." };
    npc.bread -= loaves;
    npc.gold += gold;
    next.company.bread += loaves;
    next.company.gold -= gold;
    pushEvent(next, { week: next.week, type: "trade", locationId: next.locationId, significant: false, payload: { bread: loaves, gold: -gold } });
    return { state: next, note: `Bought ${loaves} bread for ${gold} gold.` };
  }
  const loaves = Math.min(bread, next.company.bread);
  const gold = Math.floor(loaves / rate);
  if (loaves <= 0 || npc.gold < gold) return { state, note: "The merchant cannot pay." };
  next.company.bread -= loaves;
  next.company.gold += gold;
  npc.bread += loaves;
  npc.gold -= gold;
  pushEvent(next, { week: next.week, type: "trade", locationId: next.locationId, significant: false, payload: { bread: -loaves, gold } });
  return { state: next, note: `Sold ${loaves} bread for ${gold} gold.` };
}

export function sellGood(state: GameState, goodId: string): GameState {
  const next = structuredClone(state);
  const good = next.company.goods.find((item) => item.id === goodId);
  if (!good || good.qty <= 0) return state;
  const pay = good.qty * good.valueGold;
  next.company.gold += pay;
  good.qty = 0;
  next.company.goods = next.company.goods.filter((item) => item.qty > 0);
  pushEvent(next, { week: next.week, type: "sell-good", significant: false, payload: { gold: pay } });
  return next;
}

export function stageAction(state: GameState, action: PendingAction): GameState {
  if (!action || state.actionUsed || state.lost || state.ended) return state;
  const next = structuredClone(state);
  next.pendingAction = action;
  next.actionUsed = true;
  if (action.kind === "drink") next.innLeft = CONFIG.innMessages;
  return next;
}

export function acceptDeal(state: GameState, dealId: string): GameState {
  const next = structuredClone(state);
  const deal = next.deals.find((item) => item.id === dealId);
  if (!deal || deal.status !== "offered") return state;
  const moved = payFromNpc(next, deal.npcId, deal.upfrontGold || 0, 0);
  if ((deal.upfrontGold || 0) > 0 && moved.gold < (deal.upfrontGold || 0)) return state;
  next.company.gold += moved.gold;
  next.company.bread += moved.bread;
  deal.status = "accepted";
  if (deal.questId) {
    const quest = next.quests.find((item) => item.id === deal.questId);
    if (quest) {
      quest.status = "active";
      quest.upfrontGold = deal.upfrontGold;
      quest.upfrontPaid = deal.upfrontGold > 0;
      quest.rewardGold = deal.gold;
      quest.termsText = deal.note;
      const rest = Math.max(0, deal.gold - deal.upfrontGold);
      if (rest > 0) {
        next.ledger.push({
          id: `led-${next.ledger.length + 1}`,
          npcId: deal.npcId,
          direction: "npc_owes",
          amount: rest,
          currency: "gold",
          dueWeek: deal.dueWeek ?? next.maxWeeks,
          interest: 0,
          note: deal.note,
          status: "open",
        });
      }
    }
  }
  if (deal.kind === "loan" && deal.gold > 0) {
    next.ledger.push({
      id: `led-${next.ledger.length + 1}`,
      npcId: deal.npcId,
      direction: "player_owes",
      amount: deal.gold,
      currency: "gold",
      dueWeek: deal.dueWeek ?? next.week + 4,
      interest: 0,
      note: deal.note,
      status: "open",
    });
  }
  if (deal.kind === "pardon") {
    setDisposition(next, "crown", "company", 10, "A pardon was bought. The Crown will hear you.", "Pardon accepted");
    setDisposition(next, "aldous", "company", 10, "The Steward took the gold and lifted the hue.", "Pardon accepted");
    next.negotiatedEnd = true;
    pushEvent(next, { week: next.week, type: "pardon", significant: true, payload: {} });
  }
  pushEvent(next, { week: next.week, type: "deal", significant: true, payload: { gold: moved.gold } });
  bump(next, deal.npcId, 6, "You came to terms.");
  return next;
}

export function counterDeal(state: GameState, dealId: string, upfrontGold: number): GameState {
  const next = structuredClone(state);
  const deal = next.deals.find((item) => item.id === dealId);
  if (!deal || deal.status !== "offered") return state;
  const npc = next.npcs.find((item) => item.id === deal.npcId);
  const funds = fundsOf(next, deal.npcId);
  const ask = Math.max(0, Math.round(upfrontGold));
  const willing = ask <= deal.gold && ask <= funds.gold && ask <= Math.max(deal.upfrontGold, Math.round(deal.gold * 0.6));
  if (!willing) {
    next.messages.push({ id: `m-${next.messages.length}`, who: npc?.name ?? "Them", role: "npc", text: "That is more than I will put in your hand." });
    return next;
  }
  deal.upfrontGold = ask;
  deal.note = `${deal.note} ${ask} gold now, the rest when it is done.`;
  next.messages.push({
    id: `m-${next.messages.length}`,
    who: npc?.name ?? "Them",
    role: "npc",
    text: `${ask} now. The rest when the work is done.`,
  });
  return next;
}

function fundsOf(state: GameState, npcId: string): { gold: number; bread: number; store: boolean } {
  const npc = state.npcs.find((item) => item.id === npcId);
  const store = state.stores.find((item) => item.controllerNpcId === npcId);
  if (store) return { gold: store.gold + (npc?.gold ?? 0), bread: store.bread + (npc?.bread ?? 0), store: true };
  return { gold: npc?.gold ?? 0, bread: npc?.bread ?? 0, store: false };
}

function payFromNpc(state: GameState, npcId: string, gold: number, bread: number): { gold: number; bread: number } {
  const store = state.stores.find((item) => item.controllerNpcId === npcId);
  const npc = state.npcs.find((item) => item.id === npcId);
  let goldLeft = gold;
  let breadLeft = bread;
  let goldPaid = 0;
  let breadPaid = 0;
  if (store) {
    goldPaid += takeGold(store, goldLeft);
    goldLeft -= goldPaid;
    breadPaid += takeBread(store, breadLeft);
    breadLeft -= breadPaid;
  }
  if (npc && goldLeft > 0) {
    const paid = takeGold(npc, goldLeft);
    goldPaid += paid;
  }
  if (npc && breadLeft > 0) {
    const paid = takeBread(npc, breadLeft);
    breadPaid += paid;
  }
  return { gold: goldPaid, bread: breadPaid };
}

export function acceptVolunteer(state: GameState, volunteerId: string): GameState {
  const next = structuredClone(state);
  const volunteer = next.volunteers.find((item) => item.id === volunteerId);
  if (!volunteer) return state;
  const group = groupAt(next, volunteer.groupId);
  if (!group) return state;
  const available = next.people.filter((person) => person.alive && person.groupId === group.id && !person.inForceId);
  const count = Math.min(volunteer.count, available.length, CONFIG.unitCap);
  if (count <= 0) {
    next.volunteers = next.volunteers.filter((item) => item.id !== volunteerId);
    return next;
  }
  let unit = findHomeUnit(next, volunteer);
  if (!unit) {
    next.volunteers = next.volunteers.filter((item) => item.id !== volunteerId);
    return next;
  }
  if (volunteer.special) {
    const key = volunteer.special.name.toLowerCase().replace(/\s+/g, "-");
    if (!next.wiki.some((entry) => entry.key === key)) {
      next.wiki.push({
        key,
        strengths: volunteer.special.strengths,
        weaknesses: volunteer.special.weaknesses,
        counters: "",
        definedBy: "ai",
        wage: volunteer.special.wage,
      });
    }
    unit.type = key;
    unit.wageBreadPerDay = volunteer.special.wage;
  }
  const stats = recruitStats(group);
  const old = unit.headcount;
  const taken = available.slice(0, Math.min(count, CONFIG.unitCap - unit.headcount));
  if (!unit.name) {
    unit.name = volunteer.special?.name ?? `${group.name.split(" ")[0]} ${labelType(unit.type)}`;
    unit.nameMeaning = `Raised from ${group.name}.`;
    unit.morale = stats.morale;
    unit.condition = stats.condition;
    unit.stance = "holding";
    unit.headcount = 0;
  }
  unit.headcount += taken.length;
  unit.morale = Math.round((unit.morale * old + stats.morale * taken.length) / Math.max(1, unit.headcount));
  unit.condition = Math.round((unit.condition * old + stats.condition * taken.length) / Math.max(1, unit.headcount));
  unit.permanence = volunteer.permanence;
  unit.leaveCondition = volunteer.conditionText;
  unit.leaveRule = volunteer.leaveRule;
  if (!unit.sourceGroupIds.includes(group.id)) unit.sourceGroupIds.push(group.id);
  for (const person of taken) {
    person.inForceId = next.company.forceId;
    unit.memberIds.push(person.id);
  }
  if (stats.trait && !unit.traits.includes(stats.trait)) unit.traits.push(stats.trait);
  if (stats.readiness < 0) unit.stance = shiftStance(unit.stance, 1);
  unit.historyText = `${unit.historyText} ${taken.length} joined from ${group.name}.`.trim();
  next.volunteers = next.volunteers.filter((item) => item.id !== volunteerId);
  pushEvent(next, {
    week: next.week,
    type: "recruit-accept",
    locationId: group.locationId,
    significant: true,
    payload: { count: taken.length, special: volunteer.special ? 1 : 0 },
  });
  refreshAchievements(next);
  return next;
}

export function declineVolunteer(state: GameState, volunteerId: string): GameState {
  const next = structuredClone(state);
  next.volunteers = next.volunteers.filter((item) => item.id !== volunteerId);
  return next;
}

function findHomeUnit(state: GameState, volunteer: Volunteer): Unit | undefined {
  if (volunteer.special) return state.company.units.find((unit) => unit.headcount === 0);
  const typed = state.company.units.find((unit) => unit.type === volunteer.unitType && unit.headcount > 0 && unit.headcount < CONFIG.unitCap && unit.permanence === volunteer.permanence);
  if (typed) return typed;
  return state.company.units.find((unit) => unit.headcount === 0);
}

function recruitStats(group: { id: string; kind: string }) {
  if (group.id === "cm-guards") return RECRUIT_STATS["crown-guards"];
  if (group.kind === "guards") return RECRUIT_STATS["village-guards"];
  if (group.kind === "nobles") return RECRUIT_STATS.nobles;
  return RECRUIT_STATS.peasants;
}

function labelType(type: string): string {
  return type ? type[0].toUpperCase() + type.slice(1) : "Company";
}

export function netWorth(state: GameState): number {
  const breadGold = state.company.bread / CONFIG.crownmarketRate;
  const goods = state.company.goods.reduce((sum, good) => sum + good.qty * good.valueGold, 0);
  const debts = state.ledger
    .filter((entry) => entry.direction === "player_owes" && entry.status !== "paid" && entry.status !== "forgiven")
    .reduce((sum, entry) => sum + (entry.currency === "gold" ? entry.amount : entry.amount / CONFIG.crownmarketRate), 0);
  return Math.round(state.company.gold + breadGold + goods - debts);
}

export function resolveWeek(state: GameState, options?: { stopOnLoss?: boolean }): GameState {
  if (state.ended && options?.stopOnLoss !== false) return state;
  const next = structuredClone(state);
  const markers: WeeklyReport["markers"] = [];
  const causes: WeeklyReport["causes"] = [];
  const goldBefore = next.company.gold;
  const breadBefore = next.company.bread;
  const before = new Map(next.dispositions.filter((item) => item.towardId === "company").map((item) => [item.holderId, item.level]));
  const unitBefore = next.company.units.map((unit) => ({ id: unit.id, name: unit.name, headcount: unit.headcount, morale: unit.morale, condition: unit.condition }));

  firePlot(next, markers);
  ongoingHarm(next, markers);
  decideFactions(next, markers);
  resolveArrivals(next, markers);
  if (next.pendingAction) resolvePlayerAction(next, causes, markers);
  passiveRecruit(next);
  eat(next);
  payWages(next);
  releaseTemps(next);
  idleDrift(next);
  settleDebts(next);
  localDisposition(next);
  if (companyHeadcount(next) <= 0) next.lost = true;
  completeQuests(next);
  refreshAchievements(next);

  const story = storyLines(next, markers);
  next.report = {
    week: next.week,
    gold: next.company.gold,
    bread: next.company.bread,
    goldDelta: next.company.gold - goldBefore,
    breadDelta: next.company.bread - breadBefore,
    causes,
    unitDeltas: next.company.units.map((unit, index) => ({
      unitId: unit.id,
      name: unit.name || unitBefore[index]?.name || "Empty",
      headcount: unit.headcount - (unitBefore[index]?.headcount ?? 0),
      morale: unit.morale - (unitBefore[index]?.morale ?? 0),
      condition: unit.condition - (unitBefore[index]?.condition ?? 0),
    })).filter((delta) => delta.name !== "Empty" || delta.headcount !== 0),
    markers,
    volunteers: next.volunteers.map((volunteer) => ({ ...volunteer })),
    shifts: next.dispositions
      .filter((item) => item.towardId === "company" && before.get(item.holderId) && before.get(item.holderId) !== item.level)
      .map((item) => ({ holderId: item.holderId, from: before.get(item.holderId) ?? "neutral", to: item.level })),
    story,
    stores: next.stores.map((store) => ({
      locationId: store.locationId,
      name: next.locations.find((location) => location.id === store.locationId)?.name ?? store.id,
      bread: store.bread,
      cap: store.breadCap,
    })),
  };
  next.showReport = true;
  next.pendingAction = null;
  next.moveUsed = false;
  next.actionUsed = false;
  next.innLeft = 0;
  for (const unit of next.company.units) unit.worked = false;
  next.week += 1;
  if (next.company.hidden && (next.company.ambushReady || next.week > (next.forces.find((force) => force.id === next.company.forceId)?.hiddenUntilWeek ?? -1))) {
    /* hidden wears off after the following week's searches, handled below */
  }
  const hiddenUntil = next.events.filter((event) => event.type === "hide").at(-1)?.week;
  if (next.company.hidden && hiddenUntil !== undefined && next.week > hiddenUntil + 1) {
    next.company.hidden = false;
    next.company.ambushReady = false;
  }
  if (next.week > next.maxWeeks || (next.lost && options?.stopOnLoss !== false)) {
    next.ended = true;
    next.phase = "chronicle";
    refreshAchievements(next);
  }
  return next;
}

function firePlot(state: GameState, markers: WeeklyReport["markers"]) {
  for (const event of state.worldEvents) {
    if (event.fired || event.week !== state.week) continue;
    event.fired = true;
    pushEvent(state, { week: state.week, type: "plot", locationId: undefined, significant: true, payload: { id: event.id } });
    if (event.id === "wolves") {
      state.forces.push({
        id: "force-wolves",
        name: "The ferry wolves",
        factionId: null,
        kind: "beast",
        locationId: "drowned",
        hexId: "df-2",
        personIds: [],
        stance: "aggressive",
        morale: 70,
        condition: 80,
        hidden: true,
        ordersText: "Take sheep.",
        alive: true,
        supplyBread: 0,
        strength: 8,
      });
      const quest = state.quests.find((item) => item.id === "quest-wolves");
      if (quest) quest.status = "offered";
      markers.push({ locationId: "salt-ferry", kind: "quest", label: "Wolves on the ferry road" });
      const record = state.events.some((item) => item.type === "battle" || item.type === "quest-done" || item.type === "deal");
      if (record) flag(state, "doss", "Wolves are on the sheep. Clear the ferry road.");
    }
    if (event.id === "thornback") {
      const hex = state.hexes.find((item) => item.id === "tw-4");
      if (hex && !hex.contents.includes("thornback")) hex.contents.push("thornback");
      state.forces.push({
        id: "force-thornback",
        name: "The Thornback",
        factionId: null,
        kind: "beast",
        locationId: "thornwood",
        hexId: "tw-4",
        personIds: [],
        stance: "aggressive",
        morale: 80,
        condition: 90,
        hidden: true,
        ordersText: "The brambles move when it breathes.",
        alive: true,
        supplyBread: 0,
        strength: 6,
      });
      const quest = state.quests.find((item) => item.id === "quest-thornback");
      if (quest) quest.status = "offered";
      state.company.rumours.push({
        id: `rumour-thorn-${state.week}`,
        text: "A woodcutter saw a bark-grey boar by the old charcoal camp, brambles caught in its hide. They are calling it the Thornback.",
        week: state.week,
        tags: ["thornback", "thornwood"],
      });
      flag(state, "marta", "Something in the charcoal camp is killing people.");
      markers.push({ locationId: "thornwood", kind: "quest", label: "The Thornback" });
    }
    if (event.id === "lantern-rebellion") {
      raiseMilitia(state);
      setDisposition(state, "lantern", "crown", -80, "Mother Ysolde has turned the temple against the Steward.", "The rebellion");
      setDisposition(state, "ysolde", "crown", -80, "She will spend the donation chest to bring him down.", "The rebellion");
      const crush = state.quests.find((item) => item.id === "quest-crush");
      if (crush) crush.status = "offered";
      flag(state, "aldous", "Put the Lantern militia down. Civic gold will pay.");
      if (!isHostile(state, "lantern")) flag(state, "ysolde", "Bring down the Steward. The chest is open.");
      markers.push({ locationId: "lantern", kind: "smoke", label: "The Lantern rebellion" });
    }
  }
  if (state.week === 6) {
    state.company.rumours.push({
      id: "rumour-pilgrims",
      text: "Pilgrims are arming. The sermons in the Lantern House name the Steward, not the dark.",
      week: state.week,
      tags: ["rebellion", "lantern"],
    });
  }
}

function raiseMilitia(state: GameState) {
  if (state.forces.some((force) => force.id === "force-militia")) return;
  const peasants = state.people.filter((person) => person.alive && person.groupId === "cm-peasants" && !person.inForceId).slice(0, 25);
  for (const person of peasants) person.inForceId = "force-militia";
  state.forces.push({
    id: "force-militia",
    name: "The faith militia",
    factionId: "lantern",
    kind: "militia",
    locationId: "lantern",
    personIds: peasants.map((person) => person.id),
    stance: "holding",
    morale: 70,
    condition: 60,
    hidden: false,
    ordersText: "Hold the Lantern House.",
    alive: peasants.length > 0,
    supplyBread: 0,
    strength: peasants.length,
  });
}

function ongoingHarm(state: GameState, markers: WeeklyReport["markers"]) {
  const wolves = state.forces.find((force) => force.id === "force-wolves");
  if (wolves?.alive && state.week >= 3) {
    let left = CONFIG.wolfBread;
    const store = storeFor(state, "salt-ferry");
    if (store) left -= takeBread(store, left);
    const peasants = state.people.filter((person) => person.alive && person.groupId === "sf-peasants");
    for (const person of peasants) {
      if (left <= 0) break;
      left -= takeBread(person, left);
    }
    state.audit.breadDestroyed += CONFIG.wolfBread - left;
    markers.push({ locationId: "salt-ferry", kind: "smoke", label: "Wolves took sheep" });
    pushEvent(state, { week: state.week, type: "wolves-feed", locationId: "salt-ferry", significant: false, payload: { bread: CONFIG.wolfBread - left } });
  }
  const beast = state.forces.find((force) => force.id === "force-thornback");
  if (beast?.alive && state.week >= 10) {
    const drawn = rollInt(state.rng, CONFIG.thornbackKillsMin, CONFIG.thornbackKillsMax);
    state.rng = drawn.next;
    const killed = killInGroup(state, "tw-peasants", drawn.roll, true);
    state.civilianKills += killed;
    if (killed > 0) markers.push({ locationId: "thornwick", kind: "death", label: "The Thornback killed in the woods" });
  }
  if (state.week >= 11 && state.worldEvents.find((event) => event.id === "lantern-rebellion")?.fired) {
    const rebellion = state.worldEvents.find((event) => event.id === "lantern-rebellion");
    const militia = state.forces.find((force) => force.id === "force-militia");
    if (rebellion && !rebellion.resolvedBy && militia?.alive) {
      const guards = groupStack(state, "cm-guards", "a");
      const band = forceStack(state, "force-militia", "b");
      if (guards && band) {
        const fought = fightStacks({
          id: `battle-rebellion-${state.week}`,
          week: state.week,
          locationId: "crownmarket",
          terrain: "street",
          a: [{ ...guards, side: "a" }],
          b: [{ ...band, side: "b" }],
          surprise: "none",
          rng: state.rng,
          narrative: "The city guard met the faith militia in the streets. No company stood between them.",
        });
        state.rng = fought.rng;
        applyHarm(state, fought.result);
        rebellion.resolvedBy = fought.result.winner === "a" ? "crown" : "temple";
        markers.push({ locationId: "crownmarket", kind: "battle", label: "The Crown fought the militia" });
      }
    }
  }
}

function decideFactions(state: GameState, markers: WeeklyReport["markers"]) {
  const pack = state.forces.find((force) => force.id === "force-pack");
  const living = state.people.filter((person) => person.alive && person.groupId === "pack").length;
  const pool = groupAt(state, "pack");
  const weeks = living > 0 && pool ? pool.poolBread / (living * CONFIG.rationPerWeek) : 99;
  if (pack?.alive && weeks < CONFIG.banditWeeksOfBread) {
    if (state.locationId === "thornwick" && !state.company.hidden) {
      raidBattle(state, markers);
    } else if (state.locationId === "thornwick" && state.company.hidden) {
      const found = searcherFinds(state, 45);
      if (found) raidBattle(state, markers);
      else {
        state.company.ambushReady = true;
        pushEvent(state, { week: state.week, type: "hidden-success", locationId: "thornwick", significant: true, payload: {} });
      }
    } else {
      raidVillage(state, markers);
    }
  }
  const crown = disposition(state, "crown");
  let column = state.forces.find((force) => force.id === "force-pursuit" && force.alive);
  if (crown?.level === "hostile") {
    if (!column) column = raisePursuit(state) ?? undefined;
    if (column) marchPursuit(state, column, markers);
  } else if (column) {
    recall(state, column);
  }
}

function raidBattle(state: GameState, markers: WeeklyReport["markers"]) {
  const enemy = forceStack(state, "force-pack", "b");
  const ours = companyStacks(state);
  if (!enemy || ours.length === 0) return;
  const guards = groupStack(state, "tw-guards", "a");
  const fought = fightStacks({
    id: `battle-raid-${state.week}`,
    week: state.week,
    locationId: "thornwick",
    terrain: "field",
    a: guards ? [...ours, { ...guards, side: "a" }] : ours,
    b: [enemy],
    surprise: "none",
    rng: state.rng,
  });
  state.rng = fought.rng;
  applyHarm(state, fought.result);
  if (fought.result.winner === "a") plunderPack(state, fought.result);
  state.battles.push(fought.result);
  markers.push({ locationId: "thornwick", kind: "battle", label: "The Pack came into the village" });
  pushEvent(state, { week: state.week, type: "battle", locationId: "thornwick", significant: true, payload: { winner: fought.result.winner === "a" ? 1 : 0 } });
}

function raidVillage(state: GameState, markers: WeeklyReport["markers"]) {
  const guards = groupStack(state, "tw-guards", "a");
  const band = forceStack(state, "force-pack", "b");
  if (!band) return;
  const fought = fightStacks({
    id: `battle-simraid-${state.week}`,
    week: state.week,
    locationId: "thornwick",
    terrain: "field",
    a: guards ? [guards] : [{ id: "villagers", name: "Villagers", type: "peasants", headcount: 4, morale: 30, condition: 40, stance: "unready", traits: ["untrained"], side: "a" }],
    b: [band],
    surprise: "none",
    rng: state.rng,
    narrative: "The Pack struck Thornwick while the company was elsewhere.",
  });
  state.rng = fought.rng;
  applyHarm(state, fought.result);
  const store = storeFor(state, "thornwick");
  const pool = groupAt(state, "pack");
  if (fought.result.winner !== "a" && store && pool) {
    const bread = Math.round(store.bread * CONFIG.raidBreadShare);
    const gold = Math.round(store.gold * CONFIG.raidBreadShare);
    pool.poolBread += takeBread(store, bread);
    pool.poolGold += takeGold(store, gold);
    fought.result.breadTaken = bread;
    fought.result.goldTaken = gold;
  }
  const deadGuards = fought.result.units.find((unit) => unit.id === "tw-guards")?.killed ?? 0;
  if (deadGuards === 0 && fought.result.winner !== "a") {
    fought.result.civiliansKilled = killInGroup(state, "tw-peasants", 1, true);
    state.civilianKills += fought.result.civiliansKilled;
  }
  state.battles.push(fought.result);
  markers.push({ locationId: "thornwick", kind: "smoke", label: "The Pack raided Thornwick" });
  pushEvent(state, { week: state.week, type: "raid", locationId: "thornwick", significant: true, payload: { bread: fought.result.breadTaken, gold: fought.result.goldTaken } });
  bump(state, "marta", -8, "The company was away when the Pack came.");
  bump(state, "tw-peasants", -8, "No one stood in the square.");
}

function raisePursuit(state: GameState) {
  const guards = state.people.filter((person) => person.alive && person.groupId === "cm-guards" && !person.inForceId).slice(0, CONFIG.pursuitGuardMax);
  const levy = state.people.filter((person) => person.alive && person.groupId === "cm-peasants" && !person.inForceId).slice(0, Math.min(10, CONFIG.pursuitLevyMax));
  const men = [...guards, ...levy];
  if (men.length === 0) return null;
  for (const person of men) person.inForceId = "force-pursuit";
  const force = {
    id: "force-pursuit",
    name: "A column",
    factionId: "crown",
    kind: "pursuit" as const,
    locationId: "crownmarket",
    personIds: men.map((person) => person.id),
    stance: "holding" as const,
    morale: 60,
    condition: 75,
    hidden: true,
    ordersText: "Find the company.",
    alive: true,
    supplyBread: 0,
    strength: men.length,
  };
  state.forces.push(force);
  const store = storeFor(state, "crownmarket");
  if (store) {
    const food = men.length * CONFIG.rationPerWeek;
    force.supplyBread = takeBread(store, food);
  }
  pushEvent(state, { week: state.week, type: "pursuit-sent", locationId: "crownmarket", significant: true, payload: { size: men.length } });
  return force;
}

function marchPursuit(state: GameState, force: GameState["forces"][number], markers: WeeklyReport["markers"]) {
  if (!force) return;
  const path = shortest(state, force.locationId, state.locationId);
  if (path[1]) force.locationId = path[1];
  const groups = state.groups.filter((group) => group.locationId === force.locationId);
  for (const group of groups) {
    state.sightings.push({
      week: state.week,
      locationId: force.locationId,
      forceId: force.id,
      seenByGroupId: group.id,
      label: "A column of soldiers passed",
    });
  }
  if (groups.length > 0) {
    markers.push({ locationId: force.locationId, kind: "column", label: "A column was seen" });
    state.seenPursuit = true;
  }
  if (force.locationId === state.locationId) {
    if (state.company.hidden || state.company.sheltered) {
      const chance = state.company.sheltered ? 25 : state.company.betrayed ? 70 : 48;
      if (searcherFinds(state, chance)) {
        force.hidden = false;
        force.name = "Crown pursuers";
        fightForce(state, force.id, "none", markers);
      } else {
        state.company.ambushReady = true;
        pushEvent(state, { week: state.week, type: "hidden-success", locationId: state.locationId, significant: true, payload: {} });
      }
    } else {
      force.hidden = false;
      force.name = "Crown pursuers";
      fightForce(state, force.id, "none", markers);
    }
  }
}

function recall(state: GameState, force: { id: string; personIds: string[]; alive: boolean }) {
  for (const person of state.people) {
    if (person.inForceId === force.id) person.inForceId = undefined;
  }
  force.alive = false;
  pushEvent(state, { week: state.week, type: "pursuit-recalled", significant: true, payload: {} });
}

function resolveArrivals(state: GameState, markers: WeeklyReport["markers"]) {
  for (const force of state.forces) {
    if (!force.alive || force.kind === "company" || force.kind === "camp") continue;
    if (force.locationId === state.locationId && force.kind === "beast" && !force.hidden && state.pendingAction?.kind !== "fight") {
      fightForce(state, force.id, "none", markers);
    }
  }
}

function resolvePlayerAction(state: GameState, causes: WeeklyReport["causes"], markers: WeeklyReport["markers"]) {
  const action = state.pendingAction;
  if (!action) return;
  if (action.kind === "recruit") offerRecruit(state, action.groupId, action.speech, false);
  if (action.kind === "train") train(state, action.unitIds, action.drill, action.master, causes);
  if (action.kind === "rest") rest(state, action.source, action.force, causes, markers);
  if (action.kind === "repair") repair(state, causes);
  if (action.kind === "work") work(state, action.job, causes);
  if (action.kind === "search") search(state, action.hexId, action.lookingFor, markers);
  if (action.kind === "hide") {
    state.company.hidden = true;
    pushEvent(state, { week: state.week, type: "hide", locationId: state.locationId, significant: false, payload: {} });
  }
  if (action.kind === "fight") fightForce(state, action.forceId, "none", markers);
  if (action.kind === "ambush") fightForce(state, action.forceId, "ambush", markers);
  if (action.kind === "pillage") pillage(state, action.locationId, markers, causes);
  if (action.kind === "refuge") refuge(state, action.offer);
  if (action.kind === "drink") {
    for (const rumour of action.rumours) state.company.rumours.push(rumour);
    if (action.rumours.length >= 3) pushEvent(state, { week: state.week, type: "rumours", significant: false, payload: { count: action.rumours.length } });
    causes.push({ label: "Ale", gold: -CONFIG.drinkGold, bread: 0 });
  }
}

function offerRecruit(state: GameState, groupId: string, speech: string, passive: boolean) {
  const group = groupAt(state, groupId);
  if (!group || !group.recruitable || isHostile(state, group.id)) return;
  const available = livingMembers(state, group.id);
  if (available <= 0) return;
  const score = scoreOf(state, group.id);
  const wage = averageWage(state);
  let count = 0;
  if (speech.length > 40 || passive) count = score >= 20 && wage >= 2 ? Math.min(2, available) : score >= 0 && wage >= 2 ? 1 : 0;
  if (/wood|thorn|bandit|hunt/i.test(speech) && group.id === "tw-peasants") count = Math.max(count, Math.min(2, available));
  if (count <= 0) return;
  const hunters = /wood|hunt|track/i.test(speech) && group.kind === "peasants";
  const volunteer: Volunteer = hunters
    ? {
        id: `vol-${state.week}-${group.id}-track`,
        groupId: group.id,
        count: Math.min(3, available),
        skills: "They know the local ground.",
        unitType: "trackers",
        permanence: "temporary",
        conditionText: "until the bandit chief is dead",
        leaveRule: { type: "until_dead", forceId: "force-pack" },
        wage: 2,
        special: { name: "Trackers", strengths: "Raise the odds of a search", weaknesses: "Poor in a pitched line", wage: 2 },
      }
    : {
        id: `vol-${state.week}-${group.id}-${passive ? "p" : "a"}`,
        groupId: group.id,
        count,
        skills: group.kind === "guards" ? "Spear drill" : "Raw hands",
        unitType: group.kind === "nobles" ? "cavalry" : group.kind === "guards" ? "spearmen" : "spearmen",
        permanence: "permanent",
        wage,
      };
  if (!state.volunteers.some((item) => item.id === volunteer.id)) state.volunteers.push(volunteer);
}

function averageWage(state: GameState): number {
  const units = state.company.units.filter((unit) => unit.headcount > 0);
  if (units.length === 0) return CONFIG.defaultWage;
  return units.reduce((sum, unit) => sum + unit.wageBreadPerDay, 0) / units.length;
}

function train(state: GameState, unitIds: string[], drill: string, master: boolean, causes: WeeklyReport["causes"]) {
  const cost = CONFIG.trainBread * unitIds.length + (master ? 0 : 0);
  const paid = Math.min(state.company.bread, cost);
  state.company.bread -= paid;
  state.audit.breadEaten += paid;
  causes.push({ label: "Training", gold: 0, bread: -paid });
  if (master) {
    const gold = Math.min(state.company.gold, CONFIG.masterGold);
    state.company.gold -= gold;
    const oskar = state.npcs.find((npc) => npc.id === "oskar");
    if (oskar) oskar.gold += gold;
    causes.push({ label: "Master-at-Arms", gold: -gold, bread: 0 });
  }
  for (const id of unitIds) {
    const unit = state.company.units.find((item) => item.id === id);
    if (!unit || unit.headcount <= 0) continue;
    unit.worked = true;
    unit.condition = clamp(unit.condition + CONFIG.trainCondition + (master ? CONFIG.masterCondition : 0));
    unit.morale = clamp(unit.morale + CONFIG.trainMorale);
    unit.traits = unit.traits.filter((trait) => trait !== "untrained");
    const line = drill.trim().slice(0, 80) || "Close-order drill";
    if (!unit.traits.includes(line)) unit.traits.push(line);
    unit.trainingText = line;
    if (unit.stance === "unready") unit.stance = "skirmish";
  }
}

function rest(state: GameState, source: "own" | "requisition", force: boolean, causes: WeeklyReport["causes"], markers: WeeklyReport["markers"]) {
  const local = localGroup(state);
  if (source === "requisition" && local) {
    const score = scoreOf(state, local.id);
    if (score > 0 && !isHostile(state, local.id)) {
      const store = storeFor(state, state.locationId);
      const moved = store ? takeBread(store, 40) : 0;
      state.company.bread += moved;
      causes.push({ label: "Requisition", gold: 0, bread: moved });
      bump(state, local.id, -15, "The company demanded bread.");
      const elder = elderId(state);
      if (elder) bump(state, elder, -10, "They took from the store.");
    } else if (force) {
      const guards = guardsAt(state);
      if (guards) fightForce(state, guards, "none", markers);
      pushEvent(state, { week: state.week, type: "seizure", locationId: state.locationId, significant: true, payload: {} });
    } else {
      for (const unit of state.company.units) {
        if (unit.headcount <= 0) continue;
        unit.morale = clamp(unit.morale - CONFIG.hungerMorale);
      }
    }
  }
  const recent = state.events.filter((event) => event.type === "rest" && event.locationId === state.locationId).length;
  for (const unit of state.company.units) {
    if (unit.headcount <= 0) continue;
    unit.worked = true;
    unit.morale = clamp(unit.morale + CONFIG.restMorale);
    unit.condition = clamp(unit.condition + CONFIG.restCondition);
    unit.wounded = Math.max(0, unit.wounded - CONFIG.restHeal);
    unit.stance = shiftStance(unit.stance, 1);
  }
  pushEvent(state, { week: state.week, type: "rest", locationId: state.locationId, significant: false, payload: {} });
  if (recent >= CONFIG.freeloadAfter && local) bump(state, local.id, CONFIG.freeloadScore, "They have slept in the barns week after week.");
}

function repair(state: GameState, causes: WeeklyReport["causes"]) {
  const gold = Math.min(state.company.gold, CONFIG.repairGold);
  state.company.gold -= gold;
  const merchant = state.npcs.find((npc) => npc.locationId === state.locationId && /merchant|Fenn|Juna|Benet|Oskar|Varrow/i.test(npc.name + npc.role));
  if (merchant) merchant.gold += gold;
  causes.push({ label: "Repairs", gold: -gold, bread: 0 });
  for (const unit of state.company.units) {
    if (unit.headcount <= 0) continue;
    unit.worked = true;
    unit.condition = clamp(unit.condition + CONFIG.repairCondition);
  }
}

function work(state: GameState, job: "fields" | "merchant" | "guard-village" | "guard-city", causes: WeeklyReport["causes"]) {
  const men = companyHeadcount(state);
  if (job === "fields") {
    let owing = men * CONFIG.workFieldBread;
    const store = storeFor(state, state.locationId);
    let pay = store ? takeBread(store, owing) : 0;
    owing -= pay;
    if (owing > 0) {
      const peasants = state.people.filter((person) => person.alive && person.groupId === localGroup(state)?.id);
      for (const person of peasants) {
        if (owing <= 0) break;
        const moved = takeBread(person, owing);
        pay += moved;
        owing -= moved;
      }
    }
    state.company.bread += pay;
    causes.push({ label: "Field work", gold: 0, bread: pay });
    const local = localGroup(state);
    if (local) bump(state, local.id, 8, "The company worked the fields.");
    const elder = elderId(state);
    if (elder) bump(state, elder, 6, "They earned their bread in the fields.");
    for (const unit of state.company.units) {
      if (unit.headcount <= 0) continue;
      unit.worked = true;
      unit.morale = clamp(unit.morale + 4);
      unit.condition = clamp(unit.condition + 4);
      unit.wounded = Math.max(0, unit.wounded - 1);
    }
  }
  if (job === "merchant") {
    const merchant = state.npcs.find((npc) => npc.locationId === state.locationId && npc.placeId.endsWith("merchant") || npc.id === "benet" || npc.id === "fenn" || npc.id === "juna");
    const payer = state.npcs.find((npc) => npc.locationId === state.locationId && (npc.id === "fenn" || npc.id === "juna" || npc.id === "benet"));
    const pay = payer ? takeGold(payer, men * CONFIG.workMerchantGold) : 0;
    state.company.gold += pay;
    causes.push({ label: "Merchant's guard", gold: pay, bread: 0 });
    if (payer) bump(state, payer.id, 8, "You watched the stall.");
    markWorked(state);
  }
  if (job === "guard-village") {
    const store = storeFor(state, state.locationId);
    const pay = store ? takeGold(store, Math.floor(men * CONFIG.workVillageGoldHalf / 2)) : 0;
    state.company.gold += pay;
    causes.push({ label: "Village guard", gold: pay, bread: 0 });
    markWorked(state);
  }
  if (job === "guard-city") {
    const store = storeFor(state, "crownmarket");
    const pay = store ? takeGold(store, men * CONFIG.workCityGold) : 0;
    state.company.gold += pay;
    causes.push({ label: "Wall duty", gold: pay, bread: 0 });
    markWorked(state);
  }
  if (!state.jobs.includes(job)) state.jobs.push(job);
  pushEvent(state, { week: state.week, type: "work", locationId: state.locationId, significant: false, payload: { job } });
}

function markWorked(state: GameState) {
  for (const unit of state.company.units) {
    if (unit.headcount > 0) unit.worked = true;
  }
}

function search(state: GameState, hexId: string, lookingFor: string, markers: WeeklyReport["markers"]) {
  const hex = state.hexes.find((item) => item.id === hexId);
  if (!hex) return;
  hex.searchedCount += 1;
  const odds = findOdds(state, hex, lookingFor);
  const drawn = rollD100(state.rng);
  state.rng = drawn.next;
  const wanted = wantedContent(lookingFor);
  const hit = Boolean(wanted && hex.contents.includes(wanted) && drawn.roll <= odds);
  if (hit && wanted) {
    hex.found = Array.from(new Set([...hex.found, wanted]));
    if (wanted === "bandit_camp") {
      const camp = state.forces.find((force) => force.id === "force-pack");
      if (camp) camp.hidden = false;
      pushEvent(state, { week: state.week, type: "found-camp", locationId: "thornwood", significant: true, payload: {} });
      markers.push({ locationId: "thornwood", kind: "quest", label: "The camp is found" });
    }
    if (wanted === "thornback") {
      const beast = state.forces.find((force) => force.id === "force-thornback");
      if (beast) beast.hidden = false;
    }
  } else {
    const table = hex.wildernessId === "thornwood"
      ? ["herbs", "trail", "courier", "camp-sign"]
      : ["herbs", "wolf_sign", "pelts", "crate"];
    const find = table[drawn.roll % table.length];
    hex.found = Array.from(new Set([...hex.found, find]));
    if (find === "herbs") addGood(state, "Herbs", 1, 6);
    if (find === "pelts") addGood(state, "Pelts", 1, 8);
    if (find === "courier") {
      state.company.rumours.push({ id: `rumour-letter-${state.week}`, text: "A dead courier's letter: the Steward is content to let the villages beg.", week: state.week, tags: ["crown", "secret"] });
    }
  }
  if (hex.contents.includes("thornback") && !prepared(state)) {
    const unit = state.company.units.find((item) => item.headcount > 0);
    if (unit) applyUnitHarm(unit, { killed: 1, wounded: 0, moraleDelta: -6, conditionDelta: -8 }, state);
    markers.push({ locationId: "thornwood", kind: "death", label: "The Thornback took a soldier" });
  }
  pushEvent(state, { week: state.week, type: "search", locationId: hex.wildernessId, significant: hit, payload: { hit: hit ? 1 : 0 } });
}

export function findOdds(state: GameState, hex: { id: string; neighbours: string[]; searchedCount: number; contents: string[] }, lookingFor: string): number {
  const wanted = wantedContent(lookingFor);
  let odds = wanted && hex.contents.includes(wanted) ? CONFIG.campFindOdds : 18;
  const trackers = state.company.units.some((unit) => unit.headcount > 0 && (unit.type === "trackers" || unit.traits.some((trait) => /track|wood/i.test(trait))));
  if (trackers) odds += 15;
  if (state.company.rumours.some((rumour) => rumour.tags.some((tag) => lookingFor.toLowerCase().includes(tag) || tag.includes(lookingFor.toLowerCase().split(" ")[0] ?? "")))) odds += 12;
  const neighboursSearched = hex.neighbours.filter((id) => (state.hexes.find((item) => item.id === id)?.searchedCount ?? 0) > 0).length;
  odds += neighboursSearched * 4;
  odds -= Math.max(0, hex.searchedCount - 1) * 6;
  return Math.max(CONFIG.findClamp[0], Math.min(CONFIG.findClamp[1], odds));
}

function wantedContent(lookingFor: string): string | null {
  const text = lookingFor.toLowerCase();
  if (text.includes("bandit") || text.includes("camp")) return "bandit_camp";
  if (text.includes("wolf")) return "wolf_sign";
  if (text.includes("thorn") || text.includes("boar") || text.includes("beast")) return "thornback";
  if (text.includes("herb")) return "herbs";
  return null;
}

function prepared(state: GameState): boolean {
  return state.company.units.some((unit) => unit.headcount > 0 && unit.condition >= 70 && unit.stance !== "unready");
}

function plunderPack(state: GameState, result: { breadTaken: number; goldTaken: number }) {
  const pool = groupAt(state, "pack");
  const force = state.forces.find((item) => item.id === "force-pack");
  if (!pool || !force) return;
  const share = force.alive ? CONFIG.raidScrap : 1;
  const bread = Math.round(pool.poolBread * share);
  const gold = Math.round(pool.poolGold * share);
  pool.poolBread -= bread;
  pool.poolGold -= gold;
  state.company.bread += bread;
  state.company.gold += gold;
  result.breadTaken += bread;
  result.goldTaken += gold;
}

function addGood(state: GameState, name: string, qty: number, valueGold: number) {
  const existing = state.company.goods.find((good) => good.name === name);
  if (existing) existing.qty += qty;
  else state.company.goods.push({ id: name.toLowerCase().replace(/\s+/g, "-"), name, qty, valueGold });
}

function fightForce(state: GameState, forceId: string, surprise: "none" | "ambush", markers: WeeklyReport["markers"]) {
  const enemy = forceStack(state, forceId, "b") ?? groupStack(state, forceId, "b");
  const ours = companyStacks(state);
  if (!enemy || ours.length === 0) return;
  if (state.stagedBattle && (state.pendingAction?.kind === "fight" || state.pendingAction?.kind === "ambush")) {
    const staged = state.stagedBattle;
    state.stagedBattle = null;
    applyHarm(state, staged);
    state.battles.push(staged);
    for (const unit of state.company.units) if (unit.headcount > 0) unit.worked = true;
    markers.push({ locationId: state.locationId, kind: "battle", label: staged.highlights[0] ?? "Battle" });
    pushEvent(state, { week: state.week, type: "battle", locationId: state.locationId, significant: true, payload: { winner: staged.winner === "a" ? 1 : 0 } });
    if (!state.forces.find((force) => force.id === "force-pack")?.alive) plunderPack(state, staged);
    return;
  }
  const planned = state.pendingAction?.kind === "fight" || state.pendingAction?.kind === "ambush";
  const fought = fightStacks({
    id: `battle-${forceId}-${state.week}`,
    week: state.week,
    locationId: state.locationId,
    terrain: terrainOf(state, state.locationId),
    a: ours.map((stack) => (planned ? { ...stack, morale: clamp(stack.morale + 10) } : stack)),
    b: [{ ...enemy, side: "b" }],
    surprise,
    rng: state.rng,
  });
  state.rng = fought.rng;
  if (planned) {
    const harm = fought.result.units.find((unit) => unit.id === forceId);
    if (harm) harm.killed = Math.min(enemy.headcount, harm.killed + Math.ceil(enemy.headcount * 0.5));
  }
  applyHarm(state, fought.result);
  if (surprise === "ambush" && fought.result.winner === "a") {
    pushEvent(state, { week: state.week, type: "ambush-win", significant: true, payload: {} });
  }
  const force = state.forces.find((item) => item.id === forceId);
  if (fought.result.winner === "a" && forceId === "force-pack") plunderPack(state, fought.result);
  if (force && !force.alive && force.kind === "beast") {
    if (force.id === "force-wolves") addGood(state, "Wolf pelts", 4, 8);
    if (force.id === "force-thornback") {
      addGood(state, "Thornback hide", 1, 80);
      addGood(state, "Thornback tusks", 1, 40);
    }
  }
  state.battles.push(fought.result);
  for (const unit of state.company.units) if (unit.headcount > 0) unit.worked = true;
  markers.push({ locationId: state.locationId, kind: "battle", label: `Fight: ${enemy.name}` });
  pushEvent(state, { week: state.week, type: "battle", locationId: state.locationId, significant: true, payload: { winner: fought.result.winner === "a" ? 1 : 0, ambush: surprise === "ambush" ? 1 : 0 } });
  state.company.ambushReady = false;
}

function pillage(state: GameState, locationId: string, markers: WeeklyReport["markers"], causes: WeeklyReport["causes"]) {
  const guards = state.groups.find((group) => group.locationId === locationId && group.kind === "guards");
  const guardCount = guards ? livingMembers(state, guards.id) : 0;
  if (locationId === "crownmarket" && guardCount > 0) {
    fightForce(state, "cm-guards", "none", markers);
    return;
  }
  if (guardCount > 0 && locationId !== "lantern") {
    fightForce(state, guards?.id ?? "", "none", markers);
    return;
  }
  const store = storeFor(state, locationId);
  let bread = 0;
  let gold = 0;
  if (store) {
    bread = takeBread(store, Math.round(store.bread * CONFIG.pillageShare));
    gold = takeGold(store, Math.round(store.gold * CONFIG.pillageShare));
  }
  const peasants = state.groups.find((group) => group.locationId === locationId && group.kind === "peasants");
  if (peasants) {
    const killed = killInGroup(state, peasants.id, CONFIG.peasantKillOnPillage, true);
    state.civilianKills += killed;
  }
  state.company.bread += bread;
  state.company.gold += gold;
  state.pillaged = true;
  causes.push({ label: "Pillage", gold, bread });
  setDisposition(state, "crown", "company", -80, "The Crown names you brigands.", "Pillage");
  setDisposition(state, "aldous", "company", -70, "The Steward has ordered you taken.", "Pillage");
  if (locationId === "lantern") {
    for (const faction of ["crown", "pack", "lantern"]) setDisposition(state, faction, "company", -90, "Every faction has turned on the company.", "The temple was sacked");
  }
  markers.push({ locationId, kind: "smoke", label: "Pillaged" });
  pushEvent(state, { week: state.week, type: "pillage", locationId, significant: true, payload: { gold, bread, crown: locationId === "crownmarket" ? 1 : 0 } });
}

function refuge(state: GameState, offer: string) {
  const elder = elderId(state);
  const group = localGroup(state);
  const score = Math.max(elder ? scoreOf(state, elder) : 0, group ? scoreOf(state, group.id) : 0);
  const granted = score >= 10 || /gold|bread|protect|fight/i.test(offer);
  if (granted && !isHostile(state, elder ?? group?.id ?? "")) {
    state.company.hidden = true;
    state.company.sheltered = true;
    pushEvent(state, { week: state.week, type: "refuge", locationId: state.locationId, significant: true, payload: {} });
  } else {
    state.company.betrayed = score < -10;
    pushEvent(state, { week: state.week, type: "refuge-refused", locationId: state.locationId, significant: true, payload: {} });
  }
}

function passiveRecruit(state: GameState) {
  const location = state.locations.find((item) => item.id === state.locationId);
  if (!location || location.kind === "wilderness") return;
  const thin = state.company.units.some((unit) => unit.headcount > 0 && unit.headcount < CONFIG.unitCap);
  if (!thin) return;
  for (const group of state.groups) {
    if (group.locationId !== state.locationId || !group.recruitable || isHostile(state, group.id)) continue;
    offerRecruit(state, group.id, "The company is hiring at the posted wage.", true);
  }
}

function eat(state: GameState) {
  for (const person of state.people) {
    if (!person.alive || person.inForceId === state.company.forceId) continue;
    const group = groupAt(state, person.groupId);
    if (!group) continue;
    if (group.id === "pack") continue;
    let need = CONFIG.rationPerWeek;
    const fromPerson = takeBread(person, need);
    need -= fromPerson;
    state.audit.breadEaten += fromPerson;
    if (need > 0) {
      const store = storeFor(state, group.locationId);
      if (store) {
        const fromStore = takeBread(store, need);
        state.audit.breadEaten += fromStore;
        need -= fromStore;
      }
    }
    if (need > 0) group.morale = clamp(group.morale - 4);
  }
  const pack = groupAt(state, "pack");
  const bandits = state.people.filter((person) => person.alive && person.groupId === "pack").length;
  if (pack && bandits > 0) {
    const holder = { bread: pack.poolBread };
    const eaten = takeBread(holder, bandits * CONFIG.rationPerWeek);
    pack.poolBread = holder.bread;
    state.audit.breadEaten += eaten;
    if (eaten < bandits * CONFIG.rationPerWeek) pack.morale = clamp(pack.morale - 6);
  }
  let bill = 0;
  for (const unit of state.company.units) {
    if (unit.headcount <= 0) continue;
    const promised = unit.wageBreadPerDay * CONFIG.rationPerWeek * unit.headcount;
    const floor = CONFIG.rationPerWeek * unit.headcount;
    bill += Math.max(promised, floor);
  }
  const paid = Math.min(state.company.bread, bill);
  state.company.bread -= paid;
  state.audit.breadEaten += paid;
  if (paid < bill) {
    state.wagesShort = true;
    for (const unit of state.company.units) {
      if (unit.headcount <= 0) continue;
      unit.morale = clamp(unit.morale - CONFIG.shortPayMorale - CONFIG.hungerMorale);
    }
  } else {
    for (const unit of state.company.units) {
      if (unit.headcount > 0) unit.morale = clamp(unit.morale + CONFIG.fullPayMorale);
    }
  }
  for (const force of state.forces) {
    if (!force.alive || force.kind === "company" || force.kind === "beast" || force.kind === "camp") continue;
    const size = state.people.filter((person) => person.alive && person.inForceId === force.id).length;
    const eaten = Math.min(force.supplyBread, size * CONFIG.rationPerWeek);
    force.supplyBread -= eaten;
    state.audit.breadEaten += eaten;
  }
}

function payWages(state: GameState) {
  for (const group of state.groups) {
    if (group.kind !== "guards" || !group.paidByStoreId) continue;
    const store = state.stores.find((item) => item.id === group.paidByStoreId);
    if (!store) continue;
    const men = state.people.filter((person) => person.alive && person.groupId === group.id && !person.inForceId);
    const owed = men.length * group.wageGoldPerWeek;
    const paid = takeGold(store, owed);
    let left = paid;
    for (const person of men) {
      const share = Math.min(group.wageGoldPerWeek, left);
      person.gold += share;
      left -= share;
    }
    const unpaid = paid < owed;
    if (unpaid) group.morale = clamp(group.morale - 10);
    if (group.morale < CONFIG.desertionMorale && men.length > 0) {
      const deserter = men[0];
      deserter.groupId = group.locationId === "crownmarket" ? "cm-peasants" : group.locationId === "salt-ferry" ? "sf-peasants" : "tw-peasants";
    }
  }
  for (const unit of state.company.units) {
    if (unit.headcount <= 0 || unit.morale >= CONFIG.desertionMorale) continue;
    const losses = Math.floor((CONFIG.desertionMorale - unit.morale) / 10);
    for (let index = 0; index < losses && unit.headcount > 0; index += 1) {
      unit.headcount -= 1;
      const memberId = unit.memberIds.pop();
      if (!memberId) continue;
      const person = state.people.find((item) => item.id === memberId);
      if (!person) continue;
      person.inForceId = undefined;
    }
  }
}

function releaseTemps(state: GameState) {
  for (const unit of state.company.units) {
    if (unit.headcount <= 0 || unit.permanence !== "temporary" || !unit.leaveRule) continue;
    const rule = unit.leaveRule;
    const due =
      (rule.type === "until_dead" && state.forces.find((force) => force.id === rule.forceId && !force.alive)) ||
      (rule.type === "until_week" && state.week >= rule.week) ||
      (rule.type === "until_store" && (state.stores.find((store) => store.id === rule.storeId)?.bread ?? 0) >= rule.bread);
    if (!due) continue;
    for (const memberId of unit.memberIds) {
      const person = state.people.find((item) => item.id === memberId);
      if (person && person.alive) person.inForceId = undefined;
    }
    unit.memberIds = [];
    unit.headcount = 0;
    unit.name = "";
    unit.type = "";
    unit.permanence = "permanent";
    unit.leaveRule = undefined;
    pushEvent(state, { week: state.week, type: "temp-leave", significant: false, payload: {} });
  }
}

function idleDrift(state: GameState) {
  const fought = state.events.some((event) => event.week === state.week && event.type === "battle");
  for (const unit of state.company.units) {
    if (unit.headcount <= 0 || unit.worked || fought) continue;
    unit.condition = clamp(unit.condition - CONFIG.idleCondition);
    unit.stance = shiftStance(unit.stance, 1);
  }
}

function settleDebts(state: GameState) {
  for (const entry of state.ledger) {
    if (entry.status !== "open") continue;
    if (entry.dueWeek < state.week) {
      entry.status = "overdue";
      bump(state, entry.npcId, -12, "A payment was missed.");
    }
  }
}

function localDisposition(state: GameState) {
  if (state.locationId === "thornwick" && state.events.some((event) => event.week === state.week && event.type === "battle" && event.payload.winner === 1)) {
    bump(state, "marta", 8, "The company stood when the Pack came.");
    bump(state, "tw-peasants", 6, "They fought in the square.");
  }
}

function completeQuests(state: GameState) {
  const packDead = state.forces.find((force) => force.id === "force-pack")?.alive === false;
  const wolvesDead = state.forces.find((force) => force.id === "force-wolves")?.alive === false;
  const beastDead = state.forces.find((force) => force.id === "force-thornback")?.alive === false;
  const militiaDead = state.forces.find((force) => force.id === "force-militia")?.alive === false;
  finish(state, "quest-camp", packDead);
  finish(state, "quest-wolves", wolvesDead);
  finish(state, "quest-thornback", beastDead);
  finish(state, "quest-crush", militiaDead);
  if (state.company.goods.some((good) => /oil/i.test(good.name))) finish(state, "quest-oil", true);
}

function finish(state: GameState, questId: string, done: boolean) {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || !done || quest.status === "done" || quest.status === "locked") return;
  if (quest.status !== "active") return;
  const owed = state.ledger.find((entry) => entry.npcId === quest.giverId && entry.direction === "npc_owes" && entry.status === "open");
  const gold = owed?.amount ?? Math.max(0, quest.rewardGold - (quest.upfrontPaid ? quest.upfrontGold : 0));
  const paid = payFromNpc(state, quest.giverId, gold, quest.rewardBread);
  state.company.gold += paid.gold;
  state.company.bread += paid.bread;
  if (owed) owed.status = "paid";
  quest.status = "done";
  const event = state.worldEvents.find((item) => item.id === quest.eventId);
  if (event) event.resolvedBy = "company";
  bump(state, quest.giverId, 20, "The work was finished.");
  pushEvent(state, { week: state.week, type: "quest-done", significant: true, payload: { quest: questId } });
}

function applyHarm(state: GameState, result: { units: { id: string; killed: number; wounded: number; moraleDelta: number; conditionDelta: number }[] }) {
  for (const harm of result.units) {
    const unit = state.company.units.find((item) => item.id === harm.id);
    if (unit) {
      applyUnitHarm(unit, harm, state);
      continue;
    }
    const group = groupAt(state, harm.id);
    if (group) {
      if (group.id === "pack" || state.people.some((person) => person.inForceId && person.groupId === group.id)) {
        killForcePeople(state, group.id === "pack" ? "force-pack" : harm.id, harm.killed);
      } else {
        killInGroup(state, group.id, harm.killed, true);
      }
      group.morale = clamp(group.morale + harm.moraleDelta);
      group.condition = clamp(group.condition + harm.conditionDelta);
      continue;
    }
    killForcePeople(state, harm.id, harm.killed);
    const force = state.forces.find((item) => item.id === harm.id);
    if (force) {
      force.morale = clamp(force.morale + harm.moraleDelta);
      force.condition = clamp(force.condition + harm.conditionDelta);
    }
  }
}

function searcherFinds(state: GameState, chance: number): boolean {
  const drawn = rollD100(state.rng);
  state.rng = drawn.next;
  return drawn.roll <= chance;
}

function shortest(state: GameState, from: string, to: string): string[] {
  if (from === to) return [from];
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift() ?? [];
    const tip = path[path.length - 1];
    const nexts = state.locations.find((location) => location.id === tip)?.links ?? [];
    for (const link of nexts) {
      if (seen.has(link)) continue;
      const grown = [...path, link];
      if (link === to) return grown;
      seen.add(link);
      queue.push(grown);
    }
  }
  return [from];
}

export function setDisposition(state: GameState, holderId: string, towardId: string, score: number, description: string, reason: string) {
  const bounded = Math.max(-100, Math.min(100, Math.round(score)));
  const level = levelFor(bounded);
  let record = state.dispositions.find((item) => item.holderId === holderId && item.towardId === towardId);
  if (!record) {
    record = { holderId, towardId, level, description, score: bounded };
    state.dispositions.push(record);
  } else {
    record.score = bounded;
    record.level = level;
    record.description = description;
  }
  pushEvent(state, { week: state.week, type: "disposition", significant: true, payload: { holder: holderId, level, reason } });
}

function bump(state: GameState, holderId: string, delta: number, reason: string) {
  const current = disposition(state, holderId);
  const score = (current?.score ?? 0) + delta;
  const text = current?.description ? `${current.description} ${reason}` : reason;
  setDisposition(state, holderId, "company", score, text.slice(-240), reason);
}

export function refreshFlags(state: GameState) {
  const here = state.locationId;
  const parties = [
    ...state.npcs.filter((npc) => npc.locationId === here).map((npc) => npc.id),
    ...state.groups.filter((group) => group.locationId === here).map((group) => group.id),
  ];
  if (here === "thornwick" && state.week === 0) flag(state, "marta", "The bandit problem stands.");
  if (state.worldEvents.find((event) => event.id === "wolves")?.fired && !state.forces.find((force) => force.id === "force-wolves" && !force.alive)) {
    if (state.events.some((event) => event.type === "battle" || event.type === "deal" || event.type === "quest-done")) flag(state, "doss", "Clear the wolves off the ferry road.");
  }
  for (const id of parties) {
    if (isHostile(state, id)) {
      const existing = state.talkFlags.find((flagItem) => flagItem.npcOrGroupId === id);
      if (existing && !/bandit|wolf|militia|crush/i.test(existing.reason)) existing.wantsToTalk = false;
    }
  }
}

function flag(state: GameState, id: string, reason: string) {
  const existing = state.talkFlags.find((item) => item.npcOrGroupId === id);
  if (existing) {
    existing.wantsToTalk = true;
    existing.reason = reason;
    existing.checkedWeek = state.week;
    return;
  }
  state.talkFlags.push({ npcOrGroupId: id, wantsToTalk: true, reason, checkedWeek: state.week });
}

export function refreshAchievements(state: GameState) {
  const earn = (id: string) => {
    const seal = state.achievements.find((item) => item.id === id);
    if (seal && seal.earnedWeek === undefined) seal.earnedWeek = state.week;
  };
  if (state.events.some((event) => event.type === "recruit-accept")) earn("first-muster");
  if (state.events.some((event) => event.type === "battle" && event.payload.winner === 1)) earn("blooded");
  if (state.company.units.some((unit) => unit.headcount === CONFIG.unitCap && state.events.some((event) => event.type === "recruit-accept"))) earn("full-ranks");
  if (state.company.units.filter((unit) => unit.headcount > 0).length >= 10) earn("ten-banners");
  if (state.company.units.some((unit) => state.wiki.some((entry) => entry.key === unit.type && entry.definedBy === "ai"))) earn("odd-company");
  if (state.events.some((event) => event.type === "rumours" && Number(event.payload.count) >= 3)) earn("loose-tongues");
  if (state.forces.find((force) => force.id === "force-wolves")?.alive === false) earn("wolf-warden");
  if (state.events.some((event) => event.type === "found-camp")) earn("found-them");
  if (state.forces.find((force) => force.id === "force-pack")?.alive === false) earn("thornwood-cleared");
  if (state.forces.find((force) => force.id === "force-thornback")?.alive === false) earn("thornback");
  if (state.negotiatedEnd) earn("silver-tongue");
  if (state.events.some((event) => event.type === "hidden-success")) earn("ghost");
  if (state.events.some((event) => event.type === "ambush-win")) earn("shadows");
  if (state.events.some((event) => event.type === "refuge")) earn("sanctuary");
  if (state.pillaged) earn("brigands");
  if (state.events.some((event) => event.type === "pardon")) earn("pardoned");
  if (state.quests.find((quest) => quest.id === "quest-crush")?.status === "done") earn("loyal-blade");
  if (state.events.some((event) => event.type === "kingbreak")) earn("kingbreaker");
  if (state.events.some((event) => event.type === "pillage" && event.payload.crown === 1)) earn("sack");
  if (state.ended && state.week > state.maxWeeks && !state.pillaged && state.civilianKills === 0) earn("clean-hands");
  if (state.ended && !state.wagesShort) earn("never-short");
  if (state.ended && netWorth(state) >= CONFIG.breadwinner) earn("breadwinner");
  if (state.ended && state.week > state.maxWeeks && companyHeadcount(state) <= 5 && companyHeadcount(state) > 0) earn("last-stand");
  if (["fields", "merchant"].every((job) => state.jobs.includes(job)) && state.jobs.some((job) => job.startsWith("guard"))) earn("honest-work");
}

function storyLines(state: GameState, markers: WeeklyReport["markers"]): string[] {
  const lines = markers.map((marker) => marker.label);
  if (lines.length === 0) lines.push("A quiet week. The kingdom ate, and the company with it.");
  return lines.slice(0, 5);
}

function localGroup(state: GameState) {
  return state.groups.find((group) => group.locationId === state.locationId && group.kind === "peasants");
}

function elderId(state: GameState): string | null {
  if (state.locationId === "thornwick") return "marta";
  if (state.locationId === "salt-ferry") return "doss";
  if (state.locationId === "crownmarket") return "aldous";
  if (state.locationId === "lantern") return "ysolde";
  return null;
}

function guardsAt(state: GameState): string | null {
  return state.groups.find((group) => group.locationId === state.locationId && group.kind === "guards")?.id ?? null;
}

export function auditOk(state: GameState): { bread: boolean; gold: boolean; people: boolean; breadGap: number; goldGap: number } {
  const breadGap = breadNow(state) + state.audit.breadEaten + state.audit.breadDestroyed - state.audit.initialBread;
  const goldGap = goldNow(state) - state.audit.initialGold;
  return {
    bread: breadGap === 0,
    gold: goldGap === 0,
    people: peopleNow(state) === state.audit.initialPeople,
    breadGap,
    goldGap,
  };
}

export function publicRecord(state: GameState): string {
  const fights = state.events.filter((event) => event.type === "battle").length;
  const quests = state.quests.filter((quest) => quest.status === "done").map((quest) => quest.title);
  return `${state.company.name}, week ${state.week}. ${companyHeadcount(state)} soldiers, ${state.company.gold} gold, ${state.company.bread} bread. Fights: ${fights}. Done: ${quests.join(", ") || "nothing yet"}. ${state.pillaged ? "They have pillaged." : ""}`;
}

export function placeActions(state: GameState, placeId: string): { id: string; label: string; spends: boolean }[] {
  const place = state.places.find((item) => item.id === placeId);
  if (!place) return [];
  const location = state.locations.find((item) => item.id === place.locationId);
  const actions: { id: string; label: string; spends: boolean }[] = [];
  const push = (id: string, label: string, spends = true) => {
    if (actions.filter((action) => action.spends).length >= 4 && spends) return;
    actions.push({ id, label, spends });
  };
  if (location?.kind === "wilderness") {
    push("search", "Search a hex");
    push("hide", "Hide");
    push("rest", "Rest");
    const camp = state.forces.find((force) => force.id === "force-pack");
    if (place.locationId === "thornwood" && camp && !camp.hidden) push("fight-pack", "Fight the Pack");
    const wolves = state.forces.find((force) => force.id === "force-wolves");
    if (place.locationId === "drowned" && wolves?.alive && !wolves.hidden) push("fight-wolves", "Fight the wolves");
    const beast = state.forces.find((force) => force.id === "force-thornback");
    if (beast?.alive && !beast.hidden) push("fight-thornback", "Fight the Thornback");
    if (state.company.ambushReady) push("ambush", "Ambush");
    return actions;
  }
  if (/square|guard|parliament|walls/i.test(place.name)) push("recruit", "Recruit");
  if (/square/i.test(place.name) && location?.kind === "village") push("fields", "Work the fields");
  if (/merchant|market/i.test(place.name)) push("merchant-guard", "Merchant's guard");
  if (/guard/i.test(place.name) && location?.kind === "village") push("guard-village", "Guard duty");
  if (/walls/i.test(place.name)) push("guard-city", "Guard the walls");
  push("train", "Train");
  push("rest", "Rest");
  if (/barracks|merchant|market/i.test(place.name)) push("repair", "Repair gear");
  if (/loaf|inn|tankard/i.test(place.name)) push("drink", "Drink");
  if (/square|elder|reeve|hall|sanctuary/i.test(place.name)) push("refuge", "Seek refuge");
  const guards = guardsAt(state);
  const guardCount = guards ? livingMembers(state, guards) : 0;
  if (location?.kind === "village" && guardCount === 0) push("pillage", "Pillage");
  if (location?.id === "lantern") push("pillage", "Pillage the temple");
  if (location?.id === "crownmarket") push("attack-crown", "Attack the city");
  if (location?.id === "crownmarket" && guardCount === 0) push("pillage-crown", "Pillage Crownmarket");
  return actions.slice(0, 6);
}

export function chronicleOf(state: GameState): { score: number; moments: string[]; verdicts: { name: string; line: string }[]; timeline: string[] } {
  const moments = state.events.filter((event) => event.significant).slice(-3).map((event) => `${event.type} in week ${event.week}`);
  const verdicts = state.npcs.map((npc) => ({
    name: npc.name,
    line: disposition(state, npc.id)?.description ?? "They have nothing to say of you.",
  }));
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const week = index + 1;
    const event = state.events.find((item) => item.week === week && item.significant);
    return event?.type ?? "quiet";
  });
  return { score: netWorth(state), moments, verdicts, timeline };
}

export function applyCreation(draft: { name: string; origin: string; primary: string; secondary: string; sigil: string; captainName: string; captainBackground: string; unitA: string; unitB: string }, seed = 1): GameState {
  const state = createGame({
    seed,
    tutorial: true,
    unitTypes: [draft.unitA || "spearmen", draft.unitB || "swordsmen"],
    company: {
      name: draft.name || "The Free Company",
      origin: draft.origin || "Raised in a hard spring.",
      banner: { primary: draft.primary, secondary: draft.secondary, sigil: draft.sigil },
      captainName: draft.captainName || "The Captain",
      captainBackground: draft.captainBackground,
    },
  });
  state.phase = "play";
  const names: string[] = UNIT_TYPES.map((item) => item.key);
  const first = state.company.units[0];
  if (first && !names.includes(first.type)) first.type = "spearmen";
  return state;
}

export function offerHale(state: GameState, upfront: number): GameState {
  const next = structuredClone(state);
  const quest = next.quests.find((item) => item.id === "quest-camp");
  if (!quest) return state;
  const deal: Deal = {
    id: `deal-hale-${next.deals.length}`,
    npcId: "marta",
    kind: "quest",
    gold: 80,
    bread: 0,
    upfrontGold: Math.max(0, upfront),
    dueWeek: 12,
    note: "Clear the camp in Thornwood.",
    questId: quest.id,
    status: "offered",
  };
  next.deals = next.deals.filter((item) => item.npcId !== "marta" || item.status !== "offered");
  next.deals.push(deal);
  return next;
}

export function screenIntent(text: string, placeId: string): string | null {
  const line = text.toLowerCase();
  if (/recruit|join us|enlist|volunteer/.test(line)) return "recruit";
  if (/bread|food|grain|feed/.test(line)) return "rest";
  if (/train|drill/.test(line)) return "train";
  if (/hide|lay low/.test(line)) return "hide";
  if (/pillage|burn|sack/.test(line)) return "pillage";
  if (/refuge|shelter|hide us/.test(line)) return "refuge";
  if (/search|track|woods|fen/.test(line)) return "search";
  if (placeId && /fight|attack/.test(line)) return "fight";
  return null;
}

export function quartermasterReply(state: GameState, text: string): { text: string; action?: PendingAction } {
  const line = text.toLowerCase();
  if (line.includes("bandit")) {
    return { text: "The Pack sits in one hex of Thornwood, two weeks from the capital if you go by Thornwick. Search the wood. Trackers help. Marta Hale is paying." };
  }
  if (line.includes("wage") || line.includes("bread") || line.includes("pay")) {
    return { text: `Twenty soldiers at 2 bread a day eat ${20 * 2 * 7} loaves a week. You are holding ${state.company.bread}. Work will not cover it. Quests and plunder will.` };
  }
  if (line.includes("hide")) {
    return { text: "Hide spends the action, and only in the wild. Refuge is the same idea inside a village, if they still like you.", action: state.locationId === "thornwood" || state.locationId === "drowned" ? { kind: "hide" } : undefined };
  }
  return { text: "One move, one action, talk as much as you like. I keep the numbers. The faces on the rail are who will speak to you." };
}

export function localReply(state: GameState, who: string, text: string): { text: string; deal?: Deal; chip?: string | null } {
  const npc = state.npcs.find((item) => item.id === who);
  const group = state.groups.find((item) => item.id === who);
  const name = npc?.name ?? group?.name ?? "Someone";
  if (npc && isHostile(state, npc.id) && npc.id !== "corwin") {
    return { text: `${name.split(" ")[0]} will not speak with you.` };
  }
  if (who === "marta") {
    return {
      text: "Clear the camp in Thornwood. I can find 80 gold, 30 of it now, if your price is in that neighbourhood.",
      deal: {
        id: `deal-marta-${state.messages.length}`,
        npcId: "marta",
        kind: "quest",
        gold: 80,
        bread: 0,
        upfrontGold: 30,
        dueWeek: 12,
        note: "Clear the camp in Thornwood.",
        questId: "quest-camp",
        status: "offered",
      },
      chip: screenIntent(text, "tw-reeve"),
    };
  }
  if (who === "fenn") return { text: "Bread is 1 gold to 3 and a half loaves. I sell to anyone with coin, bandits included.", chip: screenIntent(text, "tw-merchant") };
  if (who === "doss") return { text: "Wolves on the ferry road. Forty gold when the pelts are in your packs and the sheep stop dying.", chip: screenIntent(text, "sf-elder") };
  if (who === "ysolde") return { text: "The flame wants oil. And if the week has turned, the Steward wants removing. The chest can pay a company that will do it.", chip: screenIntent(text, "lantern-sanctuary") };
  if (who === "aldous") return { text: state.week >= 10 ? "Crush the militia. Civic gold pays more than a village reeve ever will." : "The realm has larger worries than a new company. Come back when your name means something.", chip: null };
  if (who === "corwin") return { text: "I wore that city's coat once. A pardon, and I take the Pack apart myself. Fight me and I will.", chip: null };
  if (group) return { text: `${name} listen. ${isHostile(state, group.id) ? "They want you gone." : "They are tired, and some of them are listening."}`, chip: screenIntent(text, group.placeId) };
  return { text: `${name} has little to add.`, chip: screenIntent(text, "") };
}

export function rumourFromInn(state: GameState, text: string): Rumour | null {
  const line = text.toLowerCase();
  if (line.length < 8) return null;
  const options = [
    { text: "The bandit camp is deeper than the woodcutter's ride, toward the old charcoal ground.", tags: ["bandit", "thornwood"] },
    { text: "Thornwick's store is thinner than the reeve admits.", tags: ["thornwick"] },
    { text: "The Steward does not mind the villages staying frightened.", tags: ["secret", "crown"] },
    { text: "The Pack is eating through its bread. They will raid again soon.", tags: ["bandit"] },
    { text: "Soldiers have been asking after a company by name.", tags: ["pursuit"] },
  ];
  const pick = options[state.week % options.length];
  if (state.company.rumours.some((rumour) => rumour.text === pick.text)) return null;
  return { id: `inn-${state.week}-${state.company.rumours.length}`, week: state.week, ...pick };
}

export function tutorialFight(state: GameState): GameState {
  const next = structuredClone(state);
  next.forces.push({
    id: "force-stragglers",
    name: "Two stragglers",
    factionId: "pack",
    kind: "raid",
    locationId: "thornwick",
    personIds: [],
    stance: "unready",
    morale: 40,
    condition: 50,
    hidden: false,
    ordersText: "Loot the barn.",
    alive: true,
    supplyBread: 0,
    strength: 2,
  });
  const fought = fightStacks({
    id: "battle-barn",
    week: next.week,
    locationId: "thornwick",
    terrain: "field",
    a: companyStacks(next).slice(0, 1),
    b: [{ id: "force-stragglers", name: "Two stragglers", type: "swordsmen", headcount: 2, morale: 40, condition: 50, stance: "unready", traits: [], side: "b" }],
    surprise: "none",
    rng: next.rng,
    narrative: "Two men were still in the barn, stuffing sacks. Your first unit went in and it was over quickly.",
  });
  next.rng = fought.rng;
  const harm = fought.result.units.find((unit) => unit.id === "force-stragglers");
  const force = next.forces.find((item) => item.id === "force-stragglers");
  if (force && harm) {
    force.strength = Math.max(0, force.strength - harm.killed);
    if (force.strength <= 0) force.alive = false;
  }
  const ours = fought.result.units.find((unit) => unit.id !== "force-stragglers");
  const unit = next.company.units.find((item) => item.id === ours?.id);
  if (unit && ours) applyUnitHarm(unit, ours, next);
  next.battles.push(fought.result);
  pushEvent(next, { week: next.week, type: "battle", locationId: "thornwick", significant: true, payload: { winner: 1 } });
  refreshAchievements(next);
  return next;
}

export function brokerPeace(state: GameState): GameState {
  const next = structuredClone(state);
  const crown = scoreOf(next, "aldous");
  const temple = scoreOf(next, "ysolde");
  if (crown < 10 || temple < 10) return state;
  setDisposition(next, "lantern", "crown", 10, "A seat was offered and the oil was promised. The militia stood down.", "Peace");
  setDisposition(next, "crown", "lantern", 10, "The Steward took the terms.", "Peace");
  const militia = next.forces.find((force) => force.id === "force-militia");
  if (militia) {
    for (const person of next.people) if (person.inForceId === militia.id) person.inForceId = undefined;
    militia.alive = false;
  }
  const rebellion = next.worldEvents.find((event) => event.id === "lantern-rebellion");
  if (rebellion) rebellion.resolvedBy = "peace";
  next.negotiatedEnd = true;
  pushEvent(next, { week: next.week, type: "peace", significant: true, payload: {} });
  refreshAchievements(next);
  return next;
}

export function sideWithTemple(state: GameState): GameState {
  const next = structuredClone(state);
  const quest = next.quests.find((item) => item.id === "quest-crush");
  if (quest && quest.status !== "done") quest.status = "failed";
  const chest = storeFor(next, "lantern");
  const gold = chest ? takeGold(chest, 200) : 0;
  next.company.gold += gold;
  pushEvent(next, { week: next.week, type: "temple-contract", significant: true, payload: { gold } });
  return next;
}

export function breakCrown(state: GameState): GameState {
  const next = structuredClone(state);
  if (livingMembers(next, "cm-guards") > 0) return state;
  const steward = next.npcs.find((npc) => npc.id === "aldous");
  if (steward) steward.notesText = "Removed.";
  pushEvent(next, { week: next.week, type: "kingbreak", locationId: "crownmarket", significant: true, payload: {} });
  setDisposition(next, "ysolde", "company", 60, "You brought the Steward down.", "The city fell");
  const granary = storeFor(next, "crownmarket");
  if (granary) {
    const bread = takeBread(granary, 400);
    next.company.bread += bread;
  }
  const rebellion = next.worldEvents.find((event) => event.id === "lantern-rebellion");
  if (rebellion) rebellion.resolvedBy = "temple";
  refreshAchievements(next);
  return next;
}
