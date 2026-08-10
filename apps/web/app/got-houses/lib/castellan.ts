import type {
  CharacterId,
  CharacterState,
  Faction,
  HoldRuntime,
  NpcAgentState,
} from "../types";
import { findCharacterIdByName } from "../data/characters";
import { HOLDS_MAP } from "../data/holds";
import { garrisonHeadcount } from "./hold-runtime";

const CASTELLAN_NAMES = [
  "Ser Harrold Rivers",
  "Ser Quentyn Crabb",
  "Ser Osmund of the Crossroads",
  "Ser Maynard Holt",
  "Ser Rolland Storm",
  "Ser Lucamore Strong",
  "Ser Willem Fell",
  "Ser Jonothor Heddle",
  "Ser Cedric Payne",
  "Ser Gwayne Corbray",
  "Ser Humfrey Wagstaff",
  "Ser Addam Osgrey",
  "Ser Lorent Caswell",
  "Ser Tyler Norcross",
  "Ser Raymun Fossoway",
];

export function isHumanNegotiator(c: CharacterState): boolean {
  if (c.kind !== "npc" || !c.alive) return false;
  if (c.species === "beast") return false;
  return true;
}

/** Named human in the garrison (leaders first, then notables). Beasts skipped. */
export function findNamedGarrisonNegotiator(
  holdId: string,
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>
): CharacterId | null {
  const hs = holdStates[holdId];
  if (!hs) return null;

  const tryName = (name: string): CharacterId | null => {
    const id = findCharacterIdByName(characters, name);
    if (!id) return null;
    const c = characters[id];
    if (!c || !isHumanNegotiator(c)) return null;
    return id;
  };

  for (const l of hs.garrison.leaders) {
    const id = tryName(l.name);
    if (id) return id;
  }
  for (const n of hs.garrison.notables ?? []) {
    const id = tryName(n.name);
    if (id) return id;
  }

  // Characters explicitly posted to this hold (e.g. after peel)
  for (const c of Object.values(characters)) {
    if (
      c.kind === "npc" &&
      c.alive &&
      c.holdId === holdId &&
      c.role !== "castellan" &&
      isHumanNegotiator(c)
    ) {
      if (c.role === "commander") return c.id;
    }
  }
  for (const c of Object.values(characters)) {
    if (
      c.kind === "npc" &&
      c.alive &&
      c.holdId === holdId &&
      c.role !== "castellan" &&
      isHumanNegotiator(c)
    ) {
      return c.id;
    }
  }

  return null;
}

function defendingFaction(hs: HoldRuntime): Faction {
  if (hs.garrison.faction === "north" || hs.garrison.faction === "westerlands") {
    return hs.garrison.faction;
  }
  if (hs.controller === "north" || hs.controller === "westerlands") {
    return hs.controller;
  }
  if (hs.homeFaction === "north" || hs.homeFaction === "westerlands") {
    return hs.homeFaction;
  }
  // Hostile seat — pick opposite of besieger if investing, else north as placeholder
  if (hs.siege) {
    return hs.siege.besiegerFaction === "north" ? "westerlands" : "north";
  }
  return "north";
}

