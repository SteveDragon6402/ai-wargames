import type { EraId, Price, StationId } from "./types";

export type Row = [id: string, label: string, detail: string, points: Price];

export const ERA_ROWS: Row[] = [
  ["conciliator", "Jaehaerys's reign", "The age of the Conciliator. A long peace, and the name that sits closest to it.", 5],
  ["blackfyre", "The Blackfyre Rebellions", "The court still holds. The pretender's wars keep coming back.", 4],
  ["robert", "Robert's Rebellion", "One war, then a new king, and the dragon pulled down.", 3],
  ["dance", "The Dance of the Dragons", "Two queens, and dragons burning the useful with the unlucky.", 2],
  ["fivekings", "The War of the Five Kings", "The realm comes apart. Winter is coming.", 1],
];

export const ERA_CONTEXT: Record<EraId, { years: string; events: string; born: number; war: string }> = {
  conciliator: {
    years: "The birth year must be between 48 and 90 AC, during Jaehaerys's reign.",
    events:
      "The age of the Conciliator: the Doctrine of Exceptionalism, the kingsroad, Alysanne's progresses, the long peace, then the Great Council of 101. Drop this person into those years.",
    born: 72,
    war: "the peace of the Conciliator",
  },
  robert: {
    years: "The birth year must be between 270 and 282 AC.",
    events:
      "Robert's Rebellion: the Vale rises, the Trident, the Sack of King's Landing, the Tower of Joy, then a reign. Drop this person into those years.",
    born: 276,
    war: "Robert's war",
  },
  blackfyre: {
    years: "The birth year must be between 170 and 196 AC.",
    events:
      "The Blackfyre Rebellions, beginning with the Redgrass Field, and the wars that keep returning. Drop this person into those years.",
    born: 185,
    war: "the Blackfyre wars",
  },
  dance: {
    years: "The birth year must be between 105 and 129 AC.",
    events:
      "The Dance of the Dragons: the realm splits between Rhaenyra and Aegon, dragonfire, the Fishfeed, the Storming of the Dragonpit. Drop this person into those years.",
    born: 120,
    war: "the Dance",
  },
  fivekings: {
    years: "The birth year must be between 283 and 298 AC.",
    events:
      "The War of the Five Kings: the riverlands burn, the North marches, the shadow of the Red Wedding, winter coming. Drop this person into those years.",
    born: 290,
    war: "the war of five kings",
  },
};

const BORN_TO: Row[] = [
  ["great", "A great house", "The name that rules a kingdom.", 5],
  ["lesser", "A lesser house", "A hall, a name, and a greater house above you.", 4],
  ["knight", "A knight", "A sword, and no great name.", 3],
  ["trade", "A tradesman", "A craft, a shop, and coin.", 2],
  ["smallfolk", "Smallfolk", "No name the realm keeps.", 1],
];

export const STATIONS: Record<EraId, { prompt: string; rows: Row[] }> = {
  conciliator: { prompt: "Who were you born to?", rows: BORN_TO },
  blackfyre: { prompt: "Who were you born to?", rows: BORN_TO },
  robert: { prompt: "Who were you born to?", rows: BORN_TO },
  dance: { prompt: "Who were you born to?", rows: BORN_TO },
  fivekings: { prompt: "Who were you born to?", rows: BORN_TO },
};

