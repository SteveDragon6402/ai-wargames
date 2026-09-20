import type {
  CharacterId,
  Deed,
  DeedCircumstances,
  DeedKind,
  Faction,
  SeatFates,
} from "../types";
import { HOLDS_MAP } from "../data/holds";

/**
 * The public war record.
 *
 * `FactionEvent` is private to the faction that acted. A deed is the opposite:
 * both sides can read it, and castellans do read it before they decide whether
 * your word is worth anything. Breaking terms carries no mechanical penalty —
 * it simply goes on the record with enough context to be judged, and the
 * models draw their own conclusions.
 */

export const DEEDS_CAP = 500;

/** Yielded this quickly and mercy was cheap; held out longer and it was not. */
export const SURRENDER_QUICK_TURNS = 2;

const KIND_LABEL: Record<DeedKind, string> = {
  terms_offered: "offered terms",
  terms_accepted: "accepted terms",
  terms_rejected: "refused terms",
  garrison_let_go: "let a garrison walk",
  garrison_imprisoned: "took a garrison prisoner",
  garrison_executed: "put a garrison to the sword",
  leaders_let_go: "let the captains walk free",
  leaders_imprisoned: "took the captains prisoner",
  leaders_executed: "executed the captains",
  town_occupied: "occupied a seat",
  town_razed: "razed a seat",
  town_stormed: "stormed a seat",
  prisoners_taken: "took prisoners",
  prisoners_released: "released prisoners",
  prisoners_executed: "executed prisoners",
  prisoners_liberated: "freed prisoners from an enemy",
  counsel_given: "heard a bannerman and answered",
};

/** Deeds a reasonable man would hold against you. */
const DARK_KINDS: DeedKind[] = [
  "garrison_executed",
  "leaders_executed",
  "prisoners_executed",
  "town_razed",
];

/** Deeds that speak well of you. */
const MERCIFUL_KINDS: DeedKind[] = [
  "garrison_let_go",
  "leaders_let_go",
  "prisoners_released",
];

export function factionName(f: Faction | null): string {
  if (f === "north") return "the North";
  if (f === "westerlands") return "the Westerlands";
  return "no one";
}

function holdName(holdId: string | null): string {
  if (!holdId) return "the field";
  return HOLDS_MAP.get(holdId)?.name ?? holdId;
}

export function emptyCircumstances(
  partial: Partial<DeedCircumstances> = {}
): DeedCircumstances {
  return {
    siegeTurns: null,
    timesTermsOffered: 0,
    timesTermsRefused: 0,
    surrendered: false,
    surrenderedQuickly: false,
    stormed: false,
    starving: false,
    garrisonMen: null,
    besiegerMen: null,
    promised: null,
    chosen: null,
    brokeWord: false,
    ...partial,
  };
}

export function describeFates(f: SeatFates | null): string {
  if (!f) return "nothing promised";
  const men =
    f.garrison === "let_go"
      ? "the garrison to walk"
      : f.garrison === "prisoner"
        ? "the garrison held"
        : "the garrison put to the sword";
  const named =
    f.leaders === "let_go"
      ? "its captains free"
      : f.leaders === "prisoner"
        ? "its captains held"
        : "its captains executed";
  const town = f.town === "occupy" ? "the seat spared" : "the seat burned";
  return `${men}, ${named}, ${town}`;
}

/**
 * The sentence that lets a man judge the act rather than merely read it.
 * Razing after thirty turns of refusal is not razing on the opening day.
 */
