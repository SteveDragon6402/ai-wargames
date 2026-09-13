import type {
  Army,
  ArmyUnit,
  BattleReport,
  CharacterId,
  CharacterState,
  Deed,
  Faction,
  FactionEvent,
  ForageState,
  HoldRuntime,
  PendingChoice,
  PrisonerGroup,
  PrisonerLocation,
  SeatFates,
  Traveller,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { findCharacterIdByName } from "../data/characters";
import {
  SURRENDER_QUICK_TURNS,
  emptyCircumstances,
  recordDeed,
  recordDeeds,
  type DeedInput,
} from "./deeds";
import { compareToPromise } from "./terms";
import {
  allocationUnits,
  describeDispersal,
  disperseGarrison,
} from "./disperse";
import { defaultRefuge, describeRelease, startTravel } from "./release";
import {
  beginRaze,
  canRaze,
  stripForageAtHold,
} from "./raze";
import {
  createPrisonerGroup,
  executePrisoners,
  markCaptive,
  prisonerMen,
  releasePrisoners,
} from "./prisoners";
import { garrisonHeadcount, mergeUnits } from "./hold-runtime";
import { headcountOf } from "./siege";

/**
 * Mandatory choices after a seat falls or a fight produces captives.
 *
 * Terms are a promise. This is the act. The two are compared, and the
 * comparison goes on the ledger.
 */

function eid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function holdName(holdId: string): string {
  return HOLDS_MAP.get(holdId)?.name ?? holdId;
}

function namedIdsAtHold(
  hs: HoldRuntime,
  characters: Record<CharacterId, CharacterState>
): CharacterId[] {
  const names = [
    ...hs.garrison.leaders.map((l) => l.name),
    ...(hs.garrison.notables ?? []).map((n) => n.name),
  ];
  if (hs.castellanId) {
    const c = characters[hs.castellanId];
    if (c) names.push(c.name);
  }
  const ids: CharacterId[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const id = findCharacterIdByName(characters, name);
    if (!id || seen.has(id)) continue;
    const c = characters[id];
    if (!c || !c.alive) continue;
    if (c.kind === "npc" && c.captive) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function blockingChoicesFor(
  choices: PendingChoice[] | undefined,
  faction: Faction
): PendingChoice[] {
  return (choices ?? []).filter((c) => c.faction === faction);
}

export function blockingMessage(
  choices: PendingChoice[] | undefined,
  faction: Faction
): string | null {
  const mine = blockingChoicesFor(choices, faction);
  if (mine.length === 0) return null;
  if (mine.length === 1) {
    return `Settle ${mine[0].headline} before you submit.`;
  }
  return `${mine.length} fates still unpaid.`;
}

export function choiceAtHold(
  choices: PendingChoice[] | undefined,
  holdId: string
): PendingChoice | null {
  return (choices ?? []).find((c) => c.holdId === holdId) ?? null;
}

export function choiceForArmy(
  choices: PendingChoice[] | undefined,
  armyId: string
): PendingChoice | null {
  return (
    (choices ?? []).find((c) => (c.escortArmyIds ?? []).includes(armyId)) ?? null
  );
}

export function buildSeatFateChoice(opts: {
  turn: number;
  holdId: string;
  faction: Faction;
  promised: SeatFates | null;
  garrisonUnits: ArmyUnit[];
  captiveCharacterIds: CharacterId[];
  escortArmyIds: string[];
  stormed: boolean;
}): PendingChoice {
  const name = holdName(opts.holdId);
  return {
    id: eid("choice"),
    faction: opts.faction,
    turn: opts.turn,
    kind: "seat_fate",
    holdId: opts.holdId,
    promised: opts.promised,
    headline: opts.stormed ? `${name} stormed` : `${name} yielded`,
    garrisonUnits: opts.garrisonUnits.map((u) => ({ ...u })),
    captiveCharacterIds: [...opts.captiveCharacterIds],
    escortArmyIds: [...opts.escortArmyIds],
  };
}

export function buildBattlePrisonersChoice(opts: {
  turn: number;
  holdId: string;
  faction: Faction;
  battleId: string;
  garrisonUnits: ArmyUnit[];
  captiveCharacterIds: CharacterId[];
  escortArmyIds: string[];
}): PendingChoice {
  const name = holdName(opts.holdId);
  return {
    id: eid("choice"),
    faction: opts.faction,
    turn: opts.turn,
    kind: "battle_prisoners",
    holdId: opts.holdId,
    battleId: opts.battleId,
    promised: null,
    headline: `Prisoners at ${name}`,
    garrisonUnits: opts.garrisonUnits.map((u) => ({ ...u })),
    captiveCharacterIds: [...opts.captiveCharacterIds],
    escortArmyIds: [...opts.escortArmyIds],
  };
}

export interface BoardSlice {
  turn: number;
  armies: Army[];
  holdStates: Record<string, HoldRuntime>;
  characters: Record<CharacterId, CharacterState>;
  prisoners: PrisonerGroup[];
  travellers: Traveller[];
  deeds: Deed[];
  forage?: ForageState;
  battleReports: BattleReport[];
  pendingChoices: PendingChoice[];
}

export interface ApplyChoiceResult {
  board: BoardSlice;
  events: FactionEvent[];
}

function siegeCircumstances(
  hs: HoldRuntime | undefined,
  holdId: string,
  armies: Army[],
  promised: SeatFates | null,
  chosen: SeatFates | null,
  brokeWord: boolean
) {
  const siege = hs?.siege;
  const garrisonMen = hs ? garrisonHeadcount(hs.garrison) : null;
  const besiegerMen = siege
    ? headcountOf(
        armies.filter((a) => a.holdId === holdId && a.faction === siege.besiegerFaction)
      )
    : null;
  const turns = siege?.turns ?? null;
  return emptyCircumstances({
    siegeTurns: turns,
    timesTermsOffered: siege?.termsOfferedCount ?? 0,
    timesTermsRefused: siege?.termsRefusedCount ?? 0,
    surrendered: promised != null,
    surrenderedQuickly:
      promised != null && turns != null && turns <= SURRENDER_QUICK_TURNS,
    stormed: promised == null,
    starving: (hs?.foodDaysRemaining ?? Infinity) <= 0,
    garrisonMen,
    besiegerMen: besiegerMen && besiegerMen > 0 ? besiegerMen : null,
    promised,
    chosen,
    brokeWord,
  });
}

function applyDispersal(
  board: BoardSlice,
  units: ArmyUnit[],
  fromHoldId: string,
  faction: Faction
): { board: BoardSlice; line: string } {
  const result = disperseGarrison(
    units,
    fromHoldId,
    faction,
    board.armies,
    board.holdStates
  );
  let armies = board.armies.map((a) => ({ ...a, units: a.units.map((u) => ({ ...u })) }));
  let holdStates = { ...board.holdStates };

  for (const alloc of result.allocations) {
    const add = allocationUnits(units, alloc.men);
    if (alloc.kind === "army") {
      armies = armies.map((a) =>
        a.id === alloc.id ? { ...a, units: mergeUnits(a.units, add) } : a
      );
    } else {
      const hs = holdStates[alloc.holdId];
      if (!hs) continue;
      holdStates = {
        ...holdStates,
        [alloc.holdId]: {
          ...hs,
          garrison: {
            ...hs.garrison,
            units: mergeUnits(hs.garrison.units, add),
          },
        },
      };
    }
  }

  return {
    board: { ...board, armies, holdStates },
    line: describeDispersal(result, holdStates, armies),
  };
}

function imprison(
  board: BoardSlice,
  units: ArmyUnit[],
  characterIds: CharacterId[],
  captor: Faction,
  victim: Faction | null,
  holdId: string,
  origin: "siege" | "battle",
  location: PrisonerLocation,
  battleId?: string | null
): { board: BoardSlice; group: PrisonerGroup | null } {
  if (!victim) {
    return { board, group: null };
  }
  const group = createPrisonerGroup({
    captorFaction: captor,
    faction: victim,
    location,
    units,
    characterIds,
    takenAtHoldId: holdId,
    takenTurn: board.turn,
    origin,
    battleId,
  });
  if (!group) return { board, group: null };
  return {
    board: {
      ...board,
      prisoners: [...board.prisoners, group],
      characters: markCaptive(board.characters, characterIds),
    },
    group,
  };
}

function releaseLeaders(
  board: BoardSlice,
  characterIds: CharacterId[],
  fromHoldId: string
): BoardSlice {
  let characters = board.characters;
  let travellers = [...board.travellers];
  for (const id of characterIds) {
    const c = characters[id];
    if (!c || !c.alive) continue;
    characters =
      c.kind === "npc"
        ? { ...characters, [id]: { ...c, captive: false, armyId: null, holdId: null } }
        : characters;
    const dest =
      defaultRefuge(fromHoldId, c.faction, board.holdStates, board.armies) ??
      fromHoldId;
    travellers.push(startTravel(id, fromHoldId, dest, board.turn));
  }
  return { ...board, characters, travellers };
}

/**
 * Apply a pending choice and strike it from the list.
 *
 * For a seat, the three axes are applied independently, then compared to
 * whatever was promised. For battle captives, the same three fates apply to
 * the taken men (town axis is ignored).
 */
export function applyPendingChoice(
  board: BoardSlice,
  choiceId: string,
  fates: SeatFates,
  prisonerDestination?: PrisonerLocation | null
): ApplyChoiceResult | null {
  const choice = board.pendingChoices.find((c) => c.id === choiceId);
  if (!choice) return null;

  const holdId = choice.holdId;
  const hs = board.holdStates[holdId];
  const comparison = compareToPromise(choice.promised, fates);
  const victimFaction = inferVictim(choice, board);
  const events: FactionEvent[] = [];
  const deedInputs: DeedInput[] = [];
  let next = {
    ...board,
    pendingChoices: board.pendingChoices.filter((c) => c.id !== choiceId),
  };

  const location: PrisonerLocation =
    prisonerDestination ??
    (choice.escortArmyIds[0]
      ? { kind: "army", armyId: choice.escortArmyIds[0] }
      : { kind: "hold", holdId });

  const origin: "siege" | "battle" =
    choice.kind === "battle_prisoners" ? "battle" : "siege";

  const circumstances = siegeCircumstances(
    hs,
    holdId,
    next.armies,
    choice.promised,
    fates,
    comparison.brokeWord
  );

  const men = choice.garrisonUnits.reduce((s, u) => s + u.count, 0);
  const names = choice.captiveCharacterIds.map(
    (id) => next.characters[id]?.name ?? id
  );

  if (fates.garrison === "let_go" && men > 0 && victimFaction) {
    const dispersed = applyDispersal(
      next,
      choice.garrisonUnits,
      holdId,
      victimFaction
    );
    next = dispersed.board;
    deedInputs.push({
      turn: board.turn,
      kind: "garrison_let_go",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: [],
      characterNames: [],
      menAffected: men,
      circumstances,
      battleId: choice.battleId ?? null,
    });
    events.push({
      id: eid("ev"),
      turn: board.turn,
      faction: choice.faction,
      kind: "other",
      holdIds: [holdId],
      summary: `Garrison at ${holdName(holdId)} let walk`,
      detail: dispersed.line,
    });
  } else if (fates.garrison === "execute" && men > 0) {
    deedInputs.push({
      turn: board.turn,
      kind: "garrison_executed",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: [],
      characterNames: [],
      menAffected: men,
      circumstances,
      battleId: choice.battleId ?? null,
    });
  } else if (fates.garrison === "prisoner" && men > 0 && victimFaction) {
    const taken = imprison(
      next,
      choice.garrisonUnits,
      [],
      choice.faction,
      victimFaction,
      holdId,
      origin,
      location,
      choice.battleId
    );
    next = taken.board;
    deedInputs.push({
      turn: board.turn,
      kind: "garrison_imprisoned",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: [],
      characterNames: [],
      menAffected: men,
      circumstances,
      battleId: choice.battleId ?? null,
    });
  }

  if (fates.leaders === "let_go" && choice.captiveCharacterIds.length > 0) {
    next = releaseLeaders(next, choice.captiveCharacterIds, holdId);
    deedInputs.push({
      turn: board.turn,
      kind: "leaders_let_go",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: choice.captiveCharacterIds,
      characterNames: names,
      menAffected: names.length,
      circumstances,
      battleId: choice.battleId ?? null,
    });
    for (const id of choice.captiveCharacterIds) {
      const t = next.travellers.find((x) => x.characterId === id);
      const c = next.characters[id];
      if (t && c) {
        events.push({
          id: eid("ev"),
          turn: board.turn,
          faction: choice.faction,
          kind: "other",
          holdIds: [holdId, t.destHoldId],
          relatedCharacterIds: [id],
          summary: `${c.name} released`,
          detail: describeRelease(c.name, holdId, t.destHoldId, t.arrivesTurn),
        });
      }
    }
  } else if (fates.leaders === "execute" && choice.captiveCharacterIds.length > 0) {
    const group = {
      id: "tmp",
      captorFaction: choice.faction,
      faction: victimFaction ?? choice.faction,
      location,
      units: [],
      characterIds: choice.captiveCharacterIds,
      takenAtHoldId: holdId,
      takenTurn: board.turn,
      origin,
    };
    next = { ...next, characters: executePrisoners(next.characters, group) };
    deedInputs.push({
      turn: board.turn,
      kind: "leaders_executed",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: choice.captiveCharacterIds,
      characterNames: names,
      menAffected: names.length,
      circumstances,
      battleId: choice.battleId ?? null,
    });
  } else if (fates.leaders === "prisoner" && choice.captiveCharacterIds.length > 0 && victimFaction) {
    const taken = imprison(
      next,
      [],
      choice.captiveCharacterIds,
      choice.faction,
      victimFaction,
      holdId,
      origin,
      location,
      choice.battleId
    );
    next = taken.board;
    deedInputs.push({
      turn: board.turn,
      kind: "leaders_imprisoned",
      actorFaction: choice.faction,
      victimFaction,
      holdId,
      characterIds: choice.captiveCharacterIds,
      characterNames: names,
      menAffected: names.length,
      circumstances,
      battleId: choice.battleId ?? null,
    });
  }

  if (choice.kind === "seat_fate") {
    if (fates.town === "raze" && hs) {
      const escort = next.armies.find((a) => choice.escortArmyIds.includes(a.id));
      const check = canRaze(escort, holdId, hs);
      if (check.ok || hs.controller === choice.faction) {
        next = {
          ...next,
          holdStates: {
            ...next.holdStates,
            [holdId]: beginRaze(
              next.holdStates[holdId] ?? hs,
              choice.faction,
              board.turn
            ),
          },
        };
      }
    } else {
      deedInputs.push({
        turn: board.turn,
        kind: choice.promised ? "town_occupied" : "town_stormed",
        actorFaction: choice.faction,
        victimFaction,
        holdId,
        characterIds: [],
        characterNames: [],
        menAffected: 0,
        circumstances,
      });
    }
  }

  if (choice.kind === "battle_prisoners") {
    next = backfillBattlePrisoners(next, choice, fates, deedInputs);
  }

  const recorded = recordDeeds(next.deeds, deedInputs);
  next = { ...next, deeds: recorded.deeds };

  return { board: next, events };
}

function inferVictim(
  choice: PendingChoice,
  board: BoardSlice
): Faction | null {
  for (const id of choice.captiveCharacterIds) {
    const c = board.characters[id];
    if (c) return c.faction;
  }
  const hs = board.holdStates[choice.holdId];
  const home = hs?.homeFaction;
  if (home === "north" || home === "westerlands") {
    if (home !== choice.faction) return home;
  }
  return choice.faction === "north" ? "westerlands" : "north";
}

function backfillBattlePrisoners(
  board: BoardSlice,
  choice: PendingChoice,
  fates: SeatFates,
  deedInputs: DeedInput[]
): BoardSlice {
  if (!choice.battleId) return board;
  const outcome: "executed" | "released" | "held" =
    fates.garrison === "execute" || fates.leaders === "execute"
      ? "executed"
      : fates.garrison === "let_go" && fates.leaders === "let_go"
        ? "released"
        : "held";
  const deedId = deedInputs[deedInputs.length - 1]
    ? null
    : null;
  void deedId;
  return {
    ...board,
    battleReports: board.battleReports.map((r) => {
      if (r.id !== choice.battleId) return r;
      return {
        ...r,
        prisoners: (r.prisoners ?? []).map((p) =>
          p.role === "taken_here" && p.outcome === "undecided"
            ? {
                ...p,
                outcome,
                decidedTurn: board.turn,
              }
            : p
        ),
      };
    }),
  };
}

/** Dispose of an existing prisoner group (release or execute) and record it. */
export function disposePrisonerGroup(
  board: BoardSlice,
  groupId: string,
  action: "release" | "execute"
): ApplyChoiceResult | null {
  const group = board.prisoners.find((g) => g.id === groupId);
  if (!group) return null;

  const names = group.characterIds.map((id) => board.characters[id]?.name ?? id);
  const men = prisonerMen(group);
  const holdId =
    group.location.kind === "hold" ? group.location.holdId : group.takenAtHoldId;

  let characters = board.characters;
  let travellers = board.travellers;
  if (action === "release") {
    characters = releasePrisoners(characters, group);
    for (const id of group.characterIds) {
      const c = characters[id];
      if (!c) continue;
      const dest =
        defaultRefuge(holdId, c.faction, board.holdStates, board.armies) ??
        holdId;
      travellers = [...travellers, startTravel(id, holdId, dest, board.turn)];
    }
  } else {
    characters = executePrisoners(characters, group);
  }

  const { deeds, deed } = recordDeed(board.deeds, {
    turn: board.turn,
    kind: action === "release" ? "prisoners_released" : "prisoners_executed",
    actorFaction: group.captorFaction,
    victimFaction: group.faction,
    holdId,
    characterIds: group.characterIds,
    characterNames: names,
    menAffected: men + names.length,
    circumstances: emptyCircumstances(),
    battleId: group.battleId ?? null,
  });

  const battleReports = board.battleReports.map((r) => {
    if (!group.battleId || r.id !== group.battleId) return r;
    return {
      ...r,
      prisoners: (r.prisoners ?? []).map((p) =>
        p.groupId === group.id
          ? {
              ...p,
              outcome: action === "release" ? ("released" as const) : ("executed" as const),
              decidedTurn: board.turn,
              deedId: deed.id,
            }
          : p
      ),
    };
  });

  return {
    board: {
      ...board,
      characters,
      travellers,
      deeds,
      battleReports,
      prisoners: board.prisoners.filter((g) => g.id !== groupId),
    },
    events: [
      {
        id: eid("ev"),
        turn: board.turn,
        faction: group.captorFaction,
        kind: "other",
        holdIds: [holdId],
        relatedCharacterIds: group.characterIds,
        summary:
          action === "release"
            ? `Prisoners released (${men.toLocaleString()} men)`
            : `Prisoners executed (${men.toLocaleString()} men)`,
        detail: deed.detail,
      },
    ],
  };
}

export function namedDefendersOf(
  holdId: string,
  holdStates: Record<string, HoldRuntime>,
  characters: Record<CharacterId, CharacterState>
): CharacterId[] {
  const hs = holdStates[holdId];
  if (!hs) return [];
  return namedIdsAtHold(hs, characters);
}

export { stripForageAtHold };
