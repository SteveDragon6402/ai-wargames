import type {
  AdviceRecord,
  Army,
  BattleReport,
  CharacterId,
  Faction,
  FactionEvent,
  GameState,
  MoveOrder,
} from "../types";
import { HOLDS_MAP } from "../data/holds";
import { factionLordId } from "../data/characters";

function eid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function searchFactionEvents(
  events: FactionEvent[],
  opts: {
    faction: Faction;
    query?: string;
    kind?: string;
    turn?: number;
    limit?: number;
  }
): FactionEvent[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const kind = (opts.kind ?? "").trim().toLowerCase();
  let list = events.filter((e) => e.faction === opts.faction);
  if (opts.turn != null) list = list.filter((e) => e.turn === opts.turn);
  if (kind) list = list.filter((e) => e.kind === kind);
  if (q) {
    list = list.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q)
    );
  }
  const limit = Math.min(opts.limit ?? 40, 80);
  return list.slice(-limit);
}

export function searchAdvice(
  advice: AdviceRecord[],
  opts: {
    fromCharacterId?: CharacterId;
    toCharacterId?: CharacterId;
    query?: string;
    limit?: number;
  }
): AdviceRecord[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  let list = [...advice];
  if (opts.fromCharacterId) {
    list = list.filter((a) => a.fromCharacterId === opts.fromCharacterId);
  }
  if (opts.toCharacterId) {
    list = list.filter((a) => a.toCharacterId === opts.toCharacterId);
  }
  if (q) list = list.filter((a) => a.text.toLowerCase().includes(q));
  return list.slice(-(opts.limit ?? 30));
}

/** Build events from simultaneous orders that just resolved. */
export function eventsFromResolvedOrders(
  turn: number,
  armies: Army[],
  northOrders: MoveOrder[],
  westOrders: MoveOrder[],
  northStance: Record<string, "rest" | "fortify">,
  westStance: Record<string, "rest" | "fortify">
): FactionEvent[] {
  const events: FactionEvent[] = [];
  const armyMap = new Map(armies.map((a) => [a.id, a]));

  const handleMoves = (faction: Faction, orders: MoveOrder[]) => {
    for (const o of orders) {
      const army = armyMap.get(o.armyId);
      const from = HOLDS_MAP.get(o.fromHoldId)?.name ?? o.fromHoldId;
      const to = HOLDS_MAP.get(o.toHoldId)?.name ?? o.toHoldId;
      const name = army?.name ?? o.armyId;
      events.push({
        id: eid("ev"),
        turn,
        faction,
        kind: "march",
        armyId: o.armyId,
        holdIds: [o.fromHoldId, o.toHoldId],
        summary: `${name} marched ${from} → ${to}`,
        detail: `On turn ${turn}, ${name} (${faction}) marched from ${from} to ${to}. Leaders: ${army?.leaders.map((l) => l.name).join(", ") ?? "unknown"}.`,
      });
    }
  };

  const handleStance = (
    faction: Faction,
    stance: Record<string, "rest" | "fortify">,
    movedIds: Set<string>
  ) => {
    for (const [armyId, order] of Object.entries(stance)) {
      if (movedIds.has(armyId)) continue;
      const army = armyMap.get(armyId);
      const hold = army ? HOLDS_MAP.get(army.holdId)?.name ?? army.holdId : "?";
      const name = army?.name ?? armyId;
      events.push({
        id: eid("ev"),
        turn,
        faction,
        kind: order,
        armyId,
        holdIds: army ? [army.holdId] : undefined,
        summary: `${name} ${order === "rest" ? "rested" : "fortified"} at ${hold}`,
        detail: `On turn ${turn}, ${name} (${faction}) issued ${order} at ${hold}.`,
      });
    }
  };

  const northMoved = new Set(northOrders.map((o) => o.armyId));
  const westMoved = new Set(westOrders.map((o) => o.armyId));
  handleMoves("north", northOrders);
  handleMoves("westerlands", westOrders);
  handleStance("north", northStance, northMoved);
  handleStance("westerlands", westStance, westMoved);
  return events;
}

