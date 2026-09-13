import type {
  Army,
  CharacterId,
  CharacterState,
  Faction,
  HoldRuntime,
  Traveller,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { nearestFriendlyHold, turnsBetween } from "./travel";

/**
 * Released leaders.
 *
 * A leader let go on terms **always** reappears. Rank and file melt away into
 * the countryside — see disperse.ts — but a named man has somewhere to be and
 * the means to get there. He picks a refuge, takes as many turns to reach it as
 * it is spaces away, and walks back into the game.
 *
 * There is no fate roll here and no attrition. Letting a lord walk means
 * letting him walk, and facing him again later is the price of mercy.
 */

/** How far a freed man will travel to reach a refuge of his choosing. */
export const RELEASE_RANGE = 3;

export interface RefugeOption {
  holdId: string;
  holdName: string;
  distance: number;
  kind: "own_seat" | "friendly_host" | "home_country";
  underSiege: boolean;
  razed: boolean;
  /** What is waiting for him there, for the AI's benefit. */
  note: string;
}

/**
 * Where a freed man could plausibly go, within `RELEASE_RANGE` spaces.
 *
 * Offered to the character so they can choose for themselves rather than being
 * shunted to the nearest wall.
 */
export function refugeOptions(
  fromHoldId: string,
  faction: Faction,
  holdStates: Record<string, HoldRuntime>,
  armies: Army[],
  range: number = RELEASE_RANGE
): RefugeOption[] {
  const distance = new Map<string, number>([[fromHoldId, 0]]);
  let frontier = [fromHoldId];
  for (let d = 1; d <= range; d++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const n of HOLDS_MAP.get(cur)?.links ?? []) {
        if (distance.has(n)) continue;
        distance.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }

  const out: RefugeOption[] = [];
  for (const [holdId, d] of distance) {
    if (d === 0) continue;
    const hs = holdStates[holdId];
    const hold = HOLDS_MAP.get(holdId);
    if (!hs || !hold) continue;

    // Walking into an enemy host is not a refuge.
    if (armies.some((a) => a.holdId === holdId && a.faction !== faction)) {
      continue;
    }

    const friendlyHost = armies.find(
      (a) => a.holdId === holdId && a.faction === faction
    );

    let kind: RefugeOption["kind"] | null = null;
    if (hs.controller === faction) kind = "own_seat";
    else if (friendlyHost) kind = "friendly_host";
    else if (
      (hs.controller === null || hs.controller === "hostile") &&
      hs.homeFaction === faction
    ) {
      kind = "home_country";
    }
    if (!kind) continue;

    const notes: string[] = [];
    if (friendlyHost) notes.push(`${friendlyHost.name} is camped there`);
    if (hs.razed) notes.push("the seat is a burned ruin");
    if (hs.siege) notes.push(`it is under siege by ${hs.siege.besiegerFaction}`);

    out.push({
      holdId,
      holdName: hold.name,
      distance: d,
      kind,
      underSiege: !!hs.siege,
      razed: !!hs.razed,
      note: notes.join("; "),
    });
  }

  return out.sort((a, b) => a.distance - b.distance || a.holdId.localeCompare(b.holdId));
}

/** Where a freed man goes if nobody asks him — the nearest friendly wall. */
export function defaultRefuge(
  fromHoldId: string,
  faction: Faction,
  holdStates: Record<string, HoldRuntime>,
  armies: Army[]
): string | null {
  const options = refugeOptions(fromHoldId, faction, holdStates, armies);
  if (options.length > 0) {
    // A quiet seat of his own side first; anything in reach otherwise.
    const quiet = options.find(
      (o) => o.kind === "own_seat" && !o.underSiege && !o.razed
    );
    return (quiet ?? options[0]).holdId;
  }
  // Beyond the offered range, fall back to an unbounded search — he always
  // gets somewhere, however far he has to walk.
  return nearestFriendlyHold(fromHoldId, faction, holdStates, armies);
}

/** Put a freed man on the road. Arrival is one turn per space travelled. */
export function startTravel(
  characterId: CharacterId,
  fromHoldId: string,
  destHoldId: string,
  currentTurn: number
): Traveller {
  const distance = turnsBetween(fromHoldId, destHoldId) ?? 1;
  return {
    characterId,
    fromHoldId,
    destHoldId,
    // A man freed at the gate is not inside the next castle the same day.
    arrivesTurn: currentTurn + Math.max(1, distance),
    needsDestination: true,
  };
}

export interface TravelTickResult {
  travellers: Traveller[];
  characters: Record<CharacterId, CharacterState>;
  /** Who walked through a gate this turn, for the log. */
  arrivals: { characterId: CharacterId; name: string; holdId: string }[];
  /** Men whose destination turned hostile and who had to go elsewhere. */
  rerouted: { characterId: CharacterId; name: string; toHoldId: string }[];
}

/**
 * Advance everyone on the road by one turn.
 *
 * A traveller whose chosen refuge has fallen or been invested while he was
 * walking re-routes rather than strolling into enemy hands. The re-route uses
 * the unbounded search, so he is never simply lost.
 */
export function tickTravellers(
  travellers: Traveller[] | undefined,
  turn: number,
  holdStates: Record<string, HoldRuntime>,
  armies: Army[],
  characters: Record<CharacterId, CharacterState>
): TravelTickResult {
  const queue = travellers ?? [];
  const remaining: Traveller[] = [];
  const arrivals: TravelTickResult["arrivals"] = [];
  const rerouted: TravelTickResult["rerouted"] = [];
  let nextCharacters = characters;

  for (const t of queue) {
    const c = nextCharacters[t.characterId];
    // Died or was taken again while on the road.
    if (!c || !c.alive || (c.kind === "npc" && c.captive)) continue;

    const faction = c.faction;
    const dest = holdStates[t.destHoldId];
    const enemyThere =
      armies.some((a) => a.holdId === t.destHoldId && a.faction !== faction) ||
      (dest != null &&
        dest.controller !== faction &&
        dest.controller !== null &&
        dest.controller !== "hostile");

    if (enemyThere) {
      const alt = nearestFriendlyHold(t.fromHoldId, faction, holdStates, armies);
      if (alt && alt !== t.destHoldId) {
        const redirected = startTravel(t.characterId, t.fromHoldId, alt, turn);
        remaining.push(redirected);
        rerouted.push({
          characterId: t.characterId,
          name: c.name,
          toHoldId: alt,
        });
        continue;
      }
      // Nowhere better to go — keep walking and hope.
    }

    if (turn >= t.arrivesTurn) {
      if (c.kind === "npc") {
        nextCharacters = {
          ...nextCharacters,
          [t.characterId]: {
            ...c,
            holdId: t.destHoldId,
            armyId: null,
            captive: false,
            notepad: appendArrival(c.notepad, t, turn),
            mood: "Newly returned, and not inclined to forget his captivity",
          },
        };
      }
      arrivals.push({
        characterId: t.characterId,
        name: c.name,
        holdId: t.destHoldId,
      });
      continue;
    }

    remaining.push(t);
  }

  return {
    travellers: remaining,
    characters: nextCharacters,
    arrivals,
    rerouted,
  };
}

function appendArrival(notepad: string, t: Traveller, turn: number): string {
  const from = HOLDS_MAP.get(t.fromHoldId)?.name ?? t.fromHoldId;
  const to = HOLDS_MAP.get(t.destHoldId)?.name ?? t.destHoldId;
  const line = `Turn ${turn}: released at ${from}, reached ${to} on foot. I remember who held me and on what terms.`;
  if (notepad.includes(line)) return notepad;
  return `${notepad}\n${line}`.trim().slice(-800);
}

/** One line for the log when a man is turned loose. */
export function describeRelease(
  name: string,
  fromHoldId: string,
  destHoldId: string,
  arrivesTurn: number
): string {
  const from = HOLDS_MAP.get(fromHoldId)?.name ?? fromHoldId;
  const to = HOLDS_MAP.get(destHoldId)?.name ?? destHoldId;
  return `${name} was released at ${from} and set out for ${to}, expected there on turn ${arrivesTurn}.`;
}
