import { SEAT_BY_ID } from "../data/valden";
import type { FactionId, PlayerViewGame, SecretTestState } from "../types";
import { isFactionId, rivalFaction } from "../types";
import { pendingText } from "./state";

export function toPlayerView(state: SecretTestState, faction: string): PlayerViewGame | null {
  if (!isFactionId(faction)) return null;
  const mine: FactionId = faction;
  const other = rivalFaction(mine);
  const pending = state.pendingActions[mine];

  return {
    month: state.month,
    phase: state.phase,
    myFaction: mine,
    briefing: state.briefings[mine] ?? "",
    cash: state.cash[mine] ?? 0,
    opponentRumor: state.opponentRumors[mine] ?? "",
    issues: state.issues,
    recommendations: state.recommendations[mine] ?? [],
    map: state.seats.map((s) => {
      const def = SEAT_BY_ID[s.id];
      return {
        id: s.id,
        name: def?.name ?? s.id,
        stateId: def?.stateId ?? "havnland",
        lean: s.lean,
        turnout: s.turnout,
        summary: def?.demographics.summary ?? "",
      };
    }),
    myPendingAction: pendingText(pending) || null,
    myPendingDebate: pending?.debateAnswers ?? null,
    opponentSubmitted: Boolean(pendingText(state.pendingActions[other])),
    debateQuestions: state.debateQuestions,
    chronicle: state.history.map((entry) => ({
      month: entry.month,
      briefing: entry.briefings[mine] ?? "",
      action: entry.actions[mine] ?? "",
      note: entry.translations[mine]?.playerNote ?? "",
    })),
    winner: state.winner ?? null,
  };
}
