export const UNIT_TYPE_IDS = [
  "swordsmen",
  "spearmen",
  "archers",
  "light_cavalry",
  "heavy_cavalry",
  "berserkers",
  "bandit",
] as const;

export type UnitTypeId = (typeof UNIT_TYPE_IDS)[number];
export type BaseTypeId = "swordsmen" | "spearmen" | "archers";
export type SpecialTypeId = "light_cavalry" | "heavy_cavalry" | "berserkers";
export type WikiId = UnitTypeId | "ogres";

export const BASE_TYPES: BaseTypeId[] = ["swordsmen", "spearmen", "archers"];
export const SPECIAL_TYPES: SpecialTypeId[] = ["light_cavalry", "heavy_cavalry", "berserkers"];

export interface WikiEntry {
  id: WikiId;
  title: string;
  origin: string;
  start: [string, string, string];
  worth: string;
}

export const WIKI: Record<WikiId, WikiEntry> = {
  swordsmen: {
    id: "swordsmen",
    title: "Swordsmen",
    origin: "Swordsmen, raised from childhood to the sword and to standing in a rank.",
    start: [
      "They fight up close, shield to shield, and trust the man on their left.",
      "Steady in a line, and poor if asked to screen or to run a flank.",
      "A fair company of them beats a rabble, and suffers if horsemen get around them.",
    ],
    worth: "Reliable close fighters. Worth more than bandits man for man in a formed fight, and vulnerable on an open flank.",
  },
  spearmen: {
    id: "spearmen",
    title: "Spearmen",
    origin: "Spearmen, raised from childhood to the spear and to keeping their points dressed.",
    start: [
      "They fight in a hedge of points, best when the enemy comes at them.",
      "They hold ground and punish a charge. They are slow to take ground themselves.",
      "Horsemen think twice about their front. Archers, given time, hurt them.",
    ],
    worth: "The answer to a charge. Weak when they must advance under arrows or fight in broken trees.",
  },
  archers: {
    id: "archers",
    title: "Archers",
    origin: "Archers, raised from childhood to the bow and to shooting as a body.",
    start: [
      "They kill at a distance and want open sight and someone in front of them.",
      "Once an enemy is in among them they are light men with knives.",
      "A few volleys can break a raw band. A sudden rush, or armour, shrugs them off.",
    ],
    worth: "They decide a fight before it closes, and they lose it if the enemy does close.",
  },
  light_cavalry: {
    id: "light_cavalry",
    title: "Light cavalry",
    origin: "Light cavalry, raised from childhood in the saddle, scouting and harrying.",
    start: [
      "They screen, chase, and strike where a line is loose.",
      "They will not stand long against formed spears or heavy horse.",
      "In open country they decide who gets to choose the fight.",
    ],
    worth: "Holt's own riders. Fast and fragile. Trees and a set spear hedge waste them.",
  },
  heavy_cavalry: {
    id: "heavy_cavalry",
    title: "Heavy cavalry",
    origin: "Heavy cavalry, raised from childhood to the charge in armour.",
    start: [
      "They are a hammer. One good charge can wreck a foot line that is not set.",
      "They tire, and they are clumsy in trees, bog, and a tight village street.",
      "Against a prepared spear hedge they pay dearly for the ground they take.",
    ],
    worth: "The Mere's shock. Devastating in the open, blunted by forest and by spears that do not flinch.",
  },
  berserkers: {
    id: "berserkers",
    title: "Berserkers",
    origin: "Berserkers, raised from childhood to go first and to fight in a fury.",
    start: [
      "They close fast and frighten men who have not seen a charge like it.",
      "They do not hold a line, do not retreat in order, and do not listen once they are loose.",
      "A shock, not a company. If the first rush fails, steady spears kill them in heaps.",
    ],
    worth: "Ashmarch's frightful foot. They can break a raw or wavering band at once, and they die badly against men who hold.",
  },
  bandit: {
    id: "bandit",
    title: "Bandits",
    origin: "Bandits, not raised to any kingdom trade.",
    start: [
      "They know the trees, the paths, and when to refuse a fight.",
      "Poorly armed, weak man for man against trained soldiers, and quick to break.",
      "Dangerous to a small company that walks in careless, and unwilling to face a host that clearly outnumbers them.",
    ],
    worth: "Forest fighters, not soldiers. Weak in a stand-up fight. Experienced at noticing, hiding, and declining a battle they dislike.",
  },
  ogres: {
    id: "ogres",
    title: "Ogres",
    origin: "Ogres, huge things, not raised in any company.",
    start: [
      "They fight alone or in pairs. They do not keep rank.",
      "Slow, hard to kill, and stupid about a prepared hedge of spears.",
      "Arrows annoy them. A forest hides them until they are very close.",
    ],
    worth: "Not part of this year's work. A spear hedge can hold one. They are a bible entry so the chronicler can say what they are, and no more.",
  },
};

export function wikiText(id: WikiId): string {
  const entry = WIKI[id];
  return `${entry.title}\n${entry.origin}\n${entry.start.join("\n")}\n${entry.worth}`;
}

export function typeTitle(id: UnitTypeId): string {
  return WIKI[id].title;
}

export function isBaseType(id: UnitTypeId): id is BaseTypeId {
  return (BASE_TYPES as string[]).includes(id);
}

export function isSpecialType(id: UnitTypeId): id is SpecialTypeId {
  return (SPECIAL_TYPES as string[]).includes(id);
}
