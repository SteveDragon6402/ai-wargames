import { PACK_WEEKS_OF_BREAD, EAT } from "./tuning";

export const PLACE_IDS = [
  "crownmarket",
  "lantern-house",
  "salt-ferry",
  "thornwick",
  "drowned-fields",
  "thornwood",
] as const;

export type PlaceId = (typeof PLACE_IDS)[number];

export type PlaceKind = "capital" | "temple" | "village" | "wild";

export interface Place {
  id: PlaceId;
  name: string;
  meaning: string;
  kind: PlaceKind;
  /** Bread bought by one gold. Wilderness has none. */
  rate: number | null;
}

export const PLACES: Record<PlaceId, Place> = {
  crownmarket: {
    id: "crownmarket",
    name: "Crownmarket",
    meaning: "The king rents the stalls; everything has a price.",
    kind: "capital",
    rate: 2,
  },
  "lantern-house": {
    id: "lantern-house",
    name: "The Lantern House",
    meaning: "A flame unbroken for 200 years; pilgrims donate.",
    kind: "temple",
    rate: 2.5,
  },
  "salt-ferry": {
    id: "salt-ferry",
    name: "The Salt Ferry",
    meaning: "Taxes every river crossing.",
    kind: "village",
    rate: 3,
  },
  thornwick: {
    id: "thornwick",
    name: "Thornwick",
    meaning: "A farming town hemmed in by woods.",
    kind: "village",
    rate: 3.5,
  },
  "drowned-fields": {
    id: "drowned-fields",
    name: "The Drowned Fields",
    meaning: "Flooded farmland.",
    kind: "wild",
    rate: null,
  },
  thornwood: {
    id: "thornwood",
    name: "Thornwood",
    meaning: "The wood where the Pack keeps its camp.",
    kind: "wild",
    rate: null,
  },
};

/** One week's march. Thornwick reaches Crownmarket through the Lantern House, not directly. */
export const EDGES: [PlaceId, PlaceId][] = [
  ["crownmarket", "lantern-house"],
  ["crownmarket", "salt-ferry"],
  ["crownmarket", "drowned-fields"],
  ["salt-ferry", "drowned-fields"],
  ["lantern-house", "thornwick"],
  ["lantern-house", "thornwood"],
  ["thornwick", "thornwood"],
];

export function neighbors(id: PlaceId): PlaceId[] {
  const out: PlaceId[] = [];
  for (const [a, b] of EDGES) {
    if (a === id) out.push(b);
    if (b === id) out.push(a);
  }
  return out;
}

export function distance(from: PlaceId, to: PlaceId): number {
  if (from === to) return 0;
  const seen = new Set<PlaceId>([from]);
  let edge = [from];
  let steps = 0;
  while (edge.length) {
    steps += 1;
    const next: PlaceId[] = [];
    for (const id of edge) {
      for (const n of neighbors(id)) {
        if (seen.has(n)) continue;
        if (n === to) return steps;
        seen.add(n);
        next.push(n);
      }
    }
    edge = next;
  }
  return Infinity;
}

export const GROUP_IDS = [
  "crown-peasants",
  "crown-guards",
  "crown-nobles",
  "ferry-peasants",
  "ferry-guards",
  "thorn-peasants",
  "thorn-guards",
  "lantern-brothers",
  "pack",
  "faith-militia",
] as const;

export type GroupId = (typeof GROUP_IDS)[number];

export const NPC_IDS = [
  "aldous",
  "varrow",
  "oskar",
  "benet",
  "pell",
  "doss",
  "juna",
  "hale",
  "fenn",
  "ysolde",
  "corwin",
] as const;

export type NpcId = (typeof NPC_IDS)[number];

export interface NamedPerson {
  id: NpcId;
  name: string;
  place: string;
}

