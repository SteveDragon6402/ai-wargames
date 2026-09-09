import type {
  AdviceRecord,
  CharacterId,
  CharacterState,
  ChatMessage,
  ConversationThread,
  Faction,
  GameAction,
  GameState,
  HoldRuntime,
  NpcRuntimePatch,
} from "../types";
import {
  enemyLordId,
  factionLordId,
  warCouncilNpcIds,
} from "../data/characters";
import { ensureGarrisonNegotiator } from "./castellan";
import {
  applySurrenderDecision,
  describeTerms,
  openTermsAt,
} from "./surrender";
import type { SurrenderDecision } from "./character-tools";

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
  /** Set for a parley so the thread remembers which walls it is about. */
  holdId?: string | null;
};

export type DirectTalkResult = {
  error: string | null;
  thread: ConversationThread | null;
};

export function findActiveParleyThread(
  state: GameState,
  holdId: string,
  negotiatorId: CharacterId
): ConversationThread | undefined {
  return state.conversations.find(
    (t) =>
      t.holdId === holdId &&
      t.status === "active" &&
      t.participantIds.includes(negotiatorId)
  );
}

/** Ensure a castellan exists and open (or resume) parley at that seat. */
export async function openParleyAtHold(
  state: GameState,
  dispatch: (a: GameAction) => void,
  holdId: string
): Promise<DirectTalkResult> {
  const ensured = ensureGarrisonNegotiator(
    holdId,
    state.holdStates ?? {},
    state.characters
  );
  if (!ensured) {
    return { error: "No negotiator available at this seat.", thread: null };
  }
  dispatch({
    type: "APPLY_NEGOTIATOR_ENSURE",
    characters: ensured.characters,
    holdStates: ensured.holdStates,
  });
  const existing = findActiveParleyThread(
    { ...state, characters: ensured.characters, holdStates: ensured.holdStates },
    holdId,
    ensured.negotiatorId
  );
  if (existing) {
    dispatch({ type: "OPEN_CONVERSATION", threadId: existing.id });
    return { error: null, thread: existing };
  }
  return startDirectNpcTalk(state, dispatch, ensured.negotiatorId, {
    characters: ensured.characters,
    holdStates: ensured.holdStates,
    holdId,
  });
}

async function readLastNdjsonFrame(
  res: Response
): Promise<{
  reply?: string;
  patches?: NpcRuntimePatch[];
  adviceRecords?: AdviceRecord[];
  surrender?: { holdId: string; decision: SurrenderDecision } | null;
  error?: string;
}> {
  const text = await res.text();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const frame = JSON.parse(lines[i]) as {
        type?: string;
        reply?: string;
        patches?: NpcRuntimePatch[];
        adviceRecords?: AdviceRecord[];
        surrender?: { holdId: string; decision: SurrenderDecision } | null;
        error?: string;
      };
      if (frame.type === "done" || frame.type === "error" || frame.reply || frame.error) {
        return frame;
      }
    } catch {
      // keep scanning
    }
  }
  try {
    return JSON.parse(text) as {
      reply?: string;
      error?: string;
    };
  } catch {
    return { error: "No reply." };
  }
}

