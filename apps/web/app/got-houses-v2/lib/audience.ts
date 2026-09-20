import type {
  Audience,
  AudienceAnswer,
  AudienceEffects,
  AudienceOption,
  CharacterId,
  CharacterState,
  Faction,
  GameState,
  GarrisonConditionUpdate,
  TirednessUpdate,
} from "../types";
import { factionLordId } from "../data/characters";
import { DILEMMA_KINDS, formatDilemmaCatalog, isKnownDilemmaKind } from "../data/dilemma-kinds";
import { HOLDS_MAP } from "../data/holds";
import { emptyCircumstances, recordDeed } from "./deeds";
import { grazeHold } from "./forage";
import {
  disposePrisonerGroup,
  type BoardSlice,
} from "./pending-choices";

export const AUDIENCES_CAP = 80;
export const AUDIENCE_FREE_TEXT_WORDS = 40;

export function skippedAudience(
  faction: Faction,
  turn: number,
  reason: string
): Audience {
  return {
    id: `aud-skip-${faction}-${turn}`,
    turn,
    faction,
    speakerId: "",
    addresseeId: factionLordId(faction),
    kind: "other",
    situation: "",
    whyNow: "",
    text: "",
    options: [],
    answer: null,
    narration: null,
    effects: null,
    effectsApplied: false,
    skipped: true,
    skipReason: reason,
  };
}

export function livingBannermen(
  characters: Record<string, CharacterState>,
  faction: Faction
): CharacterState[] {
  return Object.values(characters).filter(
    (c) =>
      c.kind === "npc" &&
      c.alive &&
      c.faction === faction &&
      c.species !== "beast" &&
      c.role !== "steward"
  );
}

export function audienceThisTurn(
  audiences: Audience[] | undefined,
  turn: number,
  faction: Faction
): Audience | undefined {
  return [...(audiences ?? [])]
    .reverse()
    .find((a) => a.turn === turn && a.faction === faction);
}

export function audiencesAnswered(state: Pick<GameState, "audiences" | "turn">): boolean {
  for (const faction of ["north", "westerlands"] as Faction[]) {
    const a = audienceThisTurn(state.audiences, state.turn, faction);
    if (!a) return false;
    if (a.skipped) continue;
    if (!a.answer) return false;
  }
  return true;
}

export function audiencesReadyToFinish(state: GameState): boolean {
  if (state.phase !== "counsel") return false;
  if (!audiencesAnswered(state)) return false;
  return (state.mapStatus ?? "idle") === "resolved";
}

export function upsertAudience(
  list: Audience[] | undefined,
  next: Audience
): Audience[] {
  const current = [...(list ?? [])];
  const idx = current.findIndex((a) => a.id === next.id);
  if (idx >= 0) current[idx] = next;
  else current.push(next);
  return current.slice(-AUDIENCES_CAP);
}

export function replaceAudience(
  list: Audience[] | undefined,
  id: string,
  patch: Partial<Audience>
): Audience[] {
  return (list ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a));
}

export interface AudienceQuery {
  faction?: Faction;
  speakerId?: CharacterId;
  addresseeId?: CharacterId;
  query?: string;
  sinceTurn?: number;
  limit?: number;
}

export function searchAudiences(
  audiences: Audience[] | undefined,
  opts: AudienceQuery = {}
): Audience[] {
  let list = [...(audiences ?? [])].filter((a) => !a.skipped && a.text);
  if (opts.faction) list = list.filter((a) => a.faction === opts.faction);
  if (opts.speakerId) list = list.filter((a) => a.speakerId === opts.speakerId);
  if (opts.addresseeId) {
    list = list.filter((a) => a.addresseeId === opts.addresseeId);
  }
  if (opts.sinceTurn != null) {
    list = list.filter((a) => a.turn >= opts.sinceTurn!);
  }
  const q = (opts.query ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.text.toLowerCase().includes(q) ||
        a.situation.toLowerCase().includes(q) ||
        a.kind.toLowerCase().includes(q) ||
        (a.narration ?? "").toLowerCase().includes(q) ||
        (a.answer?.freeText ?? "").toLowerCase().includes(q)
    );
  }
  return list.slice(-(opts.limit ?? 20));
}