export function describeCircumstances(c: DeedCircumstances): string {
  const parts: string[] = [];

  if (c.surrendered) {
    parts.push(
      c.surrenderedQuickly
        ? c.siegeTurns != null && c.siegeTurns > 0
          ? `They yielded almost at once, after ${c.siegeTurns} turn${c.siegeTurns === 1 ? "" : "s"} of investment.`
          : "They yielded almost at once."
        : c.siegeTurns != null
          ? `They yielded after ${c.siegeTurns} turns under siege.`
          : "They yielded."
    );
  } else if (c.stormed) {
    parts.push(
      c.siegeTurns != null && c.siegeTurns > 0
        ? `The walls were carried by storm after ${c.siegeTurns} turns of investment.`
        : "The walls were carried by storm."
    );
  } else if (c.siegeTurns != null && c.siegeTurns > 0) {
    parts.push(`The seat had been under siege ${c.siegeTurns} turns.`);
  }

  if (c.timesTermsOffered > 0) {
    parts.push(
      c.timesTermsRefused > 0
        ? `Terms were put to them ${c.timesTermsOffered} time${c.timesTermsOffered === 1 ? "" : "s"}, and refused ${c.timesTermsRefused} time${c.timesTermsRefused === 1 ? "" : "s"}.`
        : `Terms were put to them ${c.timesTermsOffered} time${c.timesTermsOffered === 1 ? "" : "s"}.`
    );
  }

  if (c.starving) parts.push("The garrison was starving by then.");

  if (c.garrisonMen != null && c.besiegerMen != null) {
    parts.push(
      `${c.garrisonMen.toLocaleString()} behind the walls against ${c.besiegerMen.toLocaleString()} outside.`
    );
  } else if (c.garrisonMen != null) {
    parts.push(`${c.garrisonMen.toLocaleString()} men behind the walls.`);
  }

  if (c.promised) {
    parts.push(`What was promised: ${describeFates(c.promised)}.`);
  }
  if (c.chosen && c.promised) {
    parts.push(
      c.brokeWord
        ? `What was done: ${describeFates(c.chosen)}. The word given was broken.`
        : `What was done: ${describeFates(c.chosen)}. The word given was kept.`
    );
  } else if (c.chosen) {
    parts.push(`What was done: ${describeFates(c.chosen)}.`);
  }

  return parts.join(" ");
}

export type DeedInput = Omit<Deed, "id" | "summary" | "detail"> & {
  summary?: string;
  detail?: string;
};

function deedId(): string {
  return `deed-${Math.random().toString(36).slice(2, 10)}`;
}

function autoSummary(d: DeedInput): string {
  const who = factionName(d.actorFaction);
  const where = holdName(d.holdId);
  const names = d.characterNames.slice(0, 3).join(", ");
  const men = d.menAffected > 0 ? ` (${d.menAffected.toLocaleString()} men)` : "";
  const broke = d.circumstances.brokeWord ? " — word broken" : "";
  const at = d.holdId ? ` at ${where}` : "";
  return `${who} ${KIND_LABEL[d.kind]}${at}${names ? `: ${names}` : ""}${men}${broke}`;
}

function autoDetail(d: DeedInput): string {
  const who = factionName(d.actorFaction);
  const against = d.victimFaction ? ` of ${factionName(d.victimFaction)}` : "";
  const where = d.holdId ? ` at ${holdName(d.holdId)}` : "";
  const lead = `On turn ${d.turn}, ${who} ${KIND_LABEL[d.kind]}${where}${against ? `, men${against}` : ""}.`;
  const men =
    d.menAffected > 0
      ? ` ${d.menAffected.toLocaleString()} men were involved.`
      : "";
  const named =
    d.characterNames.length > 0
      ? ` Named: ${d.characterNames.join(", ")}.`
      : "";
  const ctx = describeCircumstances(d.circumstances);
  return `${lead}${men}${named}${ctx ? ` ${ctx}` : ""}`;
}

/** Append a deed to the ledger, composing its prose if the caller didn't. */
export function recordDeed(
  deeds: Deed[] | undefined,
  input: DeedInput
): { deeds: Deed[]; deed: Deed } {
  const deed: Deed = {
    ...input,
    id: deedId(),
    summary: input.summary ?? autoSummary(input),
    detail: input.detail ?? autoDetail(input),
  };
  const next = [...(deeds ?? []), deed].slice(-DEEDS_CAP);
  return { deeds: next, deed };
}

/** Append several at once, keeping one cap pass. */
export function recordDeeds(
  deeds: Deed[] | undefined,
  inputs: DeedInput[]
): { deeds: Deed[]; recorded: Deed[] } {
  let list = [...(deeds ?? [])];
  const recorded: Deed[] = [];
  for (const input of inputs) {
    const deed: Deed = {
      ...input,
      id: deedId(),
      summary: input.summary ?? autoSummary(input),
      detail: input.detail ?? autoDetail(input),
    };
    list.push(deed);
    recorded.push(deed);
  }
  list = list.slice(-DEEDS_CAP);
  return { deeds: list, recorded };
}

