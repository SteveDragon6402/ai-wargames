import type {
  Army,
  ArmyMoveRecord,
  BattleAftermath,
  BattleContext,
  BattleParticipant,
  BattlePrisonerRecord,
  BattleReport,
  BattleSetup,
  Faction,
  HoldRuntime,
  PrisonerGroup,
  TurnHistory,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { armyMen, forageAtHold } from "./forage";
import { getCastleSeed } from "../data/castles";
import { prisonerMen } from "./prisoners";

/**
 * Snapshot who was there, and in what state, before casualties land.
 * After that the armies are gone as they were.
 */
export function snapshotParticipants(
  battle: BattleContext,
  armies: Army[]
): BattleParticipant[] {
  const byId = new Map(armies.map((a) => [a.id, a]));
  const all = [
    ...battle.northArmies,
    ...battle.westArmies,
    ...(battle.rogueArmies ?? []),
  ];
  const seen = new Set<string>();
  const out: BattleParticipant[] = [];
  for (const a of all) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const live = byId.get(a.id) ?? a;
    out.push({
      armyId: a.id,
      armyName: a.name,
      faction: a.faction,
      commander: a.leaders[0]?.name ?? null,
      notables: (a.notables ?? []).map((n) => n.name),
      menBefore: armyMen(a),
      menAfter: armyMen(live),
      moraleBefore: a.morale,
      tirednessBefore: a.tiredness,
      stanceBefore: a.stance,
      fromHoldId: battle.armyApproaches?.[a.id]?.fromHoldId ?? null,
      order: battle.armyOrders?.[a.id] ?? null,
      commitment: battle.armyCommitments?.[a.id] ?? null,
      wasGarrison: a.id.startsWith("garrison:"),
    });
  }
  return out;
}

export function snapshotSetup(
  battle: BattleContext,
  holdStates: Record<string, HoldRuntime>
): BattleSetup {
  const hold = HOLDS_MAP.get(battle.holdId);
  const forage = forageAtHold(undefined, battle.holdId);
  return {
    engagement: battle.engagement ?? "field",
    lastStand: !!battle.lastStand,
    wallsStood: !!battle.wallsStand,
    combinedAssault: !!battle.combinedAssault,
    ground: hold?.ground ?? "",
    region: hold?.region ?? "",
    forage: battle.forage ?? forage,
    seatLine: battle.seatLine ?? "",
    approaches: battle.armyApproaches ?? {},
  };
}

export function inferVictor(
  holdResult: Faction | "abandoned",
  defeatType?: string
): Faction | "none" {
  if (holdResult === "abandoned") return "none";
  if (defeatType === "pyrrhic_win") return holdResult;
  return holdResult;
}

export function escortedPrisonerRecords(
  groups: PrisonerGroup[] | undefined,
  armyIds: string[]
): BattlePrisonerRecord[] {
  const ids = new Set(armyIds);
  return (groups ?? [])
    .filter((g) => g.location.kind === "army" && ids.has(g.location.armyId))
    .map((g) => ({
      groupId: g.id,
      faction: g.faction,
      men: prisonerMen(g),
      characterNames: [],
      role: "escorted_in" as const,
      outcome: "undecided" as const,
      decidedTurn: null,
      deedId: null,
    }));
}

export function takenPrisonerRecord(
  group: PrisonerGroup,
  names: string[]
): BattlePrisonerRecord {
  return {
    groupId: group.id,
    faction: group.faction,
    men: prisonerMen(group),
    characterNames: names,
    role: "taken_here",
    outcome: "undecided",
    decidedTurn: null,
    deedId: null,
  };
}

export function emptyAftermath(
  seatChanged: BattleAftermath["seatChanged"],
  destroyedArmyIds: string[]
): BattleAftermath {
  return {
    seatChanged,
    destroyedArmyIds,
    retreatedTo: {},
  };
}

export function backfillRetreats(
  reports: BattleReport[],
  retreatedTo: Record<string, string | null>
): BattleReport[] {
  return reports.map((r) => {
    const hits = (r.retreatingArmyIds ?? []).some((id) => id in retreatedTo);
    if (!hits && !r.aftermath) return r;
    return {
      ...r,
      aftermath: {
        seatChanged: r.aftermath?.seatChanged ?? null,
        destroyedArmyIds: r.aftermath?.destroyedArmyIds ?? [],
        retreatedTo: { ...(r.aftermath?.retreatedTo ?? {}), ...retreatedTo },
      },
    };
  });
}

export interface BattleLogQuery {
  holdId?: string;
  faction?: Faction;
  characterName?: string;
  sinceTurn?: number;
  limit?: number;
}

export function queryBattleLogs(
  reports: BattleReport[] | undefined,
  opts: BattleLogQuery = {}
): BattleReport[] {
  let list = [...(reports ?? [])];
  if (opts.holdId) list = list.filter((r) => r.holdId === opts.holdId);
  if (opts.sinceTurn != null) list = list.filter((r) => r.turn >= opts.sinceTurn!);
  if (opts.faction) {
    list = list.filter(
      (r) =>
        r.victor === opts.faction ||
        r.holdResult === opts.faction ||
        (r.participants ?? []).some((p) => p.faction === opts.faction)
    );
  }
  const name = (opts.characterName ?? "").trim().toLowerCase();
  if (name) {
    list = list.filter((r) => {
      const fallen = (r.fallen ?? []).some((f) => f.name.toLowerCase().includes(name));
      const captured = (r.captured ?? []).some((f) => f.name.toLowerCase().includes(name));
      const parts = (r.participants ?? []).some(
        (p) =>
          p.commander?.toLowerCase().includes(name) ||
          p.notables.some((n) => n.toLowerCase().includes(name))
      );
      return fallen || captured || parts || r.narrative.toLowerCase().includes(name);
    });
  }
  return list.slice(-(opts.limit ?? 8));
}

