import {
  BANNER_COLOURS,
  groupCount,
  NAMED,
  PLACES,
  type Colour,
  type Company,
  type Face,
  type GroupId,
  type NpcId,
  type PlaceId,
  type Sigil,
  type Trade,
  type Unit,
  type World,
} from "../data/hollowmere";
import { storeOf } from "./books";
import { cloneWorld, headcount, living, makeUnit } from "./sim";
import {
  CITY_DUTY_GOLD,
  CROWN_BREAD_PER_GOLD,
  FIELD_BREAD,
  INN_RUMOURS,
  JOIN,
  MERCHANT_GOLD,
  PILLAGE_PEASANTS,
  PURSUIT_LEVY,
  REST_CONDITION,
  REST_MORALE,
  SEARCH_FOOD_FLOOR,
  START_MEN,
  UNIT_MAX,
  UNIT_SLOTS,
  VILLAGE_DUTY_PER,
} from "../data/tuning";

export const SAVE_KEY = "hollowmere-v1";

export function reviveSave(raw: unknown): World | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { version?: number; world?: World };
  if (parsed.version !== 2 || !parsed.world?.people || parsed.world.people.length !== 273) return null;
  return parsed.world;
}

export type PlayResult = { ok: true; world: World } | { ok: false; error: string };

function fail(error: string): PlayResult {
  return { ok: false, error };
}

export function publicView(world: World) {
  const company = world.company;
  const place = company ? PLACES[company.location] : PLACES.thornwick;
  return {
    week: Math.min(world.week, 12),
    weekMax: 12,
    gold: company?.gold ?? 0,
    bread: company?.bread ?? 0,
    location: company?.location ?? "thornwick",
    placeName: place.name,
    units: (company?.units ?? []).map((unit) => ({
      id: unit.id,
      name: unit.name,
      headcount: unit.headcount,
      trade: unit.trade,
      morale: unit.morale,
      condition: unit.condition,
      stance: unit.stance,
      temporary: unit.permanence === "temporary",
    })),
    faces: world.dispositions.map((item) => ({ holder: item.holder, toward: item.toward, level: item.level })),
    deals: world.deals
      .filter((deal) => deal.status === "offered" || deal.status === "countering")
      .map((deal) => ({ id: deal.id, from: deal.from, amount: deal.amount, currency: deal.currency, dueWeek: deal.dueWeek })),
    flags: world.flags.filter((flag) => flag.wants).map((flag) => flag.who),
    quartermaster: world.quartermaster,
    suggestion: world.suggestion,
    tutorialStep: world.tutorialDone ? -1 : world.tutorialStep,
    lost: world.lost,
    ended: world.ended,
    seals: visibleSeals(world),
    campSeen: world.campSeen,
    hidden: (company?.hiddenUntilWeek ?? 0) >= world.week,
  };
}

export function regardPrompt(company: Company): string {
  const banner = company.banner;
  const colours = banner ? `${banner.colours[0]} and ${banner.colours[1]}` : "no banner";
  const sigil = banner?.sigil ?? "no sigil";
  const trades = company.units.map((unit) => unit.trade).join(" and ") || "no trades";
  return `Company: ${company.name || "Unnamed"}. Banner: ${colours}, sigil ${sigil}. Trades: ${trades}. They are not known yet.`;
}

const LEADER_STORE: Partial<Record<NpcId, World["stores"][number]["id"]>> = {
  hale: "thornwick",
  doss: "ferry",
  aldous: "civic",
  ysolde: "lantern",
};

export function funds(world: World, npcId: NpcId): { gold: number; bread: number } {
  const row = world.people.find((person) => person.npcId === npcId);
  let gold = row?.gold ?? 0;
  let bread = row?.bread ?? 0;
  const storeId = LEADER_STORE[npcId];
  if (storeId) {
    const store = storeOf(world, storeId);
    gold += store.gold;
    bread += store.bread;
  }
  return { gold, bread };
}

function spend(world: World, npcId: NpcId, amount: number, currency: "gold" | "bread"): boolean {
  const have = funds(world, npcId)[currency];
  if (have < amount) return false;
  let left = amount;
  const storeId = LEADER_STORE[npcId];
  if (storeId) {
    const store = storeOf(world, storeId);
    const take = Math.min(left, store[currency]);
    store[currency] -= take;
    left -= take;
  }
  const row = world.people.find((person) => person.npcId === npcId);
  if (row) row[currency] -= left;
  return true;
}