export const GREAT_BLOOD: Record<EraId, Row[]> = {
  conciliator: [
    ["targaryen", "House Targaryen", "The Conciliator's own blood. The peace is theirs.", 5],
    ["baratheon", "House Baratheon", "The king's kin. Storm's End, and a name made by the dragon.", 4],
    ["lannister", "House Lannister", "The Rock, and the gold that pays for a long peace.", 3],
    ["tyrell", "House Tyrell", "Lords of the Reach, still growing into a crown they were given.", 2],
    ["stark", "House Stark", "Winterfell. Far from the court, and content to be.", 1],
  ],
  blackfyre: [
    ["targaryen", "House Targaryen", "The red dragon. The throne is still theirs.", 5],
    ["martell", "House Martell", "Dorne, unconquered, and free to refuse a pretender.", 4],
    ["stark", "House Stark", "The North. Far from the Redgrass, and hard to spend.", 3],
    ["tyrell", "House Tyrell", "The Reach. Knights, bread, and a side still to pick.", 2],
    ["blackfyre", "House Blackfyre", "The black dragon. A claim, and the losing wars.", 1],
  ],
  robert: [
    ["baratheon", "House Baratheon", "The rebellion is theirs. They take the throne.", 5],
    ["stark", "House Stark", "The alliance that wins, then goes home.", 4],
    ["arryn", "House Arryn", "They start it. Jon Arryn rules beside the new king.", 3],
    ["lannister", "House Lannister", "They come late, sack the city, and marry the throne.", 2],
    ["targaryen", "House Targaryen", "The dynasty pulled down.", 1],
  ],
  dance: [
    ["targaryen", "House Targaryen", "Both queens are dragons. The war is the family.", 5],
    ["velaryon", "House Velaryon", "The sea, the fleet, and the blood closest to the throne.", 4],
    ["hightower", "House Hightower", "Oldtown, the beacon, and a king they helped crown.", 3],
    ["stark", "House Stark", "The North. Late, and far from the dragonpit.", 2],
    ["lannister", "House Lannister", "The Rock sits the war out, and is lesser for it.", 1],
  ],
  fivekings: [
    ["lannister", "House Lannister", "The throne, the gold, and the city.", 5],
    ["tyrell", "House Tyrell", "The Reach, the bread, and the alliance that feeds the throne.", 4],
    ["baratheon", "House Baratheon", "Three brothers, one name, and the storm split.", 3],
    ["martell", "House Martell", "Dorne waits, and Dorne does not forget.", 2],
    ["stark", "House Stark", "The North marches, and the war grinds the name down.", 1],
  ],
};

function creed(
  words: [string, string],
  admired: [string, string],
  working: [string, string],
  hard: [string, string],
  twist: [string, string],
): Row[] {
  return [
    ["words", words[0], words[1], 5],
    ["admired", admired[0], admired[1], 4],
    ["working", working[0], working[1], 3],
    ["hard", hard[0], hard[1], 2],
    ["twist", twist[0], twist[1], 1],
  ];
}