export function eventsFromBattleReports(
  turn: number,
  reports: BattleReport[],
  state: GameState
): FactionEvent[] {
  const events: FactionEvent[] = [];
  for (const r of reports) {
    const hold = HOLDS_MAP.get(r.holdId)?.name ?? r.holdId;
    const battle = state.pendingBattles.find((b) => b.holdId === r.holdId);
    const northIds = battle?.northArmies.map((a) => a.id) ?? [];
    const westIds = battle?.westArmies.map((a) => a.id) ?? [];

    const mk = (faction: Faction, armyIds: string[]) => {
      const names = armyIds
        .map((id) => state.armies.find((a) => a.id === id)?.name ?? id)
        .join("; ");
      const fallen = (r.fallen ?? [])
        .filter((f) => armyIds.includes(f.armyId))
        .map((f) => f.name)
        .join(", ");
      events.push({
        id: eid("ev"),
        turn,
        faction,
        kind: "battle",
        holdIds: [r.holdId],
        armyId: armyIds[0],
        summary: `Battle at ${hold}: field to ${r.holdResult} (${r.defeatType ?? "unclear"})`,
        detail: `Turn ${turn} battle at ${hold}. Result: ${r.holdResult}. Defeat type: ${r.defeatType ?? "unclear"}. Your hosts engaged: ${names || "none"}.${fallen ? ` Fallen of note: ${fallen}.` : ""}\nNarrative:\n${r.narrative.slice(0, 1200)}`,
        relatedCharacterIds: Object.values(state.characters)
          .filter(
            (c) =>
              c.kind === "npc" &&
              c.faction === faction &&
              c.armyId &&
              armyIds.includes(c.armyId)
          )
          .map((c) => c.id),
      });
    };

    if (northIds.length) mk("north", northIds);
    if (westIds.length) mk("westerlands", westIds);
  }
  return events;
}

export function eventFromSpeech(
  turn: number,
  army: Army,
  speech: string,
  reaction: string
): FactionEvent {
  const hold = HOLDS_MAP.get(army.holdId)?.name ?? army.holdId;
  const lord = factionLordId(army.faction);
  return {
    id: eid("ev"),
    turn,
    faction: army.faction,
    kind: "speech",
    armyId: army.id,
    holdIds: [army.holdId],
    relatedCharacterIds: [lord],
    summary: `${army.name} heard a speech at ${hold}`,
    detail: `Turn ${turn}: Lord addressed ${army.name} at ${hold}.\nSpeech:\n${speech}\nHost reaction: ${reaction}`,
  };
}

/** Compare recent advice to marches — short lines for digest prompts. */
export function adviceVsActionHints(
  faction: Faction,
  turn: number,
  events: FactionEvent[],
  advice: AdviceRecord[],
  lordId: CharacterId
): string[] {
  const recentAdvice = advice.filter(
    (a) => a.toCharacterId === lordId && a.turn >= turn - 3
  );
  const marches = events.filter(
    (e) => e.faction === faction && e.kind === "march" && e.turn === turn
  );
  if (recentAdvice.length === 0 || marches.length === 0) return [];

  const hints: string[] = [];
  for (const a of recentAdvice) {
    const adviceLower = a.text.toLowerCase();
    for (const m of marches) {
      const marchLower = `${m.summary} ${m.detail}`.toLowerCase();
      // Soft heuristic: south/dorne/reach warnings vs southward place names
      const warnedSouth =
        /south|dorne|reach|neck|twins|riverrun|kingsroad/.test(adviceLower);
      const wentThatWay =
        /south|dorne|reach|twins|riverrun|harrenhal|king|bitterbridge|moat/.test(
          marchLower
        );
      if (warnedSouth && wentThatWay) {
        hints.push(
          `Advice on turn ${a.turn} ("${a.text.slice(0, 80)}") may conflict with: ${m.summary}`
        );
      }
    }
  }
  return hints.slice(0, 8);
}
