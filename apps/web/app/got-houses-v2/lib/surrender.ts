import type {
  Army,
  CapturePledge,
  CharacterId,
  CharacterState,
  Faction,
  FactionEvent,
  GameAction,
  GameState,
  HoldRuntime,
  SurrenderTerms,
} from "../types";
import type { SurrenderDecision } from "./character-tools";
import { getCastleSeed } from "../data/castles";
import { HOLDS_MAP } from "../data/holds";
import { findCharacterIdByName } from "../data/characters";
import {
  garrisonHeadcount,
  isGarrisonable,
  normalizeGarrison,
  normalizeHoldRuntime,
} from "./hold-runtime";
import { armyNameForCommander } from "./army-naming";
import { headcountOf, minimumHoldingGarrison } from "./siege";
import { isOccupyingGarrison, nearestFriendlyHold } from "./travel";

/** How long an offer stays on the table before it lapses. */
export const TERMS_LIFETIME_TURNS = 2;

function eid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defendingSideOf(hs: HoldRuntime): Faction | "hostile" | null {
  return hs.garrison.faction ?? hs.controller;
}

/** The side a besieger's terms would be addressed to, and vice versa. */
export function counterpartyOf(
  hs: HoldRuntime,
  offeredBy: Faction
): Faction | "hostile" | null {
  if (!hs.siege) return null;
  return offeredBy === hs.siege.besiegerFaction
    ? defendingSideOf(hs)
    : hs.siege.besiegerFaction;
}

/** A besieger may put terms; so may the garrison, suing for its own men. */
export function canOfferTerms(
  hs: HoldRuntime | undefined,
  faction: Faction
): boolean {
  if (!hs?.siege) return false;
  if (garrisonHeadcount(hs.garrison) <= 0) return false;
  if (hs.siege.terms?.status === "offered") return false;
  return (
    hs.siege.besiegerFaction === faction ||
    defendingSideOf(hs) === faction
  );
}

export function openTermsAt(hs: HoldRuntime | undefined): SurrenderTerms | null {
  const t = hs?.siege?.terms;
  return t && t.status === "offered" ? t : null;
}

/** Terms this faction must answer (i.e. offered by the other side). */
export function termsAwaitingAnswer(
  hs: HoldRuntime | undefined,
  faction: Faction
): SurrenderTerms | null {
  const t = openTermsAt(hs);
  if (!t) return null;
  return t.offeredBy === faction ? null : t;
}

export function defaultTermsFor(
  hs: HoldRuntime,
  offeredBy: Faction,
  turn: number
): Omit<SurrenderTerms, "status" | "reply"> {
  return {
    offeredBy,
    garrisonSpared: true,
    leadersSpared: true,
    note:
      offeredBy === hs.siege?.besiegerFaction
        ? "Open the gates and your men may march out with their lives."
        : "We will yield the seat if our people are let walk.",
    offeredTurn: turn,
    expiresTurn: turn + TERMS_LIFETIME_TURNS,
  };
}

/**
 * Whether a parley line is the player putting terms, not asking about them.
 * Used so chat offers land on the board the same way the Terms block does.
 */
export function playerMessageLooksLikeTermsOffer(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 8) return false;
  if (/\b(what|which|whose)\b.*\bterms\b/.test(t)) return false;
  return (
    /\b(offer(s|ed|ing)? (you )?(terms|mercy|quarter)|put(s|ting)? terms|propose(d|s)? terms|these are (my |our )?terms)\b/.test(
      t
    ) ||
    /\b(open the gates|yield the (seat|castle|hold|walls)|surrender the (seat|castle|hold)|give (up|over) the (seat|castle|hold))\b/.test(
      t
    ) ||
    /\b(spare (your|the) (men|garrison|captains|people|lives)|keep your lives|you may (walk|march)|march out (alive|with)|walk (free|out) with)\b/.test(
      t
    ) ||
    /\b(quarter|mercy) for (you|your|the)\b/.test(t)
  );
}

