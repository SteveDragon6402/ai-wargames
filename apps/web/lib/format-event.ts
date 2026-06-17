import type { TurnEvent } from "@wargame/shared";

export function formatEvent(e: TurnEvent): string | null {
  switch (e.type) {
    case "node_battle": {
      const winnerFaction =
        e.overallWinner === "side1"
          ? e.side1FactionId
          : e.overallWinner === "side2"
            ? e.side2FactionId
            : null;
      const prefix = winnerFaction
        ? `${winnerFaction} prevails at ${e.nodeId}`
        : `Draw at ${e.nodeId}`;
      return `${prefix} — ${e.narrative}`;
    }
    case "battle_result":
      return `Battle: ${e.outcome} (${e.attackerId} vs ${e.defenderId})`;
    case "combat":
      return `Combat at ${e.nodeId}: ${e.winner}`;
    case "victory":
      return `${e.factionId} wins!`;
    case "capital_shift":
      return `Capital moved to ${e.to}`;
    case "rout":
      return `Rout: ${e.unitId}`;
    case "deny_blocked":
      return `Deny blocked entry at ${e.nodeId}`;
    case "disengage":
      return `Disengaged at ${e.nodeId}`;
    case "intention_achieved":
      return `Intention achieved: ${e.intention}`;
    case "dig_in":
      return `${e.unitId} dug in`;
  }
  return null;
}
