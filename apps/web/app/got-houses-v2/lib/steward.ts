import {
  factionLordId,
  stewardIdFor,
  stewardThreadIdFor,
} from "../data/characters";
import type {
  CharacterState,
  ConversationThread,
  Faction,
  GameState,
  NpcAgentState,
} from "../types";

export const STEWARD_ALLOWED_TOOLS = [
  "find_forces",
  "inspect_hold",
  "survey_map",
  "turns_to",
  "search_faction_events",
  "get_battle_logs",
  "march_history",
  "who_is",
  "search_deeds",
  "search_audiences",
  "prisoners_held",
  "read_notepad",
  "write_notepad",
  "append_notepad",
  "update_mood",
  "explain_rules",
  "inspect_orders",
] as const;

export function emptyStewardUnread(): Record<Faction, boolean> {
  return { north: false, westerlands: false };
}

export function emptyStewardBriefedTurn(): Record<Faction, number | null> {
  return { north: null, westerlands: null };
}

export function isStewardCharacter(c: CharacterState | undefined): c is NpcAgentState {
  return !!c && c.kind === "npc" && c.role === "steward";
}

export function isStewardThread(thread: ConversationThread | undefined): boolean {
  return thread?.kind === "steward";
}

export function emptyStewardThread(
  faction: Faction,
  turn: number
): ConversationThread {
  const stewardId = stewardIdFor(faction);
  const lordId = factionLordId(faction);
  return {
    id: stewardThreadIdFor(faction),
    kind: "steward",
    faction,
    participantIds: [lordId, stewardId],
    leftParticipantIds: [],
    status: "active",
    messages: [],
    inviteFrom: lordId,
    inviteTo: stewardId,
    createdTurn: turn,
  };
}

export function findStewardThread(
  state: Pick<GameState, "conversations">,
  faction: Faction
): ConversationThread | undefined {
  const id = stewardThreadIdFor(faction);
  return state.conversations.find((t) => t.id === id && t.kind === "steward");
}

export function ensureStewardThread(
  conversations: ConversationThread[],
  faction: Faction,
  turn: number
): { thread: ConversationThread; conversations: ConversationThread[] } {
  const existing = conversations.find(
    (t) => t.id === stewardThreadIdFor(faction) && t.kind === "steward"
  );
  if (existing) return { thread: existing, conversations };
  const thread = emptyStewardThread(faction, turn);
  return { thread, conversations: [...conversations, thread] };
}

export {
  stewardIdFor,
  stewardThreadIdFor,
};
