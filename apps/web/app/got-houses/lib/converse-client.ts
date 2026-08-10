import type {
  CharacterId,
  CharacterState,
  ChatMessage,
  ConversationThread,
  Faction,
  GameState,
  HoldRuntime,
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
    holdStates: state.holdStates,
  };
}

export type TalkOverrides = {
  characters?: Record<CharacterId, CharacterState>;
  holdStates?: Record<string, HoldRuntime>;
};

/** Open (or resume) a direct talk with an NPC — always accepts. Returns error text or null. */
export async function startDirectNpcTalk(
  state: GameState,
  dispatch: (a: import("../types").GameAction) => void,
  toId: CharacterId,
  overrides?: TalkOverrides
): Promise<string | null> {
  const characters = overrides?.characters ?? state.characters;
  const holdStates = overrides?.holdStates ?? state.holdStates;
  const myLord = factionLordId(state.activeFaction);
  const thread = buildDirectInviteThread(
    myLord,
    toId,
    state.turn,
    characters
  );
  dispatch({ type: "UPSERT_CONVERSATION", thread });

  const snap = {
    ...snapshotForApi(state),
    characters,
    holdStates,
  };
  try {
    const res = await fetch("/api/got-houses/converse/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...snap,
        fromCharacterId: myLord,
        toCharacterId: toId,
        turn: state.turn,
      }),
    });
    const data = (await res.json()) as {
      reason?: string;
      patches?: import("../types").NpcRuntimePatch[];
      error?: string;
    };

    if (!res.ok || !data.reason?.trim()) {
      const err = data.error?.trim() || "Invite failed — no reply from the negotiator.";
      return err;
    }

    if (data.patches?.length) {
      dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
    }

    const active = {
      ...thread,
      status: "active" as const,
      messages: [
        ...thread.messages,
        {
          id: `msg-${Date.now()}`,
          speakerId: toId,
          speakerName: characters[toId]?.name ?? toId,
          text: data.reason,
          at: Date.now(),
          kind: "chat" as const,
        },
      ],
    };
    dispatch({ type: "UPSERT_CONVERSATION", thread: active });
    dispatch({ type: "OPEN_CONVERSATION", threadId: active.id });
    return null;
  } catch (err) {
    console.error("Invite failed", err);
    return "Invite failed — network or server error.";
  }
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