export function formatAudienceLog(a: Audience, names: Record<string, string>): string {
  const speaker = names[a.speakerId] ?? a.speakerId;
  const lord = names[a.addresseeId] ?? a.addresseeId;
  const answer = a.answer
    ? a.answer.freeText
      ? `Answered in his own words: ${a.answer.freeText}`
      : `Chose: ${a.options.find((o) => o.id === a.answer?.optionId)?.label ?? a.answer.optionId}`
    : "Unanswered.";
  const close = a.narration ? ` What followed: ${a.narration}` : "";
  return `[T${a.turn} ${a.kind}] ${speaker} to ${lord}: ${a.situation} ${answer}${close}`;
}

export interface ProposalInput {
  speakerId: string;
  addresseeId: string;
  kind: string;
  situation: string;
  whyNow: string;
}

export function validateProposal(
  raw: Partial<ProposalInput>,
  state: GameState,
  faction: Faction
): { ok: true; proposal: ProposalInput } | { ok: false; reason: string } {
  const speakerId = String(raw.speakerId ?? "").trim();
  const addresseeId = String(raw.addresseeId ?? "").trim();
  const kind = String(raw.kind ?? "").trim() || "other";
  const situation = String(raw.situation ?? "").trim();
  const whyNow = String(raw.whyNow ?? "").trim();
  const speaker = state.characters[speakerId];
  const lord = state.characters[addresseeId];
  const expectedLord = factionLordId(faction);
  if (!speaker || speaker.kind !== "npc" || !speaker.alive) {
    return { ok: false, reason: "speaker is not a living NPC" };
  }
  if (speaker.faction !== faction) {
    return { ok: false, reason: "speaker is not of this faction" };
  }
  if (speaker.species === "beast") {
    return { ok: false, reason: "beasts do not seek counsel" };
  }
  if (!lord || lord.kind !== "player" || addresseeId !== expectedLord) {
    return { ok: false, reason: "addressee must be this faction's lord" };
  }
  if (!situation) return { ok: false, reason: "situation missing" };
  return {
    ok: true,
    proposal: {
      speakerId,
      addresseeId,
      kind: isKnownDilemmaKind(kind) ? kind : "other",
      situation: situation.slice(0, 400),
      whyNow: whyNow.slice(0, 240),
    },
  };
}

export function validateVoice(
  raw: { text?: unknown; options?: unknown }
): { ok: true; text: string; options: AudienceOption[] } | { ok: false; reason: string } {
  const text = String(raw.text ?? "").trim();
  if (text.length < 8) return { ok: false, reason: "plea too short" };
  const rawOpts = Array.isArray(raw.options) ? raw.options : [];
  const options: AudienceOption[] = rawOpts
    .map((o, i) => {
      const rec = o as { id?: unknown; label?: unknown };
      const label = String(rec.label ?? "").trim();
      const id = String(rec.id ?? `opt-${i + 1}`).trim() || `opt-${i + 1}`;
      return { id, label: label.slice(0, 80) };
    })
    .filter((o) => o.label.length > 0)
    .slice(0, 3);
  if (options.length !== 3) {
    return { ok: false, reason: "need exactly three options" };
  }
  return { ok: true, text: text.slice(0, 1200), options };
}

export interface RawAudienceOutcome {
  narration?: unknown;
  armyUpdates?: unknown;
  garrisonUpdates?: unknown;
  prisonerActs?: unknown;
  forageHolds?: unknown;
  deedSummary?: unknown;
  deedDetail?: unknown;
}

function clipLine(value: unknown, fallback: string, max = 240): string {
  const s = String(value ?? "").trim();
  return (s || fallback).slice(0, max);
}