export const BENT: Record<string, Row[]> = {
  targaryen: creed(
    ["Fire and Blood", "The words, said straight."],
    ["The blood of the dragon", "The saying people still admire."],
    ["A dragon is owed a throne", "The working version."],
    ["Kin before the realm", "The hard version."],
    ["Madness", "The coin that lands on the wrong side."],
  ),
  baratheon: creed(
    ["Ours Is the Fury", "The words, said straight."],
    ["The storm does not bend", "The saying people still admire."],
    ["Hold what you were given", "The working version."],
    ["The loudest claim", "The hard version."],
    ["Fury with nothing under it", "Brothers, and a name that eats itself."],
  ),
  lannister: creed(
    ["Hear Me Roar", "The words, said straight."],
    ["A Lannister always pays his debts", "The saying people actually repeat."],
    ["Gold is how the Rock speaks", "The working version."],
    ["The house before the person", "The hard version."],
    ["Power above all", "The debt paid in blood. The Rains of Castamere."],
  ),
  stark: creed(
    ["Winter Is Coming", "The words, said straight."],
    ["The man who passes the sentence swings the sword", "The saying the North admires."],
    ["The North remembers", "The working version."],
    ["The pack survives", "The hard version."],
    ["Unyielding", "The law kept past the point it saves anyone."],
  ),
  arryn: creed(
    ["As High as Honor", "The words, said straight."],
    ["The gate holds", "The saying the Vale admires."],
    ["Honor is the price of the mountain", "The working version."],
    ["What happens below is not our war", "The hard version."],
    ["Honor as a locked door", "The Vale will not come down."],
  ),
  martell: creed(
    ["Unbowed, Unbent, Unbroken", "The words, said straight."],
    ["Dorne remembers", "The saying people still admire."],
    ["The spear, and the wait", "The working version."],
    ["We do not hurry, and we do not forget", "The hard version."],
    ["Pride, and the children pay", "Unbroken until it is only the grudge."],
  ),
  tyrell: creed(
    ["Growing Strong", "The words, said straight."],
    ["The rose outlasts the sword", "The saying the Reach admires."],
    ["Courtesy is how the Reach wins", "The working version."],
    ["We wait, and we do not lose", "The hard version."],
    ["We grow on other people's wars", "A smile, and the harvest of someone else's dead."],
  ),
  velaryon: creed(
    ["The Old, the True, the Brave", "The words, said straight."],
    ["The sea keeps its own", "The saying Driftmark admires."],
    ["A hull outlasts a claim", "The working version."],
    ["Salt before the court", "The hard version."],
    ["Sold to the nearest dragon", "The tide owes no one."],
  ),
  hightower: creed(
    ["We Light the Way", "The words, said straight."],
    ["The beacon before the sword", "The saying Oldtown admires."],
    ["Oldtown knows", "The working version. Knowledge is the power."],
    ["The Starry Sept judges kings", "The hard version."],
    ["We light the way for the winner", "The beacon turns."],
  ),
  blackfyre: creed(
    ["Fire and Blood", "The words they claim."],
    ["The sword names the true king", "The saying the rebels admire."],
    ["A dragon can be chosen", "The working version."],
    ["The red grass will pay", "The hard version."],
    ["A black dragon is still a lie", "The name that loses."],
  ),
  manderly: creed(
    ["True to the wolf", "No words are recorded. This is the line the house lives."],
    ["White Harbor keeps its own", "A city, and a pride the North rarely has."],
    ["Coin, and a city", "The working version."],
    ["We smile, and we remember", "The hard version."],
    ["The feast, and the knife under it", "Courtesy with a debt still open."],
  ),
  royce: creed(
    ["We Remember", "The words, said straight."],
    ["Bronze outlasts steel", "The saying the Vale admires."],
    ["The gate is the work", "The working version."],
    ["We remember every slight", "The hard version."],
    ["We remember, and we do not come", "Memory as a reason to stay behind the gate."],
  ),
  frey: creed(
    ["We hold the crossing", "No words are recorded. The bridge is the claim."],
    ["The toll is the law", "The saying travelers learn."],
    ["A bridge outlasts a vow", "The working version."],
    ["We wait until a king needs us", "The hard version."],
    ["The guest right, sold", "The crossing, and the betrayal it can buy."],
  ),
  bolton: creed(
    ["Our Blades Are Sharp", "The words, said straight."],
    ["Fear keeps a promise", "The saying the North believes."],
    ["The Dreadfort does not ask", "The working version."],
    ["A guest is a thing you can use", "The hard version."],
    ["The knife, and nothing else", "A house that is only the flaying."],
  ),
  reed: creed(
    ["We keep the Neck", "No words are recorded. The bog is the claim."],
    ["The bog does not give up its own", "The saying their friends trust."],
    ["Quiet, and the old gods", "The working version."],
    ["We do not march when we can hide", "The hard version."],
    ["We vanish, and call it loyalty", "A friend no one can find."],
  ),
  mallister: creed(
    ["Above the Rest", "The words, said straight."],
    ["The eagle sees the river first", "The saying Seagard likes."],
    ["Seagard holds the coast", "The working version."],
    ["We do not share the honor", "The hard version."],
    ["Above the rest, and late", "Pride that arrives after the fight."],
  ),
  dustin: creed(
    ["The barrows are ours", "No words are recorded. The graves are the claim."],
    ["We ride when the North rides", "The saying their riders keep."],
    ["Horses, and the winter town", "The working version."],
    ["We remember who left our dead", "The hard version."],
    ["A grudge against the lord who did not bring them home", "Barrowton, and the empty graves."],
  ),
  connington: creed(
    ["Griffin's Roost holds", "No words are recorded. The roost is the claim."],
    ["The stormlands know the griffin", "The saying their neighbors grant."],
    ["We stand where the king points", "The working version."],
    ["Pride before the safer door", "The hard version."],
    ["The roost, burned for a lost king", "Loyalty that costs the house the house."],
  ),
  darry: creed(
    ["We keep the king we swore", "No words are recorded. The oath is the claim."],
    ["Loyal, and close to the Trident", "The saying the crown used."],
    ["A river house of the crown", "The working version."],
    ["We do not change kings", "The hard version."],
    ["Loyalty that guts the house", "The oath kept, and the keep lost."],
  ),
  blackwood: creed(
    ["We keep the weirwood", "No words are recorded. The tree is the claim."],
    ["Raventree does not forget", "The saying their friends trust."],
    ["The river feud is the work", "The working version."],
    ["We do not yield the tree", "The hard version."],
    ["The feud, past any war that matters", "Bracken first. The realm second."],
  ),
  bracken: creed(
    ["Stone Hedge stands", "No words are recorded. The hedge is the claim."],
    ["The horse before the raven", "The saying they prefer to the Blackwoods."],
    ["The river feud is the work", "The working version."],
    ["We do not yield the field", "The hard version."],
    ["The feud, and nothing else", "Blackwood first. The realm second."],
  ),
  celtigar: creed(
    ["We keep what the sea gives", "No words are recorded. The hoard is the claim."],
    ["Close to the dragon, and still our own", "The saying Claw Isle likes."],
    ["Treasure, counted", "The working version."],
    ["We do not sail the war ourselves", "The hard version."],
    ["A hoard, and no courage", "Rich, and absent when the dragon calls."],
  ),
  darklyn: creed(
    ["Duskendale holds", "No words are recorded. The port is the claim."],
    ["A port, and a king nearby", "The saying the town likes."],
    ["Tolls, and ships", "The working version."],
    ["We want a city, not a town", "The hard version."],
    ["A defiance that burns the town", "The wish to be more, and the fire it buys."],
  ),
  reyne: creed(
    ["Castamere stands", "No words are recorded. The mines are the claim."],
    ["Rich enough to answer the Rock", "The saying they wanted believed."],
    ["The mines, and the pride", "The working version."],
    ["We do not bow to Casterly Rock", "The hard version."],
    ["A lion the Rock drowns", "Pride, then the rain."],
  ),
  yronwood: creed(
    ["We Guard the Way", "The words, said straight."],
    ["The Bloodroyal does not bow first", "The saying the Boneway keeps."],
    ["The Boneway is ours", "The working version."],
    ["We remember princes who forgot us", "The hard version."],
    ["We guard the way against our own prince", "Dorne's second house, first in its own mouth."],
  ),
  peake: creed(
    ["Three castles", "No words are recorded. The count is the claim."],
    ["The marches know our name", "The saying they spend."],
    ["A friend to whoever promises land", "The working version."],
    ["We pick the dragon that pays", "The hard version."],
    ["Three castles, and a lost war", "Ambition with the wrong banner."],
  ),
  butterwell: creed(
    ["Whitewalls keeps a feast", "No words are recorded. The wedding is the claim."],
    ["A rich feast is a kind of power", "The saying their guests allow."],
    ["We host, and we do not fight", "The working version."],
    ["We pick the guest who is winning", "The hard version."],
    ["A feast for a king who is not coming", "The hall dressed for a lost cause."],
  ),
  osgrey: creed(
    ["Standfast remembers when we were more", "No words are recorded. The memory is the claim."],
    ["A tower, a wood, and a name", "The saying that still flatters them."],
    ["We keep what is left", "The working version."],
    ["We do not forget the castles we lost", "The hard version."],
    ["A faded name, still picking fights", "Pride, and a wood, and nothing else."],
  ),
  redwyne: creed(
    ["The Arbor stands", "No words are recorded. The vines are the claim."],
    ["The fleet, and the wine", "The saying the Reach grants them."],
    ["Ships before swords", "The working version."],
    ["We do not spend the fleet for a courtesy", "The hard version."],
    ["Wine, and a fleet that stays home", "Rich water, and no sail when the war asks."],
  ),
};

