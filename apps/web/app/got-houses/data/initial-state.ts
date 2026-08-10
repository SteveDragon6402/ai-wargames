import type { Army, ArmyActivity, GameState } from "../types";
import { buildInitialCharacters } from "./characters";
import { buildInitialHoldStates } from "../lib/hold-runtime";
import { reconcileSieges } from "../lib/siege";
import { syncCastellansWithSieges } from "../lib/castellan";

const FRESH_ACTIVITY: ArmyActivity = {
  turnsResting: 0,
  turnsFortiying: 0,
  turnsMarching: 0,
  turnsSinceMerge: null,
  turnsSinceSplit: null,
};


export const INITIAL_ARMIES: Army[] = [
  // ── Northern armies ────────────────────────────────────────────────────
  {
    id: "army-robb",
    name: "Robb Stark's Host",
    holdId: "08",
    faction: "north",
    leaders: [{ name: "Robb Stark", title: "Lord of Winterfell" }],
    notables: [
      { name: "Grey Wind", description: "Robb's direwolf — enormous, swift, and utterly fearless in battle." },
      { name: "Catelyn Tully", description: "Lady Stark; rides with the host as advisor and her son's conscience." },
      { name: "Theon Greyjoy", description: "Ward of Winterfell; archer and would-be ally of the Iron Islands." },
      { name: "Ser Rodrik Cassel", description: "Master-at-Arms of Winterfell; veteran knight and loyal guardian." },
    ],
    units: [
      { house: "Stark", type: "cavalry", count: 1000 },
      { house: "Stark", type: "infantry", count: 2000 },
      { house: "Stark", type: "archers", count: 500 },
    ],
    morale: "High spirits — the men fight for their lord and home.",
    tiredness: "Well-rested and eager, fresh from Winterfell's walls.",
    stance: "Disciplined and ready — a northern host assembled for war.",
    activity: { ...FRESH_ACTIVITY },
  },
  {
    id: "army-bolton",
    name: "Bolton Spearmen",
    holdId: "08",
    faction: "north",
    leaders: [{ name: "Roose Bolton", title: "Lord of the Dreadfort" }],
    notables: [
      { name: "Ramsay Snow", description: "Roose's bastard; a cruel and capable hunter who commands the Dreadfort's kennel-men." },
      { name: "Locke", description: "Bolton's finest tracker and enforcer — ruthless and efficient." },
    ],
    units: [
      { house: "Bolton", type: "cavalry", count: 200 },
      { house: "Bolton", type: "infantry", count: 1500 },
    ],
    morale: "Cold and disciplined — loyalty to Bolton runs deep here.",
    tiredness: "Unhurried and well-provisioned.",
    stance: "Watchful and methodical — Bolton men do not rush.",
    activity: { ...FRESH_ACTIVITY },
  },
  {
    id: "army-manderly",
    name: "Manderly Fleet-Guard",
    holdId: "08",
    faction: "north",
    leaders: [{ name: "Wyman Manderly", title: "Lord of White Harbor" }],
    notables: [
      { name: "Ser Wylis Manderly", description: "Wyman's heir; a capable if portly knight commanding the household guard." },
      { name: "Robett Glover", description: "Galbart's brother; present with the harbor forces as liaison to the Glovers." },
    ],
    units: [
      { house: "Manderly", type: "cavalry", count: 300 },
      { house: "Manderly", type: "infantry", count: 800 },
      { house: "Manderly", type: "archers", count: 400 },
    ],
    morale: "Confident and proud — the wealthiest lord in the North marches.",
    tiredness: "Fresh, well-fed, and well-equipped.",
    stance: "Steady and professional — well-drilled harbor soldiers.",
    activity: { ...FRESH_ACTIVITY },
  },
  {
    id: "army-greatjon",
    name: "Greatjon's Umbers",
    holdId: "08",
    faction: "north",
    leaders: [
      { name: "Jon Umber", title: "Lord of Last Hearth, 'the Greatjon'" },
    ],
    notables: [
      { name: "Smalljon Umber", description: "The Greatjon's son; nearly as large as his father and just as fierce." },
      { name: "Mors 'Crowfood' Umber", description: "The Greatjon's uncle; old, scarred, and not to be underestimated." },
    ],
    units: [
      { house: "Umber", type: "cavalry", count: 400 },
      { house: "Umber", type: "infantry", count: 1200 },
      { house: "Umber", type: "archers", count: 100 },
    ],
    morale: "Fierce and bellowing — the Greatjon's enthusiasm is contagious.",
    tiredness: "Rested but restless, itching for a fight.",
    stance: "Aggressive and eager — the Umbers want blood.",
    activity: { ...FRESH_ACTIVITY },
  },
  {
    id: "army-glover",
    name: "Glover's Wardens",
    holdId: "08",
    faction: "north",
    leaders: [{ name: "Galbart Glover", title: "Master of Deepwood Motte" }],
    notables: [
      { name: "Larence Snow", description: "Lord Hornwood's bastard; rides with the Glovers as a ward and scout." },
    ],
    units: [
      { house: "Glover", type: "cavalry", count: 100 },
      { house: "Glover", type: "infantry", count: 600 },
      { house: "Glover", type: "archers", count: 300 },
    ],
    morale: "Determined and steady — woodsmen and rangers bred for hard marching.",
    tiredness: "Fresh, having ridden south from Barrowton.",
    stance: "Light and mobile — rangers built for scouting and skirmish.",
    activity: { ...FRESH_ACTIVITY },
  },

  // ── Westerlands armies ─────────────────────────────────────────────────
  {
    id: "army-tywin",
    name: "Tywin's Host",
    holdId: "18",
    faction: "westerlands",
    leaders: [{ name: "Tywin Lannister", title: "Lord of Casterly Rock, Hand of the King" }],
    notables: [
      { name: "Ser Kevan Lannister", description: "Tywin's loyal brother and most trusted lieutenant; commands the infantry formations." },
      { name: "Ser Addam Marbrand", description: "Swift cavalry commander from Ashemark; Tywin's favoured outrider." },
      { name: "Ser Harys Swyft", description: "Father-in-law to Kevan; manages supply lines for the host." },
    ],
    units: [
      { house: "Lannister", type: "cavalry", count: 2000 },
      { house: "Lannister", type: "infantry", count: 5000 },
      { house: "Lannister", type: "archers", count: 1000 },
    ],
    morale: "Utterly assured — Tywin Lannister does not lose.",
    tiredness: "Well-rested and battle-ready, supplied from the Rock's deep vaults.",
    stance: "Immovable and methodical — Tywin forms his lines before he strikes.",
    activity: { ...FRESH_ACTIVITY },
  },
  {
    id: "army-jaime",
    name: "Jaime's Vanguard",
    holdId: "16",
    faction: "westerlands",
    leaders: [{ name: "Jaime Lannister", title: "Ser, the Kingslayer" }],
    notables: [
      { name: "Ser Ilyn Payne", description: "The King's Justice; mute and deadly, rides at Jaime's side." },
      { name: "Bronn", description: "A sellsword of remarkable skill; attached to the vanguard as Jaime's personal retainer." },
      { name: "Ser Balon Swann", description: "A knight of the Kingsguard assigned to the vanguard; honourable and capable." },
    ],
    units: [
      { house: "Lannister", type: "cavalry", count: 1500 },
      { house: "Lannister", type: "infantry", count: 2000 },
      { house: "Lannister", type: "archers", count: 500 },
    ],
    morale: "Swaggering confidence — their captain's reputation precedes them.",
    tiredness: "Fresh and sharp, eager to prove themselves.",
    stance: "Bold and aggressive — Jaime attacks before the enemy can set.",
    activity: { ...FRESH_ACTIVITY },
  },
];

