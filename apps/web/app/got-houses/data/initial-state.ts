import type { Army, GameState } from "../types";

export const INITIAL_ARMIES: Army[] = [
  // ── Northern armies ────────────────────────────────────────────────────
  {
    id: "army-robb",
    name: "Robb Stark's Host",
    holdId: "01",
    faction: "north",
    leaders: [{ name: "Robb Stark", title: "Lord of Winterfell" }],
    units: [
      { house: "Stark", type: "cavalry", count: 1000 },
      { house: "Stark", type: "infantry", count: 2000 },
      { house: "Stark", type: "archers", count: 500 },
    ],
    morale: "High spirits — the men fight for their lord and home.",
    tiredness: "Well-rested and eager, fresh from Winterfell's walls.",
  },
  {
    id: "army-bolton",
    name: "Bolton Spearmen",
    holdId: "02",
    faction: "north",
    leaders: [{ name: "Roose Bolton", title: "Lord of the Dreadfort" }],
    units: [
      { house: "Bolton", type: "cavalry", count: 200 },
      { house: "Bolton", type: "infantry", count: 1500 },
    ],
    morale: "Cold and disciplined — loyalty to Bolton runs deep here.",
    tiredness: "Unhurried and well-provisioned.",
  },
  {
    id: "army-manderly",
    name: "Manderly Fleet-Guard",
    holdId: "03",
    faction: "north",
    leaders: [{ name: "Wyman Manderly", title: "Lord of White Harbor" }],
    units: [
      { house: "Manderly", type: "cavalry", count: 300 },
      { house: "Manderly", type: "infantry", count: 800 },
      { house: "Manderly", type: "archers", count: 400 },
    ],
    morale: "Confident and proud — the wealthiest lord in the North marches.",
    tiredness: "Fresh, well-fed, and well-equipped.",
  },
  {
    id: "army-greatjon",
    name: "Greatjon's Umbers",
    holdId: "05",
    faction: "north",
    leaders: [
      { name: "Jon Umber", title: "Lord of Last Hearth, 'the Greatjon'" },
    ],
    units: [
      { house: "Umber", type: "cavalry", count: 400 },
      { house: "Umber", type: "infantry", count: 1200 },
      { house: "Umber", type: "archers", count: 100 },
    ],
    morale: "Fierce and bellowing — the Greatjon's enthusiasm is contagious.",
    tiredness: "Rested but restless, itching for a fight.",
  },
  {
    id: "army-glover",
    name: "Glover's Wardens",
    holdId: "07",
    faction: "north",
    leaders: [{ name: "Galbart Glover", title: "Master of Deepwood Motte" }],
    units: [
      { house: "Glover", type: "cavalry", count: 100 },
      { house: "Glover", type: "infantry", count: 600 },
      { house: "Glover", type: "archers", count: 300 },
    ],
    morale: "Determined and steady — woodsmen and rangers bred for hard marching.",
    tiredness: "Fresh, having ridden south from Barrowton.",
  },

  // ── Westerlands armies ─────────────────────────────────────────────────
  {
    id: "army-tywin",
    name: "Tywin's Host",
    holdId: "23",
    faction: "westerlands",
    leaders: [{ name: "Tywin Lannister", title: "Lord of Casterly Rock, Hand of the King" }],
    units: [
      { house: "Lannister", type: "cavalry", count: 2000 },
      { house: "Lannister", type: "infantry", count: 5000 },
      { house: "Lannister", type: "archers", count: 1000 },
    ],
    morale: "Utterly assured — Tywin Lannister does not lose.",
    tiredness: "Well-rested and battle-ready, supplied from the Rock's deep vaults.",
  },
  {
    id: "army-jaime",
    name: "Jaime's Vanguard",
    holdId: "24",
    faction: "westerlands",
    leaders: [{ name: "Jaime Lannister", title: "Ser, the Kingslayer" }],
    units: [
      { house: "Lannister", type: "cavalry", count: 1500 },
      { house: "Lannister", type: "infantry", count: 2000 },
      { house: "Lannister", type: "archers", count: 500 },
    ],
    morale: "Swaggering confidence — their captain's reputation precedes them.",
    tiredness: "Fresh and sharp, eager to prove themselves.",
  },
];

export const INITIAL_GAME_STATE: GameState = {
  turn: 1,
  armies: INITIAL_ARMIES,
  selectedHoldId: null,
  selectedArmyIds: [],
  moveMode: { active: false, validTargets: [] },
  north: { orders: [], submitted: false },
  westerlands: { orders: [], submitted: false },
  adminMode: false,
  activeFaction: "north",
};