export const GREAT_PLACE: Row[] = [
  ["heir", "Heir to the house", "The seat, if you live.", 5],
  ["spare", "Spare to the house", "The second. Close to the seat, and the first to be spent.", 4],
  ["nephew", "Nephew to the lord", "Of the lord. Of the king, if the house sits the throne.", 3],
  ["distant", "A distant relative", "The name, without the promise.", 2],
  ["bastard", "A bastard", "The blood, and none of the rights.", 1],
];

export const GREAT_RAISED: Row[] = [
  ["rule", "Raised to rule", "Courts, judgments, and the expectation of the seat.", 5],
  ["sword", "Raised by the sword", "The yard, the horse, and a command.", 4],
  ["coin", "Raised by numbers and by coin", "The accounts, the marriages, the cost of the house.", 3],
  ["study", "Raised for study", "Books, ravens, and a maester's kind of mind.", 2],
  ["indulgent", "Raised indulgent, nothing special", "Kept, praised, and taught no work.", 1],
];

export const GREAT_CAN: Row[] = [
  ["court", "Hold a court", "You can sit the hall and be obeyed.", 5],
  ["fight", "Fight", "You can hold a sword in a real press.", 4],
  ["accounts", "Keep the accounts", "You can say what the house can spend.", 3],
  ["read", "Read, and remember", "You can use a book and a raven.", 2],
  ["little", "Very little", "You have been kept from the work.", 1],
];

