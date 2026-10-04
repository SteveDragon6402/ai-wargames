export type Stance = "aggressive" | "holding" | "skirmish" | "unready";
export type DispositionLevel = "friendly" | "neutral" | "hostile";
export type Permanence = "permanent" | "temporary";
export type ForceKind = "company" | "pursuit" | "raid" | "garrison" | "camp" | "beast" | "militia";
export type GroupKind = "peasants" | "guards" | "nobles" | "clergy" | "bandits";
export type LocationKind = "capital" | "temple" | "village" | "wilderness";
export type Currency = "gold" | "bread";

export type LeaveRule =
  | { type: "until_dead"; forceId: string }
  | { type: "until_week"; week: number }
  | { type: "until_store"; storeId: string; bread: number };

export type Person = {
  id: string;
  groupId: string;
  alive: boolean;
  bread: number;
  gold: number;
  inForceId?: string;
};

export type Unit = {
  id: string;
  slot: number;
  name: string;
  nameMeaning: string;
  type: string;
  headcount: number;
  wounded: number;
  stance: Stance;
  morale: number;
  condition: number;
  wageBreadPerDay: number;
  permanence: Permanence;
  leaveCondition?: string;
  leaveRule?: LeaveRule;
  sourceGroupIds: string[];
  memberIds: string[];
  equipmentText: string;
  trainingText: string;
  historyText: string;
  traits: string[];
  worked: boolean;
};

export type Force = {
  id: string;
  name: string;
  factionId: string | null;
  kind: ForceKind;
  locationId: string;
  hexId?: string;
  personIds: string[];
  stance: Stance;
  morale: number;
  condition: number;
  hidden: boolean;
  hiddenUntilWeek?: number;
  targetId?: string;
  ordersText: string;
  alive: boolean;
  supplyBread: number;
  strength: number;
};

export type Group = {
  id: string;
  name: string;
  locationId: string;
  placeId: string;
  kind: GroupKind;
  factionId: string | null;
  quality: "raw" | "militia" | "trained";
  wageGoldPerWeek: number;
  paidByStoreId?: string;
  notesText: string;
  recruitable: boolean;
  morale: number;
  condition: number;
  poolBread: number;
  poolGold: number;
};

export type Place = {
  id: string;
  locationId: string;
  name: string;
};

export type Location = {
  id: string;
  name: string;
  nameMeaning: string;
  kind: LocationKind;
  exchangeRate: number | null;
  links: string[];
  placeIds: string[];
};

export type Store = {
  id: string;
  locationId: string;
  controllerNpcId: string;
  bread: number;
  gold: number;
  breadCap: number;
};

export type MajorNpc = {
  id: string;
  name: string;
  factionId: string | null;
  locationId: string;
  placeId: string;
  role: string;
  hook: string;
  profileText: string;
  gold: number;
  bread: number;
  notesText: string;
  questIds: string[];
};

export type Faction = {
  id: string;
  name: string;
  leaderNpcId: string;
  memberIds: string[];
};

export type Disposition = {
  holderId: string;
  towardId: string;
  level: DispositionLevel;
  description: string;
  score: number;
};

export type TalkFlag = {
  npcOrGroupId: string;
  wantsToTalk: boolean;
  reason: string;
  checkedWeek: number;
};

export type LedgerEntry = {
  id: string;
  npcId: string;
  direction: "player_owes" | "npc_owes";
  amount: number;
  currency: Currency;
  dueWeek: number;
  interest: number;
  note: string;
  status: "open" | "paid" | "forgiven" | "overdue";
};

export type Quest = {
  id: string;
  giverId: string;
  eventId?: string;
  title: string;
  target: string;
  rewardGold: number;
  rewardBread: number;
  upfrontGold: number;
  upfrontPaid: boolean;
  termsText: string;
  deadlineWeek: number | null;
  status: "locked" | "offered" | "active" | "done" | "failed";
};

export type Hex = {
  id: string;
  wildernessId: string;
  neighbours: string[];
  searchedCount: number;
  contents: string[];
  found: string[];
  label: string;
};

export type UnitWiki = {
  key: string;
  strengths: string;
  weaknesses: string;
  counters: string;
  definedBy: "base" | "ai";
  wage: number;
};

export type Rumour = {
  id: string;
  text: string;
  week: number;
  tags: string[];
};

export type Good = {
  id: string;
  name: string;
  qty: number;
  valueGold: number;
};

export type Company = {
  name: string;
  origin: string;
  banner: { primary: string; secondary: string; sigil: string };
  captainName: string;
  captainBackground: string;
  gold: number;
  bread: number;
  units: Unit[];
  rumours: Rumour[];
  goods: Good[];
  forceId: string;
  hidden: boolean;
  ambushReady: boolean;
  sheltered: boolean;
  betrayed: boolean;
};

export type WorldEvent = {
  id: string;
  week: number;
  title: string;
  fallback: string;
  fired: boolean;
  resolvedBy?: string;
  notify: { who: string; message: string }[];
};

