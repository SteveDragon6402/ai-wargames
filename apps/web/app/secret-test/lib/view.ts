import type { FactionId, PlayerViewGame, SecretTestState } from "../types";
import { isFactionId } from "../types";

export function toPlayerView(state: SecretTestState, faction: string): PlayerViewGame | null {
  if (!isFactionId(faction)) return null;
  const mine: FactionId = faction;
  const other: FactionId = mine === "lancaster" ? "york" : "lancaster";

  return {
    turn: state.turn,
    phase: state.phase,
    myFaction: mine,
    briefing: state.briefings[mine] ?? "",
    myPendingAction: state.pendingActions[mine] ?? null,
    opponentSubmitted: Boolean(state.pendingActions[other]?.trim()),
    chronicle: state.history.map((entry) => ({
      turn: entry.turn,
      briefing: entry.briefings[mine] ?? "",
      action: entry.actions[mine] ?? "",
    })),
    winner: state.winner ?? null,
  };
}