export function validateAudienceOutcome(
  raw: RawAudienceOutcome,
  state: GameState,
  audience: Audience
): { effects: AudienceEffects; narration: string; notes: string[] } {
  const notes: string[] = [];
  const armyIds = new Set(state.armies.map((a) => a.id));
  const speaker = state.characters[audience.speakerId];
  const speakerHold =
    speaker?.kind === "npc"
      ? state.armies.find((a) => a.id === speaker.armyId)?.holdId ?? speaker.holdId
      : null;

  const armyUpdates: TirednessUpdate[] = [];
  const rawArmies = Array.isArray(raw.armyUpdates) ? raw.armyUpdates : [];
  for (const row of rawArmies) {
    const rec = row as Record<string, unknown>;
    const armyId = String(rec.armyId ?? "");
    const army = state.armies.find((a) => a.id === armyId);
    if (!army || !armyIds.has(armyId)) {
      notes.push(`dropped unknown army ${armyId}`);
      continue;
    }
    if (army.faction !== audience.faction) {
      notes.push(`dropped enemy army ${armyId}`);
      continue;
    }
    armyUpdates.push({
      armyId,
      tiredness: clipLine(rec.tiredness, army.tiredness),
      morale: rec.morale ? clipLine(rec.morale, army.morale) : army.morale,
      stance: rec.stance ? clipLine(rec.stance, army.stance) : army.stance,
    });
  }

  const garrisonUpdates: GarrisonConditionUpdate[] = [];
  const rawGarrisons = Array.isArray(raw.garrisonUpdates) ? raw.garrisonUpdates : [];
  for (const row of rawGarrisons) {
    const rec = row as Record<string, unknown>;
    const holdId = String(rec.holdId ?? "");
    const hs = state.holdStates?.[holdId];
    if (!hs) {
      notes.push(`dropped unknown hold ${holdId}`);
      continue;
    }
    if (hs.garrison.faction !== audience.faction && hs.controller !== audience.faction) {
      notes.push(`dropped foreign garrison ${holdId}`);
      continue;
    }
    garrisonUpdates.push({
      holdId,
      morale: clipLine(rec.morale, hs.garrison.morale),
      tiredness: clipLine(rec.tiredness, hs.garrison.tiredness),
      stance: clipLine(rec.stance, hs.garrison.stance),
    });
  }

  const prisonerActs: AudienceEffects["prisonerActs"] = [];
  const rawActs = Array.isArray(raw.prisonerActs) ? raw.prisonerActs : [];
  for (const row of rawActs) {
    const rec = row as Record<string, unknown>;
    const groupId = String(rec.groupId ?? "");
    const action = rec.action === "execute" ? "execute" : rec.action === "release" ? "release" : null;
    const group = (state.prisoners ?? []).find((g) => g.id === groupId);
    if (!group || !action) {
      notes.push(`dropped prisoner act ${groupId}`);
      continue;
    }
    if (group.captorFaction !== audience.faction) {
      notes.push(`dropped prisoner act not held by ${audience.faction}`);
      continue;
    }
    prisonerActs.push({ groupId, action });
  }
  if (prisonerActs.length > 2) {
    notes.push("dropped over-large prisoner acts");
    prisonerActs.splice(2);
  }

  const forageHolds: AudienceEffects["forageHolds"] = [];
  const rawForage = Array.isArray(raw.forageHolds) ? raw.forageHolds : [];
  for (const row of rawForage) {
    const rec = row as Record<string, unknown>;
    const holdId = String(rec.holdId ?? "");
    if (!HOLDS_MAP.has(holdId)) {
      notes.push(`dropped unknown forage hold ${holdId}`);
      continue;
    }
    const occupied =
      speakerHold === holdId ||
      state.armies.some((a) => a.faction === audience.faction && a.holdId === holdId);
    if (!occupied) {
      notes.push(`dropped forage at unoccupied ${holdId}`);
      continue;
    }
    const steps = Math.max(0, Math.min(2, Math.round(Number(rec.steps ?? rec.grazeSteps ?? 0))));
    if (steps <= 0) continue;
    forageHolds.push({ holdId, steps });
  }

  const narration = clipLine(raw.narration, "The lord's word went out, and the camp took it as it could.", 600);
  const speakerName = state.characters[audience.speakerId]?.name ?? "a bannerman";
  const lordName = state.characters[audience.addresseeId]?.name ?? "the lord";
  return {
    narration,
    notes,
    effects: {
      armyUpdates,
      garrisonUpdates,
      prisonerActs,
      forageHolds,
      deedSummary: clipLine(
        raw.deedSummary,
        `${lordName} heard ${speakerName} after the last march.`,
        180
      ),
      deedDetail: clipLine(
        raw.deedDetail,
        `${speakerName} put a dilemma to ${lordName} (${audience.kind}). ${narration}`,
        800
      ),
    },
  };
}

