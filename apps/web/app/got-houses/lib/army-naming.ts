import type { ArmyUnit, Faction } from "../types";

/** Soft host label when no named commander leads — e.g. "Lannister Host". */
export function majorityHouseHostName(
  units: ArmyUnit[],
  faction: Faction,
  suffix = "Host"
): string {
  const counts = new Map<string, number>();
  for (const u of units) {
    counts.set(u.house, (counts.get(u.house) ?? 0) + u.count);
  }
  let bestHouse = "";
  let bestCount = 0;
  for (const [house, count] of counts) {
    if (count > bestCount) {
      bestHouse = house;
      bestCount = count;
    }
  }
  if (!bestHouse) {
    bestHouse = faction === "north" ? "Northern" : "Lannister";
  }
  return `${bestHouse} ${suffix}`;
}

export function armyNameForCommander(
  leadName: string | null | undefined,
  units: ArmyUnit[],
  faction: Faction,
  existingName?: string
): string {
  const words = (existingName ?? "").split(" ").filter(Boolean);
  const suffix = words.length >= 2 ? words[words.length - 1] : "Host";
  if (leadName?.trim()) {
    return `${leadName.trim()}'s ${suffix}`;
  }
  return majorityHouseHostName(units, faction, suffix);
}
