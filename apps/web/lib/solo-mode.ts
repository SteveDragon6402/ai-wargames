import type { Command, FactionId, GameState } from "@wargame/shared";

/** Faction that owns a command (for solo dual-faction order bucketing). */
export function commandFaction(
  state: GameState,
  command: Command
): FactionId | null {
  const unit = state.units[command.unitId];
  return unit?.factionId ?? null;
}

export function factionForOrderValidation(
  state: GameState,
  command: Command,
  playerFaction: FactionId
): FactionId {
  return commandFaction(state, command) ?? playerFaction;
}
