import type {
  Army,
  ArmyUnit,
  CharacterId,
  CharacterState,
  Faction,
  PrisonerGroup,
  PrisonerLocation,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { factionName } from "./deeds";

/**
 * Men held captive.
 *
 * A prisoner group is a card, never a merge. Attached to a host it takes its
 * position from the escort, so there is no second movement system to resolve;
 * left in a castle it sits there until somebody comes for it. Captives have no
 * combat value of their own. Their weight is deliberately soft: the battle and
 * tiredness models are simply told the captives are there, and a thousand men
 * shepherding four thousand prisoners into a fight can work out the rest.
 */

export function prisonerMen(group: PrisonerGroup): number {
  return group.units.reduce((sum, u) => sum + u.count, 0);
}

export function totalPrisonerMen(groups: PrisonerGroup[]): number {
  return groups.reduce((sum, g) => sum + prisonerMen(g), 0);
}

function groupId(): string {
  return `pris-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreatePrisonersInput {
  captorFaction: Faction;
  faction: Faction;
  location: PrisonerLocation;
  units?: ArmyUnit[];
  characterIds?: CharacterId[];
  takenAtHoldId: string;
  takenTurn: number;
  origin: "siege" | "battle";
  battleId?: string | null;
}

/** Take men prisoner. Returns null when there is nobody to take. */
export function createPrisonerGroup(
  input: CreatePrisonersInput
): PrisonerGroup | null {
  const units = (input.units ?? []).filter((u) => u.count > 0);
  const characterIds = input.characterIds ?? [];
  if (units.length === 0 && characterIds.length === 0) return null;
  return {
    id: groupId(),
    captorFaction: input.captorFaction,
    faction: input.faction,
    location: input.location,
    units: units.map((u) => ({ ...u })),
    characterIds: [...characterIds],
    takenAtHoldId: input.takenAtHoldId,
    takenTurn: input.takenTurn,
    origin: input.origin,
    battleId: input.battleId ?? null,
  };
}

/* ── Finding captives ─────────────────────────────────────────── */

/** Groups sitting behind these walls. */
export function prisonersAt(
  groups: PrisonerGroup[] | undefined,
  holdId: string
): PrisonerGroup[] {
  return (groups ?? []).filter(
    (g) => g.location.kind === "hold" && g.location.holdId === holdId
  );
}

/** Groups riding with this host. */
export function prisonersWith(
  groups: PrisonerGroup[] | undefined,
  armyId: string
): PrisonerGroup[] {
  return (groups ?? []).filter(
    (g) => g.location.kind === "army" && g.location.armyId === armyId
  );
}

export function prisonersHeldBy(
  groups: PrisonerGroup[] | undefined,
  faction: Faction
): PrisonerGroup[] {
  return (groups ?? []).filter((g) => g.captorFaction === faction);
}

/** The group holding a particular man, if anyone is. */
export function groupHolding(
  groups: PrisonerGroup[] | undefined,
  characterId: CharacterId
): PrisonerGroup | null {
  return (
    (groups ?? []).find((g) => g.characterIds.includes(characterId)) ?? null
  );
}

/**
 * Where a group physically is, resolving an escort's position.
 * Null when the escorting host no longer exists.
 */
export function prisonerHoldId(
  group: PrisonerGroup,
  armies: Army[]
): string | null {
  const loc = group.location;
  if (loc.kind === "hold") return loc.holdId;
  return armies.find((a) => a.id === loc.armyId)?.holdId ?? null;
}

/* ── Moving and disposing ─────────────────────────────────────── */

/** Hand a group to a host, or set it down behind walls. */
export function movePrisoners(
  groups: PrisonerGroup[] | undefined,
  groupId: string,
  to: PrisonerLocation
): PrisonerGroup[] {
  return (groups ?? []).map((g) =>
    g.id === groupId ? { ...g, location: to } : g
  );
}

export function removeGroup(
  groups: PrisonerGroup[] | undefined,
  groupId: string
): PrisonerGroup[] {
  return (groups ?? []).filter((g) => g.id !== groupId);
}

/**
 * Let a body of captives go.
 *
 * The rank and file scatter — that is `disperse`'s business, not ours. The
 * named men are freed here: no longer captive, and not yet anywhere, since
 * `release.ts` puts them on the road to wherever they choose to go.
 */
export function releasePrisoners(
  characters: Record<CharacterId, CharacterState>,
  group: PrisonerGroup
): Record<CharacterId, CharacterState> {
  const next = { ...characters };
  for (const id of group.characterIds) {
    const c = next[id];
    if (!c || c.kind !== "npc") continue;
    next[id] = { ...c, captive: false, holdId: null, armyId: null };
  }
  return next;
}

/** Put a body of captives to the sword. */
export function executePrisoners(
  characters: Record<CharacterId, CharacterState>,
  group: PrisonerGroup
): Record<CharacterId, CharacterState> {
  const next = { ...characters };
  for (const id of group.characterIds) {
    const c = next[id];
    if (!c) continue;
    next[id] =
      c.kind === "npc"
        ? { ...c, alive: false, captive: false, armyId: null, holdId: null }
        : { ...c, alive: false, armyId: null };
  }
  return next;
}

/** Mark named captives as held, and strip them off host and hold. */
export function markCaptive(
  characters: Record<CharacterId, CharacterState>,
  characterIds: CharacterId[]
): Record<CharacterId, CharacterState> {
  const next = { ...characters };
  for (const id of characterIds) {
    const c = next[id];
    if (!c || c.kind !== "npc") continue;
    next[id] = { ...c, captive: true, armyId: null, holdId: null };
  }
  return next;
}

/* ── Liberation ───────────────────────────────────────────────── */

export interface LiberationResult {
  prisoners: PrisonerGroup[];
  characters: Record<CharacterId, CharacterState>;
  /** Units folded into the liberating host, to be merged by the caller. */
  freedUnits: ArmyUnit[];
  freedCharacterIds: CharacterId[];
  freedMen: number;
  /** Groups that were actually freed, for the ledger. */
  liberated: PrisonerGroup[];
}

/**
 * Free every captive of `liberatorFaction` in these groups.
 *
 * Two paths lead here and both matter. An escorting host loses a battle and the
 * men it was dragging along are suddenly among friends; or a city is retaken
 * and whoever the last holder had locked up walks out. Storming a seat
 * therefore does two things at once — its garrison becomes your prisoners,
 * and anyone the enemy was holding there goes free to their own side.
 */
export function liberatePrisoners(
  allGroups: PrisonerGroup[] | undefined,
  candidateGroupIds: string[],
  liberatorFaction: Faction,
  characters: Record<CharacterId, CharacterState>,
  /** Host the freed men fall in with; null leaves them unattached. */
  joinArmyId: string | null
): LiberationResult {
  const groups = allGroups ?? [];
  const candidates = new Set(candidateGroupIds);

  const liberated = groups.filter(
    (g) =>
      candidates.has(g.id) &&
      // Their own men, held by the other side.
      g.faction === liberatorFaction &&
      g.captorFaction !== liberatorFaction
  );

  if (liberated.length === 0) {
    return {
      prisoners: groups,
      characters,
      freedUnits: [],
      freedCharacterIds: [],
      freedMen: 0,
      liberated: [],
    };
  }

  const freedIds = new Set(liberated.map((g) => g.id));
  const freedUnits: ArmyUnit[] = [];
  const freedCharacterIds: CharacterId[] = [];
  let nextCharacters = { ...characters };

  for (const g of liberated) {
    for (const u of g.units) freedUnits.push({ ...u });
    for (const id of g.characterIds) {
      freedCharacterIds.push(id);
      const c = nextCharacters[id];
      if (!c || c.kind !== "npc") continue;
      // Back in the fight, with the host that opened the door.
      nextCharacters[id] = {
        ...c,
        captive: false,
        armyId: joinArmyId,
        holdId: null,
      };
    }
  }

  return {
    prisoners: groups.filter((g) => !freedIds.has(g.id)),
    characters: nextCharacters,
    freedUnits,
    freedCharacterIds,
    freedMen: liberated.reduce((s, g) => s + prisonerMen(g), 0),
    liberated,
  };
}

/**
 * A host has been destroyed. Whatever it was escorting has to go somewhere:
 * its own captives fall to the victor, and captives of the victor's side go
 * free. Handled by the caller in two passes; this only re-homes what remains.
 */
export function reassignEscortedPrisoners(
  groups: PrisonerGroup[] | undefined,
  lostArmyId: string,
  victorFaction: Faction,
  victorArmyId: string | null,
  fallbackHoldId: string
): PrisonerGroup[] {
  return (groups ?? []).map((g) => {
    if (g.location.kind !== "army" || g.location.armyId !== lostArmyId) return g;
    // The guards are gone; the victor inherits the column.
    return {
      ...g,
      captorFaction: victorFaction,
      location: victorArmyId
        ? { kind: "army" as const, armyId: victorArmyId }
        : { kind: "hold" as const, holdId: fallbackHoldId },
    };
  });
}

/** Drop any group whose escorting host no longer exists onto the ground. */
export function groundOrphanedGroups(
  groups: PrisonerGroup[] | undefined,
  armies: Army[],
  fallbackHoldId: (group: PrisonerGroup) => string | null
): PrisonerGroup[] {
  const live = new Set(armies.map((a) => a.id));
  const out: PrisonerGroup[] = [];
  for (const g of groups ?? []) {
    if (g.location.kind !== "army" || live.has(g.location.armyId)) {
      out.push(g);
      continue;
    }
    const holdId = fallbackHoldId(g);
    // Nowhere to put them and nobody guarding them: they are gone.
    if (holdId) out.push({ ...g, location: { kind: "hold", holdId } });
  }
  return out;
}

/* ── Describing captives ──────────────────────────────────────── */

function nameList(
  characters: Record<CharacterId, CharacterState>,
  ids: CharacterId[]
): string[] {
  return ids.map((id) => characters[id]?.name ?? id);
}

function holdName(holdId: string): string {
  return HOLDS_MAP.get(holdId)?.name ?? holdId;
}

/**
 * What a host is dragging along, for the battle and tiredness models.
 *
 * Stated as a fact with no guidance attached: the chronicler is better placed
 * than any formula to judge what a column of captives costs a marching army.
 */
export function describePrisonerBurden(
  groups: PrisonerGroup[] | undefined,
  armyId: string,
  characters: Record<CharacterId, CharacterState>
): string | null {
  const carried = prisonersWith(groups, armyId);
  if (carried.length === 0) return null;

  const men = totalPrisonerMen(carried);
  const names = carried.flatMap((g) => nameList(characters, g.characterIds));
  const where = [...new Set(carried.map((g) => holdName(g.takenAtHoldId)))];

  const parts: string[] = [];
  if (men > 0) {
    parts.push(`escorting ${men.toLocaleString()} captives`);
  }
  if (names.length > 0) {
    parts.push(
      `${men > 0 ? "among them " : "escorting "}${names.slice(0, 6).join(", ")}${names.length > 6 ? ` and ${names.length - 6} others` : ""}`
    );
  }
  if (where.length > 0) parts.push(`taken at ${where.join(" and ")}`);
  return parts.join(", ");
}

/** The same line for a castle full of captives. */
export function describeHoldPrisoners(
  groups: PrisonerGroup[] | undefined,
  holdId: string,
  characters: Record<CharacterId, CharacterState>
): string | null {
  const held = prisonersAt(groups, holdId);
  if (held.length === 0) return null;
  const men = totalPrisonerMen(held);
  const names = held.flatMap((g) => nameList(characters, g.characterIds));
  const parts: string[] = [];
  if (men > 0) parts.push(`${men.toLocaleString()} captives in the cells`);
  if (names.length > 0) parts.push(names.slice(0, 6).join(", "));
  return parts.join(" — ");
}

export interface PrisonerRosterEntry {
  groupId: string;
  captorFaction: Faction;
  faction: Faction;
  men: number;
  names: string[];
  takenAtHoldId: string;
  takenAtHoldName: string;
  takenTurn: number;
  origin: "siege" | "battle";
  /** Plain English: where they are being kept right now. */
  whereabouts: string;
}

export function prisonerRoster(
  groups: PrisonerGroup[] | undefined,
  characters: Record<CharacterId, CharacterState>,
  armies: Army[],
  captorFaction?: Faction
): PrisonerRosterEntry[] {
  const list = captorFaction
    ? prisonersHeldBy(groups, captorFaction)
    : (groups ?? []);
  return list.map((g) => ({
    groupId: g.id,
    captorFaction: g.captorFaction,
    faction: g.faction,
    men: prisonerMen(g),
    names: nameList(characters, g.characterIds),
    takenAtHoldId: g.takenAtHoldId,
    takenAtHoldName: holdName(g.takenAtHoldId),
    takenTurn: g.takenTurn,
    origin: g.origin,
    whereabouts: describeWhereabouts(g, armies),
  }));
}

export function describeWhereabouts(
  group: PrisonerGroup,
  armies: Army[]
): string {
  const loc = group.location;
  if (loc.kind === "hold") {
    return `held at ${holdName(loc.holdId)}`;
  }
  const army = armies.find((a) => a.id === loc.armyId);
  if (!army) return "whereabouts unclear";
  return `in the train of ${army.name}, at ${holdName(army.holdId)}`;
}

/**
 * The standing line every character carries into a conversation.
 *
 * Who you are holding is public knowledge — a castellan should raise his
 * cousin's name unprompted, not only when a tool happens to fire.
 */
export function prisonerAwarenessLines(
  groups: PrisonerGroup[] | undefined,
  characters: Record<CharacterId, CharacterState>,
  armies: Army[]
): string[] {
  const lines: string[] = [];
  for (const captor of ["north", "westerlands"] as Faction[]) {
    const roster = prisonerRoster(groups, characters, armies, captor);
    if (roster.length === 0) continue;

    const named: string[] = [];
    let men = 0;
    for (const e of roster) {
      men += e.men;
      for (const name of e.names) {
        named.push(
          `${name} (taken at ${e.takenAtHoldName}, turn ${e.takenTurn}, ${e.whereabouts})`
        );
      }
    }
    const bits = [...named.slice(0, 8)];
    if (named.length > 8) bits.push(`and ${named.length - 8} others of note`);
    if (men > 0) bits.push(`some ${men.toLocaleString()} common men`);
    if (bits.length === 0) continue;
    lines.push(`${factionName(captor)} holds prisoner: ${bits.join("; ")}.`);
  }
  return lines;
}

/** A straight answer about one man, for who_is. */
export function describeCaptivity(
  groups: PrisonerGroup[] | undefined,
  characterId: CharacterId,
  armies: Army[]
): string | null {
  const group = groupHolding(groups, characterId);
  if (!group) return null;
  return `Held prisoner by ${factionName(group.captorFaction)} since turn ${group.takenTurn}, taken at ${holdName(group.takenAtHoldId)} — ${describeWhereabouts(group, armies)}.`;
}