export function offerDeal(world: World, from: NpcId, amount: number, currency: "gold" | "bread", dueWeek: number): PlayResult {
  if (funds(world, from)[currency] < amount) return fail("That is more than they can pay.");
  const next = cloneWorld(world);
  next.deals = next.deals.filter((deal) => deal.from !== from || deal.status === "accepted");
  next.deals.push({ id: `deal-${from}-${dueWeek}`, from, amount, currency, dueWeek, status: "offered" });
  return { ok: true, world: next };
}

export function acceptDeal(world: World, id: string): PlayResult {
  const deal = world.deals.find((item) => item.id === id);
  if (!deal || !world.company) return fail("There is no offer to accept.");
  if (!(deal.from in NAMED)) return fail("That offer is not from a person.");
  const npcId = deal.from as NpcId;
  if (funds(world, npcId)[deal.currency] < deal.amount) return fail("That is more than they can pay.");
  const next = cloneWorld(world);
  if (!spend(next, npcId, deal.amount, deal.currency)) return fail("That is more than they can pay.");
  if (deal.currency === "gold") next.company!.gold += deal.amount;
  else next.company!.bread += deal.amount;
  const found = next.deals.find((item) => item.id === id);
  if (found) found.status = "accepted";
  return { ok: true, world: next };
}

export function counterDeal(world: World, id: string, amount: number): PlayResult {
  const next = cloneWorld(world);
  const deal = next.deals.find((item) => item.id === id);
  if (!deal) return fail("There is no offer to counter.");
  const gold = next.company?.gold ?? 0;
  deal.amount = amount;
  deal.status = "countering";
  if (next.company) next.company.gold = gold;
  return { ok: true, world: next };
}

export function declineDeal(world: World, id: string): PlayResult {
  const next = cloneWorld(world);
  next.deals = next.deals.filter((deal) => deal.id !== id);
  return { ok: true, world: next };
}

export function setChip(world: World, chip: { label: string; action: string } | null): World {
  const next = cloneWorld(world);
  next.intentChip = chip;
  return next;
}

export function acceptChip(world: World): PlayResult {
  if (!world.intentChip || !world.company) return fail("There is nothing to perform.");
  if (world.company.actionUsed) return fail("The week's action is spent.");
  const next = cloneWorld(world);
  next.company!.actionUsed = true;
  next.intentChip = null;
  return { ok: true, world: next };
}

export function dismissChip(world: World): World {
  const next = cloneWorld(world);
  next.intentChip = null;
  return next;
}

export function openingFlags(world: World) {
  const empty = world.decisions.length === 0;
  const flags = [
    { who: "hale", wants: world.company?.location === "thornwick", reason: "The bandit problem stands.", week: world.week },
    ...(["aldous", "varrow", "oskar", "benet", "pell"] as const).map((who) => ({
      who,
      wants: !empty,
      reason: empty ? "No reason to stop." : "The company is spoken of.",
      week: world.week,
    })),
  ];
  return flags;
}

export function decisionsKnownTo(world: World, place: PlaceId) {
  const spans: { from: number; to: number }[] = [];
  const here = world.company?.location === place;
  if (here && world.company) {
    for (const unit of world.company.units) {
      if (unit.headcount > 0 && unit.home === place) spans.push({ from: unit.seenFrom, to: world.decisions.length - 1 });
    }
  }
  for (const item of world.returned) {
    if (item.home === place) spans.push({ from: item.from, to: item.to });
  }
  return world.decisions.filter((_, index) => spans.some((span) => index >= span.from && index <= span.to));
}

export function blend(headA: number, statA: number, headB: number, statB: number): number {
  const heads = headA + headB;
  if (heads <= 0) return 0;
  return (headA * statA + headB * statB) / heads;
}

export function offerRecruits(world: World, groupId: GroupId, asked: number): number {
  return Math.min(asked, groupCount(world.people, groupId));
}