export const NAMED: Record<NpcId, { name: string; role: string }> = {
  aldous: { name: "Aldous Crane", role: "Lord Steward" },
  varrow: { name: "Ilse Varrow", role: "Commander of the guard" },
  oskar: { name: "Oskar Tull", role: "Master-at-Arms" },
  benet: { name: "Benet Hollis", role: "Grain merchant" },
  pell: { name: "Pell", role: "Tavernkeeper" },
  doss: { name: "Elder Doss", role: "Elder of the Salt Ferry" },
  juna: { name: "Juna", role: "Merchant" },
  hale: { name: "Marta Hale", role: "Reeve of Thornwick" },
  fenn: { name: "Fenn", role: "Merchant" },
  ysolde: { name: "Mother Ysolde", role: "Head of the Lantern House" },
  corwin: { name: "Corwin Ashgrave", role: "Chief of the Pack" },
};

export type Stance = "Aggressive" | "Holding" | "Skirmish" | "Unready";
export type Trade = "spearmen" | "swordsmen" | "archers" | "crossbowmen" | "cavalry" | "special";
export type Colour = "azure" | "purpure" | "sable" | "tenne" | "murrey";
export type Sigil = "wheat" | "spear" | "lantern" | "wolf" | "ferry" | "thorn";
export type CaptainBackground = "Deserter" | "Noble's Bastard" | "Former Quartermaster";
export type Face = "Friendly" | "Neutral" | "Hostile";

export const BANNER_COLOURS: Colour[] = ["azure", "purpure", "sable", "tenne", "murrey"];
export const SIGILS: Sigil[] = ["wheat", "spear", "lantern", "wolf", "ferry", "thorn"];
export const BACKGROUNDS: CaptainBackground[] = ["Deserter", "Noble's Bastard", "Former Quartermaster"];
export const TRADES: Trade[] = ["spearmen", "swordsmen", "archers", "crossbowmen", "cavalry"];

export interface PersonRow {
  id: string;
  groupId: GroupId;
  placeId: PlaceId;
  name: string | null;
  npcId: NpcId | null;
  alive: boolean;
  bread: number;
  gold: number;
  morale: number;
  forceId: string | null;
}

export interface Store {
  id: "civic" | "ferry" | "thornwick" | "lantern";
  placeId: PlaceId;
  bread: number;
  gold: number;
}

export interface Unit {
  id: string;
  slot: number;
  name: string;
  meaning: string;
  trade: Trade;
  specialName: string | null;
  headcount: number;
  wounded: number;
  stance: Stance;
  morale: number;
  condition: number;
  wageBreadPerDay: number;
  permanence: "permanent" | "temporary";
  leaveCondition: string | null;
  leaveWeek: number | null;
  sourceGroupId: GroupId | null;
  personIds: string[];
  home: PlaceId | null;
  seenFrom: number;
  wikiKey: string | null;
}

export interface Goods {
  id: string;
  name: string;
  price: number;
}

export interface Debt {
  id: string;
  npcId: NpcId;
  amount: number;
  currency: "gold" | "bread";
  dueWeek: number;
  /** Company owes the NPC, or the NPC owes the company. */
  direction: "company-owes" | "npc-owes";
  status: "open" | "settled";
}

export interface Company {
  founded: boolean;
  name: string;
  origin: string;
  banner: { colours: [Colour, Colour]; sigil: Sigil } | null;
  captainName: string;
  captainBackground: CaptainBackground | null;
  gold: number;
  bread: number;
  location: PlaceId;
  units: Unit[];
  goods: Goods[];
  debts: Debt[];
  hiddenUntilWeek: number | null;
  lastSeen: PlaceId;
  fought: boolean;
  trained: boolean;
  worked: boolean;
  actionUsed: boolean;
  moveUsed: boolean;
  restedInARow: number;
  paidThisWeek: boolean;
}

export interface Deal {
  id: string;
  from: NpcId | GroupId;
  amount: number;
  currency: "gold" | "bread";
  dueWeek: number;
  status: "offered" | "countering" | "accepted" | "declined";
}

