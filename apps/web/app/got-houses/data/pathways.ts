import type { Pathway } from "../types";
import { HOLDS } from "./holds";

export const PATHWAYS: Pathway[] = [
  {
    a: "01",
    b: "02",
    route: "East road along the White Knife marches — cold hills and lonely northern leagues",
  },
  {
    a: "01",
    b: "03",
    route: "Road southeast to the Bite — cold rain, better supply near the port, still northern weather",
  },
  {
    a: "01",
    b: "05",
    route: "Long northern road through snow country toward the Gift — bitter cold and thin forage",
  },
  {
    a: "01",
    b: "06",
    route: "Wolfswood paths west through wet forest and mud — slow for wagons, cold and dark even in summer",
  },
  {
    a: "01",
    b: "07",
    route: "Kingsroad and barrowland tracks across cold open downs — windy, exposed, and hard on footsore southerners",
  },
  {
    a: "01",
    b: "08",
    route: "Kingsroad south through the North toward the Neck — cold then increasingly boggy as the swamps draw near",
  },
  {
    a: "02",
    b: "04",
    route: "Coastal and upland tracks to Karhold — Shivering Sea wind and sparse villages",
  },
  {
    a: "02",
    b: "05",
    route: "Rough northern cross-country between Dreadfort and Last Hearth — snow, woods, and hard lodging",
  },
  {
    a: "03",
    b: "08",
    route: "Road from White Harbor into the Neck approaches — damp, then swamp-edged as Moat Cailin nears",
  },
  {
    a: "04",
    b: "05",
    route: "Far-northern track between Karstark and Umber lands — deep cold and empty country",
  },
  {
    a: "06",
    b: "07",
    route: "Western North track between wolfswood and barrows — muddy, cold, and lightly peopled",
  },
  {
    a: "07",
    b: "08",
    route: "South from the barrows into the Neck fringe — from open downs into bog and reed",
  },
  {
    a: "08",
    b: "17",
    route: "The Neck causeway and swamp road to the Twins — fever bogs, narrow firm ground, deadly to unprepared southern hosts; northerners know it better but still suffer the mud",
  },
  {
    a: "09",
    b: "10",
    route: "The final ascent from the Gates of the Moon to the Eyrie — mule path, sheer drop, exhausting climb",
  },
  {
    a: "09",
    b: "11",
    route: "High Vale mountain trails toward Runestone — thin air, steep stone, cold wind",
  },
  {
    a: "10",
    b: "13",
    route: "Foothill lanes between the Gates and Redfort — rocky Vale chill",
  },
  {
    a: "10",
    b: "14",
    route: "Vale foothill roads among oaks and stone — cool, steep, and well-watched",
  },
  {
    a: "10",
    b: "18",
    route: "High road down from the Vale into the Riverlands toward Harrenhal — mountain descent into milder wet lowlands",
  },
  {
    a: "11",
    b: "12",
    route: "Coastal Vale road to Gulltown — salt wind and firmer footing than the high passes",
  },
  {
    a: "12",
    b: "13",
    route: "Inland from Gulltown into the Redfort hills — cool climb from the port",
  },
  {
    a: "13",
    b: "15",
    route: "Vale hill tracks between Redfort and Heart's Home — steep and cool",
  },
  {
    a: "14",
    b: "15",
    route: "Wooded Vale lanes between Ironoaks and Heart's Home — cool cover and narrow roads",
  },
  {
    a: "16",
    b: "17",
    route: "Green Fork road to the Twins — wet riverland leagues and Frey toll-ground",
  },
  {
    a: "16",
    b: "19",
    route: "Road northwest to Seagard — riverland fields then coastal wind",
  },
  {
    a: "16",
    b: "21",
    route: "Red Fork marches to Stone Hedge — open mild river country",
  },
  {
    a: "16",
    b: "22",
    route: "Short Red Fork march through river woods — damp mild ground",
  },
  {
    a: "16",
    b: "25",
    route: "River road west into the Golden Tooth pass — from watered plains into a steep Westerlands choke-point",
  },
  {
    a: "17",
    b: "18",
    route: "Long riverland march between Twins and Harrenhal — muddy roads, mild damp air, soft camping",
  },
  {
    a: "17",
    b: "19",
    route: "Cross-country between Twins and Seagard — wet fields and coastal approach",
  },
  {
    a: "18",
    b: "20",
    route: "Gods Eye and Bay of Crabs approaches to Maidenpool — lakeside damp then coastal mud",
  },
  {
    a: "18",
    b: "21",
    route: "West along the Trident marches to Stone Hedge — open riverland",
  },
  {
    a: "18",
    b: "30",
    route: "Kingsroad south from Harrenhal to King's Landing — softening climate, busy road, soft crownland mud near the capital",
  },
  {
    a: "20",
    b: "30",
    route: "Bay road into King's Landing — crowded approaches and Blackwater mud",
  },
  {
    a: "20",
    b: "34",
    route: "Coastal road from Maidenpool to Duskendale — mild wet crownland shore",
  },
  {
    a: "21",
    b: "22",
    route: "Short feud-road between Bracken and Blackwood seats — river woods and open fields",
  },
  {
    a: "23",
    b: "24",
    route: "Short descent to Lannisport — paved and easy, mild sea air",
  },
  {
    a: "23",
    b: "25",
    route: "East into the Golden Tooth mountains — rising stone passes and cool hill air",
  },
  {
    a: "23",
    b: "26",
    route: "Ocean road south through coastal hills to Crakehall — mild west-coast march",
  },
  {
    a: "23",
    b: "27",
    route: "Hill roads from the Rock into Marbrand country — steep familiar Westerlands lanes",
  },
  {
    a: "24",
    b: "26",
    route: "Coastal ocean road between Lannisport and Crakehall — mild hills and good footing",
  },
  {
    a: "25",
    b: "28",
    route: "Mountain lanes between Golden Tooth and Deep Den — narrow cool passes",
  },
  {
    a: "26",
    b: "29",
    route: "Hill tracks inland to Clegane's Keep — rough, ugly, and steep",
  },
  {
    a: "26",
    b: "46",
    route: "Ocean road south from Crakehall into the Reach at Old Oak — climate warming, easier forage",
  },
  {
    a: "27",
    b: "28",
    route: "Hill passes between Ashemark and Deep Den — cool stone and mining tracks",
  },
  {
    a: "27",
    b: "29",
    route: "Rough Westerlands hill country between Ashemark and Clegane lands",
  },
  {
    a: "30",
    b: "31",
    route: "Narrow sea crossing to Dragonstone — ship-borne, wind and spray, no easy land march",
  },
  {
    a: "30",
    b: "32",
    route: "Kingsroad north to Rosby — soft roads and mild air",
  },
  {
    a: "30",
    b: "34",
    route: "Coastal kingsroad to Duskendale — mild crowded crownland road",
  },
  {
    a: "30",
    b: "35",
    route: "East toward Massey's Hook and Sharp Point — coastal rock and salt wind",
  },
  {
    a: "30",
    b: "36",
    route: "Short west road to Hayford — easy crownland fields",
  },
  {
    a: "30",
    b: "37",
    route: "Kingsroad and stormland approaches to Storm's End — weather turning wet and violent",
  },
  {
    a: "30",
    b: "47",
    route: "Roseroad southwest toward Bitterbridge — warm Reach approach, open fertile country",
  },
  {
    a: "31",
    b: "35",
    route: "Island and hook waters between Dragonstone and Sharp Point — sea passage, not a land road",
  },
  {
    a: "32",
    b: "33",
    route: "Short pasture road to Stokeworth — soft fields",
  },
  {
    a: "32",
    b: "34",
    route: "Crownland lanes between Rosby and Duskendale — mild and easy",
  },
  {
    a: "33",
    b: "34",
    route: "Coastal hinterland tracks to Duskendale — mild mud",
  },
  {
    a: "36",
    b: "47",
    route: "Road from Hayford into the Reach at Bitterbridge — climate warming along the Mander approaches",
  },
  {
    a: "37",
    b: "38",
    route: "Inland stormland roads to Griffin's Roost — wet hills",
  },
  {
    a: "37",
    b: "39",
    route: "Stormland road to Bronzegate — rain, mud, and rolling hills",
  },
  {
    a: "37",
    b: "42",
    route: "Coastal and cape roads toward Stonehelm — wind and rain",
  },
  {
    a: "37",
    b: "43",
    route: "Sea passage to Tarth — ship crossing under storm winds",
  },
  {
    a: "38",
    b: "39",
    route: "Short stormland lane between Griffin's Roost and Bronzegate",
  },
  {
    a: "38",
    b: "41",
    route: "Marcher roads west to Blackhaven — drying hills toward Dorne",
  },
  {
    a: "40",
    b: "41",
    route: "Dornish Marches track between Nightsong and Blackhaven — hot dry border hills",
  },
  {
    a: "40",
    b: "42",
    route: "Marcher and cape roads between Nightsong and Stonehelm",
  },
  {
    a: "40",
    b: "55",
    route: "Prince's Pass into Dorne at Skyreach — mountain heat, steep stone, and a famous southern invasion road; crushing for cold-bred hosts",
  },
  {
    a: "41",
    b: "53",
    route: "The Boneway into Dorne at Yronwood — brutal Red Mountain pass, dry heat, and ambush country; one of the hardest marches in Westeros for northern armies",
  },
  {
    a: "44",
    b: "45",
    route: "Honeywine road to Oldtown — warm wet coastal Reach, excellent forage",
  },
  {
    a: "44",
    b: "46",
    route: "Ocean road west to Old Oak — mild wooded Reach",
  },
  {
    a: "44",
    b: "47",
    route: "Roseroad and Mander approaches between Highgarden and Bitterbridge — warm, fertile, easy marching",
  },
  {
    a: "44",
    b: "48",
    route: "South into Tarly hunt country and Red Mountain foothills — warmer upland forest",
  },
  {
    a: "44",
    b: "49",
    route: "Reach lanes to Goldengrove — warm soft country",
  },
  {
    a: "44",
    b: "50",
    route: "Short Reach orchard roads to Cider Hall — mild and well supplied",
  },
  {
    a: "45",
    b: "48",
    route: "Road from Oldtown into Horn Hill country — from port warmth into forested foothills",
  },
  {
    a: "47",
    b: "49",
    route: "Mander-side Reach roads between Bitterbridge and Goldengrove",
  },
  {
    a: "49",
    b: "50",
    route: "Orchard country between Goldengrove and Cider Hall — easy warm marching",
  },
  {
    a: "51",
    b: "54",
    route: "Hot coastal Dornish road to Ghost Hill — dry wind and scarce shade",
  },
  {
    a: "51",
    b: "56",
    route: "Open Dornish march to Vaith — sand, sun, and thin water",
  },
  {
    a: "51",
    b: "57",
    route: "Desert-river road along the Greenblood to Godsgrace — fierce heat",
  },
  {
    a: "52",
    b: "55",
    route: "Mountain and desert tracks from Starfall to Skyreach — Torrentine then Prince's Pass heights",
  },
  {
    a: "52",
    b: "56",
    route: "Desert crossing between Starfall and Vaith — dry heat and hard going",
  },
  {
    a: "53",
    b: "55",
    route: "Red Mountain lanes between Yronwood and Skyreach — linking Boneway and Prince's Pass",
  },
  {
    a: "53",
    b: "57",
    route: "Dornish interior from Yronwood to Godsgrace — heat after the Boneway",
  },
  {
    a: "56",
    b: "57",
    route: "Greenblood approach between Vaith and Godsgrace — river heat and open Dornish plain",
  },
];

function pathwayKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

const PATHWAY_MAP = new Map<string, Pathway>(
  PATHWAYS.map((p) => [pathwayKey(p.a, p.b), p])
);

/** Soft route between two adjacent holds, or undefined if missing. */
export function getPathway(a: string, b: string): Pathway | undefined {
  return PATHWAY_MAP.get(pathwayKey(a, b));
}

/** Soft route text, with a safe fallback if data is incomplete. */
export function getPathwayRoute(a: string, b: string): string {
  return (
    getPathway(a, b)?.route ??
    "Ordinary road between the holds — no special difficulty recorded"
  );
}

/**
 * Dev/runtime assert: every hold link has a pathway and every pathway matches a link.
 * Throws if the graph and pathway table drift apart.
 */
export function assertPathwayCoverage(): void {
  const linkKeys = new Set<string>();
  for (const hold of HOLDS) {
    for (const otherId of hold.links) {
      linkKeys.add(pathwayKey(hold.id, otherId));
      if (!hold.ground?.trim()) {
        throw new Error(`Hold ${hold.id} (${hold.name}) is missing ground`);
      }
    }
  }

  const pathwayKeys = new Set(PATHWAYS.map((p) => pathwayKey(p.a, p.b)));

  for (const key of linkKeys) {
    if (!pathwayKeys.has(key)) {
      throw new Error(`Missing pathway for link ${key}`);
    }
  }
  for (const key of pathwayKeys) {
    if (!linkKeys.has(key)) {
      throw new Error(`Orphan pathway ${key} has no matching hold link`);
    }
  }
}

// Run coverage check when this module loads in development.
if (process.env.NODE_ENV !== "production") {
  assertPathwayCoverage();
}