function joinStats(groupId: GroupId): { morale: number; condition: number } {
  if (groupId === "crown-guards") return JOIN["crown-guards"];
  if (groupId === "thorn-guards" || groupId === "ferry-guards") return JOIN["village-guards"];
  if (groupId === "crown-nobles") return JOIN.nobles;
  return JOIN.peasants;
}

function recruitName(company: Company): string {
  const taken = company.units.filter(
    (unit) => unit.name === "The Recruits" || unit.name.startsWith("The Recruits ") || unit.name === "New File",
  ).length;
  return taken === 0 ? "The Recruits" : `The Recruits ${taken + 1}`;
}

export function acceptRecruits(
  world: World,
  groupId: GroupId,
  asked: number,
  trade: Trade,
  permanence: "permanent" | "temporary" = "permanent",
  leaveCondition: string | null = null,
  special?: { name: string; strengths: string; weaknesses: string },
): PlayResult {
  if (!world.company?.founded) return fail("The company is not formed.");
  const count = offerRecruits(world, groupId, asked);
  if (count <= 0) return fail("Nobody is left to take.");
  const next = cloneWorld(world);
  const rows = next.people.filter((person) => person.alive && person.groupId === groupId && (person.forceId === null || person.forceId === person.groupId) && !person.npcId).slice(0, count);
  const stats = joinStats(groupId);
  const company = next.company!;
  let left = rows.length;
  if (!special) {
    for (const unit of company.units) {
      if (left <= 0) break;
      if (unit.trade !== trade || unit.headcount >= UNIT_MAX) continue;
      const room = UNIT_MAX - unit.headcount;
      const take = Math.min(room, left);
      const batch = rows.splice(0, take);
      unit.headcount += take;
      unit.personIds.push(...batch.map((person) => person.id));
      unit.morale = (unit.morale * (unit.headcount - take) + stats.morale * take) / unit.headcount;
      unit.condition = (unit.condition * (unit.headcount - take) + stats.condition * take) / unit.headcount;
      for (const person of batch) person.forceId = "company";
      left -= take;
    }
  }
  while (left > 0) {
    if (company.units.length >= UNIT_SLOTS) break;
    const take = Math.min(UNIT_MAX, left);
    const batch = rows.splice(0, take);
    const key = special ? special.name.toLowerCase().replace(/\s+/g, "-") : null;
    if (special && key && !next.wiki.some((entry) => entry.key === key)) {
      next.wiki.push({ key, strengths: special.strengths, weaknesses: special.weaknesses, definedBy: "ai" });
    }
    company.units.push(
      makeUnit({
        id: `u-${company.units.length + 1}`,
        slot: company.units.length,
        trade: special ? "special" : trade,
        headcount: take,
        name: special?.name ?? recruitName(company),
        morale: stats.morale,
        condition: stats.condition,
        permanence,
        leaveCondition,
        leaveWeek: leaveCondition === "for 3 weeks" ? next.week + 3 : null,
        sourceGroupId: groupId,
        personIds: batch.map((person) => person.id),
        home: PLACES[company.location].kind === "wild" ? null : company.location,
        seenFrom: next.decisions.length,
        wikiKey: key,
        specialName: special?.name ?? null,
      }),
    );
    for (const person of batch) person.forceId = "company";
    left -= take;
  }
  next.events.push({ week: next.week, type: "recruit", significant: true });
  return { ok: true, world: next };
}

export function canvasAllowed(world: World, groupId: GroupId): boolean {
  const company = world.company;
  if (!company?.founded) return false;
  const place = PLACES[company.location];
  if (place.kind === "wild") return false;
  const hostile = world.dispositions.some((item) => item.holder === groupId && item.toward === "company" && item.level === "Hostile");
  if (hostile) return false;
  const groupPlace = world.people.find((person) => person.groupId === groupId)?.placeId;
  if (groupPlace !== company.location) return false;
  return company.units.some((unit) => unit.headcount > 0 && unit.headcount < UNIT_MAX);
}

