import type { EdgeDef, EdgeTag, NodeDef, TerrainTag } from "@wargame/shared";

export function nodeNameMap(nodes: NodeDef[]): Record<string, string> {
  return Object.fromEntries(nodes.map((n) => [n.id, n.name]));
}

const TERRAIN_LABELS: Partial<Record<TerrainTag, string>> = {
  capital_rohan: "Capital",
  capital_isengard: "Capital",
  capital_lannister: "Capital",
  capital_stark: "Capital",
  fortified: "Fortified",
  stronghold: "Stronghold",
  easy_defend: "Easy defend",
  hard_defend: "Hard defend",
  rugged: "Rugged",
  open: "Open",
  river_crossing: "River",
  fast_march: "Fast march",
  industrial: "Industrial",
  ambush: "Ambush",
};

/** Descriptive phrase for the territory card body. */
const TERRAIN_PHRASES: Partial<Record<TerrainTag, string>> = {
  capital_rohan: "Rohan capital",
  capital_isengard: "Isengard capital",
  capital_lannister: "Lannister command position",
  capital_stark: "Stark muster point",
  fortified: "Fortified position",
  stronghold: "Major stronghold",
  easy_defend: "Defensive ground",
  hard_defend: "Exposed position",
  rugged: "Rugged terrain",
  open: "Open plains",
  river_crossing: "River ford",
  fast_march: "Open road country",
  industrial: "Industrial centre",
  ambush: "Ambush country",
};

export function terrainPhrase(tags: TerrainTag[]): string {
  const priority: TerrainTag[] = [
    "capital_rohan",
    "capital_isengard",
    "capital_lannister",
    "capital_stark",
    "stronghold",
    "fortified",
    "river_crossing",
    "ambush",
    "easy_defend",
    "hard_defend",
    "industrial",
    "rugged",
    "open",
    "fast_march",
  ];
  for (const p of priority) {
    if (tags.includes(p)) return TERRAIN_PHRASES[p] ?? terrainLabel(p);
  }
  return tags.length > 0 ? (TERRAIN_PHRASES[tags[0]!] ?? terrainLabel(tags[0]!)) : "";
}

const TERRAIN_TOOLTIPS: Partial<Record<TerrainTag, string>> = {
  capital_rohan: "Faction capital — high strategic value",
  capital_isengard: "Faction capital — high strategic value",
  capital_lannister: "Lannister command — high strategic value",
  capital_stark: "Stark muster — high strategic value",
  fortified: "Improved defense for dug-in troops",
  stronghold: "Major defensive bonus",
  easy_defend: "Favorable ground for defenders",
  hard_defend: "Difficult to hold — lower defense",
  rugged: "Slower movement, moderate cover",
  open: "Little cover — movement favored",
  river_crossing: "River obstacle — harder to attack across",
  fast_march: "Good ground for rapid movement",
  industrial: "Supply hub — slight defensive bonus",
  ambush: "Ambush terrain — defender advantage",
};

export function terrainLabel(tag: TerrainTag): string {
  return TERRAIN_LABELS[tag] ?? tag.replace(/_/g, " ");
}

export function terrainTooltip(tag: TerrainTag): string {
  return TERRAIN_TOOLTIPS[tag] ?? terrainLabel(tag);
}

/** Compact glyph for wargame-style territory markers (tooltip carries full text). */
export function terrainIcon(tag: TerrainTag): string {
  const icons: Partial<Record<TerrainTag, string>> = {
    capital_rohan: "♔",
    capital_isengard: "♜",
    capital_lannister: "♔",
    capital_stark: "♔",
    fortified: "⛊",
    stronghold: "▣",
    easy_defend: "↑",
    hard_defend: "↓",
    rugged: "△",
    open: "○",
    river_crossing: "≈",
    fast_march: "»",
    industrial: "⚙",
    ambush: "†",
  };
  return icons[tag] ?? "·";
}

export function primaryTerrainTags(tags: TerrainTag[]): TerrainTag[] {
  const priority: TerrainTag[] = [
    "capital_rohan",
    "capital_isengard",
    "capital_lannister",
    "capital_stark",
    "stronghold",
    "fortified",
    "river_crossing",
    "ambush",
    "rugged",
    "open",
  ];
  const out: TerrainTag[] = [];
  for (const p of priority) {
    if (tags.includes(p)) out.push(p);
  }
  if (out.length === 0 && tags.length > 0) out.push(tags[0]!);
  return out.slice(0, 2);
}

export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  label?: string;
}

export function edgeStyle(tags: EdgeTag[]): EdgeStyle {
  if (tags.includes("river")) {
    return {
      stroke: "#38bdf8",
      strokeWidth: 2.5,
      strokeDasharray: "8 5",
      label: "River",
    };
  }
  if (tags.includes("rugged")) {
    return {
      stroke: "#a8a29e",
      strokeWidth: 2.5,
      strokeDasharray: "6 4",
      label: "Trail",
    };
  }
  return { stroke: "#d97706", strokeWidth: 2.5, label: "Road" };
}

export function edgeLabel(e: EdgeDef, fromName: string, toName: string): string {
  if (e.tags.includes("river")) return "River crossing";
  if (e.tags.includes("rugged")) return "Rugged trail";
  return `${fromName} — ${toName}`;
}
