import type { Faction } from "../types";

/**
 * Soft homeland character for each playable faction.
 * Fed to adjudicators so climate/terrain affinity can be reasoned about dynamically.
 * Adjudicator-only — never shown to players.
 */
export const FACTION_HOMELAND: Record<Faction, string> = {
  north:
    "Accustomed to bitter cold, snow, long winters, sparse forage, and hard northern roads; thrive in frost and struggle in dry southern heat",
  westerlands:
    "Accustomed to steep hills, mining country, west-coast mildness, and defended mountain passes; know hill fighting and struggle most in deep desert heat or endless fen",
};