export function releaseTemporary(world: World): World {
  const next = cloneWorld(world);
  if (!next.company) return next;
  const chiefDead = next.people.find((person) => person.npcId === "corwin")?.alive === false;
  const keep: Unit[] = [];
  for (const unit of next.company.units) {
    const byChief = unit.permanence === "temporary" && !!unit.leaveCondition?.includes("bandit chief") && chiefDead;
    const byWeek = unit.permanence === "temporary" && unit.leaveWeek !== null && next.week >= unit.leaveWeek;
    if (!byChief && !byWeek) {
      keep.push(unit);
      continue;
    }
    for (const id of unit.personIds) {
      const row = next.people.find((person) => person.id === id);
      if (!row || !unit.sourceGroupId || !unit.home) continue;
      row.forceId = null;
      row.groupId = unit.sourceGroupId;
      row.placeId = unit.home;
    }
    if (unit.home) next.returned.push({ home: unit.home, from: unit.seenFrom, to: next.decisions.length - 1 });
  }
  next.company.units = keep;
  return next;
}

export function applyFight(
  world: World,
  input: { killed: number; wounded: number; inHand: number; atLarge: number; group: GroupId },
): { world: World; stood: boolean } {
  const next = cloneWorld(world);
  const foes = next.people.filter(
    (person) => person.alive && person.groupId === input.group && !person.npcId && person.forceId !== "captive",
  );
  for (const person of foes.slice(0, input.killed)) person.alive = false;
  const stood = input.atLarge > 0 && input.inHand === 0;
  if (!stood && input.inHand > 0) {
    const held = foes.filter((person) => person.alive).slice(0, input.inHand);
    for (const person of held) person.forceId = "captive";
  }
  if (next.company && input.wounded > 0) {
    const unit = next.company.units.find((item) => item.headcount > 0);
    if (unit) unit.wounded += input.wounded;
  }
  next.events.push({ week: next.week, type: stood ? "stood" : "fight", significant: true });
  return { world: next, stood };
}

export function pillage(world: World, placeId: PlaceId): PlayResult {
  if (!world.company?.founded) return fail("The company is not formed.");
  const guards: Partial<Record<PlaceId, GroupId>> = {
    thornwick: "thorn-guards",
    "salt-ferry": "ferry-guards",
    crownmarket: "crown-guards",
  };
  const guardGroup = guards[placeId];
  if (guardGroup && groupCount(world.people, guardGroup) > 0) return fail("The guards are still standing.");
  const next = cloneWorld(world);
  const store = next.stores.find((item) => item.placeId === placeId);
  if (store) {
    next.company!.bread += store.bread;
    next.company!.gold += store.gold;
    store.bread = 0;
    store.gold = 0;
  }
  const peasants = next.people.filter((person) => person.alive && person.placeId === placeId && person.groupId.endsWith("peasants") && !person.npcId);
  for (const person of peasants.slice(0, PILLAGE_PEASANTS)) person.alive = false;
  const crown = next.dispositions.find((item) => item.holder === "crown" && item.toward === "company");
  if (crown) {
    crown.level = "Hostile";
    crown.score = -80;
  } else {
    next.dispositions.push({ holder: "crown", toward: "company", level: "Hostile", description: "The Crown names you brigands.", score: -80 });
  }
  next.events.push({ week: next.week, type: "pillage", significant: true });
  next.company!.actionUsed = true;
  return { ok: true, world: next };
}

export function raisePursuit(world: World, faction: "crown" | "pack"): World {
  const next = cloneWorld(world);
  const id = `pursuit-${faction}`;
  const personIds: string[] = [];
  if (faction === "crown") {
    const guards = next.people.filter((person) => person.alive && person.groupId === "crown-guards" && person.forceId === null);
    const peasants = next.people.filter((person) => person.alive && person.groupId === "crown-peasants" && person.forceId === null && !person.npcId).slice(0, PURSUIT_LEVY);
    const civic = storeOf(next, "civic");
    for (const person of [...guards, ...peasants]) {
      if (person.groupId === "crown-peasants") {
        if (civic.gold < 1) continue;
        civic.gold -= 1;
        person.gold += 1;
      }
      person.forceId = id;
      personIds.push(person.id);
    }
  } else {
    for (const person of next.people.filter((row) => row.alive && row.groupId === "pack")) {
      person.forceId = id;
      personIds.push(person.id);
    }
  }
  next.pursuits.push({ id, faction, placeId: faction === "crown" ? "crownmarket" : "thornwood", personIds, target: next.company?.lastSeen ?? null });
  return next;
}