export function formatBattleLog(r: BattleReport): string {
  const hold = HOLDS_MAP.get(r.holdId)?.name ?? r.holdId;
  const victor =
    r.victor === "north"
      ? "the North"
      : r.victor === "westerlands"
        ? "the Westerlands"
        : r.victor === "none"
          ? "neither side"
          : r.holdResult;
  const lines: string[] = [
    `Turn ${r.turn} at ${hold} — victor: ${victor}${r.defeatType ? ` (${r.defeatType})` : ""}.`,
  ];
  if (r.headline) lines.push(r.headline);
  for (const p of r.participants ?? []) {
    lines.push(
      `${p.armyName} (${p.faction}): ${p.menBefore.toLocaleString()} → ${p.menAfter.toLocaleString()} men; ${p.commander ?? "no commander"}; ${p.moraleBefore}; ${p.tirednessBefore}.`
    );
  }
  const fallen = (r.fallen ?? []).map((f) => f.name);
  const captured = (r.captured ?? []).map((f) => f.name);
  if (fallen.length) lines.push(`Slain: ${fallen.join(", ")}.`);
  if (captured.length) lines.push(`Taken alive: ${captured.join(", ")}.`);
  const haul = (r.prisonersTaken ?? []).reduce((s, c) => s + c.count, 0);
  if (haul > 0) {
    lines.push(`Rank-and-file taken prisoner: ${haul.toLocaleString()}.`);
  }
  for (const p of r.prisoners ?? []) {
    lines.push(
      `Prisoners (${p.role}): ${p.men.toLocaleString()} ${p.faction} men${p.characterNames.length ? ` — ${p.characterNames.join(", ")}` : ""}; ${p.outcome}.`
    );
  }
  if (r.setup) {
    lines.push(
      `Setup: ${r.setup.engagement}${r.setup.lastStand ? ", last stand" : ""}${r.setup.wallsStood ? ", walls still stood" : ""}. ${r.setup.ground}`
    );
  }
  if (r.aftermath) {
    const dests = Object.entries(r.aftermath.retreatedTo)
      .map(([id, dest]) => `${id}→${dest ? HOLDS_MAP.get(dest)?.name ?? dest : "nowhere"}`)
      .join("; ");
    if (dests) lines.push(`Retreats: ${dests}.`);
    if (r.aftermath.destroyedArmyIds.length) {
      lines.push(`Destroyed: ${r.aftermath.destroyedArmyIds.join(", ")}.`);
    }
  }
  if (r.factors) {
    lines.push(`Forces: ${r.factors.forceRatio}. ${r.factors.ground}`);
  }
  lines.push(r.narrative.slice(0, 900));
  return lines.join("\n");
}

export interface MarchQuery {
  armyName?: string;
  holdId?: string;
  faction?: Faction;
  sinceTurn?: number;
  limit?: number;
}

/**
 * Own marches in full. Enemy marches only where they became public —
 * a battle, a siege, or a seat changing hands.
 */
export function queryMarchHistory(
  history: TurnHistory[] | undefined,
  viewer: Faction,
  opts: MarchQuery,
  publicHoldTurns: Set<string>
): ArmyMoveRecord[] {
  const name = (opts.armyName ?? "").trim().toLowerCase();
  const out: ArmyMoveRecord[] = [];
  for (const turn of history ?? []) {
    if (opts.sinceTurn != null && turn.turn < opts.sinceTurn) continue;
    for (const m of turn.armyMoves) {
      if (opts.faction && m.faction !== opts.faction) continue;
      if (opts.holdId && m.fromHoldId !== opts.holdId && m.toHoldId !== opts.holdId) {
        continue;
      }
      if (name && !m.armyName.toLowerCase().includes(name) && !m.armyId.toLowerCase().includes(name)) {
        continue;
      }
      if (m.faction !== viewer) {
        const keyFrom = `${turn.turn}:${m.fromHoldId}`;
        const keyTo = `${turn.turn}:${m.toHoldId}`;
        const siegeFrom = `siege:${m.fromHoldId}`;
        const siegeTo = `siege:${m.toHoldId}`;
        if (
          !publicHoldTurns.has(keyFrom) &&
          !publicHoldTurns.has(keyTo) &&
          !publicHoldTurns.has(siegeFrom) &&
          !publicHoldTurns.has(siegeTo)
        ) {
          continue;
        }
      }
      out.push(m);
    }
  }
  return out.slice(-(opts.limit ?? 30));
}

export function publicHoldTurnsFrom(
  reports: BattleReport[] | undefined,
  holdStates: Record<string, HoldRuntime>
): Set<string> {
  const out = new Set<string>();
  for (const r of reports ?? []) {
    out.add(`${r.turn}:${r.holdId}`);
  }
  for (const [id, hs] of Object.entries(holdStates)) {
    if (hs.siege) out.add(`siege:${id}`);
  }
  void getCastleSeed;
  return out;
}

export function formatMarch(m: ArmyMoveRecord, turn: number): string {
  const from = HOLDS_MAP.get(m.fromHoldId)?.name ?? m.fromHoldId;
  const to = HOLDS_MAP.get(m.toHoldId)?.name ?? m.toHoldId;
  if (!m.moved) return `Turn ${turn}: ${m.armyName} ${m.order}ed at ${from} (${m.men.toLocaleString()} men).`;
  return `Turn ${turn}: ${m.armyName} marched ${from} → ${to} (${m.men.toLocaleString()} men).`;
}
