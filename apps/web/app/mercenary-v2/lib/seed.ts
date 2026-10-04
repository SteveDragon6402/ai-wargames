import { CONFIG, UNIT_TYPES } from "./config";
import { breadNow, goldNow, peopleNow } from "./resources";
import type {
  Achievement,
  Company,
  CreationDraft,
  Force,
  GameState,
  Group,
  Hex,
  Location,
  MajorNpc,
  Person,
  Place,
  Store,
  Unit,
  UnitWiki,
} from "./types";

const ACHIEVEMENTS: Achievement[] = [
  { id: "first-muster", name: "First Muster", hidden: false },
  { id: "blooded", name: "Blooded", hidden: false },
  { id: "full-ranks", name: "Full Ranks", hidden: false },
  { id: "ten-banners", name: "Ten Banners", hidden: false },
  { id: "odd-company", name: "Odd Company", hidden: false },
  { id: "loose-tongues", name: "Loose Tongues", hidden: false },
  { id: "wolf-warden", name: "Wolf-Warden", hidden: false },
  { id: "found-them", name: "Found Them", hidden: false },
  { id: "thornwood-cleared", name: "Thornwood Cleared", hidden: false },
  { id: "thornback", name: "Thornback's Bane", hidden: false },
  { id: "silver-tongue", name: "Silver Tongue", hidden: false },
  { id: "ghost", name: "Ghost", hidden: true },
  { id: "shadows", name: "From the Shadows", hidden: true },
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

function place(id: string, locationId: string, name: string): Place {
  return { id, locationId, name };
}

function hexRing(wildernessId: string, prefix: string, labels: string[]): Hex[] {
  const ids = labels.map((_, index) => `${prefix}-${index}`);
  return labels.map((label, index) => {
    const neighbours =
      index === 0
        ? ids.slice(1)
        : [ids[0], ids[index === 1 ? 6 : index - 1], ids[index === 6 ? 1 : index + 1]];
    return {
      id: ids[index],
      wildernessId,
      neighbours,
      searchedCount: 0,
      contents: [],
      found: [],
      label,
    };
  });
}

function emptyUnit(slot: number): Unit {
  return {
    id: `unit-empty-${slot}`,
    slot,
    name: "",
    nameMeaning: "",
    type: "",
    headcount: 0,
    wounded: 0,
    stance: "holding",
    morale: 0,
    condition: 0,
    wageBreadPerDay: CONFIG.defaultWage,
    permanence: "permanent",
    sourceGroupIds: [],
    memberIds: [],
    equipmentText: "",
    trainingText: "",
    historyText: "",
    traits: [],
    worked: false,
  };
}

function starterUnit(slot: number, type: string, name: string, meaning: string): Unit {
  const wiki = UNIT_TYPES.find((item) => item.key === type) ?? UNIT_TYPES[0];
  return {
    ...emptyUnit(slot),
    id: `unit-${slot}-${type}`,
    name,
    nameMeaning: meaning,
    type,
    headcount: CONFIG.unitCap,
    stance: "holding",
    morale: 62,
    condition: 80,
    wageBreadPerDay: wiki.wage,
    equipmentText: type === "cavalry" ? "Lances and riding horses" : "Issue spears or blades, patched coats",
    trainingText: "Green, but they have drilled a week.",
    historyText: "Raised the morning the company was named.",
    traits: [],
    worked: true,
  };
}

function addPeople(
  people: Person[],
  groupId: string,
  count: number,
  breadEach: number,
  goldEach: number,
  dead = 0,
) {
  for (let index = 0; index < count; index += 1) {
    people.push({
      id: `${groupId}-${index + 1}`,
      groupId,
      alive: true,
      bread: breadEach,
      gold: goldEach,
    });
  }
  for (let index = 0; index < dead; index += 1) {
    people.push({
      id: `${groupId}-dead-${index + 1}`,
      groupId,
      alive: false,
      bread: breadEach,
      gold: goldEach,
    });
  }
}

export function blankCreation(rngNames: string[]): CreationDraft {
  return {
    name: "",
    origin: "",
    origins: rngNames,
    primary: "azure",
    secondary: "tenne",
    sigil: "sword",
    captainName: "",
    captainBackground: "Deserter",
    unitA: "spearmen",
    unitB: "swordsmen",
  };
}

export function createGame(options?: {
  seed?: number;
  company?: Partial<Pick<Company, "name" | "origin" | "banner" | "captainName" | "captainBackground">>;
  unitTypes?: [string, string];
  tutorial?: boolean;
}): GameState {
  const seed = options?.seed ?? 1;
  const unitTypes = options?.unitTypes ?? ["spearmen", "swordsmen"];
  const people: Person[] = [];
  addPeople(people, "cm-peasants", 160, 95, 3);
  addPeople(people, "cm-guards", 30, 95, 12);
  addPeople(people, "cm-nobles", 10, 160, 80);
  addPeople(people, "sf-peasants", 22, 95, 3);
  addPeople(people, "sf-guards", 3, 95, 12);
  addPeople(people, "tw-peasants", 22, 95, 3);
  addPeople(people, "tw-guards", 2, 95, 12, 1);
  addPeople(people, "lantern-brothers", 6, 120, 30);
  addPeople(people, "pack", 18, 0, 0);

  const groups: Group[] = [
    group("cm-peasants", "Crownmarket peasants", "crownmarket", "cm-square", "peasants", null, "raw", 0, true, 55, 70),
    group("cm-guards", "Crownmarket guards", "crownmarket", "cm-walls", "guards", "crown", "trained", 3, true, 65, 85, "crown-store"),
    group("cm-nobles", "Crownmarket nobles", "crownmarket", "cm-parliament", "nobles", "crown", "trained", 0, true, 60, 80),
    group("sf-peasants", "Salt Ferry peasants", "salt-ferry", "sf-square", "peasants", null, "raw", 0, true, 55, 70),
    group("sf-guards", "Salt Ferry guards", "salt-ferry", "sf-guard", "guards", null, "militia", 1, true, 50, 65, "salt-store"),
    group("tw-peasants", "Thornwick peasants", "thornwick", "tw-square", "peasants", null, "raw", 0, true, 48, 62),
    group("tw-guards", "Thornwick guards", "thornwick", "tw-guard", "guards", null, "militia", 1, true, 46, 60, "thorn-store"),
    group("lantern-brothers", "Lantern Brothers", "lantern", "lantern-sanctuary", "clergy", "lantern", "trained", 0, false, 70, 75),
    group("pack", "The Pack", "thornwood", "thornwood-hex", "bandits", "pack", "militia", 0, false, 58, 64),
  ];
  const pack = groups.find((item) => item.id === "pack");
  if (pack) {
    pack.poolBread = 250;
    pack.poolGold = 300;
  }

  const places: Place[] = [
    place("cm-square", "crownmarket", "Square"),
    place("cm-walls", "crownmarket", "Walls"),
    place("cm-parliament", "crownmarket", "Parliament"),
    place("cm-hall", "crownmarket", "Steward's Hall"),
    place("cm-barracks", "crownmarket", "Barracks"),
    place("cm-market", "crownmarket", "Market"),
    place("cm-loaf", "crownmarket", "The Last Loaf"),
    place("lantern-sanctuary", "lantern", "Sanctuary"),
    place("lantern-hall", "lantern", "Donation hall"),
    place("sf-square", "salt-ferry", "Square"),
    place("sf-guard", "salt-ferry", "Guard post"),
    place("sf-elder", "salt-ferry", "Elder's house"),
    place("sf-merchant", "salt-ferry", "Merchant"),
    place("sf-inn", "salt-ferry", "Ferry Inn"),
    place("tw-square", "thornwick", "Square"),
    place("tw-guard", "thornwick", "Guard post"),
    place("tw-reeve", "thornwick", "Reeve's house"),
    place("tw-merchant", "thornwick", "Merchant"),
    place("tw-inn", "thornwick", "Thorn & Tankard"),
    place("drowned-hex", "drowned", "The fen"),
    place("thornwood-hex", "thornwood", "The wood"),
  ];

  const locations: Location[] = [
    loc("crownmarket", "Crownmarket", "The king rents the stalls; everything has a price", "capital", 2, ["salt-ferry", "thornwick", "lantern"], ["cm-square", "cm-walls", "cm-parliament", "cm-hall", "cm-barracks", "cm-market", "cm-loaf"]),
    loc("lantern", "The Lantern House", "A flame unbroken for 200 years; pilgrims donate", "temple", 2.5, ["crownmarket"], ["lantern-sanctuary", "lantern-hall"]),
    loc("salt-ferry", "The Salt Ferry", "Taxes every river crossing", "village", 3, ["crownmarket", "drowned"], ["sf-square", "sf-guard", "sf-elder", "sf-merchant", "sf-inn"]),
    loc("thornwick", "Thornwick", "A farming town hemmed in by woods", "village", 3.5, ["crownmarket", "thornwood"], ["tw-square", "tw-guard", "tw-reeve", "tw-merchant", "tw-inn"]),
    loc("drowned", "The Drowned Fields", "Flooded farmland", "wilderness", null, ["salt-ferry"], ["drowned-hex"]),
    loc("thornwood", "Thornwood", "Oak, bramble, and a hidden camp", "wilderness", null, ["thornwick"], ["thornwood-hex"]),
  ];

  const stores: Store[] = [
    { id: "crown-store", locationId: "crownmarket", controllerNpcId: "aldous", bread: 7000, gold: 2000, breadCap: 7000 },
    { id: "salt-store", locationId: "salt-ferry", controllerNpcId: "doss", bread: 875, gold: 120, breadCap: 875 },
    { id: "thorn-store", locationId: "thornwick", controllerNpcId: "marta", bread: 580, gold: 120, breadCap: 900 },
    { id: "lantern-store", locationId: "lantern", controllerNpcId: "ysolde", bread: 300, gold: 600, breadCap: 300 },
  ];

  const npcs: MajorNpc[] = [
    npc("aldous", "Lord Steward Aldous Crane", "crown", "crownmarket", "cm-hall", "City leader", "Quietly lets the bandits be, to keep the villages dependent on the capital", "Rules in the king's name. Controls the civic granary.", 40, 80),
    npc("varrow", "Commander Ilse Varrow", "crown", "crownmarket", "cm-barracks", "Guard commander", "Short of men; resents every guard the company recruits", "Drills the city guard. Hates losing them.", 20, 40),
    npc("benet", "Benet Hollis", null, "crownmarket", "cm-market", "Grain merchant", "Has been buying up village bread cheap", "A stall the size of a barn, and a ledger to match.", 500, 200),
    npc("oskar", "Master-at-Arms Oskar Tull", null, "crownmarket", "cm-barracks", "Drill master", "Was the bandit chief's old sergeant", "Teaches named drills for gold.", 60, 30),
    npc("pell", "Pell", null, "crownmarket", "cm-loaf", "Tavernkeeper", "Sells rumours to anyone, both ways", "Hears everything said over ale.", 40, 20),
    npc("doss", "Elder Doss", null, "salt-ferry", "sf-elder", "Village elder", "Owes Benet more than he admits", "Collects the ferry toll and fears the fen.", 25, 40),
    npc("juna", "Juna", null, "salt-ferry", "sf-merchant", "Salvage merchant", "Smuggles through the Drowned Fields", "Buys pelts, hides, and sealed crates.", 70, 80),
    npc("marta", "Reeve Marta Hale", null, "thornwick", "tw-reeve", "Village reeve", "Her son ran off to join the bandits", "The morning after the raid, she is still counting the dead.", 15, 30),
    npc("fenn", "Fenn", null, "thornwick", "tw-merchant", "Bread seller", "Will sell to the bandits if they pay", "Cheap loaves, few questions.", 80, CONFIG.fennBread),
    npc("ysolde", "Mother Ysolde", "lantern", "lantern", "lantern-sanctuary", "Head of the temple", "Needs lamp oil the smugglers control", "The flame is hungry, and so are her pilgrims.", 20, 40),
    npc("corwin", "Corwin Ashgrave", "pack", "thornwood", "thornwood-hex", "Bandit chief", "Would rather be pardoned than fight", "A disgraced Crownmarket guard captain. Hidden with the camp.", 0, 0),
  ];

  const drowned = hexRing("drowned", "df", ["Heart fen", "North sluice", "Sheep track", "Drowned orchard", "Charcoal spit", "Reed maze", "Old ford"]);
  const thorn = hexRing("thornwood", "tw", ["Heart wood", "Brambles", "Woodcutter's ride", "Old charcoal camp", "Black pool", "Hunter's ridge", "East thicket"]);
  const camp = thorn.find((item) => item.id === "tw-3");
  if (camp) camp.contents = ["bandit_camp"];
  drowned[2].contents = ["wolf_sign"];
  drowned[4].contents = ["herbs"];
  thorn[1].contents = ["herbs"];
  thorn[5].contents = ["trail"];

  const units = Array.from({ length: CONFIG.slotCount }, (_, slot) => emptyUnit(slot));
  units[0] = starterUnit(0, unitTypes[0], "The Ash Pikes", "Named for the burned stakes still standing in Thornwick's square.");
  units[1] = starterUnit(1, unitTypes[1], "The Debtors", "The captain's old creditors, who took steel instead of payment.");

  const companyForce: Force = {
    id: "force-company",
    name: options?.company?.name || "The Company",
    factionId: null,
    kind: "company",
    locationId: "thornwick",
    personIds: [],
    stance: "holding",
    morale: 62,
    condition: 80,
    hidden: false,
    ordersText: "",
    alive: true,
    supplyBread: 0,
    strength: 20,
  };

  const campForce: Force = {
    id: "force-pack",
    name: "The Pack",
    factionId: "pack",
    kind: "camp",
    locationId: "thornwood",
    hexId: "tw-3",
    personIds: people.filter((person) => person.groupId === "pack").map((person) => person.id),
    stance: "holding",
    morale: 58,
    condition: 64,
    hidden: true,
    ordersText: "Hold the camp until the bread runs out.",
    alive: true,
    supplyBread: 0,
    strength: 18,
  };

  const wiki: UnitWiki[] = UNIT_TYPES.map((item) => ({
    key: item.key,
    strengths: item.strengths,
    weaknesses: item.weaknesses,
    counters: "",
    definedBy: "base",
    wage: item.wage,
  }));

  const company: Company = {
    name: options?.company?.name || "The Free Company",
    origin: options?.company?.origin || "Founded the morning after Thornwick burned, by soldiers who had nowhere else to be paid.",
    banner: options?.company?.banner ?? { primary: "azure", secondary: "tenne", sigil: "sword" },
    captainName: options?.company?.captainName || "Captain Reed",
    captainBackground: options?.company?.captainBackground || "Deserter",
    gold: CONFIG.startGold,
    bread: CONFIG.startBread,
    units,
    rumours: [],
    goods: [],
    forceId: companyForce.id,
    hidden: false,
    ambushReady: false,
    sheltered: false,
    betrayed: false,
  };

  const state: GameState = {
    week: 0,
    maxWeeks: CONFIG.maxWeeks,
    moveUsed: false,
    actionUsed: false,
    locationId: "thornwick",
    seed,
    rng: seed || 1,
    lost: false,
    ended: false,
    phase: "play",
    tutorial: options?.tutorial === false ? null : 0,
    company,
    people,
    factions: [
      { id: "crown", name: "The Crown", leaderNpcId: "aldous", memberIds: ["aldous", "varrow", "cm-guards"] },
      { id: "pack", name: "The Pack", leaderNpcId: "corwin", memberIds: ["corwin", "pack"] },
      { id: "lantern", name: "The Lantern House", leaderNpcId: "ysolde", memberIds: ["ysolde", "lantern-brothers"] },
    ],
    dispositions: [
      disp("marta", "company", "neutral", "An unproven company formed the morning after the raid. She needs swords more than she needs to trust them.", 15),
      disp("tw-peasants", "company", "neutral", "They watched the company arrive while the store was still smoking.", 5),
      disp("tw-guards", "company", "neutral", "Two of them left. They will take help.", 10),
      disp("fenn", "company", "neutral", "A customer is a customer.", 10),
      disp("pack", "company", "hostile", "Another armed band in their feeding ground.", -20),
      disp("tw-peasants", "pack", "hostile", "The Pack took a third of the store and killed a guard.", -60),
      disp("marta", "pack", "hostile", "They have her grain, and she fears they have her son.", -70),
      disp("aldous", "company", "neutral", "No one in the capital has heard of them.", 0),
      disp("crown", "company", "neutral", "The Crown has no opinion of an unnamed company.", 0),
      disp("ysolde", "company", "neutral", "Pilgrims pass. Soldiers are another matter.", 0),
      disp("lantern", "company", "neutral", "The temple has not been wronged.", 0),
      disp("doss", "company", "neutral", "Salt Ferry has not met them.", 0),
      disp("juna", "company", "neutral", "She buys from whoever comes out of the fen.", 5),
      disp("varrow", "company", "neutral", "Another company that will try to steal her guards.", -5),
      disp("benet", "company", "neutral", "Useful if they move grain. Dangerous if they don't.", 0),
      disp("oskar", "company", "neutral", "He will teach anyone who pays.", 5),
      disp("pell", "company", "neutral", "She will talk if they buy ale.", 5),
      disp("cm-peasants", "company", "neutral", "The square has not heard the name.", 0),
      disp("cm-guards", "company", "neutral", "City guards do not salute strangers.", 0),
      disp("cm-nobles", "company", "neutral", "Parliament has no business with them.", 0),
      disp("sf-peasants", "company", "neutral", "The ferry has its own worries.", 0),
      disp("sf-guards", "company", "neutral", "Three spears, and none of them offered yet.", 0),
      disp("corwin", "company", "neutral", "He has not seen their banner. He would rather a pardon than a fight.", -10),
      disp("lantern", "crown", "neutral", "Oil is short, and the sermons are getting sharper.", -15),
      disp("ysolde", "crown", "neutral", "She still says the prayers for the king. The words are thinning.", -20),
    ],
    talkFlags: [
      {
        npcOrGroupId: "marta",
        wantsToTalk: true,
        reason: "An unproven company has formed in town; the bandit problem stands.",
        checkedWeek: 0,
      },
    ],
    forces: [companyForce, campForce],
    groups,
    locations,
    places,
    stores,
    npcs,
    worldEvents: [
      {
        id: "week0-raid",
        week: 0,
        title: "Thornwick burns",
        fallback: "The Pack keeps raiding whenever its bread runs low.",
        fired: true,
        resolvedBy: "before play",
        notify: [{ who: "marta", message: "An unproven company has formed in town; the bandit problem stands. Do you want anything of them?" }],
      },
      {
        id: "wolves",
        week: 3,
        title: "Wolves at the Salt Ferry",
        fallback: "The sheep keep dying. The ferry goes hungry.",
        fired: false,
        notify: [{ who: "doss", message: "Wolves are taking the sheep. If this company has done anything at all, ask them to clear the ferry road." }],
      },
      {
        id: "thornback",
        week: 9,
        title: "Something in Thornwood",
        fallback: "The beast kills a peasant or two each week and makes the wood worse.",
        fired: false,
        notify: [{ who: "marta", message: "A woodcutter saw the Thornback by the old charcoal camp." }],
      },
      {
        id: "lantern-rebellion",
        week: 10,
        title: "The Lantern rebellion",
        fallback: "The Crown fights the militia with its own guards.",
        fired: false,
        notify: [
          { who: "aldous", message: "Put the rebellion down. Civic gold will pay." },
          { who: "ysolde", message: "If they are not your enemy, ask them to bring the Steward down." },
        ],
      },
    ],
    sightings: [],
    ledger: [],
    quests: [
      {
        id: "quest-camp",
        giverId: "marta",
        eventId: "week0-raid",
        title: "Clear the camp in Thornwood",
        target: "force-pack",
        rewardGold: 80,
        rewardBread: 0,
        upfrontGold: 0,
        upfrontPaid: false,
        termsText: "Break the Pack. Price open.",
        deadlineWeek: 12,
        status: "offered",
      },
      {
        id: "quest-wolves",
        giverId: "doss",
        eventId: "wolves",
        title: "Clear the wolves off the ferry road",
        target: "force-wolves",
        rewardGold: 40,
        rewardBread: 0,
        upfrontGold: 0,
        upfrontPaid: false,
        termsText: "Kill the pack. Pelts are yours.",
        deadlineWeek: 12,
        status: "locked",
      },
      {
        id: "quest-thornback",
        giverId: "marta",
        eventId: "thornback",
        title: "Kill the Thornback",
        target: "force-thornback",
        rewardGold: 0,
        rewardBread: 0,
        upfrontGold: 0,
        upfrontPaid: false,
        termsText: "The hide and tusks are the prize.",
        deadlineWeek: 12,
        status: "locked",
      },
      {
        id: "quest-crush",
        giverId: "aldous",
        eventId: "lantern-rebellion",
        title: "Crush the militia",
        target: "force-militia",
        rewardGold: 150,
        rewardBread: 0,
        upfrontGold: 0,
        upfrontPaid: false,
        termsText: "Paid from civic gold.",
        deadlineWeek: 12,
        status: "locked",
      },
      {
        id: "quest-oil",
        giverId: "ysolde",
        title: "Bring oil for the flame",
        target: "oil",
        rewardGold: 30,
        rewardBread: 0,
        upfrontGold: 0,
        upfrontPaid: false,
        termsText: "Lamp oil, from the fen smugglers or anywhere else.",
        deadlineWeek: 12,
        status: "offered",
      },
    ],
    hexes: [...drowned, ...thorn],
    wiki,
    battles: [],
    achievements: ACHIEVEMENTS,
    events: [
      {
        week: 0,
        type: "raid-before-play",
        locationId: "thornwick",
        significant: true,
        payload: { guardsDead: 1, storeLeft: 580 },
      },
    ],
    report: null,
    showReport: false,
    pendingAction: null,
    volunteers: [],
    deals: [],
    messages: [],
    audit: { initialBread: 0, initialGold: 0, initialPeople: 0, breadEaten: 0, breadDestroyed: 0 },
    innLeft: 0,
    creation: null,
    seenPursuit: false,
    civilianKills: 0,
    pillaged: false,
    wagesShort: false,
    jobs: [],
    negotiatedEnd: false,
  };

  state.audit.initialBread = breadNow(state);
  state.audit.initialGold = goldNow(state);
  state.audit.initialPeople = peopleNow(state);
  return state;
}

function group(
  id: string,
  name: string,
  locationId: string,
  placeId: string,
  kind: Group["kind"],
  factionId: string | null,
  quality: Group["quality"],
  wageGoldPerWeek: number,
  recruitable: boolean,
  morale: number,
  condition: number,
  paidByStoreId?: string,
): Group {
  return {
    id,
    name,
    locationId,
    placeId,
    kind,
    factionId,
    quality,
    wageGoldPerWeek,
    paidByStoreId,
    notesText: "",
    recruitable,
    morale,
    condition,
    poolBread: 0,
    poolGold: 0,
  };
}

function loc(
  id: string,
  name: string,
  nameMeaning: string,
  kind: Location["kind"],
  exchangeRate: number | null,
  links: string[],
  placeIds: string[],
): Location {
  return { id, name, nameMeaning, kind, exchangeRate, links, placeIds };
}

function npc(
  id: string,
  name: string,
  factionId: string | null,
  locationId: string,
  placeId: string,
  role: string,
  hook: string,
  profileText: string,
  gold: number,
  bread: number,
): MajorNpc {
  return {
    id,
    name,
    factionId,
    locationId,
    placeId,
    role,
    hook,
    profileText,
    gold,
    bread,
    notesText: "",
    questIds: [],
  };
}

function disp(holderId: string, towardId: string, level: "friendly" | "neutral" | "hostile", description: string, score: number) {
  return { holderId, towardId, level, description, score };
}

export function companyHeadcount(state: GameState): number {
  return state.company.units.reduce((sum, unit) => sum + unit.headcount, 0);
}