export function marchPursuit(world: World, id: string, to: PlaceId): World {
  const next = cloneWorld(world);
  const force = next.pursuits.find((item) => item.id === id);
  if (!force) return next;
  force.placeId = to;
  const hidden = (next.company?.hiddenUntilWeek ?? 0) >= next.week;
  if (next.company && to === next.company.location && !hidden) {
    next.pendingBattle = { kind: "pursuit", placeId: to, foe: force.faction };
  }
  return next;
}

export function recallPursuit(world: World, id: string): World {
  const next = cloneWorld(world);
  const force = next.pursuits.find((item) => item.id === id);
  if (!force) return next;
  for (const personId of force.personIds) {
    const row = next.people.find((person) => person.id === personId);
    if (row?.alive) row.forceId = row.groupId === "pack" ? "pack" : null;
  }
  next.pursuits = next.pursuits.filter((item) => item.id !== id);
  return next;
}

export function searchHistoryLine(times: number, trail: boolean): string {
  const base = times === 0 ? "This is their first search of this ground." : `They have already searched this ground ${times} ${times === 1 ? "time" : "times"}.`;
  const rumour = "";
  return `${base}${trail ? " A fresh trail was found here." : ""}${rumour}`;
}

export function searchPrompt(world: World, place: PlaceId): string {
  const times = world.searches[place] ?? 0;
  const trail = !!world.trails[place];
  const rumour = world.rumours.map((item) => item.text).join(" ");
  return `${searchHistoryLine(times, trail)}${rumour ? ` Rumour: ${rumour}` : ""}`;
}

export function applyFind(world: World, kind: "camp" | "bandits" | "trail" | "food" | "nothing"): World {
  const next = cloneWorld(world);
  const place = next.company?.location ?? "thornwood";
  next.searches[place] = (next.searches[place] ?? 0) + 1;
  const bandAlive = next.people.some((person) => person.alive && person.groupId === "pack");
  if (kind === "camp") next.campSeen = true;
  if (kind === "bandits" && !bandAlive) {
    next.campSeen = false;
    if (next.company) next.company.bread += SEARCH_FOOD_FLOOR;
  }
  if (kind === "trail") next.trails[place] = true;
  const empty = kind === "nothing" || kind === "food";
  if (empty && next.company) next.company.bread += SEARCH_FOOD_FLOOR;
  if (kind === "trail" && next.company) next.company.bread += SEARCH_FOOD_FLOOR;
  return next;
}

export function hide(world: World): World {
  const next = cloneWorld(world);
  if (next.company) next.company.hiddenUntilWeek = next.week + 1;
  return next;
}

export function refuge(world: World, accepted: boolean): World {
  const next = cloneWorld(world);
  if (accepted && next.company) next.company.hiddenUntilWeek = next.week + 1;
  next.events.push({ week: next.week, type: accepted ? "refuge" : "refuge-refused", significant: accepted });
  return next;
}

export function resolveFind(world: World, found: boolean): World {
  const next = cloneWorld(world);
  if (found) {
    next.foeStance = "Holding";
    next.ambushReady = false;
    next.pendingBattle = { kind: "band", placeId: next.company?.location ?? "thornwood", foe: "The Pack" };
  } else {
    next.foeStance = "Unready";
    next.ambushReady = true;
  }
  return next;
}

export function workFields(world: World): PlayResult {
  if (!world.company) return fail("No company.");
  const men = headcount(world.company);
  const storeId = world.company.location === "salt-ferry" ? "ferry" : "thornwick";
  const next = cloneWorld(world);
  const store = storeOf(next, storeId);
  const pay = Math.min(store.bread, men * FIELD_BREAD);
  store.bread -= pay;
  next.company!.bread += pay;
  next.company!.worked = true;
  next.events.push({ week: next.week, type: "work-fields", significant: false });
  return { ok: true, world: next };
}

export function merchantGuard(world: World, npcId: NpcId): PlayResult {
  if (!world.company) return fail("No company.");
  const next = cloneWorld(world);
  const row = next.people.find((person) => person.npcId === npcId);
  if (!row) return fail("No such merchant.");
  const owed = headcount(next.company!) * MERCHANT_GOLD;
  const pay = Math.min(row.gold, owed);
  row.gold -= pay;
  next.company!.gold += pay;
  next.company!.worked = true;
  next.events.push({ week: next.week, type: "work-merchant", significant: false });
  return { ok: true, world: next };
}