export interface DeedQuery {
  /** Who did it. */
  faction?: Faction;
  holdId?: string;
  /** Matches a named person caught up in the deed, by loose name match. */
  characterName?: string;
  kind?: string;
  sinceTurn?: number;
  /** Free text across summary and detail. */
  query?: string;
  limit?: number;
}

export function searchDeeds(
  deeds: Deed[] | undefined,
  opts: DeedQuery = {}
): Deed[] {
  let list = [...(deeds ?? [])];
  if (opts.faction) list = list.filter((d) => d.actorFaction === opts.faction);
  if (opts.holdId) list = list.filter((d) => d.holdId === opts.holdId);
  if (opts.sinceTurn != null) {
    list = list.filter((d) => d.turn >= opts.sinceTurn!);
  }
  const kind = (opts.kind ?? "").trim().toLowerCase();
  if (kind) list = list.filter((d) => d.kind === kind);

  const name = (opts.characterName ?? "").trim().toLowerCase();
  if (name) {
    list = list.filter((d) =>
      d.characterNames.some((n) => n.toLowerCase().includes(name))
    );
  }
  const q = (opts.query ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (d) =>
        d.summary.toLowerCase().includes(q) ||
        d.detail.toLowerCase().includes(q)
    );
  }
  const limit = Math.min(opts.limit ?? 30, 60);
  return list.slice(-limit);
}

export interface Reputation {
  faction: Faction;
  termsOffered: number;
  termsAccepted: number;
  wordKept: number;
  wordBroken: number;
  garrisonsLetGo: number;
  garrisonsImprisoned: number;
  garrisonsExecuted: number;
  leadersLetGo: number;
  leadersImprisoned: number;
  leadersExecuted: number;
  townsOccupied: number;
  townsRazed: number;
  prisonersReleased: number;
  prisonersExecuted: number;
  menExecuted: number;
  /** The worst of it, for quoting in full. */
  notorious: Deed[];
  /** The best of it. */
  merciful: Deed[];
}

export function reputationOf(
  deeds: Deed[] | undefined,
  faction: Faction
): Reputation {
  const mine = (deeds ?? []).filter((d) => d.actorFaction === faction);
  const count = (k: DeedKind) => mine.filter((d) => d.kind === k).length;

  let menExecuted = 0;
  for (const d of mine) {
    if (
      d.kind === "garrison_executed" ||
      d.kind === "prisoners_executed" ||
      d.kind === "leaders_executed"
    ) {
      menExecuted += d.menAffected;
    }
  }

  const notorious = mine
    .filter((d) => DARK_KINDS.includes(d.kind) || d.circumstances.brokeWord)
    .slice(-3);
  const merciful = mine
    .filter((d) => MERCIFUL_KINDS.includes(d.kind) && !d.circumstances.brokeWord)
    .slice(-2);

  return {
    faction,
    termsOffered: count("terms_offered"),
    termsAccepted: count("terms_accepted"),
    wordKept: mine.filter(
      (d) => d.circumstances.chosen != null && d.circumstances.promised != null && !d.circumstances.brokeWord
    ).length,
    wordBroken: mine.filter((d) => d.circumstances.brokeWord).length,
    garrisonsLetGo: count("garrison_let_go"),
    garrisonsImprisoned: count("garrison_imprisoned"),
    garrisonsExecuted: count("garrison_executed"),
    leadersLetGo: count("leaders_let_go"),
    leadersImprisoned: count("leaders_imprisoned"),
    leadersExecuted: count("leaders_executed"),
    townsOccupied: count("town_occupied"),
    townsRazed: count("town_razed"),
    prisonersReleased: count("prisoners_released"),
    prisonersExecuted: count("prisoners_executed"),
    menExecuted,
    notorious,
    merciful,
  };
}

/**
 * The reputation a castellan weighs before answering an offer.
 *
 * Deliberately plain: the facts and the worst examples, with no instruction on
 * what to conclude. Let the model decide whether the word is good.
 */
