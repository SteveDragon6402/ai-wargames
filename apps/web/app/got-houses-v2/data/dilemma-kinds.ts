/**
 * Premises a counsel GM may instantiate against the CURRENT board.
 * Prefer kinds that still make sense after a day of marching.
 * `stable: false` kinds need a specific just-happened event — do not offer them
 * when preloading a dilemma before the map resolves.
 */
export interface DilemmaKind {
  id: string;
  tags: string[];
  premise: string;
  /** Default true. False = depends on a fight or captive that may vanish today. */
  stable?: boolean;
}

export const DILEMMA_KINDS: DilemmaKind[] = [
  { id: "prisoners_fate", tags: ["prisoners", "policy"], premise: "Captives already in our hands are a standing weight: keep, trade, or make an example. Do not name a group that may be gone by nightfall." },
  { id: "named_captive", tags: ["prisoners", "named"], premise: "A named man is in our hands. Mercy, a cell, or the sword will be remembered.", stable: false },
  { id: "overloaded_escort", tags: ["prisoners", "march"], premise: "A host is already shepherding more captives than fighting men. The column cannot go on like this." },
  { id: "camp_fever", tags: ["camp", "tiredness"], premise: "Fever is in the camp. Push on, rest, or burn the sick tents." },
  { id: "stripped_forage", tags: ["forage", "supply"], premise: "The country around the host is picked clean. Stay and starve slowly, or move and fight hungry." },
  { id: "long_march_wear", tags: ["march", "tiredness"], premise: "The men have marched hard with no rest. Another push may break them; a halt may lose the hour." },
  { id: "siege_camp_discipline", tags: ["siege", "discipline"], premise: "A siege camp is getting slack — dice, drink, men wandering toward the walls." },
  { id: "siege_food_share", tags: ["siege", "supply"], premise: "There is not enough food in a siege camp for men, horses, and captives alike." },
  { id: "storm_butchers_bill", tags: ["storm", "battle"], premise: "A storm of the walls left the host bloodied even in success. The men want rest, drink, or another go.", stable: false },
  { id: "failed_storm", tags: ["storm", "siege"], premise: "The assault was thrown back. Some want to try again at dawn; some want to starve them out.", stable: false },
  { id: "garrison_sally_cost", tags: ["sally", "siege"], premise: "A sally cut up the camp. The besiegers want revenge on the country or a tighter cordon.", stable: false },
  { id: "vassal_held_back", tags: ["battle", "vassal"], premise: "A bannerman's host sat a fight out, or came late. Honour wants a word.", stable: false },
  { id: "vassal_too_eager", tags: ["battle", "vassal"], premise: "A bannerman charged without waiting and spent men the lord still needed.", stable: false },
  { id: "fallen_commander", tags: ["battle", "named"], premise: "A commander is dead or taken. His men want a new captain, vengeance, or to go home.", stable: false },
  { id: "loot_and_order", tags: ["battle", "discipline"], premise: "After a fight the men are stripping the dead and the nearby crofts. Stop them or let them have it.", stable: false },
  { id: "broken_word_rumour", tags: ["terms", "reputation"], premise: "Word is spreading about how we treat men who yield. A bannerman wants the house's policy said aloud." },
  { id: "open_terms", tags: ["siege", "terms"], premise: "Terms sit on a table at a besieged seat. Someone wants them sweetened, withdrawn, or forced." },
  { id: "raze_question", tags: ["raze", "seat"], premise: "A seat we hold or invest can be put to the torch. Some want the lesson; some want the walls kept." },
  { id: "thin_garrison", tags: ["garrison", "seat"], premise: "A seat of ours has too few men on the walls. Peel a host, or risk it falling back." },
  { id: "empty_seat", tags: ["garrison", "claim"], premise: "We hold ground with no proper garrison. Walk away, scrape a household, or leave a named man." },
  { id: "river_crossing", tags: ["march", "riverlands"], premise: "The next road is a crossing under someone else's walls. Pay, force, or go the long way." },
  { id: "frey_toll", tags: ["riverlands", "vassal"], premise: "The Twins want a price for the bridge. Honour, gold, or a slight." },
  { id: "scout_report", tags: ["scouts", "march"], premise: "Outriders want leave to ride farther than the map. Grant it, keep them close, or take a local guide." },
  { id: "desertion", tags: ["discipline", "morale"], premise: "Men have slipped the pickets. Hang a few, promise pay, or pretend not to see." },
  { id: "pay_short", tags: ["supply", "morale"], premise: "The war chest will not cover the next fortnight. Borrow, plunder, or send men home." },
  { id: "horse_flesh", tags: ["cavalry", "supply"], premise: "The horses are foundering. Rest them, eat some, or push the riders as infantry." },
  { id: "wounded_train", tags: ["battle", "camp"], premise: "The wounded slow the column. Leave a camp, carry them, or a harder mercy.", stable: false },
  { id: "burial", tags: ["battle", "honour"], premise: "The dead of both sides still lie on the last field. Bury our own, bury all, or march.", stable: false },
  { id: "camp_followers", tags: ["camp", "discipline"], premise: "A trail of wives, sutlers, and thieves has attached itself to the host." },
  { id: "ravens", tags: ["politics", "home"], premise: "A raven from home asks for men, or news, or a marriage, while the war is unfinished." },
  { id: "winter_coming", tags: ["weather", "supply"], premise: "The weather is turning. Winter quarters, a last strike, or a hard camp in the open." },
  { id: "rain_and_mud", tags: ["weather", "march"], premise: "The roads are mud. Wait it out and lose days, or ruin horses dragging the column." },
  { id: "split_host", tags: ["split", "command"], premise: "The host is too large for this country, or too mixed in purpose. Split, or keep it one." },
  { id: "combine_hosts", tags: ["combine", "command"], premise: "Two of our hosts stand on the same ground and snarl at one another. Merge them, or send one away." },
  { id: "speech_aftermath", tags: ["speech", "morale"], premise: "The lord's last words to the men landed wrong — too soft, too bloody, or not believed.", stable: false },
  { id: "parley_ask", tags: ["parley", "siege"], premise: "Someone wants a parley with the walls, or with the other lord, and others call it weakness." },
  { id: "hostage_exchange", tags: ["prisoners", "politics"], premise: "A chance to trade captives. The names on both lists are not equal.", stable: false },
  { id: "turned_house", tags: ["betrayal", "honour"], premise: "Loyalty in the host is talk. Make an example of a wavering house, buy them, or ignore the rumour." },
  { id: "bolton_method", tags: ["north", "discipline"], premise: "A northern bannerman proposes a cruelty that would work, and stain." },
  { id: "kingslayer_honour", tags: ["westerlands", "honour"], premise: "A western knight wants a single combat, a charge, or a slight answered in blood." },
  { id: "castellan_plea", tags: ["siege", "garrison"], premise: "A castellan of ours, invested, begs for relief that would pull the field army off its road." },
  { id: "relief_column", tags: ["siege", "march"], premise: "We can lift a friendly siege only by abandoning another purpose." },
  { id: "forage_parties", tags: ["forage", "discipline"], premise: "Foraging parties are ranging too far and coming back with complaints — or with no food." },
  { id: "local_lords", tags: ["riverlands", "politics"], premise: "A small Riverlands house offers bread and a banner, at a price in protection we may not keep." },
  { id: "holy_men", tags: ["honour", "camp"], premise: "A septon or silent sister wants the camp's sins answered: whores, hangings, or a burned sept." },
  { id: "night_watchers", tags: ["camp", "scouts"], premise: "The night watch is thin. Another attack on the pickets will get in." },
  { id: "heir_question", tags: ["named", "politics"], premise: "A dead lord's heir rides with us, or against us, and someone wants the succession used." },
  { id: "maps_and_guides", tags: ["march", "scouts"], premise: "The next country is unknown. Hire a local, take one, or go blind." },
  { id: "shared_camp", tags: ["camp", "combine"], premise: "Two friendly hosts share a camp and the men are already at knives over firewood and honour." },
  { id: "last_stand_echo", tags: ["battle", "morale"], premise: "Men who watched a last stand want either no quarter next time, or never to be so trapped.", stable: false },
];

export const DILEMMA_KIND_IDS: string[] = DILEMMA_KINDS.map((k) => k.id);

export function isKnownDilemmaKind(id: string): boolean {
  return id === "other" || DILEMMA_KIND_IDS.includes(id);
}

export function formatDilemmaCatalog(): string {
  return DILEMMA_KINDS.filter((k) => k.stable !== false)
    .map((k) => `- ${k.id} [${k.tags.join(", ")}]: ${k.premise}`)
    .join("\n");
}