export function guardDuty(world: World, where: "village" | "city"): PlayResult {
  if (!world.company) return fail("No company.");
  const next = cloneWorld(world);
  const men = headcount(next.company!);
  if (where === "village") {
    const store = storeOf(next, next.company!.location === "salt-ferry" ? "ferry" : "thornwick");
    const pay = Math.min(store.gold, Math.floor(men / VILLAGE_DUTY_PER));
    store.gold -= pay;
    next.company!.gold += pay;
    next.events.push({ week: next.week, type: "work-village-guard", significant: false });
  } else {
    const store = storeOf(next, "civic");
    const pay = Math.min(store.gold, men * CITY_DUTY_GOLD);
    store.gold -= pay;
    next.company!.gold += pay;
    next.events.push({ week: next.week, type: "work-city-guard", significant: false });
  }
  next.company!.worked = true;
  return { ok: true, world: next };
}

export function rest(world: World, mode: "own" | "requisition", comply = true): PlayResult {
  if (!world.company) return fail("No company.");
  const next = cloneWorld(world);
  const company = next.company;
  if (!company) return fail("No company.");
  if (mode === "requisition" && !comply) {
    next.takeByForce = true;
    return { ok: true, world: next };
  }
  if (mode === "requisition" && comply) {
    const store = storeOf(next, company.location === "salt-ferry" ? "ferry" : "thornwick");
    const take = Math.min(store.bread, 20);
    store.bread -= take;
    company.bread += take;
    const key = company.location;
    next.hiddenScores[key] = (next.hiddenScores[key] ?? 0) - 10;
  }
  for (const unit of company.units) {
    if (unit.headcount <= 0) continue;
    unit.morale += REST_MORALE;
    unit.condition += REST_CONDITION;
  }
  company.restedInARow += 1;
  next.elderTold = company.location;
  if (company.restedInARow >= 2) {
    const key = company.location;
    next.hiddenScores[key] = (next.hiddenScores[key] ?? 0) - 5;
  }
  company.worked = true;
  return { ok: true, world: next };
}

export function declineForce(world: World): World {
  const next = cloneWorld(world);
  next.takeByForce = false;
  return next;
}

export function addRumours(world: World, lines: string[]): World {
  const next = cloneWorld(world);
  for (const text of lines) {
    if (next.rumours.length >= INN_RUMOURS) break;
    next.rumours.push({ id: `rumour-${next.rumours.length + 1}`, text });
  }
  next.innMessages = 6;
  next.events.push({ week: next.week, type: "inn", significant: false });
  return next;
}

export function createQuest(world: World, giverId: NpcId, reward: number, currency: "gold" | "bread", terms: string): PlayResult {
  if (funds(world, giverId)[currency] < reward) return fail("The reward is not there.");
  const next = cloneWorld(world);
  next.quests.push({ id: `quest-${giverId}`, giverId, reward, currency, terms, status: "open" });
  return { ok: true, world: next };
}

export const TUTORIAL_STEPS = ["card", "hale", "quest", "fenn", "speech", "end", "report", "volunteers", "barn"] as const;

export function skipTutorial(world: World): World {
  const next = cloneWorld(world);
  next.tutorialDone = true;
  next.tutorialStep = TUTORIAL_STEPS.length;
  return next;
}

export function advanceTutorial(world: World): World {
  const next = cloneWorld(world);
  const step = TUTORIAL_STEPS[next.tutorialStep];
  if (step === "quest") {
    next.deals.push({ id: "deal-hale-quest", from: "hale", amount: 30, currency: "gold", dueWeek: next.week + 4, status: "offered" });
  }
  if (step === "fenn" && next.company) {
    const fenn = next.people.find((person) => person.npcId === "fenn");
    if (fenn && fenn.bread > 0) {
      const gift = Math.min(10, fenn.bread);
      fenn.bread -= gift;
      next.company.bread += gift;
    }
  }
  if (step === "barn") {
    next.events.push({ week: next.week, type: "barn-fight", significant: true });
    next.pendingBattle = { kind: "barn", placeId: next.company?.location ?? "thornwick", foe: "Men in the barn" };
  }
  next.tutorialStep += 1;
  if (next.tutorialStep >= TUTORIAL_STEPS.length) next.tutorialDone = true;
  return next;
}

