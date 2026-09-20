import type {
  CharacterId,
  CharacterState,
  Faction,
  HoldRuntime,
  NpcAgentState,
} from "../types";
import { findCharacterIdByName } from "../data/characters";
import { castellanSeedForHold } from "../data/castellans";
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
  if (c.role === "steward") return false;
  // A man in an enemy cell cannot answer for his own walls.
  if (c.captive) return false;
  return true;
}

/** A castellan we seeded, as opposed to one conjured for a siege. */
export function isPersistentCastellan(c: CharacterState | undefined): boolean {
  return !!c && c.kind === "npc" && c.role === "castellan" && !c.ephemeral;
}

/**
 * Put the seat's own castellan back in charge of it.
 *
 * Used when a seat returns to the side whose household holds it — the native
 * castellan resumes his post, with everything he remembers, rather than a
 * stranger being invented.
 */
export function restoreSeededCastellan(
  holdId: string,
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>
): {
  holdStates: Record<string, HoldRuntime>;
  characters: Record<CharacterId, CharacterState>;
  restoredId: CharacterId | null;
} {
  const hs = holdStates[holdId];
  const seed = castellanSeedForHold(holdId);
  if (!hs || !seed) return { holdStates, characters, restoredId: null };

  const c = characters[seed.id];
  if (!c || c.kind !== "npc" || !c.alive || c.captive) {
    return { holdStates, characters, restoredId: null };
  }
  // Only his own side's seat, and only if he is not off riding with a host.
  if (hs.controller !== c.faction) {
    return { holdStates, characters, restoredId: null };
  }
  if (c.armyId) return { holdStates, characters, restoredId: null };

  return {
    holdStates: { ...holdStates, [holdId]: { ...hs, castellanId: seed.id } },
    characters: { ...characters, [seed.id]: { ...c, holdId } },
    restoredId: seed.id,
  };
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
    runtimeSystemPrompt: `You are ${name}, castellan of ${holdName}. You speak for the garrison — not as a king or great lord, but as the man who holds the keys and counts the grain. You may negotiate: terms, threats, bluffs, surrender, defiance. Before you commit on relief, stores, or the war, use tools — inspect_my_castle, survey_map, find_forces, search_faction_events, get_battle_logs — and judge from what you find. Speak plainly and finish your sentences. Never break character.`,
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
    // A named commander left inside a castle usually has no holdId, which broke
    // every tool that asks "which walls are mine?" — including the one the
    // parley prompt tells them to use. Post them to the seat properly.
    const c = characters[named];
    const nextCharacters =
      c?.kind === "npc" && c.holdId !== holdId
        ? { ...characters, [named]: { ...c, holdId } }
        : characters;
    return {
      characters: nextCharacters,
      holdStates,
      negotiatorId: named,
      created: false,
    };
  }

  // Reuse existing castellan for this hold
  const existingId = hs.castellanId;
  const existing = existingId ? characters[existingId] : undefined;
  if (
    existingId &&
    existing?.kind === "npc" &&
    existing.alive &&
    !existing.captive
  ) {
    return {
      characters,
      holdStates,
      negotiatorId: existingId,
      created: false,
    };
  }

  // The seat's own castellan, if he is free and it is still his side's seat.
  const restored = restoreSeededCastellan(holdId, holdStates, characters);
  if (restored.restoredId) {
    return {
      characters: restored.characters,
      holdStates: restored.holdStates,
      negotiatorId: restored.restoredId,
      created: false,
    };
  }

  // Nobody native is left — conjure someone. This is now the fallback it was
  // always meant to be: a manned ruin, or a conqueror's appointee at a seat
  // whose own castellan is dead or in a cell.
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

/** Add a line to a notepad without repeating it, keeping the most recent. */
function appendNote(notepad: string, line: string): string {
  if (notepad.includes(line)) return notepad;
  return `${notepad}\n${line}`.trim().slice(-800);
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
  // A seated castellan is not scaffolding — leave him holding the keys.
  if (isPersistentCastellan(c)) {
    return { characters, holdStates, removedId: null };
  }
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
  protectCharacterIds?: ReadonlySet<CharacterId>,
  /** Stamped into the castellan's memory of the siege opening. */
  turn?: number
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
        // Every castellan keeps a notepad, seeded or conjured — a siege is the
        // sort of thing a man remembers, and remembers who put terms to him.
        const c = chars[ensured.negotiatorId];
        if (c?.kind === "npc") {
          const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
          const men = garrisonHeadcount(next.garrison);
          const line = `Siege opened at ${holdName} (turn ${turn ?? "?"}). Besieger: ${next.siege!.besiegerFaction}. Garrison ~${men}. Food ~${next.foodDaysRemaining ?? "unknown"}. ${next.supplies}`;
          chars[ensured.negotiatorId] = {
            ...c,
            notepad: appendNote(c.notepad, line),
            mood: "Watchful on the walls, weighing every word from outside",
          };
        }
      }
    } else if (isSieged && wasSieged) {
      // Continue — refresh castellan notepad lightly
      const cid = next.castellanId;
      if (cid) {
        const c = chars[cid];
        if (c?.kind === "npc") {
          const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
          const line = `Siege day ${next.siege!.turns} at ${holdName}. Besieger: ${next.siege!.besiegerFaction}. Food ~${next.foodDaysRemaining ?? "unknown"}. ${next.supplies}`;
          chars[cid] = { ...c, notepad: appendNote(c.notepad, line) };
        }
      }
    } else if (!isSieged && wasSieged) {
      const cid = next.castellanId;
      const c = cid ? chars[cid] : undefined;

      // A seated castellan stays seated. He held these walls before the enemy
      // came and he holds them after they leave — and he remembers the siege.
      if (cid && isPersistentCastellan(c) && c?.kind === "npc") {
        const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
        chars[cid] = {
          ...c,
          notepad: appendNote(
            c.notepad,
            `The siege of ${holdName} lifted. The walls held and I still keep them.`
          ),
          mood: "Relieved, and counting what the siege cost",
        };
        continue;
      }

      if (cid && protectCharacterIds?.has(cid)) {
        // Open parley — keep castellan until the thread closes
        continue;
      }
      // Siege ended — a conjured castellan disappears, memory and all.
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