export const LESSER_HOUSES: Record<EraId, Row[]> = {
  conciliator: [
    ["hightower", "House Hightower of Oldtown", "The city, the Citadel, the Starry Sept.", 5],
    ["redwyne", "House Redwyne of the Arbor", "The fleet, and the wine.", 4],
    ["royce", "House Royce of Runestone", "Bronze, and the gate.", 3],
    ["blackwood", "House Blackwood of Raventree", "An old river name, and the weirwood.", 2],
    ["reed", "House Reed of the Neck", "The bog. Small, and hidden.", 1],
  ],
  blackfyre: [
    ["reyne", "House Reyne of Castamere", "Mines, pride, and almost a great house.", 5],
    ["yronwood", "House Yronwood", "The Bloodroyal. The greatest house in Dorne after the prince.", 4],
    ["peake", "House Peake", "Three castles in the marches.", 3],
    ["butterwell", "House Butterwell of Whitewalls", "A rich hall, and a feast for a claim.", 2],
    ["osgrey", "House Osgrey of Standfast", "A tower, a wood, and a faded name.", 1],
  ],
  robert: [
    ["royce", "House Royce of Runestone", "Bronze kings once. The gate is still theirs.", 5],
    ["mallister", "House Mallister of Seagard", "A proud coast, and a name the river respects.", 4],
    ["connington", "House Connington of Griffin's Roost", "A lord's house in the stormlands.", 3],
    ["dustin", "House Dustin of Barrowton", "Horses, barrows, and a northern town.", 2],
    ["darry", "House Darry", "A river house of the crown. Smaller than the names above.", 1],
  ],
  dance: [
    ["manderly", "House Manderly of White Harbor", "The only city in the North.", 5],
    ["blackwood", "House Blackwood of Raventree", "An old line, and a weirwood.", 4],
    ["bracken", "House Bracken of Stone Hedge", "A large river house, and the old feud.", 3],
    ["celtigar", "House Celtigar of Claw Isle", "Close to the dragons, and small.", 2],
    ["darklyn", "House Darklyn of Duskendale", "A port in the crownlands. A town, not a city.", 1],
  ],
  fivekings: [
    ["manderly", "House Manderly of White Harbor", "A city, silver, and the richest of these.", 5],
    ["royce", "House Royce of Runestone", "Ancient, and the gate of the Vale.", 4],
    ["frey", "House Frey of the Twins", "The crossing, and more swords than their blood deserves.", 3],
    ["bolton", "House Bolton of the Dreadfort", "Old, feared, and smaller than the city and the gate.", 2],
    ["reed", "House Reed of the Neck", "The crannogmen. Few, and hidden.", 1],
  ],
};