export interface Seal {
  id: string;
  name: string;
  hidden: boolean;
}

export const SEAL_LIST: Seal[] = [
  { id: "first-muster", name: "First Muster", hidden: false },
  { id: "blooded", name: "Blooded", hidden: false },
  { id: "full-ranks", name: "Full Ranks", hidden: false },
  { id: "ten-banners", name: "Ten Banners", hidden: false },
  { id: "odd-company", name: "Odd Company", hidden: false },
  { id: "loose-tongues", name: "Loose Tongues", hidden: false },
  { id: "wolf-warden", name: "Wolf-Warden", hidden: false },
  { id: "found-them", name: "Found Them", hidden: false },
  { id: "thornwood-cleared", name: "Thornwood Cleared", hidden: false },
  { id: "thornbacks-bane", name: "Thornback's Bane", hidden: false },
  { id: "silver-tongue", name: "Silver Tongue", hidden: false },
  { id: "ghost", name: "Ghost", hidden: true },
  { id: "from-the-shadows", name: "From the Shadows", hidden: true },
  { id: "sanctuary", name: "Sanctuary", hidden: true },
  { id: "brigands", name: "Brigands", hidden: true },
  { id: "pardoned", name: "Pardoned", hidden: true },
  { id: "loyal-blade", name: "Loyal Blade", hidden: true },
  { id: "kingbreaker", name: "Kingbreaker", hidden: true },
  { id: "sack", name: "Sack of Crownmarket", hidden: true },
  { id: "clean-hands", name: "Clean Hands", hidden: false },
  { id: "never-short", name: "Never Short", hidden: false },
  { id: "breadwinner", name: "Breadwinner", hidden: false },
  { id: "last-stand", name: "Last Stand", hidden: true },
  { id: "honest-work", name: "Honest Work", hidden: false },
];

function has(world: World, type: string): boolean {
  return world.events.some((event) => event.type === type);
}

export function earnedSealIds(world: World): string[] {
  const men = headcount(world.company);
  const ids: string[] = [];
  if (has(world, "recruit")) ids.push("first-muster");
  if (has(world, "fight")) ids.push("blooded");
  if (world.company?.units.some((unit) => unit.headcount === UNIT_MAX && unit.personIds.length > 0)) ids.push("full-ranks");
  if ((world.company?.units.length ?? 0) >= UNIT_SLOTS && (world.company?.units.every((unit) => unit.headcount > 0) ?? false)) ids.push("ten-banners");
  if (world.wiki.some((entry) => entry.definedBy === "ai")) ids.push("odd-company");
  if (world.rumours.length >= 3) ids.push("loose-tongues");
  if (!world.wolvesAlive && has(world, "wolves")) ids.push("wolf-warden");
  if (world.campSeen) ids.push("found-them");
  if (!world.people.some((person) => person.alive && person.groupId === "pack")) ids.push("thornwood-cleared");
  if (world.thornback.placed && !world.thornback.alive) ids.push("thornbacks-bane");
  if (has(world, "negotiated")) ids.push("silver-tongue");
  if (has(world, "hid-through-search")) ids.push("ghost");
  if (has(world, "ambush-win")) ids.push("from-the-shadows");
  if (has(world, "refuge")) ids.push("sanctuary");
  if (has(world, "pillage")) ids.push("brigands");
  if (has(world, "pardoned")) ids.push("pardoned");
  if (has(world, "crush-rebellion")) ids.push("loyal-blade");
  if (has(world, "kingbreaker")) ids.push("kingbreaker");
  if (has(world, "sack-crownmarket")) ids.push("sack");
  if (world.week >= 12 && !has(world, "pillage") && !has(world, "civilian-killed")) ids.push("clean-hands");
  if (world.week >= 12 && world.events.filter((event) => event.type === "unpaid").length === 0 && world.company?.paidThisWeek !== false) ids.push("never-short");
  if (netWorth(world) >= 1000) ids.push("breadwinner");
  if (world.week >= 12 && men > 0 && men <= 5) ids.push("last-stand");
  if (has(world, "work-fields") && has(world, "work-merchant") && (has(world, "work-village-guard") || has(world, "work-city-guard"))) ids.push("honest-work");
  return ids;
}

