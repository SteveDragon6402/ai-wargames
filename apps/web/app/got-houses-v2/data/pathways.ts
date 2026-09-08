import type { Pathway } from "../types";
import { HOLDS } from "./holds";

/**
 * Soft march text per edge, preserved verbatim from the eight-region map.
 * `sea: true` marks a crossing that is made by ship rather than road.
 */
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
    sea: true,
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
    a: "31",
    b: "35",
    route: "Island and hook waters between Dragonstone and Sharp Point — sea passage, not a land road",
    sea: true,
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
    a: "32",
    b: "36",
    route: "Crossroads tracks between Rosby and Hayford across the flat crownland farm country — short, well-travelled, and watched from King's Landing",
  },
  {
    a: "33",
    b: "34",
    route: "Coastal hinterland tracks to Duskendale — mild mud",
  },
];

function pathwayKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

const PATHWAY_MAP = new Map(PATHWAYS.map((p) => [pathwayKey(p.a, p.b), p]));

export function getPathway(a: string, b: string): Pathway | undefined {
  return PATHWAY_MAP.get(pathwayKey(a, b));
}

export function getPathwayRoute(a: string, b: string): string {
  return getPathway(a, b)?.route ?? "Unremarkable road between neighbouring seats";
}

export function isSeaCrossing(a: string, b: string): boolean {
  return getPathway(a, b)?.sea === true;
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