export const LESSER_CAN: Row[] = [
  ["speak", "Speak for the house", "The hall listens when you stand.", 5],
  ["fight", "Fight", "You can hold a sword for the house.", 4],
  ["books", "Keep the books", "You can say what the hall can spend.", 3],
  ["read", "Read", "You can use a letter and a raven.", 2],
  ["little", "Very little", "You have been kept from the work.", 1],
];

export const KNIGHT_WHERE: Record<EraId, Row[]> = {
  conciliator: [
    ["crownlands", "The crownlands", "The king's peace is the life.", 5],
    ["reach", "The Reach", "Knights, bread, and a court that likes both.", 4],
    ["stormlands", "The stormlands", "The king's own country.", 3],
    ["vale", "The Vale", "Honor, and a long way from the court.", 2],
    ["north", "The North", "Few knights, and far from the Conciliator.", 1],
  ],
  blackfyre: [
    ["crownlands", "The crownlands", "The red dragon's court still holds.", 5],
    ["reach", "The Reach", "Knights, and a side still worth having.", 4],
    ["dorne", "Dorne", "Unconquered, and able to refuse.", 3],
    ["vale", "The Vale", "Behind the gate, and out of the Redgrass.", 2],
    ["riverlands", "The riverlands", "The field where the black dragon loses.", 1],
  ],
  robert: [
    ["stormlands", "The stormlands", "Robert's country.", 5],
    ["vale", "The Vale", "Where the rebellion starts.", 4],
    ["north", "The North", "The riders who win, then go home.", 3],
    ["westerlands", "The Westerlands", "They come late, and they come rich.", 2],
    ["crownlands", "The crownlands", "The city that is sacked.", 1],
  ],
  dance: [
    ["reach", "The Reach", "The country of knights, and still rich.", 5],
    ["vale", "The Vale", "The gate, and no dragon overhead.", 4],
    ["stormlands", "The stormlands", "A king's country, and a battle coming.", 3],
    ["riverlands", "The riverlands", "The Fishfeed is here.", 2],
    ["crownlands", "The crownlands", "The dragonpit, and the fire.", 1],
  ],
  fivekings: [
    ["westerlands", "The Westerlands", "The lion's country, and the gold.", 5],
    ["reach", "The Reach", "Knights, bread, and the winning alliance.", 4],
    ["stormlands", "The stormlands", "A name split across three brothers.", 3],
    ["dorne", "Dorne", "Waiting, and not yet burned.", 2],
    ["riverlands", "The riverlands", "The war lives here.", 1],
  ],
};

export const KNIGHT_BESIDE: Row[] = [
  ["landed", "A landed knight, with a tower and a village", "The best life a sword without a great name gets.", 5],
  ["great", "Sworn sword of a great house", "Close to the name that rules.", 4],
  ["lesser", "Sworn sword of a lesser house", "A hall, a wage, and a smaller war.", 3],
  ["hedge", "A hedge knight men know", "A name on the road, and no roof.", 2],
  ["name", "A knight in nothing but the word", "The vow, and nothing under it.", 1],
];

export const KNIGHT_RAISED: Row[] = [
  ["tower", "Raised to hold a tower", "A small rule, and the people under it.", 5],
  ["sword", "Raised by the sword", "The yard, from the time you could lift one.", 4],
  ["pay", "Raised on ransom and pay", "What a sword is worth, and who can pay it.", 3],
  ["letters", "Raised on letters", "Enough to read a command and a debt.", 2],
  ["soft", "Raised soft, and taught nothing of war", "Kept, and not made into a knight.", 1],
];

export const KNIGHT_BENT: Row[] = creed(
  ["Brave, just, and defend the innocent", "The vows, said straight."],
  ["A knight's word, once given", "The saying men still admire."],
  ["Service to the one who armed you", "The working version."],
  ["The lance is the whole of it", "The hard version."],
  ["A cloak over a killer", "The vows as a license."],
);