export type Sighting = {
  week: number;
  locationId: string;
  forceId: string;
  seenByGroupId: string;
  label: string;
};

export type GameEvent = {
  week: number;
  type: string;
  locationId?: string;
  significant: boolean;
  payload: Record<string, number | string | boolean>;
};

export type Achievement = {
  id: string;
  name: string;
  hidden: boolean;
  earnedWeek?: number;
};

export type BattleSide = {
  id: string;
  name: string;
  plan: string;
  units: {
    id: string;
    name: string;
    type: string;
    headcount: number;
    wounded: number;
    stance: Stance;
    morale: number;
    condition: number;
    traits: string[];
  }[];
};

export type BattleResult = {
  id: string;
  week: number;
  locationId: string;
  winner: "a" | "b" | "none";
  sideA: string;
  sideB: string;
  surprise: "none" | "ambush";
  units: {
    id: string;
    killed: number;
    wounded: number;
    moraleDelta: number;
    conditionDelta: number;
  }[];
  breadTaken: number;
  goldTaken: number;
  civiliansKilled: number;
  loot: { name: string; qty: number; valueGold: number }[];
  highlights: string[];
  narrative: string;
};

export type Volunteer = {
  id: string;
  groupId: string;
  count: number;
  skills: string;
  unitType: string;
  permanence: Permanence;
  conditionText?: string;
  leaveRule?: LeaveRule;
  wage: number;
  special?: { name: string; strengths: string; weaknesses: string; wage: number };
};

export type Cause = { label: string; gold: number; bread: number };

export type WeeklyReport = {
  week: number;
  gold: number;
  bread: number;
  goldDelta: number;
  breadDelta: number;
  causes: Cause[];
  unitDeltas: { unitId: string; name: string; headcount: number; morale: number; condition: number }[];
  markers: { locationId: string; kind: string; label: string }[];
  volunteers: Volunteer[];
  shifts: { holderId: string; from: DispositionLevel; to: DispositionLevel }[];
  story: string[];
  stores: { locationId: string; name: string; bread: number; cap: number }[];
};

export type Deal = {
  id: string;
  npcId: string;
  kind: "payment" | "quest" | "trade" | "loan" | "pardon";
  gold: number;
  bread: number;
  upfrontGold: number;
  dueWeek: number | null;
  note: string;
  questId?: string;
  status: "offered" | "accepted" | "declined";
};

export type ChatMessage = {
  id: string;
  who: string;
  role: "player" | "npc" | "qm";
  text: string;
};

export type PendingAction =
  | { kind: "recruit"; groupId: string; speech: string }
  | { kind: "train"; unitIds: string[]; drill: string; master: boolean }
  | { kind: "rest"; source: "own" | "requisition"; force: boolean }
  | { kind: "repair" }
  | { kind: "work"; job: "fields" | "merchant" | "guard-village" | "guard-city" }
  | { kind: "search"; hexId: string; lookingFor: string }
  | { kind: "hide" }
  | { kind: "fight"; forceId: string; plan: string }
  | { kind: "pillage"; locationId: string }
  | { kind: "refuge"; offer: string }
  | { kind: "ambush"; forceId: string; plan?: string }
  | { kind: "drink"; placeId: string; rumours: Rumour[] }
  | null;

export type Audit = {
  initialBread: number;
  initialGold: number;
  initialPeople: number;
  breadEaten: number;
  breadDestroyed: number;
};

export type GameState = {
  week: number;
  maxWeeks: number;
  moveUsed: boolean;
  actionUsed: boolean;
  locationId: string;
  seed: number;
  rng: number;
  lost: boolean;
  ended: boolean;
  phase: "title" | "create" | "play" | "chronicle";
  tutorial: number | null;
  company: Company;
  people: Person[];
  factions: Faction[];
  dispositions: Disposition[];
  talkFlags: TalkFlag[];
  forces: Force[];
  groups: Group[];
  locations: Location[];
  places: Place[];
  stores: Store[];
  npcs: MajorNpc[];
  worldEvents: WorldEvent[];
  sightings: Sighting[];
  ledger: LedgerEntry[];
  quests: Quest[];
  hexes: Hex[];
  wiki: UnitWiki[];
  battles: BattleResult[];
  achievements: Achievement[];
  events: GameEvent[];
  report: WeeklyReport | null;
  showReport: boolean;
  pendingAction: PendingAction;
  volunteers: Volunteer[];
  deals: Deal[];
  messages: ChatMessage[];
  audit: Audit;
  innLeft: number;
  creation: CreationDraft | null;
  seenPursuit: boolean;
  civilianKills: number;
  pillaged: boolean;
  wagesShort: boolean;
  jobs: string[];
  negotiatedEnd: boolean;
  stagedBattle?: BattleResult | null;
};

export type CreationDraft = {
  name: string;
  origin: string;
  origins: string[];
  primary: string;
  secondary: string;
  sigil: string;
  captainName: string;
  captainBackground: string;
  unitA: string;
  unitB: string;
};