export function reputationSummary(
  deeds: Deed[] | undefined,
  faction: Faction
): string {
  const r = reputationOf(deeds, faction);
  const who = factionName(faction);

  const total =
    r.termsOffered +
    r.garrisonsLetGo +
    r.garrisonsImprisoned +
    r.garrisonsExecuted +
    r.leadersLetGo +
    r.leadersImprisoned +
    r.leadersExecuted +
    r.townsOccupied +
    r.townsRazed +
    r.prisonersReleased +
    r.prisonersExecuted;

  if (total === 0) {
    return `${who} has taken no seats and made no bargains yet. Nothing is known of how they treat men who yield.`;
  }

  const lines: string[] = [];

  if (r.wordKept > 0 || r.wordBroken > 0) {
    lines.push(
      r.wordBroken === 0
        ? `${who} has kept terms ${r.wordKept} time${r.wordKept === 1 ? "" : "s"} and broken none.`
        : `${who} has kept terms ${r.wordKept} time${r.wordKept === 1 ? "" : "s"} and BROKEN their word ${r.wordBroken} time${r.wordBroken === 1 ? "" : "s"}.`
    );
  }

  const garrison: string[] = [];
  if (r.garrisonsLetGo > 0) garrison.push(`let ${r.garrisonsLetGo} walk`);
  if (r.garrisonsImprisoned > 0) garrison.push(`held ${r.garrisonsImprisoned}`);
  if (r.garrisonsExecuted > 0) garrison.push(`put ${r.garrisonsExecuted} to the sword`);
  if (garrison.length > 0) lines.push(`Of garrisons taken: ${garrison.join(", ")}.`);

  const named: string[] = [];
  if (r.leadersLetGo > 0) named.push(`freed the captains of ${r.leadersLetGo}`);
  if (r.leadersImprisoned > 0) named.push(`imprisoned the captains of ${r.leadersImprisoned}`);
  if (r.leadersExecuted > 0) named.push(`executed the captains of ${r.leadersExecuted}`);
  if (named.length > 0) lines.push(`Of captains: ${named.join(", ")}.`);

  if (r.townsRazed > 0) {
    lines.push(
      `They have burned ${r.townsRazed} seat${r.townsRazed === 1 ? "" : "s"} and spared ${r.townsOccupied}.`
    );
  } else if (r.townsOccupied > 0) {
    lines.push(`They have taken ${r.townsOccupied} seat${r.townsOccupied === 1 ? "" : "s"} and burned none.`);
  }

  if (r.prisonersExecuted > 0) {
    lines.push(
      `They have executed prisoners ${r.prisonersExecuted} time${r.prisonersExecuted === 1 ? "" : "s"}.`
    );
  }
  if (r.menExecuted > 0) {
    lines.push(`Some ${r.menExecuted.toLocaleString()} men have been killed after laying down arms.`);
  }

  if (r.notorious.length > 0) {
    lines.push("What is spoken of:");
    for (const d of r.notorious) lines.push(`- ${d.detail}`);
  }
  if (r.merciful.length > 0) {
    lines.push("Also remembered:");
    for (const d of r.merciful) lines.push(`- ${d.summary}`);
  }

  return lines.join("\n");
}

/** Full prose for one deed, for tool output. */
export function describeDeed(d: Deed): string {
  return `Turn ${d.turn} — ${d.summary}\n${d.detail}`;
}

/** Names of everyone this faction has killed after they had yielded. */
export function executedByFaction(
  deeds: Deed[] | undefined,
  faction: Faction
): { name: string; id: CharacterId | null; turn: number; holdId: string | null }[] {
  const out: { name: string; id: CharacterId | null; turn: number; holdId: string | null }[] = [];
  for (const d of deeds ?? []) {
    if (d.actorFaction !== faction) continue;
    if (
      d.kind !== "leaders_executed" &&
      d.kind !== "garrison_executed" &&
      d.kind !== "prisoners_executed"
    ) {
      continue;
    }
    d.characterNames.forEach((name, i) => {
      out.push({
        name,
        id: d.characterIds[i] ?? null,
        turn: d.turn,
        holdId: d.holdId,
      });
    });
  }
  return out;
}