function pickCastellanName(
  characters: Record<CharacterId, CharacterState>
): string {
  const used = new Set(
    Object.values(characters).map((c) => c.name.toLowerCase())
  );
  const shuffled = [...CASTELLAN_NAMES].sort(() => Math.random() - 0.5);
  for (const name of shuffled) {
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Ser ${CASTELLAN_NAMES[Math.floor(Math.random() * CASTELLAN_NAMES.length)].split(" ").slice(-1)[0]} of the Keep`;
}

export function createCastellanNpc(
  holdId: string,
  hs: HoldRuntime,
  characters: Record<CharacterId, CharacterState>
): NpcAgentState {
  const hold = HOLDS_MAP.get(holdId);
  const holdName = hold?.name ?? holdId;
  const name = pickCastellanName(characters);
  const id = `castellan-${holdId}-${Math.random().toString(36).slice(2, 8)}`;
  const faction = defendingFaction(hs);
  const men = garrisonHeadcount(hs.garrison);
  const underSiege = !!hs.siege;

  return {
    kind: "npc",
    id,
    name,
    faction,
    role: "castellan",
    species: "human",
    armyId: null,
    holdId,
    alive: true,
    notepad: underSiege
      ? `Invested at ${holdName}. Siege day ${hs.siege!.turns}. Besieger: ${hs.siege!.besiegerFaction}. Garrison ~${men}. Food ~${hs.foodDaysRemaining ?? "unknown"} days. Stores: ${hs.supplies}`
      : "",
    mood: underSiege
      ? "Watchful on the walls, weighing every word from outside"
      : "Duty-bound keeper of the seat",
    dispositionToward: {},
    inviteHistory: [],
    adviceGivenIds: [],
    ephemeral: true,
    runtimeBackground: `Castellan of ${holdName}. Not a great lord — a practical man left in charge of the walls and stores. Commands about ${men.toLocaleString()} defenders. Speaks for the garrison in parley.`,
    runtimeSystemPrompt: `You are ${name}, castellan of ${holdName}. You speak for the garrison — not as a king or great lord, but as the man who holds the keys and counts the grain. You may negotiate: terms, threats, bluffs, surrender, defiance. Before you commit on relief, stores, or the war, use tools — inspect_my_castle, survey_map, find_forces, search_faction_events, get_battle_logs — and judge from what you find. End replies with SPEAK: under 60 words. Never break character.`,
  };
}

export interface EnsureCastellanResult {
  characters: Record<CharacterId, CharacterState>;
  holdStates: Record<string, HoldRuntime>;
  negotiatorId: CharacterId;
  created: boolean;
}

/**
 * Prefer a named human in the garrison; otherwise ensure an ephemeral castellan.
 */
export function ensureGarrisonNegotiator(
  holdId: string,
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>
): EnsureCastellanResult | null {
  const hs = holdStates[holdId];
  if (!hs) return null;

  const named = findNamedGarrisonNegotiator(holdId, holdStates, characters);
  if (named) {
    return {
      characters,
      holdStates,
      negotiatorId: named,
      created: false,
    };
  }

  // Reuse existing castellan for this hold
  const existingId = hs.castellanId;
  if (existingId && characters[existingId]?.kind === "npc" && characters[existingId].alive) {
    return {
      characters,
      holdStates,
      negotiatorId: existingId,
      created: false,
    };
  }

  const castellan = createCastellanNpc(holdId, hs, characters);
  return {
    characters: { ...characters, [castellan.id]: castellan },
    holdStates: {
      ...holdStates,
      [holdId]: { ...hs, castellanId: castellan.id },
    },
    negotiatorId: castellan.id,
    created: true,
  };
}

/** Remove ephemeral castellan and close their identity when siege ends. */
export function removeEphemeralCastellan(
  holdId: string,
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>
): {
  characters: Record<CharacterId, CharacterState>;
  holdStates: Record<string, HoldRuntime>;
  removedId: CharacterId | null;
} {
  const hs = holdStates[holdId];
  if (!hs?.castellanId) {
    return { characters, holdStates, removedId: null };
  }
  const id = hs.castellanId;
  const c = characters[id];
  if (!c || c.kind !== "npc" || !c.ephemeral) {
    return {
      characters,
      holdStates: {
        ...holdStates,
        [holdId]: { ...hs, castellanId: null },
      },
      removedId: null,
    };
  }
  const nextChars = { ...characters };
  delete nextChars[id];
  return {
    characters: nextChars,
    holdStates: {
      ...holdStates,
      [holdId]: { ...hs, castellanId: null },
    },
    removedId: id,
  };
}

/** After siege tick: spin up castellans on new invests; tear down when siege ends. */
export function syncCastellansWithSieges(
  prevHoldStates: Record<string, HoldRuntime>,
  nextHoldStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>,
  /** Keep ephemeral castellans that are still in an open / pending talk */
  protectCharacterIds?: ReadonlySet<CharacterId>
): {
  holdStates: Record<string, HoldRuntime>;
  characters: Record<CharacterId, CharacterState>;
} {
  let holdStates = { ...nextHoldStates };
  let chars = { ...characters };

  for (const holdId of Object.keys(holdStates)) {
    const prev = prevHoldStates[holdId];
    const next = holdStates[holdId];
    if (!next) continue;

    const wasSieged = !!prev?.siege;
    const isSieged = !!next.siege;

    if (isSieged && !wasSieged) {
      // New investment — ensure a negotiator (named or castellan) for memory
      const ensured = ensureGarrisonNegotiator(holdId, holdStates, chars);
      if (ensured) {
        holdStates = ensured.holdStates;
        chars = ensured.characters;
        // Seed notepad with siege opening
        const c = chars[ensured.negotiatorId];
        if (c?.kind === "npc" && c.ephemeral) {
          const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
          const men = garrisonHeadcount(next.garrison);
          chars[ensured.negotiatorId] = {
            ...c,
            notepad: `Siege opened at ${holdName}. Day 1. Besieger: ${next.siege!.besiegerFaction}. Garrison ~${men}. Food ~${next.foodDaysRemaining ?? "unknown"}. ${next.supplies}`,
            mood: "Watchful on the walls, weighing every word from outside",
          };
        }
      }
    } else if (isSieged && wasSieged) {
      // Continue — refresh castellan notepad lightly
      const cid = next.castellanId;
      if (cid) {
        const c = chars[cid];
        if (c?.kind === "npc" && c.ephemeral) {
          const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
          const line = `Siege day ${next.siege!.turns} at ${holdName}. Besieger: ${next.siege!.besiegerFaction}. Food ~${next.foodDaysRemaining ?? "unknown"}. ${next.supplies}`;
          chars[cid] = {
            ...c,
            notepad: c.notepad.includes(line)
              ? c.notepad
              : `${c.notepad}\n${line}`.slice(-800),
          };
        }
      }
    } else if (!isSieged && wasSieged) {
      const cid = next.castellanId;
      if (cid && protectCharacterIds?.has(cid)) {
        // Open parley — keep castellan until the thread closes
        continue;
      }
      // Siege ended — ephemeral castellan disappears (memory gone with them)
      const removed = removeEphemeralCastellan(holdId, holdStates, chars);
      holdStates = removed.holdStates;
      chars = removed.characters;
    }
  }

  return { holdStates, characters: chars };
}

/** Character ids in active / pending talk threads. */
export function protectedTalkCharacterIds(
  conversations: { status: string; participantIds: CharacterId[] }[]
): Set<CharacterId> {
  const ids = new Set<CharacterId>();
  for (const t of conversations) {
    if (t.status !== "active" && t.status !== "pending_invite") continue;
    for (const id of t.participantIds) ids.add(id);
  }
  return ids;
}

/**
 * Tear down ephemeral castellans that are not under siege and not in an open talk.
 * Call after a conversation dock closes.
 */
export function pruneOrphanCastellans(
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>,
  protectCharacterIds: ReadonlySet<CharacterId>
): {
  holdStates: Record<string, HoldRuntime>;
  characters: Record<CharacterId, CharacterState>;
  removedIds: CharacterId[];
} {
  let nextHs = holdStates;
  let nextChars = characters;
  const removedIds: CharacterId[] = [];
  for (const holdId of Object.keys(nextHs)) {
    const hs = nextHs[holdId];
    if (!hs?.castellanId || hs.siege) continue;
    const cid = hs.castellanId;
    const c = nextChars[cid];
    if (!c || c.kind !== "npc" || !c.ephemeral) continue;
    if (protectCharacterIds.has(cid)) continue;
    const removed = removeEphemeralCastellan(holdId, nextHs, nextChars);
    nextHs = removed.holdStates;
    nextChars = removed.characters;
    if (removed.removedId) removedIds.push(removed.removedId);
  }
  return { holdStates: nextHs, characters: nextChars, removedIds };
}

/** Label for UI. */
export function negotiatorLabel(
  negotiatorId: CharacterId,
  characters: Record<CharacterId, CharacterState>
): { name: string; sub: string } {
  const c = characters[negotiatorId];
  if (!c) return { name: "Castellan", sub: "Parley" };
  if (c.kind === "npc" && c.role === "castellan") {
    return { name: c.name, sub: "Castellan — parley" };
  }
  return { name: c.name, sub: "Garrison commander" };
}