export function visibleSeals(world: World): { id: string; name: string }[] {
  const earned = new Set(earnedSealIds(world));
  return SEAL_LIST.filter((seal) => earned.has(seal.id)).map((seal) => ({ id: seal.id, name: seal.hidden && !earned.has(seal.id) ? "" : seal.name }));
}

export function sealName(world: World, id: string): string {
  const seal = SEAL_LIST.find((item) => item.id === id);
  if (!seal) return "";
  const earned = earnedSealIds(world).includes(id);
  if (seal.hidden && !earned) return "";
  return earned ? seal.name : "";
}

export function netWorth(world: World): number {
  const company = world.company;
  if (!company) return 0;
  const goods = company.goods.reduce((sum, item) => sum + item.price, 0);
  const owed = company.debts.filter((debt) => debt.direction === "company-owes" && debt.status === "open").reduce((sum, debt) => sum + debt.amount, 0);
  return company.gold + company.bread / CROWN_BREAD_PER_GOLD + goods - owed;
}

export function closeYear(world: World): World {
  const next = cloneWorld(world);
  next.ended = true;
  next.score = netWorth(next);
  next.seals = earnedSealIds(next);
  return next;
}

export function found(world: World, input: {
  name: string;
  origin: string;
  colours: [string, string];
  sigil: Sigil;
  captainName: string;
  captainBackground: Company["captainBackground"];
  trades: [Trade, Trade];
  unitNames: [string, string];
}): PlayResult {
  if (!input.name.trim()) return fail("The company needs a name.");
  if (!BANNER_COLOURS.includes(input.colours[0] as Colour) || !BANNER_COLOURS.includes(input.colours[1] as Colour)) return fail("That colour is not for a banner.");
  if (input.trades.length !== 2 || input.trades[0] === input.trades[1]) return fail("Pick two different trades.");
  if (!input.unitNames[0]?.trim() || !input.unitNames[1]?.trim()) return fail("Each unit needs a name.");
  if (input.unitNames[0].trim().toLowerCase() === input.unitNames[1].trim().toLowerCase()) return fail("Give the two units different names.");
  const next = cloneWorld(world);
  next.company = {
    founded: true,
    name: input.name.trim(),
    origin: input.origin.trim(),
    banner: { colours: [input.colours[0] as Colour, input.colours[1] as Colour], sigil: input.sigil },
    captainName: input.captainName.trim(),
    captainBackground: input.captainBackground,
    gold: 120,
    bread: 280,
    location: "thornwick",
    units: [
      makeUnit({ id: "u1", slot: 0, trade: input.trades[0], headcount: START_MEN, name: input.unitNames[0].trim() }),
      makeUnit({ id: "u2", slot: 1, trade: input.trades[1], headcount: START_MEN, name: input.unitNames[1].trim() }),
    ],
    goods: [],
    debts: [],
    hiddenUntilWeek: null,
    lastSeen: "thornwick",
    fought: false,
    trained: false,
    worked: false,
    actionUsed: false,
    moveUsed: false,
    restedInARow: 0,
    paidThisWeek: true,
  };
  next.decisions.push({ week: next.week, text: `Founded ${next.company.name}.` });
  next.suggestion = { text: "You are in Thornwick. Marta Hale, the reeve, wants a word.", action: "talk" };
  return { ok: true, world: next };
}

export function ignoreSuggestion(world: World): World {
  const next = cloneWorld(world);
  next.suggestion = null;
  return next;
}

export function confirmSuggestion(world: World): PlayResult {
  if (!world.suggestion || !world.company) return fail("Nothing was suggested.");
  if (world.company.actionUsed) return fail("The week's action is spent.");
  const next = cloneWorld(world);
  next.company!.actionUsed = true;
  next.suggestion = null;
  return { ok: true, world: next };
}

export function suggest(world: World, text: string, action: string): World {
  const next = cloneWorld(world);
  next.suggestion = { text, action };
  return next;
}
