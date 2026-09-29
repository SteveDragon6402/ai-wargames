import type { EraId, Flavor, Price, StationId } from "./types";

export type Row = [id: string, label: string, detail: string, points: Price];

export const ERA_ROWS: Row[] = [
  ["robert", "Robert's Rebellion", "One war, then a realm that needs new men.", 5],
  ["heroes", "The Age of Heroes", "No law and long winters, but one life can found a house or a song that lasts three thousand years.", 4],
  ["blackfyre", "The Blackfyre Rebellions", "The wars keep coming, and a sword on the right field can still be given a keep.", 3],
  ["dance", "The Dance of the Dragons", "The board is already two queens. Dragons burn the useful and the unlucky alike.", 2],
  ["fivekings", "The War of the Five Kings", "Born into the collapse. Winter is coming, and most lives are ground down.", 1],
];

export const ERA_CONTEXT: Record<EraId, { years: string; events: string; born: number; war: string }> = {
  robert: {
    years: "The birth year must be between 270 and 282 AC.",
    events:
      "Robert's Rebellion: the Vale rises, the Trident, the Sack of King's Landing, the Tower of Joy, then a reign. Drop this person into those years.",
    born: 276,
    war: "Robert's war",
  },
  heroes: {
    years: "The birth year must be in the Age of Heroes, between 8000 and 6000 years before Aegon's Conquest. Use a negative number of years before the Conquest.",
    events:
      "The Age of Heroes: petty kings, long winters, no king's peace, and a life that can found a house or vanish. Drop this person into those years.",
    born: -7000,
    war: "the wars of the petty kings",
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

const STATION_PROMPT = "What were you born to?";

function stations(details: Record<StationId, [string, string]>, prompt = STATION_PROMPT): { prompt: string; rows: Row[] } {
  const order: [StationId, Price][] = [
    ["knight", 5],
    ["lesser", 4],
    ["great", 3],
    ["trade", 2],
    ["smallfolk", 1],
  ];
  return {
    prompt,
    rows: order.map(([id, points]): Row => [id, details[id][0], details[id][1], points]),
  };
}

export const STATIONS: Record<EraId, { prompt: string; rows: Row[] }> = {
  robert: stations({
    knight: ["A knight with no great name", "Other men's wars will look for you. Almost nothing about you is written yet."],
    lesser: ["A lesser house", "A name and a roof, and a life that is not already a lord paramount's."],
    great: ["A great house", "Shelter, and a fate mostly decided by the seat. This war will still reach the seat."],
    trade: ["A tradesman's house", "The shop survives more winters than a village does. The new court is not yours to climb."],
    smallfolk: ["Smallfolk", "The war passes through the country, and there is little between you and it."],
  }),
  heroes: stations(
    {
      knight: ["A sword with no king's name", "The kings are many and small. Your life is not written."],
      lesser: ["A petty king, or a clan with a tower", "A name the neighbors know. Not a name the next age must keep."],
      great: ["A line the songs will call great", "Shelter, if a wall can be shelter. The seat is already the story."],
      trade: ["A maker in a lord's shadow", "There are no guilds yet. There is the work, and whoever owns the hall."],
      smallfolk: ["People the songs will not keep", "Winter and petty kings arrive, and there is little between you and them."],
    },
    "What were you born to, in a world the songs have not finished naming?",
  ),
  blackfyre: stations({
    knight: ["A knight with no great name", "The rebellions hire swords. A life can still be made on one field."],
    lesser: ["A lesser house", "A roof, and a choice of banners that a great house pretends it does not have."],
    great: ["A great house", "The seat decides more of you than you do. The wars still come to the gate."],
    trade: ["A tradesman's house", "Camps need smiths and grain. They do not need you to have a future."],
    smallfolk: ["Smallfolk", "The fields where the rebellions are fought are someone's fields."],
  }),
  dance: stations({
    knight: ["A knight with no great name", "Dragons take sides. A sword without a banner can still be hired, or burned."],
    lesser: ["A lesser house", "You are useful to a queen and easy for a dragon to miss. Sometimes."],
    great: ["A great house", "The seat puts you on a side before you can speak."],
    trade: ["A tradesman's house", "A shop can feed a garrison. It cannot bargain with a dragon."],
    smallfolk: ["Smallfolk", "The dance is fought over your roads, and no one asks you."],
  }),
  fivekings: stations({
    knight: ["A knight with no great name", "Other men's wars will look for you. Almost nothing about your life is written yet."],
    lesser: ["A lesser house", "A name and a roof, and a life that is not already a lord paramount's."],
    great: ["A great house", "Shelter, and a fate mostly decided by the seat."],
    trade: ["A tradesman's house", "The shop survives more winters than a village does. The realm is not yours to climb."],
    smallfolk: ["Smallfolk", "War and winter arrive, and there is little between you and them."],
  }),
};

export const GREAT_BLOOD: Record<EraId, Row[]> = {
  fivekings: [
    ["martell", "House Martell", "Far from the first blows, and playing a longer game than the war.", 5],
    ["tyrell", "House Tyrell", "Rich, and late. The roses still have room to choose a side.", 4],
    ["lannister", "House Lannister", "Gold, and a target. The throne's favor is also the throne's danger.", 3],
    ["stark", "House Stark", "Honor, winter, and the meat grinder of this war.", 2],
    ["baratheon", "House Baratheon", "The name is splitting. Brothers are already killing it.", 1],
  ],
  robert: [
    ["stark", "House Stark", "They rise with Robert. The North has a future if you live to see the reign.", 5],
    ["arryn", "House Arryn", "The Eyrie starts the war and stays behind its gate.", 4],
    ["baratheon", "House Baratheon", "The storm, the siege, and a throne if anyone is left to sit it.", 3],
    ["lannister", "House Lannister", "Late, rich, and then tied to a peace that will rot.", 2],
    ["targaryen", "House Targaryen", "The dynasty is what the war is built to pull down.", 1],
  ],
  dance: [
    ["stark", "House Stark", "Far from the pit. The pact still has a future the fire has not reached.", 5],
    ["velaryon", "House Velaryon", "The sea stays open when the court burns. The house still bleeds for the queen.", 4],
    ["lannister", "House Lannister", "Gold in the west. The dance reaches you without eating the Rock whole.", 3],
    ["hightower", "House Hightower", "Oldtown is the green heart. A child of this house is already on a side.", 2],
    ["targaryen", "House Targaryen", "The blood the dragons are killing.", 1],
  ],
  blackfyre: [
    ["martell", "House Martell", "Dorne is far from the Redgrass Field, and proud enough to stay out.", 5],
    ["stark", "House Stark", "The North is a long way from the pretenders. Winter still comes.", 4],
    ["tyrell", "House Tyrell", "The Reach supplies the wars and is not itself the prize.", 3],
    ["targaryen", "House Targaryen", "The crown holds. Every rebellion is aimed at your cradle.", 2],
    ["blackfyre", "House Blackfyre", "The name is the war. The field is usually lost.", 1],
  ],
  heroes: [
    ["gardener", "the Gardeners", "The green lands. Bread, and room to be a king, between the wars for the fields.", 5],
    ["stark", "the Starks", "A long night in the stories, and a house that becomes the North.", 4],
    ["lannister", "the Lannisters", "Cunning in a rock that already had owners. Room, and a knife in it.", 3],
    ["durrandon", "the Durrandons", "Storm kings. The wars with the sea and the neighbors do not end.", 2],
    ["greyiron", "the Grey King's line", "Rock, salt, and reaving. The sea keeps what it takes.", 1],
  ],
};

export const HOUSE_FLAVOR: Record<string, Flavor> = {
  stark: "north",
  lannister: "rock",
  tyrell: "reach",
  gardener: "reach",
  baratheon: "storm",
  durrandon: "storm",
  martell: "dorne",
  targaryen: "dragon",
  blackfyre: "dragon",
  arryn: "vale",
  velaryon: "sea",
  greyiron: "isles",
  hightower: "hightower",
};

export const BENT: Record<Flavor, Row[]> = {
  north: [
    ["court", "The high table, where the lords talk", "Words travel farther than a sword in a house that already has swords.", 5],
    ["books", "The maester's turret", "A chain can walk out of Winterfell. An inheritance cannot.", 4],
    ["gods", "The godswood", "The old gods, and a life that is not the south's.", 3],
    ["yard", "The yard", "Expected. The wars will know your name only as a sword.", 2],
    ["sept", "The sept your southron kin keep", "A faith the North does not love. A closed door in your own hall.", 1],
  ],
  rock: [
    ["court", "The gilded court", "In a house of gold, hearing the room is how a life gets large.", 5],
    ["books", "The maester, and the letters that move gold", "You learn the sums that outlast a battle.", 4],
    ["gods", "The deep places of the Rock", "Old stories, and the dark under the gold.", 3],
    ["yard", "The yard above the sunset sea", "The house has knights. Another is not an opening.", 2],
    ["sept", "The sept, gold leaf and little else", "Pretty, and it takes you out of the game the Rock is playing.", 1],
  ],
  reach: [
    ["court", "The court among the roses", "Courtesy here is how power moves without drawing.", 5],
    ["books", "The books, and a maester who indulges you", "The Reach can spare a reader. The wars cannot always use one.", 4],
    ["gods", "The old songs of the green kings", "A private faith in a country that prefers the sept.", 3],
    ["yard", "The yard, and the chivalry", "Every boy in the Reach is asked to be this.", 2],
    ["sept", "The sept the Reach keeps richly", "Safe, public, and already full of sons who will not inherit.", 1],
  ],
  storm: [
    ["court", "The hall where the storm lords shout", "Even here, the one who listens can outlive the one who shouts.", 5],
    ["books", "The maester's wet books", "An odd bent on a coast that wants fury. That is why it opens.", 4],
    ["gods", "What the storms have not taken of the old gods", "A private watching, not a career.", 3],
    ["yard", "The yard", "The point of a storm house, and the grave that comes with it.", 2],
    ["sept", "The sept", "A quiet the storm lords do not promote.", 1],
  ],
  dorne: [
    ["court", "The court of the spear", "Plots and patience. A Dornish life gets large by waiting.", 5],
    ["books", "A maester, rare and closely watched", "Learning is an opening, and your kin will notice which books.", 4],
    ["gods", "The Water Gardens", "Quiet between plots. Not a harmless quiet.", 3],
    ["yard", "The yard, and the spears", "Expected, and the marches will spend it.", 2],
    ["sept", "The sept the Rhoynar do not love", "You step out of your own house's story.", 1],
  ],
  dragon: [
    ["court", "The court that remembers dragons", "Claims are the work. You can learn them without a dragon.", 5],
    ["books", "The books of old Valyria", "A dangerous literacy. It can leave the court with you.", 4],
    ["gods", "The place where dragons are spoken of as gods", "Faith and blood, tangled. It does not make you free.", 3],
    ["yard", "The yard", "Another sword in a house that wants riders.", 2],
    ["sept", "The sept your blood barely keeps", "The Faith is a door out, and a door that does not love you.", 1],
  ],
  vale: [
    ["court", "The high hall", "The Vale's wars are often decided in a room above the clouds.", 5],
    ["books", "The maester", "Letters go down the mountain when you cannot.", 4],
    ["gods", "The sky, and whatever gods are left up here", "A private bent. The gate does the rest.", 3],
    ["yard", "The yard on a narrow ledge", "There is little ground to learn anything but the sword.", 2],
    ["sept", "The sept", "Respected, and a small life inside a closed kingdom.", 1],
  ],
  sea: [
    ["court", "The hall where tides and claims are talked", "Driftwood and blood. Hearing both is the opening.", 5],
    ["books", "Charts, and the books of the sea", "A skill that sails when a claim cannot.", 4],
    ["gods", "The old Valyrian prayers", "Not the Faith. A private tide under the house.", 3],
    ["yard", "The deck, which is your yard", "Expected of a house that lives on ships.", 2],
    ["sept", "The sept on the island", "A green faith on a Valyrian shore. Little room in it.", 1],
  ],
  isles: [
    ["court", "The rock where captains are chosen", "Even here, a voice can be chosen. The sea still votes.", 5],
    ["books", "The one who can read a chart", "Rare, and it makes you the person a reaver needs.", 4],
    ["gods", "The Drowned God", "The faith of the isles. It will ask you to go under.", 3],
    ["yard", "The reaving", "The expected life. The sea spends it.", 2],
    ["sept", "A greenland sept forced on the shore", "No one here will follow you for it.", 1],
  ],
  hightower: [
    ["books", "The Citadel's shadow", "Oldtown's real opening. A chain, or the knowledge just short of one.", 5],
    ["court", "The court of the Hightower", "The beacon's politics. High, and already spoken for.", 4],
    ["gods", "The Starry Sept", "The Faith's heart. Power, of a kind that does not love ambition.", 3],
    ["stories", "The stories told under the beacon", "Old, private, and not a road into the war.", 2],
    ["yard", "The yard", "Oldtown has knights. It does not need another.", 1],
  ],
};

export const BELIEF: Record<Flavor, Row[]> = {
  north: [
    ["winter", "Winter is the only lord that matters", "It travels. It keeps you useful in any northern war.", 5],
    ["sword", "The one who passes the sentence should swing the sword", "A code the halls still respect.", 4],
    ["gods", "The old gods are enough", "A faith with no sept between you and it.", 3],
    ["guest", "A guest under your roof is sacred", "Noble, and the wrong year will kill you for it.", 2],
    ["south", "The south is a lie", "You close the realm before it can use you.", 1],
  ],
  rock: [
    ["gold", "Gold is a weapon if you do not love it", "You can aim the house's real power.", 5],
    ["room", "Hear the name, then hear the room", "Court sense. It works in any reign.", 4],
    ["debts", "A Lannister pays the debt", "A rule that gives you standing, and a list of enemies.", 3],
    ["house", "The house comes before the person", "You will be spent, and you will call it duty.", 2],
    ["slight", "A slight is a debt that must be paid in blood", "It closes you into a feud.", 1],
  ],
  reach: [
    ["courtesy", "Courtesy is a kind of armor", "It lets you cross a war without drawing first.", 5],
    ["harvest", "The harvest outlasts the war", "A true thing, and a way to stay necessary.", 4],
    ["wait", "Roses win by waiting", "Patience. It can also be cowardice with a better name.", 3],
    ["vows", "A knight's vows are real", "The Reach loves this. The war will charge you for it.", 2],
    ["never", "We do not lose", "A story the house tells. It leaves you no way to bend.", 1],
  ],
  storm: [
    ["laugh", "Fury is cheaper than a plot, and worse", "You can see the storm lords clearly. That is an opening.", 5],
    ["stand", "Hold the wall you were given", "Sieges remember the ones who stayed.", 4],
    ["kin", "Blood before banner", "A storm belief. It will split you when brothers split.", 3],
    ["shout", "The loudest claim is the true one", "It works until you meet a quieter house.", 2],
    ["never", "We do not bend", "The storm's closed door.", 1],
  ],
  dorne: [
    ["wait", "Dorne wins by not being in a hurry", "The long game is the opening.", 5],
    ["unbowed", "Unbent, unbowed, unbroken", "A pride that keeps you standing, and in the fight.", 4],
    ["water", "The Water Gardens matter more than the spear", "Children and quiet. A different kind of power.", 3],
    ["spear", "The spear answers what courtesy will not", "True here, and it spends you.", 2],
    ["alone", "Dorne needs no one", "It closes every alliance that could save you.", 1],
  ],
  dragon: [
    ["blood", "Blood is a claim, not a virtue", "You can use the name without being eaten by it.", 5],
    ["fire", "Fire is the argument", "It makes you dangerous, and it is a real argument in this age.", 4],
    ["kin", "Kin before the realm", "The family's disease, and its shelter.", 3],
    ["right", "The throne is owed", "A belief that puts you in the war whether you are ready or not.", 2],
    ["ash", "What burns was meant to burn", "It closes pity, and pity is sometimes the way out.", 1],
  ],
  vale: [
    ["gate", "The gate is the whole strategy", "You understand the Vale. The Vale stays alive.", 5],
    ["honor", "Honor is the mountain's tax", "The Vale pays it. Other kingdoms will charge you extra.", 4],
    ["sky", "What happens below the clouds is gossip", "A way to survive. A way to miss the realm.", 3],
    ["wing", "As high as honor, and no higher", "Pretty, and it keeps you on the mountain.", 2],
    ["pure", "The Vale does not mix its blood", "A closed door in a war that is about marriages.", 1],
  ],
  sea: [
    ["tide", "The tide does not care who sits the throne", "A sailor's truth. It keeps you employable.", 5],
    ["hull", "A hull is worth more than a claim", "Ships outlast banners.", 4],
    ["salt", "Salt and blood are the same debt", "Velaryon kinship. It binds you to a queen's war.", 3],
    ["drift", "We were kings of the tide before the dragons", "Pride. It puts you in the family quarrel.", 2],
    ["drown", "The sea takes the disloyal", "A fear that leaves you no harbor but one.", 1],
  ],
  isles: [
    ["choose", "A captain is chosen, not born", "The isles' real opening, if you can speak.", 5],
    ["pay", "The iron price, or nothing", "It makes you legible to every crew.", 4],
    ["drown", "What is dead may rise", "Faith, and a willingness to go under for it.", 3],
    ["reave", "We do not sow", "The old boast. It leaves you nothing in winter.", 2],
    ["thrall", "The green lands are only for taking", "It closes every life but reaving.", 1],
  ],
  hightower: [
    ["know", "Knowing is safer than ruling", "Oldtown's real power. It can leave the beacon.", 5],
    ["light", "The beacon is a signal, not a sword", "You learn politics as light and silence.", 4],
    ["faith", "The Starry Sept judges kings", "True enough to be useful, and dangerous if you believe it whole.", 3],
    ["late", "Oldtown survives by being late", "A family strategy. It keeps you out of the first charge.", 2],
    ["above", "The tower is above the realm", "It closes you off from everyone the war is happening to.", 1],
  ],
};

export const GREAT_RAISED: Row[] = [
  ["fostered", "Fostered, to bind another house", "You learn a second hall. You may also be the hostage.", 5],
  ["side", "Kept at the lord's side", "You see how rule is done in this house.", 4],
  ["yard", "Hardened in the yard", "You can fight. The years will know it.", 3],
  ["indulged", "Indulged", "Safe, and unready.", 2],
  ["household", "Raised by the household, more than by your parents", "The house fed you. It did not keep you in its heart.", 1],
];

export const LESSER_PLACE: Row[] = [
  ["spare", "The spare", "Not the first the knife looks for, and a life you still have to make.", 5],
  ["marriage", "The child the marriage needs", "You will leave this house for another. A pledge, and a second roof.", 4],
  ["heir", "The heir", "The house will be yours if you live. The war knows that.", 3],
  ["cousin", "A cousin under the roof", "Fed, and no claim.", 2],
  ["bastard", "A bastard", "The name is half closed. The opening is leaving.", 1],
];

export const LESSER_BENT: Row[] = [
  ["living", "The work that keeps a small house alive", "Ships, sheep, tolls, or the harvest. It outlasts a sword.", 5],
  ["letters", "The lord's letters, and the riders", "You learn the realm by carrying its news.", 4],
  ["gods", "The sept, or the godswood, whichever the house keeps", "A private life inside a small name.", 3],
  ["yard", "The yard", "Expected, and the wars will use it.", 2],
  ["wild", "The country around the house", "Woods, marsh, or hills. You can disappear into them.", 1],
];

export const LESSER_RAISED: Row[] = [
  ["up", "Fostered up to a great house", "A greater hall. You may be the hostage.", 5],
  ["road", "Raised on the road between keeps", "Unguarded, and you learn the distances.", 4],
  ["neighbor", "Sent to a neighbor", "Another roof, close enough to come home.", 3],
  ["home", "At home", "Safe, and small.", 2],
  ["steward", "Left with the steward", "The house forgot to raise you itself.", 1],
];

export const LESSER_CARRY: Row[] = [
  ["sibling", "A sibling you will not abandon", "The bond that can outlast the house's plans.", 5],
  ["grievance", "A grievance against the great house above you", "Dangerous, and it is an engine.", 4],
  ["parent", "Loyalty to the parent who rules", "Their friends, and their wars.", 3],
  ["debt", "A debt the house pretends not to owe", "It sits under the hall.", 2],
  ["none", "Nothing you would die for", "You are harder to aim. You are also alone.", 1],
];

export const KNIGHT_WHERE: Record<EraId, Row[]> = {
  fivekings: [
    ["reach", "The Reach", "The war comes late. A sword can still be noticed.", 5],
    ["north", "The North", "A long war, and every enduring sword is needed.", 4],
    ["vale", "The Vale", "The gate holds. You live. The greater war is mostly shut out.", 3],
    ["crownlands", "The crownlands", "The throne's war. The lords are already spoken for.", 2],
    ["riverlands", "The riverlands", "The war lives here. Fire closes most of the roads.", 1],
  ],
  robert: [
    ["vale", "The Vale", "The rebellion starts here, behind a gate that holds.", 5],
    ["north", "The North", "They march with the winning side.", 4],
    ["stormlands", "The stormlands", "Robert's country. A siege, and a name if you live.", 3],
    ["reach", "The Reach", "They sit outside a siege for a king who loses.", 2],
    ["crownlands", "The crownlands", "The throne's knights. The throne falls.", 1],
  ],
  dance: [
    ["north", "The North", "Far from the dragons. The wolves come late.", 5],
    ["vale", "The Vale", "A wall, and dragon blood behind it that may never come down.", 4],
    ["reach", "The Reach", "Knights in plenty. The fire still comes south.", 3],
    ["riverlands", "The riverlands", "The ground war.", 2],
    ["crownlands", "The crownlands", "Dragonfire, and the pit.", 1],
  ],
  blackfyre: [
    ["marches", "The Dornish marches", "One field can still make a nameless sword into something more.", 5],
    ["reach", "The Reach", "Rich country, and the wars hire it.", 4],
    ["vale", "The Vale", "Behind the gate. The famous field is far.", 3],
    ["riverlands", "The riverlands", "The country of the Redgrass Field, and its graves.", 2],
    ["crownlands", "The crownlands", "The court decides. A sword without a name is a pawn.", 1],
  ],
  heroes: [
    ["green", "The green lands", "Bread, and petty kings who want it.", 5],
    ["north", "The North", "Long winters, and a life that can become a first story.", 4],
    ["vale", "The mountains", "High, hard, and a wall against the rest.", 3],
    ["storm", "The storm coast", "Kings who fight the sea and each other.", 2],
    ["isles", "The islands", "Rock, salt, and reaving.", 1],
  ],
};

export const KNIGHT_BESIDE: Row[] = [
  ["known", "A hedge knight men know", "No keep binds you. The name can be hired.", 5],
  ["lesser", "Sworn sword of a lesser house", "Close enough to be seen. Not so great that you are furniture.", 4],
  ["tower", "A landed tower and a village", "A small room of your own. Raiders know the road to it.", 3],
  ["word", "A knight in nothing but the word", "The opening is mostly a story.", 2],
  ["great", "Sworn sword of a great house", "The finest cloak, and the least say in where it goes.", 1],
];

export const KNIGHT_RAISED: Row[] = [
  ["foster", "A lord's fosterage", "You eat in a greater hall, and you are not their blood.", 5],
  ["road", "Hunger, and the road", "Dangerous, and you learn every mile.", 4],
  ["septon", "A septon", "Letters, and a road the sword does not own.", 3],
  ["yard", "The yard, every morning", "What a knight's child is expected to want.", 2],
  ["mother", "Your mother, after your father died in someone else's war", "You know what a banner costs.", 1],
];

export const KNIGHT_BENT: Row[] = [
  ["book", "A book you were not meant to have", "The opening a knight's child rarely gets.", 5],
  ["coin", "Coin, and who owes it", "A sword spends itself. A debt can be aimed.", 4],
  ["sept", "The sept", "A life beside the war, not in the first rank of it.", 3],
  ["lance", "The lance", "What they already expect of you.", 2],
  ["mean", "A mean streak men already notice", "It makes you dangerous, and it closes doors.", 1],
];

export function knightOath(war: string): Row[] {
  return [
    ["family", "Sworn only to your family", `You can still refuse ${war}.`, 5],
    ["wrong", "Sworn to a banner that will be wrong", `${war} makes the oath a trap, or a way out if you see it in time.`, 4],
    ["sworn", "Sworn", `A lord already has the sword, and ${war} will spend it.`, 3],
    ["looking", "Unsworn, and looking", "No one owns you. No one will miss you either.", 2],
    ["village", "Sworn to one village", "The smallest oath. The war can still find the village.", 1],
  ];
}

export const TRADE_CRAFT: Row[] = [
  ["smith", "A smith", "Wars need nails, horseshoes, and blades. The work travels.", 5],
  ["provision", "A provisioner", "Grain, salt, and wagons. Armies eat.", 4],
  ["copyist", "A copyist who left the Citadel", "Letters travel when a shop cannot.", 3],
  ["cloth", "Cloth", "A city craft. It dies if the city is sacked.", 2],
  ["minstrel", "A minstrel", "When the war starts, few pay for songs.", 1],
];

export const TRADE_TOWN: Record<EraId, Row[]> = {
  fivekings: [
    ["oldtown", "Oldtown", "Customers, books, and a war that usually arrives last.", 5],
    ["whiteharbor", "White Harbor", "The North's port. Silver, ships, and a war that still reaches the docks.", 4],
    ["lannisport", "Lannisport", "Gold in the west, and the west's enemies.", 3],
    ["kingslanding", "King's Landing", "The most customers, and a city that eats people.", 2],
    ["market", "A market town off the kingsroad", "The road brings armies.", 1],
  ],
  robert: [
    ["lannisport", "Lannisport", "The west comes out of this war rich.", 5],
    ["oldtown", "Oldtown", "Far enough from the sack to keep trading.", 4],
    ["whiteharbor", "White Harbor", "A long way from the Trident. A smaller purse.", 3],
    ["market", "A market town off the kingsroad", "The armies use the road.", 2],
    ["kingslanding", "King's Landing", "The sack is coming for this city.", 1],
  ],
  dance: [
    ["whiteharbor", "White Harbor", "Far from the dragons, and still a port.", 5],
    ["oldtown", "Oldtown", "The Hightower's city. Rich, and on a side.", 4],
    ["lannisport", "Lannisport", "The west's gold, at a distance from the pit.", 3],
    ["market", "A market town", "The ground war needs roads, and eats the towns on them.", 2],
    ["kingslanding", "King's Landing", "Dragons, and the pit, and the mob.", 1],
  ],
  blackfyre: [
    ["oldtown", "Oldtown", "The Citadel and the merchants outlast a pretender.", 5],
    ["kingslanding", "King's Landing", "The court is spending. So are the people who feed it.", 4],
    ["lannisport", "Lannisport", "Western gold, and western caution.", 3],
    ["whiteharbor", "White Harbor", "Far, and a smaller war-purse.", 2],
    ["market", "A market town", "The rebellions are fought in country like this.", 1],
  ],
  heroes: [
    ["green", "A market of the green lands", "Where a great city will stand. Bread and strangers.", 5],
    ["harbor", "A harbor under a rock of gold", "Fish, ore, and a lord who takes a share.", 4],
    ["winter", "A winter town against a lord's wall", "You eat if the lord remembers.", 3],
    ["strand", "A fishing strand", "The sea feeds you, and takes boats.", 2],
    ["camp", "A camp that moves when the grass fails", "No door that is yours.", 1],
  ],
};

export const TRADE_BENCH: Row[] = [
  ["younger", "The skilled younger child", "You have the skill, and you must make your own bench.", 5],
  ["out", "Apprenticed out", "You leave, and you learn a second shop.", 4],
  ["inherit", "You will inherit the shop", "The bench is yours. So is its size.", 3],
  ["rough", "Kept for the rough work", "Useful, and not taught the craft.", 2],
  ["unclaimed", "The shop does not claim you", "Fed, sometimes. Not named in the shop's future.", 1],
];

export const TRADE_BENT: Row[] = [
  ["sword", "A sword you were not meant to own", "The dangerous way out of the shop.", 5],
  ["coin", "The coin", "You learn what the work is worth, and to whom.", 4],
  ["work", "The work itself", "A true craft. Narrow, if you let it be the whole life.", 3],
  ["out", "Getting out", "A want, and not yet a road.", 2],
  ["sept", "The sept", "A quiet that will not feed you.", 1],
];

export const TRADE_TROUBLE: Row[] = [
  ["secret", "A secret in the accounts", "Dangerous, and it is leverage.", 5],
  ["patron", "A patron who wants the shop", "A door, and a hand already on it.", 4],
  ["rival", "A rivalry with another bench", "You are known. So is the fight.", 3],
  ["debt", "A debt", "The shop works, and it does not keep what it earns.", 2],
  ["clean", "A clean name", "Nothing owed, and nothing pushing.", 1],
];

export function folkLand(war: string): Row[] {
  return [
    ["free", "A freehold, no lord close", `No one owns your leaving. No one stands between you and ${war}.`, 5],
    ["lesser", "A lesser house's village", "The lord may still know your face.", 4],
    ["great", "A great house's village", "Some protection. Their war becomes your war.", 3],
    ["knight", "A landed knight's village", "A small lord, and a short temper.", 2],
    ["edges", "The edges", "Marsh, mountain, or the Neck. The realm forgets you. The land does not.", 1],
  ];
}

export const FOLK_WORK: Row[] = [
  ["none", "Nothing steady", "No place to be kept in. That is a road, and it is hunger.", 5],
  ["boat", "A boat", "The water is a way out.", 4],
  ["croft", "A croft", "A field, if the year is kind.", 3],
  ["sheep", "Sheep", "The high ground, and little else.", 2],
  ["mine", "A mine", "Under the ground. The work does not travel.", 1],
];

export const FOLK_RAISED: Row[] = [
  ["found", "A foundling's place", "No blood binds you. You can leave.", 5],
  ["hunger", "Hunger in the bad winters", "You learn what a winter costs.", 4],
  ["work", "Hard work, and a roof", "A life with edges, and a place to sleep.", 3],
  ["full", "A full bowl", "Safe, and small.", 2],
  ["war", "A war crossed the village while you were small", "It took things the later years do not give back.", 1],
];

export const FOLK_BENT: Row[] = [
  ["hands", "A skill in your hands, beyond the daily work", "It can be carried out of the village.", 5],
  ["leave", "Leaving", "The opening is the road.", 4],
  ["fed", "Keeping your people fed", "A purpose. It ties you to the place.", 3],
  ["gods", "The gods of that place", "Company. Not a road.", 2],
  ["anger", "Anger", "It spends you before it saves you.", 1],
];

export const FOLK_LINE: Row[] = [
  ["kneel", "You will not kneel to a lord who did not feed you", "A dangerous line, and a real one.", 5],
  ["war", "You will not go to someone else's war", "You may still be dragged. The refusal is yours first.", 4],
  ["sibling", "You will not abandon a sibling", "A bond. It chooses for you later.", 3],
  ["people", "You will not leave your people", "The village holds you.", 2],
  ["steal", "You will not steal", "A clean rule. Hunger will test it.", 1],
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
