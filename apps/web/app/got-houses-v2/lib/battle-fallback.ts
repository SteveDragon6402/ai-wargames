import type { BattleContext, BattleReport, Casualty, ForceSummary, Hold } from "../types";
import { describeForceRatio, fallbackOutcome } from "./battle-forces";
import { distributeProportional, inferPrisonersTaken } from "./battle-validate";

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
  const isStorm = (battle.engagement ?? "field") === "storm";

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

  const prisonersTaken = inferPrisonersTaken(
    battle,
    casualties,
    holdResult,
    battle.lastStand
      ? "last_stand"
      : isStorm && !stormHeld
        ? "pyrrhic_win"
        : "structured_withdrawal"
  );

  const seat = hold?.name ?? battle.holdId;
  const stormNarrative = stormHeld
    ? `INITIAL DEPLOYMENT: The investing host stormed the walls of ${seat}.${groundNote}\n\n` +
      `PHASE 1 — ASSAULT: ${describeForceRatio(summary)}. Ladders and ram went in; the garrison held the gate.\n\n` +
      `RESOLUTION: The assault was thrown back. ${winnerLabel} still holds ${seat}. The attackers fell back to their siege camp. No detailed account survives — the adjudicator was unreachable.`
    : isStorm
      ? `INITIAL DEPLOYMENT: The investing host stormed the walls of ${seat}.${groundNote}\n\n` +
        `PHASE 1 — ASSAULT: ${describeForceRatio(summary)}. The attackers pressed the gate until it gave.\n\n` +
        `RESOLUTION: The gates were forced. ${winnerLabel} took ${seat} at a bloody price. No detailed account survives — the adjudicator was unreachable.`
      : `INITIAL DEPLOYMENT: The hosts met at ${seat}.${groundNote}\n\n` +
        `PHASE 1 — CLASH: ${describeForceRatio(summary)}. The heavier side pressed and the lighter gave ground.\n\n` +
        `RESOLUTION: ${winnerLabel} held the field. No detailed account of this engagement survives — the adjudicator was unreachable, so the outcome was settled on numbers and posture alone.`;

  return {
    defeatType: battle.lastStand
      ? "last_stand"
      : isStorm && !stormHeld
        ? "pyrrhic_win"
        : "structured_withdrawal",
    narrative: stormNarrative,
    shortSummary: isStorm
      ? stormHeld
        ? `${winnerLabel} threw the storm back at ${seat}.\nThe account is thin — settled on numbers, not witness.\nThe attackers remain camped.`
        : `${winnerLabel} forced the gates at ${seat}.\nThe account is thin — settled on numbers, not witness.\nThe assault cost both sides dearly.`
      : `${winnerLabel} held the field at ${seat}.\nThe account is thin — this battle was settled on numbers, not on witness.\nBoth sides counted their dead and moved on.`,
    holdResult,
    casualties,
    fallen: [],
    captured: [],
    prisonersTaken,
    retreatingArmyIds,
    conditionUpdates: [],
    fallbackReason: reason,
  };
}
