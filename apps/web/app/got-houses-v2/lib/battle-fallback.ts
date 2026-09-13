import type { BattleContext, BattleReport, Casualty, ForceSummary, Hold } from "../types";
import { describeForceRatio, fallbackOutcome } from "./battle-forces";
import { distributeProportional } from "./battle-validate";

/**
 * The one deterministic outcome used whenever the models cannot resolve a
 * battle — whether that failed on the server (no key, chronicler down, executor
 * never returned a usable call) or on the client (fetch or parse error).
 *
 * There used to be two different fallbacks: the server always awarded the field
 * to the North, and the client returned "abandoned" with zero casualties, which
 * the reducer then turned into both intact sides retreating from a battle that
 * had cost nobody anything. Both are replaced by this: a symmetric result driven
 * by the computed force ratio and each side's posture.
 */
export function buildFallbackReport(
  battle: BattleContext,
  holdsMap: Map<string, Hold>,
  summary: ForceSummary,
  reason: string
): Omit<BattleReport, "id" | "turn" | "holdId"> {
  const hold = holdsMap.get(battle.holdId);
  const { holdResult, lossShare } = fallbackOutcome(battle, summary);

  const casualties: Casualty[] = [];
  const holdBack = battle.armyCommitments ?? {};
  for (const army of [
    ...battle.northArmies,
    ...battle.westArmies,
    ...(battle.rogueArmies ?? []),
  ]) {
    let share = lossShare[army.faction] ?? 0.1;
    if (holdBack[army.id] === "hold_back") share *= 0.35;
    const total = Math.floor(army.units.reduce((s, u) => s + u.count, 0) * share);
    for (const [unit, n] of distributeProportional(army.units, total)) {
      if (n > 0) {
        casualties.push({
          faction: army.faction,
          armyId: army.id,
          unitType: unit.type,
          house: unit.house,
          count: n,
        });
      }
    }
  }

  const winnerLabel =
    holdResult === "north"
      ? "The Northern host"
      : holdResult === "westerlands"
        ? "The Western host"
        : "Neither host";
  const groundNote = hold?.ground
    ? ` The ground told against nobody in particular — ${hold.ground.split(";")[0].trim()}.`
    : "";

  const garrisonOnNorth = battle.northArmies.some((a) =>
    a.id.startsWith("garrison:")
  );
  const garrisonOnWest = battle.westArmies.some((a) =>
    a.id.startsWith("garrison:")
  );
  const stormHeld =
    (battle.engagement ?? "field") === "storm" &&
    !(
      (garrisonOnNorth && holdResult === "westerlands") ||
      (garrisonOnWest && holdResult === "north")
    );
  const retreatingArmyIds = stormHeld
    ? []
    : (
        holdResult === "north"
          ? battle.westArmies
          : holdResult === "westerlands"
            ? battle.northArmies
            : [...battle.northArmies, ...battle.westArmies]
      )
        .map((a) => a.id)
        .filter((id) => !id.startsWith("garrison:"));

  return {
    defeatType: battle.lastStand ? "last_stand" : "structured_withdrawal",
    narrative:
      `INITIAL DEPLOYMENT: The hosts met at ${hold?.name ?? "the contested hold"}.${groundNote}\n\n` +
      `PHASE 1 — CLASH: ${describeForceRatio(summary)}. The heavier side pressed and the lighter gave ground.\n\n` +
      `RESOLUTION: ${winnerLabel} held the field. No detailed account of this engagement survives — the adjudicator was unreachable, so the outcome was settled on numbers and posture alone.`,
    shortSummary:
      `${winnerLabel} held the field at ${hold?.name ?? battle.holdId}.\n` +
      "The account is thin — this battle was settled on numbers, not on witness.\n" +
      "Both sides counted their dead and moved on.",
    holdResult,
    casualties,
    fallen: [],
    retreatingArmyIds,
    conditionUpdates: [],
    fallbackReason: reason,
  };
}
