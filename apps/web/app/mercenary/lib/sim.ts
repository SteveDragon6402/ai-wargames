import {
  groupCount,
  openingWorld,
  PACK_RAID_LINE,
  type Company,
  type GroupId,
  type PersonRow,
  type PlaceId,
  type Stance,
  type Trade,
  type Unit,
  type World,
  type WeekTrace,
} from "../data/hollowmere";
import { books, storeOf } from "./books";
import {
  CAVALRY_WAGE,
  DESERT_LINE,
  EAT,
  FOOT_WAGE,
  GUARD_WAGE_CITY,
  GUARD_WAGE_VILLAGE,
  IDLE_CONDITION,
  RAID_BREAD,
  RAID_GOLD,
  REBELLION_GUARDS_DEAD,
  REBELLION_MILITIA_DEAD,
  REBELLION_SIZE,
  REBELLION_WEEK,
  START_BREAD,
  START_CONDITION,
  START_GOLD,
  START_MEN,
  START_MORALE,
  THORNBACK_KILL_FROM,
  THORNBACK_WEEK,
  UNIT_MAX,
  UNPAID_GUARD_MORALE,
  UNPAID_MORALE,
  WOLF_BREAD,
  WOLF_FROM_WEEK,
} from "../data/tuning";

export interface SimOptions {
  raids?: boolean;
  plots?: boolean;
  upkeep?: boolean;
  /** When the company is in Thornwick, open a battle instead of calling the raid off. */
  raidAsBattle?: boolean;
}

const STANCES: Stance[] = ["Aggressive", "Holding", "Skirmish", "Unready"];

export function cloneWorld(world: World): World {
  return structuredClone(world);
}

export function living(world: World, groupId?: GroupId): PersonRow[] {
  return world.people.filter((person) => person.alive && (groupId === undefined || person.groupId === groupId));
}

export function headcount(company: Company | null): number {
  if (!company) return 0;
  return company.units.reduce((sum, unit) => sum + unit.headcount, 0);
}

function stepUnready(stance: Stance): Stance {
  const index = STANCES.indexOf(stance);
  return STANCES[Math.min(STANCES.length - 1, index + 1)] ?? "Unready";
}

function killOne(people: PersonRow[], preferUnnamed = true): PersonRow | null {
  const pool = preferUnnamed ? people.filter((person) => !person.npcId) : people;
  const row = (pool[0] ?? people[0]) ?? null;
  if (!row) return null;
  row.alive = false;
  row.forceId = null;
  return row;
}

function fireRebellion(world: World) {
  world.rebellionFired = true;
  const peasants = living(world, "crown-peasants").filter((person) => !person.npcId);
  const taken = peasants.slice(0, REBELLION_SIZE);
  for (const person of taken) {
    person.groupId = "faith-militia";
    person.placeId = "lantern-house";
    person.forceId = "faith-militia";
  }
  const face = world.dispositions.find((item) => item.holder === "lantern-house" && item.toward === "crown");
  if (face) {
    face.level = "Hostile";
    face.score = -60;
    face.description = "Mother Ysolde has raised the Lantern against the Steward.";
  } else {
    world.dispositions.push({
      holder: "lantern-house",
      toward: "crown",
      level: "Hostile",
      description: "Mother Ysolde has raised the Lantern against the Steward.",
      score: -60,
    });
  }
  const militia = living(world, "faith-militia");
  for (const person of militia.slice(0, REBELLION_MILITIA_DEAD)) person.alive = false;
  const guards = living(world, "crown-guards").filter((person) => !person.npcId);
  for (const person of guards.slice(0, REBELLION_GUARDS_DEAD)) person.alive = false;
  for (const person of living(world, "faith-militia")) person.forceId = null;
  world.events.push({ week: world.week, type: "rebellion", significant: true });
}

function applyRaid(world: World): { bread: number; gold: number } {
  const guards = living(world, "thorn-guards");
  const bandits = living(world, "pack").filter((person) => person.npcId !== "corwin" && person.forceId !== "captive");
  if (guards.length > 0) {
    killOne(guards, true);
    if (bandits.length) killOne(bandits, true);
  } else {
    const peasants = living(world, "thorn-peasants");
    killOne(peasants, true);
    if (bandits.length) killOne(bandits, true);
  }
  const store = storeOf(world, "thornwick");
  const bread = Math.min(RAID_BREAD, store.bread);
  const gold = Math.min(RAID_GOLD, store.gold);
  store.bread -= bread;
  store.gold -= gold;
  world.pack.bread += bread;
  world.pack.gold += gold;
  world.events.push({ week: world.week, type: "raid", significant: true });
  return { bread, gold };
}