/** Ask the castellan to answer terms already on the table. */
export async function promptCastellanAboutTerms(opts: {
  state: GameState;
  dispatch: (a: GameAction) => void;
  thread: ConversationThread;
  holdId: string;
  holdStates: Record<string, HoldRuntime>;
  characters?: Record<CharacterId, CharacterState>;
  playerMessage: string;
}): Promise<string | null> {
  const { state, dispatch, thread, holdId, holdStates, playerMessage } = opts;
  const characters = opts.characters ?? state.characters;
  const lordId = factionLordId(state.activeFaction);
  const npcId = thread.inviteTo === lordId ? thread.inviteFrom : thread.inviteTo;
  if (!npcId || characters[npcId]?.kind !== "npc") {
    return "No negotiator at these walls.";
  }

  const playerMsg = makeMessage(
    lordId,
    characters[lordId]?.name ?? "Lord",
    playerMessage,
    "chat"
  );
  dispatch({
    type: "APPEND_MESSAGES",
    threadId: thread.id,
    messages: [playerMsg],
  });

  const liveThread: ConversationThread = {
    ...thread,
    messages: [...thread.messages, playerMsg],
  };
  const terms = openTermsAt(holdStates[holdId]);
  if (terms) {
    dispatch({
      type: "APPEND_MESSAGES",
      threadId: thread.id,
      messages: [
        makeMessage(
          "system",
          "Terms",
          `Terms put to the gate: "${terms.note}" — under them, ${describeTerms(terms)}.`,
          "system"
        ),
      ],
    });
  }

  try {
    const res = await fetch("/api/got-houses-v2/converse/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...snapshotForApi({ ...state, characters, holdStates }),
        thread: liveThread,
        npcCharacterId: npcId,
        playerMessage,
        turn: state.turn,
      }),
    });
    const data = await readLastNdjsonFrame(res);
    if (!res.ok || !data.reply?.trim()) {
      return data.error?.trim() || "The castellan gave no answer.";
    }
    if (data.patches?.length) {
      dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
    }
    dispatch({
      type: "APPEND_MESSAGES",
      threadId: thread.id,
      messages: [
        makeMessage(npcId, characters[npcId]?.name ?? npcId, data.reply, "chat"),
      ],
    });
    if (data.surrender) {
      const note = applySurrenderDecision(
        dispatch,
        { ...state, holdStates, characters },
        data.surrender.holdId,
        data.surrender.decision
      );
      if (note) {
        dispatch({
          type: "APPEND_MESSAGES",
          threadId: thread.id,
          messages: [makeMessage(npcId, "Terms", note, "system")],
        });
      }
    }
    return null;
  } catch (err) {
    console.error("Parley prompt failed", err);
    return "The call never reached the walls.";
  }
}

/** Open (or resume) a direct talk with an NPC — always accepts. */
export async function startDirectNpcTalk(
  state: GameState,
  dispatch: (a: GameAction) => void,
  toId: CharacterId,
  overrides?: TalkOverrides
): Promise<DirectTalkResult> {
  const characters = overrides?.characters ?? state.characters;
  const holdStates = overrides?.holdStates ?? state.holdStates;
  const myLord = factionLordId(state.activeFaction);
  const thread = buildDirectInviteThread(
    myLord,
    toId,
    state.turn,
    characters,
    overrides?.holdId ?? null
  );
  dispatch({ type: "UPSERT_CONVERSATION", thread });

  const snap = {
    ...snapshotForApi(state),
    characters,
    holdStates,
  };
  try {
    const res = await fetch("/api/got-houses-v2/converse/invite", {
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
      // Leaving the thread on pending_invite stranded it forever: it never
      // opened, could not be closed from the UI, and kept its participants
      // pinned alive by the talk-protection pass.
      dispatch({
        type: "UPSERT_CONVERSATION",
        thread: {
          ...thread,
          status: "closed",
          closedReason: "They never answered the call.",
        },
      });
      return {
        error: data.error?.trim() || "Invite failed — no reply from the negotiator.",
        thread: null,
      };
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
    return { error: null, thread: active };
  } catch (err) {
    console.error("Invite failed", err);
    dispatch({
      type: "UPSERT_CONVERSATION",
      thread: {
        ...thread,
        status: "closed",
        closedReason: "The call never reached them.",
      },
    });
    return { error: "Invite failed — network or server error.", thread: null };
  }
}

export function activeLordId(faction: Faction): CharacterId {
  return factionLordId(faction);
}

export function buildDirectInviteThread(
  fromId: CharacterId,
  toId: CharacterId,
  turn: number,
  characters: Record<CharacterId, CharacterState>,
  holdId: string | null = null
): ConversationThread {
  const from = characters[fromId];
  return {
    id: newId("thread"),
    holdId,
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
