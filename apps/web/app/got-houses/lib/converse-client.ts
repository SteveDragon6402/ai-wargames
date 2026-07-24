import type {
  CharacterId,
  CharacterState,
  ChatMessage,
  ConversationThread,
  Faction,
  GameState,
} from "../types";
import {
  enemyLordId,
  factionLordId,
  warCouncilNpcIds,
} from "../data/characters";

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeMessage(
  speakerId: CharacterId,
  speakerName: string,
  text: string,
  kind: ChatMessage["kind"] = "chat"
): ChatMessage {
  return {
    id: newId("msg"),
    speakerId,
    speakerName,
    text,
    at: Date.now(),
    kind,
  };
}

export function snapshotForApi(state: GameState) {
  return {
    characters: state.characters,
    armies: state.armies,
    battleReports: state.battleReports,
    conversations: state.conversations,
    turn: state.turn,
    factionEvents: state.factionEvents,
    adviceLog: state.adviceLog,
  };
}

export function activeLordId(faction: Faction): CharacterId {
  return factionLordId(faction);
}

export function buildDirectInviteThread(
  fromId: CharacterId,
  toId: CharacterId,
  turn: number,
  characters: Record<CharacterId, CharacterState>
): ConversationThread {
  const from = characters[fromId];
  return {
    id: newId("thread"),
    kind: "direct",
    participantIds: [fromId, toId],
    leftParticipantIds: [],
    status: "pending_invite",
    messages: [
      makeMessage(
        fromId,
        from?.name ?? fromId,
        `Requests a word with ${characters[toId]?.name ?? toId}.`,
        "invite"
      ),
    ],
    inviteFrom: fromId,
    inviteTo: toId,
    createdTurn: turn,
  };
}

export function buildWarCouncilThread(
  faction: Faction,
  turn: number,
  characters: Record<CharacterId, CharacterState>
): ConversationThread {
  const lord = factionLordId(faction);
  const npcs = warCouncilNpcIds(characters, faction);
  return {
    id: newId("council"),
    kind: "war_council",
    faction,
    participantIds: [lord, ...npcs],
    leftParticipantIds: [],
    status: "active",
    messages: [
      makeMessage(lord, characters[lord]?.name ?? "Lord", "War council is assembled.", "system"),
    ],
    inviteFrom: lord,
    inviteTo: null,
    createdTurn: turn,
  };
}

export function pendingInvitesForFaction(
  state: GameState,
  faction: Faction
): ConversationThread[] {
  const lord = factionLordId(faction);
  return state.conversations.filter(
    (t) =>
      t.kind === "direct" &&
      t.status === "pending_invite" &&
      t.inviteTo === lord
  );
}

export { enemyLordId, factionLordId, warCouncilNpcIds };