export const KNIGHT_CAN: Row[] = [
  ["command", "Command a few men", "They will ride where you point.", 5],
  ["fight", "Fight", "You can hold a press.", 4],
  ["ransom", "Ransom, and pay", "You know what a life is worth in coin.", 3],
  ["letter", "Read a letter", "A command, a debt, a name.", 2],
  ["ride", "Ride, and little else", "A horse, and no trade of war.", 1],
];

export const TRADE_CRAFT: Row[] = [
  ["gold", "A goldsmith and a changer", "Coin, and the people who need it counted.", 5],
  ["factor", "A factor, with ships", "Other people's goods, and a share.", 4],
  ["armorer", "An armorer", "Swords, mail, and lords who pay.", 3],
  ["mason", "A mason", "Stone, and a wage when someone is building.", 2],
  ["baker", "A baker", "Bread. Needed, and never rich.", 1],
];

export const TRADE_TOWN: Record<EraId, Row[]> = {
  conciliator: [
    ["kingslanding", "King's Landing", "The peace is building it.", 5],
    ["oldtown", "Oldtown", "Already a city. The Faith, the Citadel, the port.", 4],
    ["lannisport", "Lannisport", "The Rock's gold, one gate away.", 3],
    ["whiteharbor", "White Harbor", "The North's only city.", 2],
    ["market", "A market town", "A road, and no walls that matter.", 1],
  ],
  blackfyre: [
    ["kingslanding", "King's Landing", "The court holds. The trade holds with it.", 5],
    ["oldtown", "Oldtown", "Far from the Redgrass, and rich.", 4],
    ["lannisport", "Lannisport", "Gold, and a lion who is not yet at war with his own.", 3],
    ["whiteharbor", "White Harbor", "Far, and quiet.", 2],
    ["market", "A market town on the army's road", "The wars use this road.", 1],
  ],
  robert: [
    ["lannisport", "Lannisport", "The west comes out of the war rich.", 5],
    ["oldtown", "Oldtown", "Untouched, and still the richest city.", 4],
    ["whiteharbor", "White Harbor", "Far from the sack.", 3],
    ["market", "A market town on a quiet road", "Small, and missed by the armies.", 2],
    ["kingslanding", "King's Landing", "The city that is sacked.", 1],
  ],
  dance: [
    ["oldtown", "Oldtown", "The Hightower, and no dragonpit.", 5],
    ["whiteharbor", "White Harbor", "Far north of the fire.", 4],
    ["lannisport", "Lannisport", "The Rock sits the war out.", 3],
    ["market", "A market town", "Small enough to be beneath notice.", 2],
    ["kingslanding", "King's Landing", "The pit, and the fire.", 1],
  ],
  fivekings: [
    ["lannisport", "Lannisport", "The lion's gold, behind the west.", 5],
    ["oldtown", "Oldtown", "Rich, and not yet the battlefield.", 4],
    ["whiteharbor", "White Harbor", "A city the war has not reached.", 3],
    ["kingslanding", "King's Landing", "The throne's city. Hungry, and afraid.", 2],
    ["market", "A market town in the riverlands", "The war lives on this road.", 1],
  ],
};

export const TRADE_BENCH: Row[] = [
  ["inherit", "You will inherit the shop", "The bench, the name, and the custom.", 5],
  ["skilled", "A skilled child, still of the shop", "The work is yours. The shop is not, yet.", 4],
  ["apprentice", "Apprenticed to a good master", "A place, and no blood claim.", 3],
  ["rough", "Kept for the rough work", "Hands, and no secret of the craft.", 2],
  ["unclaimed", "The shop does not claim you", "You sleep there. It is not yours.", 1],
];

export const TRADE_RAISED: Row[] = [
  ["own", "Raised to own the shop", "Custom, price, and the name over the door.", 5],
  ["bench", "Raised at the bench", "The hands, from the time you could hold a tool.", 4],
  ["accounts", "Raised on the accounts", "What is owed, and what can be spent.", 3],
  ["letters", "Raised for letters", "Enough to read a contract. Not enough to love the work.", 2],
  ["indulgent", "Raised indulgent, away from the work", "Kept, and not made into the craft.", 1],
];

