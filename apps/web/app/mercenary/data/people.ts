import type { Villager } from "../lib/types";

type Seed = [id: string, name: string, description: string, grain: number, coins: number, possession: string, other: string, bond: string];

const ROWS: Seed[] = [
  ["alden", "Alden Wain", "Alden Wain is elder of Millcross. He keeps the common chest and the granary, and he has a house, a little grain, and a few coins of his own.", 6, 8, "a staff", "mara", "sister"],
  ["tobin", "Tobin Pell", "Tobin Pell sells grain from his own sacks in Millcross. Those sacks are not the village granary. He lives over the store with a small purse of his own.", 4, 12, "a set of scales", "edwick", "nephew"],
  ["mara", "Mara Wain", "Mara Wain keeps her brother's house and the hens behind it.", 5, 3, "a hen coop", "alden", "brother"],
  ["edwick", "Edwick Pell", "Edwick Pell loads his uncle's sacks and sleeps in the store.", 3, 2, "a handcart", "tobin", "uncle"],
  ["hesta", "Hesta Cole", "Hesta Cole milks the two cows and sells a little cheese at her door.", 4, 2, "a milk pail", "bram", "husband"],
  ["bram", "Bram Cole", "Bram Cole ploughs the long strip north of the lane.", 5, 1, "a ploughshare", "hesta", "wife"],
  ["nell", "Nell Ash", "Nell Ash lays and cuts the hedges along the west field.", 2, 1, "a billhook", "oswin", "son"],
  ["oswin", "Oswin Ash", "Oswin Ash is old enough to work a row and young enough to run.", 1, 0, "a sling", "nell", "mother"],
  ["cora", "Cora Dace", "Cora Dace weaves the coarse cloth the village wears.", 3, 4, "a loom", "hob", "husband"],
  ["hob", "Hob Dace", "Hob Dace thatches roofs when the straw is dry.", 4, 2, "a thatching needle", "cora", "wife"],
  ["ivy", "Ivy Fenn", "Ivy Fenn keeps bees on the sunny side of the orchard.", 6, 3, "two hives", "watt", "brother"],
  ["watt", "Watt Fenn", "Watt Fenn minds the swine in the oak scrub.", 2, 1, "a pig stick", "ivy", "sister"],
  ["sible", "Sible Larke", "Sible Larke bakes the village bread in the mill oven.", 5, 2, "a peel", "dunstan", "husband"],
  ["dunstan", "Dunstan Larke", "Dunstan Larke runs the mill when the stream is high enough.", 4, 3, "a sack of flour", "sible", "wife"],
  ["annis", "Annis Reed", "Annis Reed cuts rushes and reeds along the brook.", 2, 1, "a reed bundle", "col", "husband"],
  ["col", "Col Reed", "Col Reed fishes the brook and mends nets in the evenings.", 3, 2, "a net", "annis", "wife"],
  ["maud", "Maud Pike", "Maud Pike tends the orchard and the grafting knives.", 4, 1, "a pruning knife", "hal", "son"],
  ["hal", "Hal Pike", "Hal Pike can swing an axe and is counted among the men who can leave the fields.", 2, 0, "an axe", "maud", "mother"],
  ["rose", "Rose Quinn", "Rose Quinn dyes wool in a pot behind her house.", 3, 2, "a dye pot", "tam", "husband"],
  ["tam", "Tam Quinn", "Tam Quinn cuts wood and hauls it in on a sledge.", 5, 1, "a bill", "rose", "wife"],
  ["edith", "Edith Barr", "Edith Barr is the midwife and keeps a roll of clean linen.", 4, 3, "a linen roll", "ned", "husband"],
  ["ned", "Ned Barr", "Ned Barr drives the ox and will not lend it lightly.", 6, 2, "an ox goad", "edith", "wife"],
  ["lottie", "Lottie Crowe", "Lottie Crowe drives the geese off the young wheat.", 2, 1, "a goose staff", "sim", "brother"],
  ["sim", "Sim Crowe", "Sim Crowe digs the ditches that keep the lower field from drowning.", 3, 0, "a spade", "lottie", "sister"],
  ["agnes", "Agnes Holt", "Agnes Holt is a widow and still works a short row.", 1, 2, "a black shawl", "wilf", "son"],
  ["wilf", "Wilf Holt", "Wilf Holt works his mother's row and can be called from it.", 2, 1, "a hoe", "agnes", "mother"],
  ["jenny", "Jenny Marsh", "Jenny Marsh dips rushes for lights and has no grain of her own this week.", 0, 1, "a rush light", "kit", "husband"],
  ["kit", "Kit Marsh", "Kit Marsh mends carts. His own wheel is still broken, and his bin is empty.", 0, 0, "a broken wheel", "jenny", "wife"],
  ["ruth", "Ruth Hale", "Ruth Hale presses cheese and keeps the press in the dairy.", 4, 2, "a cheese press", "piers", "husband"],
  ["piers", "Piers Hale", "Piers Hale saves barley seed and is slow to spend it.", 5, 1, "a seed basket", "ruth", "wife"],
  ["susan", "Susan Greve", "Susan Greve washes linen at the brook.", 2, 1, "a wash paddle", "tom", "husband"],
  ["tom", "Tom Greve", "Tom Greve sets fences and gates.", 3, 1, "a mallet", "susan", "wife"],
  ["bethan", "Bethan York", "Bethan York keeps the small children when the rows are being worked.", 1, 0, "a wooden doll", "hugh", "husband"],
  ["hugh", "Hugh York", "Hugh York is able-bodied and keeps a spear he should not need.", 4, 1, "a spear", "bethan", "wife"],
  ["clara", "Clara Venn", "Clara Venn dries herbs and knows which ones are for fever.", 3, 2, "a herb bundle", "rob", "brother"],
  ["rob", "Rob Venn", "Rob Venn works a sickle and can be called from the field.", 2, 0, "a sickle", "clara", "sister"],
  ["mary", "Mary Spence", "Mary Spence brews a small ale and keeps one barrel back.", 5, 4, "a small barrel", "jack", "husband"],
  ["jack", "Jack Spence", "Jack Spence turns the malt and watches the kiln.", 4, 1, "a malt shovel", "mary", "wife"],
  ["ellen", "Ellen Ward", "Ellen Ward folds the sheep on the common.", 3, 2, "a crook", "gus", "husband"],
  ["gus", "Gus Ward", "Gus Ward shears and is counted among the men who can leave.", 2, 1, "shears", "ellen", "wife"],
  ["frieda", "Frieda Moss", "Frieda Moss smokes what meat there is. Her own bin is empty.", 0, 2, "a salt box", "len", "husband"],
  ["len", "Len Moss", "Len Moss sets snares. He has no grain stored.", 0, 1, "a snare", "frieda", "wife"],
  ["polly", "Polly Kite", "Polly Kite gathers eggs and sells them by the door.", 2, 1, "a basket", "abe", "father"],
  ["abe", "Abe Kite", "Abe Kite is too old to muster. He sits by the lane and remembers other years.", 1, 3, "a stool", "polly", "daughter"],
  ["nora", "Nora Birch", "Nora Birch spins flax when the light is good.", 3, 1, "a distaff", "cal", "husband"],
  ["cal", "Cal Birch", "Cal Birch is able-bodied and works a fork in the rows.", 4, 0, "a fork", "nora", "wife"],
  ["tess", "Tess Lowe", "Tess Lowe draws water and keeps the well rope.", 2, 1, "a bucket", "owen", "husband"],
  ["owen", "Owen Lowe", "Owen Lowe is able-bodied and breaks the clods after the plough.", 3, 1, "a mattock", "tess", "wife"],
  ["hannah", "Hannah Croft", "Hannah Croft has a baby and an empty bin.", 0, 0, "a cradle", "seth", "husband"],
  ["seth", "Seth Croft", "Seth Croft is able-bodied. His seed lip is empty and so is his bin.", 0, 1, "a seed lip", "hannah", "wife"],
];

export function millcrossPeople(): Villager[] {
  return ROWS.map(([id, name, description, grain, coins, possession, other, bond]) => ({
    id,
    name,
    description,
    grain,
    coins,
    possessions: [possession],
    relations: [{ id: other, bond }],
    planted: false,
    alive: true,
  }));
}

export function villagerNamed(people: Villager[], token: string): Villager | undefined {
  const key = token.trim().toLowerCase();
  return people.find((person) => person.id === key || person.name.toLowerCase() === key);
}