function boardOf(state: GameState): BoardSlice {
  return {
    turn: state.turn,
    armies: state.armies,
    holdStates: state.holdStates ?? {},
    characters: state.characters,
    prisoners: state.prisoners ?? [],
    travellers: state.travellers ?? [],
    deeds: state.deeds ?? [],
    forage: state.forage,
    battleReports: state.battleReports,
    pendingChoices: state.pendingChoices ?? [],
  };
}

export function applyAudienceEffects(
  state: GameState,
  audience: Audience,
  effects: AudienceEffects
): GameState {
  let next: GameState = {
    ...state,
    armies: state.armies.map((army) => {
      const update = effects.armyUpdates.find((u) => u.armyId === army.id);
      if (!update) return army;
      return {
        ...army,
        tiredness: update.tiredness,
        ...(update.morale ? { morale: update.morale } : {}),
        ...(update.stance ? { stance: update.stance } : {}),
      };
    }),
  };

  if (effects.garrisonUpdates.length > 0) {
    const holdStates = { ...(next.holdStates ?? {}) };
    for (const upd of effects.garrisonUpdates) {
      const hs = holdStates[upd.holdId];
      if (!hs) continue;
      holdStates[upd.holdId] = {
        ...hs,
        garrison: {
          ...hs.garrison,
          morale: upd.morale,
          tiredness: upd.tiredness,
          stance: upd.stance,
        },
      };
    }
    next = { ...next, holdStates };
  }

  let forage = next.forage;
  for (const row of effects.forageHolds) {
    forage = grazeHold(forage, row.holdId, row.steps);
  }
  next = { ...next, forage };

  for (const act of effects.prisonerActs) {
    const disposed = disposePrisonerGroup(boardOf(next), act.groupId, act.action);
    if (!disposed) continue;
    next = {
      ...next,
      armies: disposed.board.armies,
      holdStates: disposed.board.holdStates,
      characters: disposed.board.characters,
      prisoners: disposed.board.prisoners,
      travellers: disposed.board.travellers,
      deeds: disposed.board.deeds,
      forage: disposed.board.forage,
      battleReports: disposed.board.battleReports,
      pendingChoices: disposed.board.pendingChoices,
      factionEvents: [...(next.factionEvents ?? []), ...disposed.events],
    };
  }

  const speaker = next.characters[audience.speakerId];
  const lord = next.characters[audience.addresseeId];
  const { deeds } = recordDeed(next.deeds, {
    turn: audience.turn,
    kind: "counsel_given",
    actorFaction: audience.faction,
    victimFaction: null,
    holdId: speaker?.kind === "npc" ? speaker.holdId ?? null : null,
    characterIds: [audience.speakerId, audience.addresseeId],
    characterNames: [speaker?.name ?? audience.speakerId, lord?.name ?? audience.addresseeId],
    menAffected: 0,
    circumstances: emptyCircumstances(),
    summary: effects.deedSummary,
    detail: effects.deedDetail,
  });

  const factionEvents = [
    ...(next.factionEvents ?? []),
    {
      id: `ev-counsel-${audience.id}`,
      turn: audience.turn,
      faction: audience.faction,
      kind: "other" as const,
      relatedCharacterIds: [audience.speakerId, audience.addresseeId],
      summary: effects.deedSummary,
      detail: effects.deedDetail,
    },
  ].slice(-400);

  const audiences = replaceAudience(next.audiences, audience.id, {
    effects,
    effectsApplied: true,
    narration: audience.narration,
  });

  return {
    ...next,
    deeds,
    factionEvents,
    audiences,
  };
}