/** Opening board: Jaime already investing North-held Riverrun. */
function buildOpeningBoard(): Pick<
  GameState,
  "holdStates" | "characters" | "factionEvents"
> {
  const baseHolds = buildInitialHoldStates();
  const baseChars = buildInitialCharacters();
  const siege = reconcileSieges(1, INITIAL_ARMIES, baseHolds);
  const synced = syncCastellansWithSieges(
    baseHolds,
    siege.holdStates,
    baseChars
  );
  return {
    holdStates: synced.holdStates,
    characters: synced.characters,
    factionEvents: siege.events,
  };
}

const OPENING = buildOpeningBoard();

export const INITIAL_GAME_STATE: GameState = {
  turn: 1,
  phase: "planning",
  armies: INITIAL_ARMIES,
  selectedHoldId: null,
  selectedArmyIds: [],
  moveMode: { active: false, validTargets: [] },
  north: { orders: [], stanceOrders: {}, stormArmyIds: [], sallyHoldIds: [], submitted: false },
  westerlands: { orders: [], stanceOrders: {}, stormArmyIds: [], sallyHoldIds: [], submitted: false },
  adminMode: true,
  activeFaction: "north",
  pendingBattles: [],
  battleReports: [],
  retreats: [],
  battleLogOpen: false,
  turnHistory: [],
  pendingRenames: [],
  voluntaryCommanderChange: null,
  splitPanelArmyId: null,
  characters: OPENING.characters,
  conversations: [],
  speechesThisTurn: [],
  speechArmyId: null,
  openConversationIds: [],
  talkPickerOpen: false,
  focusedConversationId: null,
  factionEvents: OPENING.factionEvents,
  adviceLog: [],
  holdStates: OPENING.holdStates,
  garrisonPanel: null,
};
