import { HOLDS } from "./holds";
import { PATHWAYS, pathwayKey } from "./pathways";

const HOLD: Record<string, string> = {
  "01": "Winter stores, wolfswood game, and village grain",
  "02": "Sparse hill villages and little surplus",
  "03": "Port granaries, fish, and Manderly stores",
  "04": "Thin coastal forage; few villages and wind-scoured fields",
  "05": "Umber herds and game, but winter country with little surplus",
  "06": "Wolfswood game and timber-country scrap",
  "07": "Barrowland sheep and thin grain",
  "08": "Fever bogs and reed — almost nothing a host can live off",
  "16": "Rich riverland fields, orchards, and Tully stores",
  "17": "Frey farm country and river traffic",
  "18": "Gods Eye farms around a dead castle",
  "19": "Coastal farms and Mallister stores",
  "20": "Bay farms and a harbour market",
  "21": "Bracken river-fields and pasture",
  "22": "Blackwood woods and river farms",
  "23": "Rock stores and the Lannisport hinterland",
  "24": "City markets and coastal farms",
  "25": "Pass villages and mine-country scrap",
  "26": "Coastal hills, herds, and hall stores",
  "27": "Hill villages and Marbrand herds",
  "28": "Mining tracks and poor hillside forage",
  "29": "Ugly hill country with little to take",
  "30": "Crown granaries and a fat hinterland",
  "31": "Island rock and sea-catch; little land forage",
  "32": "Fat crownland farms",
  "33": "Pasture and dairy country",
  "34": "Harbour town and coastal farms",
  "35": "Hook rock and salt; thin forage",
  "36": "Easy crownland fields",
};

const PATH: Record<string, string> = {
  [pathwayKey("01", "02")]: "Lonely White Knife villages and thin northern forage",
  [pathwayKey("01", "03")]: "Road farms toward the Bite, better as the port draws near",
  [pathwayKey("01", "05")]: "Snow country and empty Gift approaches",
  [pathwayKey("01", "06")]: "Wolfswood game and little else",
  [pathwayKey("01", "07")]: "Barrowland sheep and wind-scoured downs",
  [pathwayKey("01", "08")]: "Kingsroad villages thinning toward the Neck",
  [pathwayKey("02", "04")]: "Coastal upland scrap and lonely steadings",
  [pathwayKey("02", "05")]: "Snow, woods, and hard lodging",
  [pathwayKey("03", "08")]: "Damp farms giving way to swamp-edge reed",
  [pathwayKey("04", "05")]: "Empty far-northern country",
  [pathwayKey("06", "07")]: "Lightly peopled woods and barrows",
  [pathwayKey("07", "08")]: "Open downs sinking into bog and reed",
  [pathwayKey("08", "17")]: "The Neck — fever bogs, no forage worth the name",
  [pathwayKey("16", "17")]: "Green Fork farms and riverland villages",
  [pathwayKey("16", "19")]: "River fields then coastal stores toward Seagard",
  [pathwayKey("16", "21")]: "Red Fork marches through open mild country",
  [pathwayKey("16", "22")]: "Short river-wood march, damp and yielding",
  [pathwayKey("16", "25")]: "Riverland farms rising into the Tooth pass",
  [pathwayKey("17", "18")]: "Long riverland march — muddy roads and soft camping",
  [pathwayKey("17", "19")]: "Wet fields and the Seagard approach",
  [pathwayKey("18", "20")]: "Gods Eye and Bay farms",
  [pathwayKey("18", "21")]: "Trident marches and open riverland",
  [pathwayKey("18", "30")]: "Kingsroad farms softening toward the capital",
  [pathwayKey("20", "30")]: "Crowded bay road and Blackwater hinterland",
  [pathwayKey("20", "34")]: "Mild wet crownland shore",
  [pathwayKey("21", "22")]: "River woods and feud-road fields",
  [pathwayKey("23", "24")]: "Paved descent and easy coastal supply",
  [pathwayKey("23", "25")]: "Rising stone passes, little to take on the climb",
  [pathwayKey("23", "26")]: "Ocean-road villages and coastal hills",
  [pathwayKey("23", "27")]: "Steep Westerlands lanes and hill villages",
  [pathwayKey("24", "26")]: "Ocean road, mild hills, good footing",
  [pathwayKey("25", "28")]: "Narrow cool passes and mining tracks",
  [pathwayKey("26", "29")]: "Rough inland hills toward Clegane land",
  [pathwayKey("27", "28")]: "Hill passes and mining tracks",
  [pathwayKey("27", "29")]: "Rough Westerlands hill country",
  [pathwayKey("30", "31")]: "Ship stores only — no land forage on the crossing",
  [pathwayKey("30", "32")]: "Soft kingsroad farms",
  [pathwayKey("30", "34")]: "Crowded mild crownland road",
  [pathwayKey("30", "35")]: "Coastal rock toward the Hook",
  [pathwayKey("30", "36")]: "Easy west-road fields",
  [pathwayKey("31", "35")]: "Sea passage — biscuit and catch, not forage",
  [pathwayKey("32", "33")]: "Short pasture road",
  [pathwayKey("32", "34")]: "Mild crownland lanes",
  [pathwayKey("32", "36")]: "Watched farm tracks toward Hayford",
  [pathwayKey("33", "34")]: "Coastal hinterland farms",
};

const REGION_FALLBACK: Record<string, string> = {
  north: "Thin northern country",
  riverlands: "Riverland farms and village stores",
  westerlands: "Hill villages and mine-country scrap",
  crownlands: "Fat crownland farms",
};

export function holdForageSeed(holdId: string): string {
  const seeded = HOLD[holdId];
  if (seeded) return seeded;
  const hold = HOLDS.find((h) => h.id === holdId);
  if (hold?.forage?.trim()) return hold.forage.trim();
  return REGION_FALLBACK[hold?.region ?? ""] ?? "Ordinary country forage";
}

export function pathForageSeed(a: string, b: string): string {
  const key = pathwayKey(a, b);
  const seeded = PATH[key];
  if (seeded) return seeded;
  const path = PATHWAYS.find((p) => pathwayKey(p.a, p.b) === key);
  if (path?.sea) return "Ship stores only — no land forage on the crossing";
  if (path?.forage?.trim()) return path.forage.trim();
  return "Roadside villages and whatever the country yields";
}