export const TRADE_BENT: Row[] = creed(
  ["The work, done right", "The creed of the bench, said straight."],
  ["A fair price, paid", "The saying a good shop is known by."],
  ["The shop before the person", "The working version."],
  ["Coin above the work", "The hard version."],
  ["The measure, thumbed", "A cheat, and a name that will not survive it."],
);

export function folkLand(war: string): Row[] {
  return [
    ["great", "A great house's village", "The strongest roof a person without a name can stand under.", 5],
    ["lesser", "A lesser house's village", "A hall that knows your face.", 4],
    ["knight", "A landed knight's village", "A tower, a ditch, and a lord who is not far.", 3],
    ["free", "A freehold", "No lord's bread. No lord's wall.", 2],
    ["edges", "The edges", `No one keeps you when ${war} arrives.`, 1],
  ];
}

export const FOLK_WORK: Row[] = [
  ["croft", "A croft that feeds the house", "The best living this station gets.", 5],
  ["boat", "A boat", "Fish, and a winter that depends on the water.", 4],
  ["flock", "A flock", "Wool, and a living that moves.", 3],
  ["mine", "A mine", "Wages under the ground.", 2],
  ["day", "Day work, and nothing steady", "Hired when someone needs a back.", 1],
];

export const FOLK_RAISED: Row[] = [
  ["roof", "Raised to keep the roof", "The small rule of a house that is not a house.", 5],
  ["work", "Raised to the work", "Hands, weather, and a full day.", 4],
  ["stores", "Raised to mind the stores", "What is left, and what winter will take.", 3],
  ["prayers", "Raised on prayers", "The sept, or the heart tree, and little else.", 2],
  ["nothing", "Kept, and taught nothing", "A full bowl when there was one, and no skill.", 1],
];

export const FOLK_BENT: Row[] = creed(
  ["We keep our own", "The creed, said straight."],
  ["The gods of this place see us", "The saying people trust."],
  ["We pay what we owe", "The working version."],
  ["We endure", "The hard version."],
  ["We take what is left, and call it fair", "Hunger, with a clean story."],
);

export const FOLK_CAN: Row[] = [
  ["winter", "Keep a house through a winter", "People live because you planned.", 5],
  ["day", "Work a full day", "The labor is real.", 4],
  ["count", "Count a store", "You know what will last.", 3],
  ["prayers", "Say the prayers right", "The gods, and no other tool.", 2],
  ["little", "Very little", "You have not been taught a living.", 1],
];

export const CHIPS: Record<StationId, { want: string[]; hate: string[]; love: string[] }> = {
  great: {
    want: ["the seat", "your house to endure", "to be left alone", "a person", "the truth of that court"],
    hate: ["the cold", "being spent by your house", "liars", "a rival house", "being forgotten"],
    love: ["a sibling", "the old stories", "the yard at first light", "the gods of your house", "a quiet room"],
  },
  lesser: {
    want: ["the seat", "a greater lord's notice", "to be left alone", "a person", "your house to outlast its betters"],
    hate: ["the great house above you", "the cold", "being overlooked", "a debt", "war on your road"],
    love: ["the hall", "a sibling", "the country around the house", "a hawk or a hound", "the harvest"],
  },
  knight: {
    want: ["a keep", "a lord who keeps his word", "the road", "a name men repeat", "someone waiting"],
    hate: ["oathbreakers", "hunger", "a war that is not yours", "being unnamed", "the cold"],
    love: ["a horse", "the person who raised you", "a clean blade", "the road at morning", "one village"],
  },
  trade: {
    want: ["the shop", "enough coin", "to be left alone", "a person", "a life off the bench"],
    hate: ["debt", "a smashed shop", "lords", "hunger", "being cheated"],
    love: ["the work of your hands", "the town", "a person at the bench", "a good tool", "quiet custom"],
  },
  smallfolk: {
    want: ["a full winter", "to be left alone", "a person", "land no lord counts", "to get out"],
    hate: ["the cold", "lords", "hunger", "other men's wars", "being forgotten"],
    love: ["your people", "the land", "a sibling", "a dog", "the first warm day"],
  },
};