function matchAudience(list: Audience[], a: Audience): Audience | undefined {
  return (
    list.find((x) => x.id === a.id) ??
    list.find((x) => x.turn === a.turn && x.faction === a.faction)
  );
}

export function mergeCounselAudiences(
  current: Audience[] | undefined,
  incoming: Audience[] | undefined,
  writer: Faction
): Audience[] {
  const currentList = current ?? [];
  const incomingList = incoming ?? [];

  if (writer === "westerlands") {
    return currentList.map((local) => {
      if (local.faction !== "westerlands") return local;
      const remote = matchAudience(incomingList, local);
      if (!remote?.answer || local.answer) return local;
      return { ...local, answer: remote.answer };
    });
  }

  return incomingList.map((remote) => {
    if (remote.faction !== "westerlands") return remote;
    const prior = matchAudience(currentList, remote);
    if (prior?.answer && !remote.answer) {
      return { ...remote, answer: prior.answer };
    }
    return remote;
  });
}

export function buildCounselBriefing(state: GameState, faction: Faction): string {
  const lordId = factionLordId(faction);
  const lord = state.characters[lordId];
  const bannermen = livingBannermen(state.characters, faction);
  const prisoners = (state.prisoners ?? []).filter((p) => p.captorFaction === faction);
  const sieges = Object.entries(state.holdStates ?? {}).filter(
    ([, hs]) => hs.siege && (hs.siege.besiegerFaction === faction || hs.controller === faction)
  );
  const hosts = state.armies
    .filter((a) => a.faction === faction)
    .map(
      (a) =>
        `- ${a.id} ${a.name} at ${HOLDS_MAP.get(a.holdId)?.name ?? a.holdId} (${a.morale}; ${a.tiredness})`
    )
    .join("\n");
  const npcLines = bannermen
    .map((c) => {
      const army =
        c.kind === "npc" && c.armyId
          ? state.armies.find((a) => a.id === c.armyId)
          : null;
      const where = army
        ? `with ${army.name} at ${HOLDS_MAP.get(army.holdId)?.name ?? army.holdId}`
        : c.kind === "npc" && c.holdId
          ? `at ${HOLDS_MAP.get(c.holdId)?.name ?? c.holdId}`
          : "unposted";
      return `- ${c.id} ${c.name} (${c.role}) ${where}`;
    })
    .join("\n");

  return [
    `The war is on turn ${state.turn}. Faction: ${faction}. Lord: ${lord?.name ?? lordId} (${lordId}).`,
    `This dilemma is pre-loaded BEFORE today's marches resolve. It MUST still make sense after a day of fighting. Do not stake it on a battle that may be fought today, a captive who may be killed or freed today, or a seat that may fall today. Ask about standing camp, honour, supply, vassals, and policy.`,
    `Hosts now:\n${hosts || "- none"}`,
    `Prisoner groups currently held (do not name a group that must still exist tonight): ${prisoners.length}.`,
    `Sieges touching this side: ${sieges.map(([id]) => HOLDS_MAP.get(id)?.name ?? id).join(", ") || "none"}.`,
    `Living bannermen who may approach:\n${npcLines || "- none"}`,
    `Stable dilemma kinds (pick one that fits the board as it stands, or other):\n${formatDilemmaCatalog()}`,
  ].join("\n\n");
}

export { DILEMMA_KINDS, formatDilemmaCatalog };