function eat(world: World): number {
  let eaten = 0;
  for (const person of world.people) {
    if (!person.alive || person.groupId === "pack" || person.forceId === "company") continue;
    const take = Math.min(EAT, person.bread);
    person.bread -= take;
    eaten += take;
    if (take < EAT) person.alive = false;
  }
  const pack = living(world, "pack")
    .filter((person) => person.forceId !== "captive")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const person of pack) {
    const take = Math.min(EAT, world.pack.bread);
    world.pack.bread -= take;
    eaten += take;
    if (take < EAT) person.alive = false;
  }
  return eaten;
}

function payGuards(world: World): number {
  const posts: { group: GroupId; store: "civic" | "ferry" | "thornwick"; wage: number }[] = [
    { group: "crown-guards", store: "civic", wage: GUARD_WAGE_CITY },
    { group: "thorn-guards", store: "thornwick", wage: GUARD_WAGE_VILLAGE },
    { group: "ferry-guards", store: "ferry", wage: GUARD_WAGE_VILLAGE },
  ];
  let moved = 0;
  for (const post of posts) {
    const store = storeOf(world, post.store);
    for (const person of living(world, post.group)) {
      if (store.gold >= post.wage) {
        store.gold -= post.wage;
        person.gold += post.wage;
        moved += post.wage;
      } else {
        person.morale -= UNPAID_GUARD_MORALE;
      }
    }
  }
  return moved;
}

function upkeep(world: World) {
  const company = world.company;
  if (!company?.founded) return;
  const men = headcount(company);
  if (men <= 0) {
    world.lost = true;
    return;
  }
  const idle = !company.fought && !company.trained && !company.worked;
  if (idle) {
    for (const unit of company.units) {
      if (unit.headcount <= 0) continue;
      unit.condition = Math.max(0, unit.condition - IDLE_CONDITION);
      unit.stance = stepUnready(unit.stance);
    }
  }
  const cost = company.units.reduce((sum, unit) => sum + unit.headcount * unit.wageBreadPerDay * EAT, 0);
  if (cost > 0 && company.bread >= cost) {
    company.bread -= cost;
    company.paidThisWeek = true;
  } else if (men > 0) {
    company.paidThisWeek = false;
    for (const unit of company.units) {
      if (unit.headcount > 0) unit.morale -= UNPAID_MORALE;
    }
  }
  const morale = company.units.find((unit) => unit.headcount > 0)?.morale ?? START_MORALE;
  if (morale < DESERT_LINE) {
    let lose = Math.floor((DESERT_LINE - morale) / 10);
    for (const unit of company.units) {
      if (lose <= 0) break;
      const cut = Math.min(unit.headcount, lose);
      unit.headcount -= cut;
      lose -= cut;
      const gone = unit.personIds.splice(0, cut);
      for (const id of gone) {
        const row = world.people.find((person) => person.id === id);
        if (!row) continue;
        if (unit.home && unit.sourceGroupId) {
          row.forceId = null;
          row.groupId = unit.sourceGroupId;
          row.placeId = unit.home;
        } else {
          row.alive = false;
        }
      }
    }
  }
  company.fought = false;
  company.trained = false;
  company.worked = false;
  if (headcount(company) <= 0) world.lost = true;
}

function snapshot(world: World, extra: Pick<WeekTrace, "eaten" | "wolfLoss" | "raidBread" | "raidGold" | "guardPay" | "raided">): WeekTrace {
  const totals = books(world);
  const company = world.company?.founded ? world.company : null;
  return {
    week: world.week,
    thornBread: storeOf(world, "thornwick").bread,
    thornGold: storeOf(world, "thornwick").gold,
    thornGuards: groupCount(world.people, "thorn-guards"),
    ferryBread: storeOf(world, "ferry").bread,
    packAlive: groupCount(world.people, "pack"),
    packBread: world.pack.bread,
    crownPeasants: groupCount(world.people, "crown-peasants"),
    crownGuards: groupCount(world.people, "crown-guards"),
    militiaAlive: groupCount(world.people, "faith-militia"),
    thornbackAlive: world.thornback.alive,
    bread: totals.bread,
    gold: totals.gold,
    companyBread: company ? company.bread : null,
    companyGold: company ? company.gold : null,
    companyMen: company ? headcount(company) : null,
    companyMorale: company ? (company.units.find((unit) => unit.headcount > 0)?.morale ?? null) : null,
    ...extra,
  };
}

