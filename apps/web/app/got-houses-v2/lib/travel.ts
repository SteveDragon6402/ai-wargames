import type {
  Army,
  Faction,
  Hold,
  HoldRuntime,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { garrisonHeadcount } from "./hold-runtime";

/** Adjacent holds — one step is one turn. */
export function adjacentHoldIds(holdId: string): string[] {
  return HOLDS_MAP.get(holdId)?.links ?? [];
}

/**
 * Shortest path in turns (each road/sea link = 1 turn). Null if unreachable.
 */
export function turnsBetween(fromHoldId: string, toHoldId: string): number | null {
  if (fromHoldId === toHoldId) return 0;
  if (!HOLDS_MAP.has(fromHoldId) || !HOLDS_MAP.has(toHoldId)) return null;
  const seen = new Set<string>([fromHoldId]);
  const q: { id: string; d: number }[] = [{ id: fromHoldId, d: 0 }];
  while (q.length > 0) {
    const cur = q.shift()!;
    for (const n of adjacentHoldIds(cur.id)) {
      if (seen.has(n)) continue;
      if (n === toHoldId) return cur.d + 1;
      seen.add(n);
      q.push({ id: n, d: cur.d + 1 });
    }
  }
  return null;
}

/** A posted garrison of the occupying faction, not the seat's native household. */
export function isOccupyingGarrison(hs: HoldRuntime | undefined): boolean {
  if (!hs) return false;
  const g = hs.garrison.faction;
  if (g !== "north" && g !== "westerlands") return false;
  if (garrisonHeadcount(hs.garrison) <= 0) return false;
  return hs.homeFaction !== g;
}

/**
 * Nearest hold this faction can actually stand on — own walls, a friendly host,
 * or empty home country — not the seat they are leaving, and not enemy-occupied.
 */
export function nearestFriendlyHold(
  fromHoldId: string,
  faction: Faction,
  holdStates: Record<string, HoldRuntime>,
  armies: Army[]
): string | null {
  const enemyOn = (holdId: string) =>
    armies.some((a) => a.holdId === holdId && a.faction !== faction);

  const friendly = (holdId: string) => {
    if (holdId === fromHoldId) return false;
    if (enemyOn(holdId)) return false;
    const hs = holdStates[holdId];
    if (hs?.controller === faction) return true;
    if (armies.some((a) => a.holdId === holdId && a.faction === faction)) {
      return true;
    }
    if (
      hs &&
      (hs.controller === null || hs.controller === "hostile") &&
      hs.homeFaction === faction
    ) {
      return true;
    }
    return false;
  };

  const seen = new Set<string>([fromHoldId]);
  const q = [fromHoldId];
  while (q.length > 0) {
    const cur = q.shift()!;
    for (const n of adjacentHoldIds(cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (friendly(n)) return n;
      q.push(n);
    }
  }
  return null;
}

export function retreatCountryKind(
  holdId: string,
  faction: Faction,
  holdStates: Record<string, HoldRuntime>
): "friendly" | "hostile" {
  const hs = holdStates[holdId];
  if (hs?.controller === faction) return "friendly";
  const enemy: Faction = faction === "north" ? "westerlands" : "north";
  if (hs?.controller === enemy) return "hostile";
  if (hs?.homeFaction === faction) return "friendly";
  if (hs?.homeFaction === enemy) return "hostile";
  return "hostile";
}

/**
 * Who actually holds the seat, vs the house that built it.
 * NPCs must not keep talking about Freys at a Lannister-occupied Twins.
 */
export function describeSeat(hold: Hold | undefined, hs: HoldRuntime | undefined): string {
  if (!hold) return "unknown hold";
  const built = `originally the seat of House ${hold.house} (${hold.lord})`;
  if (!hs) return `${hold.name} (${hold.region}) — ${built}. Current holder unknown.`;

  const gMen = garrisonHeadcount(hs.garrison);
  const gSide =
    hs.garrison.faction === "north"
      ? "Northern"
      : hs.garrison.faction === "westerlands"
        ? "Westerlands"
        : null;
  const who =
    hs.controller === "north"
      ? "the North"
      : hs.controller === "westerlands"
        ? "the Westerlands"
        : hs.controller === "hostile"
          ? "a hostile household"
          : "nobody (unheld)";

  const occupied =
    hs.controller === "north" || hs.controller === "westerlands"
      ? hs.controller !== hs.homeFaction
      : false;

  const occupyNote = occupied
    ? ` Currently HELD BY ${who.toUpperCase()} — House ${hold.house} does not hold these walls.`
    : ` Currently held by ${who}.`;
  const garrisonNote =
    gMen > 0 && gSide
      ? ` Garrison: ${gMen.toLocaleString()} ${gSide} men.`
      : gMen > 0
        ? ` Garrison: ${gMen.toLocaleString()} men.`
        : " Walls unmanned.";

  return `${hold.name} (${hold.region}) — ${built}.${occupyNote}${garrisonNote}`;
}