export function describeTerms(terms: SurrenderTerms): string {
  const men = terms.garrisonSpared
    ? "the garrison marches out alive"
    : "the garrison is taken";
  const named = terms.leadersSpared
    ? "its captains walk free"
    : "its captains are held";
  return `${men}, ${named}`;
}

/**
 * How badly the garrison's position argues for taking terms.
 *
 * Pure and soft: no thresholds decide anything by themselves, this is only the
 * summary the castellan agent reasons over. Starvation and a hopeless strength
 * ratio are the two things that make yielding sane.
 */
export interface SurrenderPressure {
  starving: boolean;
  foodDaysRemaining: number | null;
  siegeTurns: number;
  garrisonMen: number;
  besiegerMen: number;
  /** Besiegers per defender, rounded to one decimal. */
  odds: number;
  reliefNearby: boolean;
  /** Soft one-line read of the whole position. */
  summary: string;
}

export function surrenderPressure(
  holdId: string,
  hs: HoldRuntime,
  armies: Army[]
): SurrenderPressure | null {
  if (!hs.siege) return null;
  const besieger = hs.siege.besiegerFaction;
  const defender = defendingSideOf(hs);
  const garrisonMen = garrisonHeadcount(hs.garrison);
  const besiegerMen = headcountOf(
    armies.filter((a) => a.holdId === holdId && a.faction === besieger)
  );
  const odds =
    garrisonMen > 0
      ? Math.round((besiegerMen / garrisonMen) * 10) / 10
      : Infinity;

  const hold = HOLDS_MAP.get(holdId);
  const reliefNearby =
    defender === "north" || defender === "westerlands"
      ? (hold?.links ?? []).some((linkId) =>
          armies.some((a) => a.holdId === linkId && a.faction === defender)
        )
      : false;

  const starving = (hs.foodDaysRemaining ?? Infinity) <= 0;
  const parts: string[] = [];
  parts.push(
    starving
      ? "The stores are out; the men are eating leather."
      : hs.foodDaysRemaining != null
        ? `About ${hs.foodDaysRemaining} days of food left.`
        : "Stores untracked."
  );
  parts.push(`Day ${hs.siege.turns} of the investment.`);
  parts.push(
    besiegerMen > 0
      ? `Roughly ${besiegerMen.toLocaleString()} outside against ${garrisonMen.toLocaleString()} within.`
      : `No host visible outside; ${garrisonMen.toLocaleString()} within.`
  );
  parts.push(
    reliefNearby
      ? "Friendly banners stand one march away — relief is possible."
      : "No relief within a march."
  );

  return {
    starving,
    foodDaysRemaining: hs.foodDaysRemaining,
    siegeTurns: hs.siege.turns,
    garrisonMen,
    besiegerMen,
    odds,
    reliefNearby,
    summary: parts.join(" "),
  };
}

/**
 * Seats where the garrison's own position is bad enough that its castellan
 * should be given the chance to sue for terms unprompted.
 */
export function holdsRipeForAiSurrender(
  holdStates: Record<string, HoldRuntime>,
  armies: Army[],
  besiegerFaction?: Faction
): string[] {
  const out: string[] = [];
  for (const [holdId, raw] of Object.entries(holdStates)) {
    const hs = normalizeHoldRuntime(raw);
    if (!hs.siege) continue;
    if (besiegerFaction && hs.siege.besiegerFaction !== besiegerFaction) {
      continue;
    }
    // Only a seat with a voice on the walls can sue for terms.
    if (!hs.castellanId) continue;
    if (garrisonHeadcount(hs.garrison) <= 0) continue;
    if (hs.siege.terms?.status === "offered") continue;
    const p = surrenderPressure(holdId, hs, armies);
    if (!p) continue;
    if (p.starving || (p.odds >= 3 && !p.reliefNearby && p.siegeTurns >= 3)) {
      out.push(holdId);
    }
  }
  return out;
}

/**
 * Turn a castellan's tool call into board state.
 *
 * Returns a short line describing what the decision did, for the parley log —
 * or null when the decision could not apply (no siege, nothing on the table).
 */