export function resolveWeek(input: World, opts: SimOptions = {}): World {
  const world = cloneWorld(input);
  const raids = opts.raids !== false;
  const plots = opts.plots !== false;
  let wolfLoss = 0;
  let raidBread = 0;
  let raidGold = 0;
  let raided = false;

  if (plots && world.week >= WOLF_FROM_WEEK && world.wolvesAlive) {
    const ferry = storeOf(world, "ferry");
    wolfLoss = Math.min(WOLF_BREAD, ferry.bread);
    ferry.bread -= wolfLoss;
    world.events.push({ week: world.week, type: "wolves", significant: true });
  }
  if (plots && world.week === THORNBACK_WEEK) {
    world.thornback = { placed: true, alive: true, hidden: true, found: false };
    world.events.push({ week: world.week, type: "thornback", significant: true });
  }
  if (plots && world.week >= THORNBACK_KILL_FROM && world.thornback.alive) {
    const peasants = living(world, "thorn-peasants");
    killOne(peasants, true);
    world.events.push({ week: world.week, type: "thornback-kill", significant: true });
  }
  if (plots && world.week === REBELLION_WEEK && !world.rebellionFired) fireRebellion(world);

  const companyHere = !!world.company?.founded && world.company.location === "thornwick";
  const packFree = living(world, "pack").some((person) => person.forceId !== "captive");
  const wouldRaid = raids && world.pack.bread < PACK_RAID_LINE && packFree;
  if (wouldRaid && companyHere && opts.raidAsBattle) {
    world.pendingBattle = { kind: "raid", placeId: "thornwick", foe: "The Pack" };
  } else if (wouldRaid && !companyHere) {
    const moved = applyRaid(world);
    raidBread = moved.bread;
    raidGold = moved.gold;
    raided = true;
  }

  const eaten = eat(world);
  const guardPay = payGuards(world);
  if (opts.upkeep !== false) upkeep(world);
  if (world.company) {
    world.company.moveUsed = false;
    world.company.actionUsed = false;
  }
  world.trace.push(snapshot(world, { eaten, wolfLoss, raidBread, raidGold, guardPay, raided }));
  world.week += 1;
  if (world.week > 12 && world.company?.founded && !world.lost) world.ended = true;
  return world;
}

export function runWeeks(world: World, count: number, opts: SimOptions = {}): World {
  let current = world;
  for (let i = 0; i < count; i += 1) current = resolveWeek(current, opts);
  return current;
}

export function makeUnit(partial: Partial<Unit> & { id: string; trade: Trade; headcount: number }): Unit {
  const wage = partial.trade === "cavalry" ? CAVALRY_WAGE : FOOT_WAGE;
  return {
    slot: partial.slot ?? 0,
    name: partial.name ?? "The File",
    meaning: partial.meaning ?? "Named for the work they do.",
    specialName: partial.specialName ?? null,
    wounded: partial.wounded ?? 0,
    stance: partial.stance ?? "Holding",
    morale: partial.morale ?? START_MORALE,
    condition: partial.condition ?? START_CONDITION,
    wageBreadPerDay: partial.wageBreadPerDay ?? wage,
    permanence: partial.permanence ?? "permanent",
    leaveCondition: partial.leaveCondition ?? null,
    leaveWeek: partial.leaveWeek ?? null,
    sourceGroupId: partial.sourceGroupId ?? null,
    personIds: partial.personIds ?? [],
    home: partial.home ?? null,
    seenFrom: partial.seenFrom ?? 0,
    wikiKey: partial.wikiKey ?? null,
    ...partial,
  };
}

export function foundCompany(world: World, trades: [Trade, Trade] = ["spearmen", "swordsmen"]): World {
  const next = cloneWorld(world);
  next.company = {
    founded: true,
    name: "The Grey Company",
    origin: "Raised on the road.",
    banner: { colours: ["azure", "sable"], sigil: "spear" },
    captainName: "Harl",
    captainBackground: "Deserter",
    gold: START_GOLD,
    bread: START_BREAD,
    location: "thornwick",
    units: [
      makeUnit({ id: "u1", slot: 0, trade: trades[0], headcount: START_MEN, name: "The File" }),
      makeUnit({ id: "u2", slot: 1, trade: trades[1], headcount: START_MEN, name: "The Bows" }),
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
  return next;
}

export function freshGame(): World {
  const world = openingWorld();
  world.company = {
    founded: false,
    name: "",
    origin: "",
    banner: null,
    captainName: "",
    captainBackground: null,
    gold: 0,
    bread: 0,
    location: "thornwick",
    units: [],
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
    paidThisWeek: false,
  };
  world.tutorialStep = 0;
  world.tutorialDone = false;
  return world;
}

export { openingWorld, PACK_RAID_LINE, UNIT_MAX };
