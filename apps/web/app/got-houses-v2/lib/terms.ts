import type {
  Faction,
  PersonFate,
  SeatFates,
  SurrenderTerms,
  TownFate,
} from "../types";

/**
 * Three-axis terms.
 *
 * Terms are a promise, not an outcome: the taker chooses what actually happens
 * once the gates are open. That gap is the whole point — it is what makes a
 * bargain worth something and what makes breaking one possible.
 */

/** Severity order for men. Higher is worse for the man in question. */
const PERSON_SEVERITY: Record<PersonFate, number> = {
  let_go: 0,
  prisoner: 1,
  execute: 2,
};

/** Severity order for walls. */
const TOWN_SEVERITY: Record<TownFate, number> = {
  occupy: 0,
  raze: 1,
};

export function personSeverity(f: PersonFate): number {
  return PERSON_SEVERITY[f] ?? 0;
}

export function townSeverity(f: TownFate): number {
  return TOWN_SEVERITY[f] ?? 0;
}

const PERSON_FATES: PersonFate[] = ["let_go", "prisoner", "execute"];
const TOWN_FATES: TownFate[] = ["occupy", "raze"];

export function asPersonFate(v: unknown, fallback: PersonFate = "prisoner"): PersonFate {
  return PERSON_FATES.includes(v as PersonFate) ? (v as PersonFate) : fallback;
}

export function asTownFate(v: unknown, fallback: TownFate = "occupy"): TownFate {
  return TOWN_FATES.includes(v as TownFate) ? (v as TownFate) : fallback;
}

export function asSeatFates(v: unknown): SeatFates {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    garrison: asPersonFate(o.garrison),
    leaders: asPersonFate(o.leaders),
    town: asTownFate(o.town),
  };
}

/**
 * Read terms off a save.
 *
 * Games already in the database carry the old two-boolean shape
 * (`garrisonSpared` / `leadersSpared`) and no town axis at all. Spared maps to
 * letting men walk, unspared to holding them prisoner — not to execution,
 * since the old game never promised anyone's death. Town defaults to occupy,
 * which is what the old game always did.
 */
export function normalizeTerms(raw: unknown): SurrenderTerms | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (t.offeredBy !== "north" && t.offeredBy !== "westerlands") return null;

  const legacyGarrison =
    typeof t.garrisonSpared === "boolean"
      ? t.garrisonSpared
        ? "let_go"
        : "prisoner"
      : undefined;
  const legacyLeaders =
    typeof t.leadersSpared === "boolean"
      ? t.leadersSpared
        ? "let_go"
        : "prisoner"
      : undefined;

  const status = t.status;
  return {
    offeredBy: t.offeredBy,
    garrison: asPersonFate(t.garrison ?? legacyGarrison),
    leaders: asPersonFate(t.leaders ?? legacyLeaders),
    town: asTownFate(t.town),
    releasePrisonerIds: Array.isArray(t.releasePrisonerIds)
      ? (t.releasePrisonerIds as string[])
      : undefined,
    note: typeof t.note === "string" ? t.note : "",
    offeredTurn: typeof t.offeredTurn === "number" ? t.offeredTurn : 0,
    expiresTurn: typeof t.expiresTurn === "number" ? t.expiresTurn : 0,
    status:
      status === "offered" ||
      status === "accepted" ||
      status === "rejected" ||
      status === "lapsed"
        ? status
        : "offered",
    reply: typeof t.reply === "string" ? t.reply : undefined,
  };
}

export function fatesOf(terms: SurrenderTerms): SeatFates {
  return {
    garrison: terms.garrison,
    leaders: terms.leaders,
    town: terms.town,
  };
}

export interface PromiseComparison {
  brokeWord: boolean;
  /** Axes where the taker went harder than promised. */
  brokenAxes: ("garrison" | "leaders" | "town")[];
  /** Plain account of the breach, empty when the word was kept. */
  detail: string;
}

/**
 * Did the taker go harder than promised?
 *
 * Only harsher counts. Promising death and then showing mercy is not a breach —
 * nobody complains about that.
 */
export function compareToPromise(
  promised: SeatFates | null,
  chosen: SeatFates
): PromiseComparison {
  if (!promised) {
    return { brokeWord: false, brokenAxes: [], detail: "" };
  }
  const brokenAxes: ("garrison" | "leaders" | "town")[] = [];
  if (personSeverity(chosen.garrison) > personSeverity(promised.garrison)) {
    brokenAxes.push("garrison");
  }
  if (personSeverity(chosen.leaders) > personSeverity(promised.leaders)) {
    brokenAxes.push("leaders");
  }
  if (townSeverity(chosen.town) > townSeverity(promised.town)) {
    brokenAxes.push("town");
  }
  if (brokenAxes.length === 0) {
    return { brokeWord: false, brokenAxes: [], detail: "" };
  }

  const say: string[] = [];
  if (brokenAxes.includes("garrison")) {
    say.push(
      `the garrison was promised ${describePersonFate(promised.garrison)} and got ${describePersonFate(chosen.garrison)}`
    );
  }
  if (brokenAxes.includes("leaders")) {
    say.push(
      `the captains were promised ${describePersonFate(promised.leaders)} and got ${describePersonFate(chosen.leaders)}`
    );
  }
  if (brokenAxes.includes("town")) {
    say.push("the seat was promised quarter and was burned instead");
  }
  return {
    brokeWord: true,
    brokenAxes,
    detail: say.join("; "),
  };
}

export function describePersonFate(f: PersonFate): string {
  if (f === "let_go") return "their freedom";
  if (f === "prisoner") return "chains";
  return "the sword";
}

/** One line for the board and the log. */
export function describeTerms(terms: SurrenderTerms): string {
  const men =
    terms.garrison === "let_go"
      ? "the garrison marches out alive"
      : terms.garrison === "prisoner"
        ? "the garrison is taken prisoner"
        : "the garrison is put to the sword";
  const named =
    terms.leaders === "let_go"
      ? "its captains walk free"
      : terms.leaders === "prisoner"
        ? "its captains are held"
        : "its captains are executed";
  const town =
    terms.town === "occupy" ? "the seat is spared" : "the seat is to be burned";
  return `${men}, ${named}, ${town}`;
}

/** The default offer: mercy for the men, the seat kept standing. */
export function defaultFates(): SeatFates {
  return { garrison: "let_go", leaders: "let_go", town: "occupy" };
}

/** What an unconditional yield concedes — everything left to the taker. */
export function unconditionalFates(): SeatFates {
  return { garrison: "prisoner", leaders: "prisoner", town: "occupy" };
}

export function termsAreHarsh(terms: SurrenderTerms): boolean {
  return (
    terms.garrison === "execute" ||
    terms.leaders === "execute" ||
    terms.town === "raze"
  );
}

/** Who is on the other side of an exchange of terms. */
export function otherFaction(f: Faction): Faction {
  return f === "north" ? "westerlands" : "north";
}