export interface Flag {
  who: string;
  wants: boolean;
  reason: string;
  week: number;
}

export interface Regard {
  level: Face;
  description: string;
  score: number;
}

export interface Rumour {
  id: string;
  text: string;
}

export interface Quest {
  id: string;
  giverId: NpcId;
  reward: number;
  currency: "gold" | "bread";
  terms: string;
  status: "open" | "done" | "failed";
}

export interface WikiEntry {
  key: string;
  strengths: string;
  weaknesses: string;
  definedBy: "base" | "ai";
}

export interface Pursuit {
  id: string;
  faction: "crown" | "pack";
  placeId: PlaceId;
  personIds: string[];
  target: PlaceId | null;
}

export interface GameEvent {
  week: number;
  type: string;
  significant: boolean;
}

export interface Decision {
  week: number;
  text: string;
}

export interface Returned {
  home: PlaceId;
  from: number;
  to: number;
}

export interface WeekTrace {
  week: number;
  thornBread: number;
  thornGold: number;
  thornGuards: number;
  ferryBread: number;
  packAlive: number;
  packBread: number;
  crownPeasants: number;
  crownGuards: number;
  militiaAlive: number;
  thornbackAlive: boolean;
  bread: number;
  gold: number;
  eaten: number;
  wolfLoss: number;
  raidBread: number;
  raidGold: number;
  guardPay: number;
  raided: boolean;
  companyBread: number | null;
  companyGold: number | null;
  companyMen: number | null;
  companyMorale: number | null;
}

export interface PendingBattle {
  kind: "raid" | "pursuit" | "pillage" | "band" | "ambush" | "barn";
  placeId: PlaceId;
  foe: string;
}

export interface World {
  week: number;
  people: PersonRow[];
  stores: Store[];
  pack: { bread: number; gold: number };
  company: Company | null;
  wolvesAlive: boolean;
  thornback: { placed: boolean; alive: boolean; hidden: boolean; found: boolean };
  rebellionFired: boolean;
  dispositions: { holder: string; toward: string; level: Face; description: string; score: number }[];
  flags: Flag[];
  deals: Deal[];
  pendingForce: boolean;
  pendingBattle: PendingBattle | null;
  searches: Partial<Record<PlaceId, number>>;
  trails: Partial<Record<PlaceId, boolean>>;
  campSeen: boolean;
  rumours: Rumour[];
  quests: Quest[];
  events: GameEvent[];
  decisions: Decision[];
  returned: Returned[];
  tutorialStep: number;
  tutorialDone: boolean;
  lost: boolean;
  ended: boolean;
  trace: WeekTrace[];
  wiki: WikiEntry[];
  pursuits: Pursuit[];
  quartermaster: string;
  intentChip: { label: string; action: string } | null;
  suggestion: { text: string; action: string } | null;
  innMessages: number;
  takeByForce: boolean;
  seals: string[];
  score: number | null;
  ambushReady: boolean;
  foeStance: Stance | null;
  elderTold: PlaceId | null;
  hiddenScores: Record<string, number>;
}

interface GroupSpec {
  id: GroupId;
  placeId: PlaceId;
  count: number;
  bread: number;
  gold: number;
  named: NpcId[];
  morale: number;
}

const GROUPS: GroupSpec[] = [
  { id: "crown-peasants", placeId: "crownmarket", count: 160, bread: 95, gold: 3, named: ["benet", "pell"], morale: 55 },
  { id: "crown-guards", placeId: "crownmarket", count: 30, bread: 95, gold: 12, named: ["varrow", "oskar"], morale: 65 },
  { id: "crown-nobles", placeId: "crownmarket", count: 10, bread: 160, gold: 80, named: ["aldous"], morale: 50 },
  { id: "ferry-peasants", placeId: "salt-ferry", count: 22, bread: 95, gold: 3, named: ["doss", "juna"], morale: 55 },
  { id: "ferry-guards", placeId: "salt-ferry", count: 3, bread: 95, gold: 12, named: [], morale: 50 },
  { id: "thorn-peasants", placeId: "thornwick", count: 22, bread: 95, gold: 3, named: ["hale", "fenn"], morale: 55 },
  { id: "thorn-guards", placeId: "thornwick", count: 2, bread: 95, gold: 12, named: [], morale: 50 },
  { id: "lantern-brothers", placeId: "lantern-house", count: 6, bread: 120, gold: 30, named: ["ysolde"], morale: 60 },
  { id: "pack", placeId: "thornwood", count: 18, bread: 0, gold: 0, named: ["corwin"], morale: 60 },
];