export function applySurrenderDecision(
  dispatch: (a: GameAction) => void,
  state: GameState,
  holdId: string,
  decision: SurrenderDecision
): string | null {
  const hs = state.holdStates?.[holdId];
  if (!hs?.siege) return null;
  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const garrisonSide = defendingSideOf(hs);
  const open = openTermsAt(hs);

  switch (decision.kind) {
    case "accept": {
      // Accepting nothing is a no-op; there has to be an offer on the table.
      if (!open) return null;
      dispatch({
        type: "RESOLVE_SURRENDER",
        holdId,
        accepted: true,
        reply: decision.reason,
      });
      return `${holdName} yields on the terms offered — ${describeTerms(open)}.`;
    }

    case "reject": {
      if (!open) return null;
      dispatch({
        type: "RESOLVE_SURRENDER",
        holdId,
        accepted: false,
        reply: decision.reason,
      });
      return `Terms refused at ${holdName}. The siege goes on.`;
    }

    case "propose": {
      if (garrisonSide !== "north" && garrisonSide !== "westerlands") {
        return null;
      }
      const terms: Omit<SurrenderTerms, "status" | "reply"> = {
        offeredBy: garrisonSide,
        garrisonSpared: decision.garrisonSpared,
        leadersSpared: decision.leadersSpared,
        note: decision.note,
        offeredTurn: state.turn,
        expiresTurn: state.turn + TERMS_LIFETIME_TURNS,
      };
      if (open) {
        dispatch({
          type: "RESOLVE_SURRENDER",
          holdId,
          accepted: false,
          reply: decision.note,
          counterTerms: terms,
        });
        return `${holdName} counters: ${decision.note}`;
      }
      dispatch({ type: "OFFER_SURRENDER_TERMS", holdId, terms });
      return `${holdName} sues for terms: ${decision.note}`;
    }
  }
}

export interface YieldResult {
  holdStates: Record<string, HoldRuntime>;
  characters: Record<CharacterId, CharacterState>;
  pledge: CapturePledge | null;
  events: FactionEvent[];
  armies: Army[];
}

/**
 * Hand a besieged seat over without a battle.
 *
 * The men inside leave the walls. An occupying garrison (posted troops of the
 * taker's enemy, not the native household) that is spared walks out to the
 * nearest friendly seat. Native garrisons just disperse. The victor is never
 * handed a hostile host standing on the castle they just accepted.
 */
export function yieldHold(opts: {
  turn: number;
  holdId: string;
  holdStates: Record<string, HoldRuntime>;
  armies: Army[];
  characters: Record<CharacterId, CharacterState>;
  terms: SurrenderTerms;
}): YieldResult {
  const { turn, holdId, terms } = opts;
  const hs = normalizeHoldRuntime(opts.holdStates[holdId]);
  const seed = getCastleSeed(holdId);
  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;

  if (!hs.siege || !isGarrisonable(seed)) {
    return {
      holdStates: opts.holdStates,
      characters: opts.characters,
      pledge: null,
      events: [],
      armies: opts.armies,
    };
  }

  const taker = hs.siege.besiegerFaction;
  const yielder = defendingSideOf(hs);
  const garrison = normalizeGarrison(hs.garrison);
  const men = garrisonHeadcount(garrison);

  // Named defenders walk or are held; either way they are off these walls.
  const characters = { ...opts.characters };
  const namedNames = [
    ...garrison.leaders.map((l) => l.name),
    ...(garrison.notables ?? []).map((n) => n.name),
  ];
  if (hs.castellanId && characters[hs.castellanId]) {
    const c = characters[hs.castellanId];
    if (c.kind === "npc") namedNames.push(c.name);
  }
  const held: string[] = [];
  const walked: string[] = [];
  for (const name of namedNames) {
    const id = findCharacterIdByName(characters, name);
    if (!id) continue;
    const c = characters[id];
    if (c?.kind !== "npc") continue;
    characters[id] = {
      ...c,
      holdId: null,
      armyId: null,
      captive: !terms.leadersSpared,
      mood: terms.leadersSpared
        ? `Walked out of ${holdName} on terms; the shame of it sits badly.`
        : `Taken at ${holdName} when the gates opened.`,
    };
    (terms.leadersSpared ? walked : held).push(name);
  }

  let nextArmies = [...opts.armies];
  let walkDest: string | null = null;
  const yielderFaction =
    yielder === "north" || yielder === "westerlands" ? yielder : null;
  if (
    terms.garrisonSpared &&
    yielderFaction &&
    isOccupyingGarrison(hs) &&
    men > 0
  ) {
    walkDest = nearestFriendlyHold(
      holdId,
      yielderFaction,
      opts.holdStates,
      nextArmies
    );
    if (walkDest) {
      const lead = terms.leadersSpared
        ? garrison.leaders[0]?.name ?? null
        : null;
      const walkArmy: Army = {
        id: `walkout-${holdId}-${turn}`,
        name: armyNameForCommander(lead, garrison.units, yielderFaction),
        holdId: walkDest,
        faction: yielderFaction,
        units: garrison.units.map((u) => ({ ...u })),
        leaders: terms.leadersSpared
          ? garrison.leaders.map((l) => ({ ...l }))
          : [],
        notables: terms.leadersSpared
          ? (garrison.notables ?? []).map((n) => ({ ...n }))
          : [],
        morale: "Walked out on terms; the shame of it sits badly.",
        tiredness: "Spent from the siege and the road out.",
        stance: "Re-forming in friendly country.",
        activity: {
          turnsResting: 0,
          turnsFortiying: 0,
          turnsMarching: 0,
          turnsSinceMerge: null,
          turnsSinceSplit: 0,
        },
      };
      nextArmies = [...nextArmies, walkArmy];
      if (terms.leadersSpared) {
        for (const name of walked) {
          const id = findCharacterIdByName(characters, name);
          if (!id) continue;
          const c = characters[id];
          if (c?.kind !== "npc") continue;
          characters[id] = { ...c, armyId: walkArmy.id, holdId: null };
        }
      }
    }
  }

  const holdStates = {
    ...opts.holdStates,
    [holdId]: {
      ...hs,
      controller: taker,
      garrison: {
        ...garrison,
        faction: taker,
        units: [],
        leaders: [],
        notables: [],
      },
      siege: null,
      postSiegeTurnsLeft: 2,
      scar: `Yielded on terms in turn ${turn}.`,
      supplies: "Taken on terms; the walls stand empty until men are posted.",
      foodDaysRemaining: seed.defaultFoodDays,
      skipUpdates: false,
      castellanId: null,
    } satisfies HoldRuntime,
  };

  const takerMenHere = headcountOf(
    nextArmies.filter((a) => a.holdId === holdId && a.faction === taker)
  );
  const pledge: CapturePledge | null =
    takerMenHere > 0
      ? {
          holdId,
          faction: taker,
          minimumMen: minimumHoldingGarrison(holdId, takerMenHere),
          turn,
          cause: "surrender",
        }
      : null;

  const destName = walkDest ? HOLDS_MAP.get(walkDest)?.name ?? walkDest : null;
  const detail = `${holdName} yielded to ${taker} on terms after ${hs.siege.turns} turns of investment: ${describeTerms(terms)}. ${men.toLocaleString()} defenders left the walls${held.length > 0 ? `; taken: ${held.join(", ")}` : walked.length > 0 ? `; walked free: ${walked.join(", ")}` : ""}${destName ? `; the occupying host appeared at ${destName}` : ""}.${
    pledge
      ? ` The walls stand empty; posting a garrison is optional.`
      : ""
  }`;

  const events: FactionEvent[] = [
    {
      id: eid("ev"),
      turn,
      faction: taker,
      kind: "claim",
      holdIds: [holdId],
      summary: `${holdName} yielded on terms`,
      detail,
    },
  ];
  if (yielder === "north" || yielder === "westerlands") {
    events.push({
      id: eid("ev"),
      turn,
      faction: yielder,
      kind: "other",
      holdIds: [holdId],
      summary: `${holdName} surrendered`,
      detail,
    });
  }

  return { holdStates, characters, pledge, events, armies: nextArmies };
}