function rowsFor(spec: GroupSpec): PersonRow[] {
  const rows: PersonRow[] = [];
  spec.named.forEach((npcId, index) => {
    rows.push({
      id: npcId,
      groupId: spec.id,
      placeId: spec.placeId,
      name: NAMED[npcId].name,
      npcId,
      alive: true,
      bread: spec.bread,
      gold: spec.gold,
      morale: spec.morale,
      forceId: spec.id === "pack" ? "pack" : null,
    });
    void index;
  });
  for (let i = spec.named.length; i < spec.count; i += 1) {
    rows.push({
      id: `${spec.id}-${i + 1}`,
      groupId: spec.id,
      placeId: spec.placeId,
      name: null,
      npcId: null,
      alive: true,
      bread: spec.bread,
      gold: spec.gold,
      morale: spec.morale,
      forceId: spec.id === "pack" ? "pack" : null,
    });
  }
  return rows;
}

export function census(): PersonRow[] {
  return GROUPS.flatMap(rowsFor);
}

export function openingStores(): Store[] {
  return [
    { id: "civic", placeId: "crownmarket", bread: 7000, gold: 2000 },
    { id: "ferry", placeId: "salt-ferry", bread: 875, gold: 120 },
    { id: "thornwick", placeId: "thornwick", bread: 580, gold: 120 },
    { id: "lantern", placeId: "lantern-house", bread: 300, gold: 600 },
  ];
}

export function openingWorld(): World {
  return {
    week: 1,
    people: census(),
    stores: openingStores(),
    pack: { bread: 250, gold: 300 },
    company: null,
    wolvesAlive: true,
    thornback: { placed: false, alive: false, hidden: true, found: false },
    rebellionFired: false,
    dispositions: [
      { holder: "pack", toward: "thornwick", level: "Hostile", description: "The Pack burned the store.", score: -40 },
      { holder: "lantern-house", toward: "crown", level: "Neutral", description: "The flame is kept. The Steward is tolerated.", score: 0 },
      { holder: "crown", toward: "company", level: "Neutral", description: "An unknown company.", score: 0 },
    ],
    flags: [],
    deals: [],
    pendingForce: false,
    pendingBattle: null,
    searches: {},
    trails: {},
    campSeen: false,
    rumours: [],
    quests: [],
    events: [],
    decisions: [],
    returned: [],
    tutorialStep: 0,
    tutorialDone: false,
    lost: false,
    ended: false,
    trace: [],
    wiki: [],
    pursuits: [],
    quartermaster: "The quartermaster is here if you ask.",
    intentChip: null,
    suggestion: null,
    innMessages: 0,
    takeByForce: false,
    seals: [],
    score: null,
    ambushReady: false,
    foeStance: null,
    elderTold: null,
    hiddenScores: {},
  };
}

export const PACK_RAID_LINE = 18 * PACK_WEEKS_OF_BREAD * EAT;

/** Still with their group. A company, a militia, or a pursuit is not. The Pack's own force still counts. */
export function atHome(person: PersonRow): boolean {
  return person.alive && (person.forceId === null || person.forceId === person.groupId);
}

export function groupCount(people: PersonRow[], id: GroupId, aliveOnly = true): number {
  return people.filter((person) => person.groupId === id && (!aliveOnly || atHome(person))).length;
}
