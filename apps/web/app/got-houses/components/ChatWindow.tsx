"use client";

import { useState } from "react";
import type {
  ConversationThread,
  GameAction,
  GameState,
  NpcRuntimePatch,
} from "../types";
import {
  activeLordId,
  makeMessage,
  snapshotForApi,
  warCouncilNpcIds,
} from "../lib/converse-client";
import { countWords, PLAYER_CHAT_MAX_WORDS } from "../data/characters";

interface Props {
  thread: ConversationThread;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export default function ChatWindow({ thread, state, dispatch }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lordId = activeLordId(state.activeFaction);
  const lord = state.characters[lordId];

  async function acceptInvite() {
    const active = {
      ...thread,
      status: "active" as const,
      messages: [
        ...thread.messages,
        makeMessage(lordId, lord?.name ?? "Lord", "I accept.", "system"),
      ],
    };
    dispatch({ type: "UPSERT_CONVERSATION", thread: active });
    dispatch({ type: "OPEN_CONVERSATION", threadId: active.id });
  }

  function declineInvite() {
    dispatch({
      type: "UPSERT_CONVERSATION",
      thread: {
        ...thread,
        status: "closed",
        closedReason: "Declined by player",
        messages: [
          ...thread.messages,
          makeMessage(lordId, lord?.name ?? "Lord", "I decline.", "system"),
        ],
      },
    });
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (countWords(trimmed) > PLAYER_CHAT_MAX_WORDS) {
      alert(`Keep it under ${PLAYER_CHAT_MAX_WORDS} words.`);
      return;
    }

    const playerMsg = makeMessage(lordId, lord?.name ?? "Lord", trimmed, "chat");
    dispatch({
      type: "APPEND_MESSAGES",
      threadId: thread.id,
      messages: [playerMsg],
    });
    setText("");
    setBusy(true);

    const liveThread: ConversationThread = {
      ...thread,
      messages: [...thread.messages, playerMsg],
    };

    try {
      if (thread.kind === "war_council") {
        const responders = warCouncilNpcIds(
          state.characters,
          state.activeFaction
        ).filter((id) => !liveThread.leftParticipantIds.includes(id));

        const res = await fetch("/api/got-houses/converse/war-council", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thread: liveThread,
            responderIds: responders,
            playerMessage: trimmed,
            playerName: lord?.name ?? "Lord",
            ...snapshotForApi(state),
          }),
        });
        const data = (await res.json()) as {
          replies?: {
            characterId: string;
            name: string;
            text: string;
            left: boolean;
            leaveReason?: string;
          }[];
          patches?: NpcRuntimePatch[];
        };

        if (data.patches?.length) {
          dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
        }

        const msgs = (data.replies ?? []).map((r) =>
          makeMessage(r.characterId, r.name, r.text, r.left ? "leave" : "chat")
        );
        if (msgs.length) {
          dispatch({
            type: "APPEND_MESSAGES",
            threadId: thread.id,
            messages: msgs,
          });
        }

        const leftIds = (data.replies ?? [])
          .filter((r) => r.left)
          .map((r) => r.characterId);
        if (leftIds.length) {
          dispatch({
            type: "UPSERT_CONVERSATION",
            thread: {
              ...liveThread,
              messages: [...liveThread.messages, ...msgs],
              leftParticipantIds: [
                ...new Set([...liveThread.leftParticipantIds, ...leftIds]),
              ],
            },
          });
        }
      } else {
        const npcId =
          thread.inviteTo === lordId ? thread.inviteFrom : thread.inviteTo;
        if (!npcId || state.characters[npcId]?.kind !== "npc") {
          // Player-to-player: other side sees messages via shared state
          setBusy(false);
          return;
        }

        const res = await fetch("/api/got-houses/converse/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thread: liveThread,
            npcCharacterId: npcId,
            playerMessage: trimmed,
            ...snapshotForApi(state),
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          patches?: NpcRuntimePatch[];
          left?: boolean;
          leaveReason?: string;
        };

        if (data.patches?.length) {
          dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
        }

        const replyMsg = makeMessage(
          npcId,
          state.characters[npcId]?.name ?? npcId,
          data.reply ?? "…",
          data.left ? "leave" : "chat"
        );
        dispatch({
          type: "APPEND_MESSAGES",
          threadId: thread.id,
          messages: [replyMsg],
        });

        if (data.left) {
          dispatch({
            type: "UPSERT_CONVERSATION",
            thread: {
              ...liveThread,
              messages: [...liveThread.messages, replyMsg],
              status: "closed",
              closedReason: data.leaveReason ?? "Left the conversation",
              leftParticipantIds: [...liveThread.leftParticipantIds, npcId],
            },
          });
        }
      }
    } catch (err) {
      console.error("Chat send failed", err);
    } finally {
      setBusy(false);
    }
  }

  const pendingForMe =
    thread.status === "pending_invite" && thread.inviteTo === lordId;

  return (
    <div
      style={{
        width: 280,
        height: 340,
        background: "#0c0c0c",
        border: "1px solid #2a2a2a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid #222",
          display: "flex",
          justifyContent: "space-between",
          color: "#9a9a6a",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: 9,
        }}
      >
        <span>
          {thread.kind === "war_council"
            ? "War council"
            : thread.participantIds
                .map((id) => state.characters[id]?.name ?? id)
                .join(" · ")}
          {thread.status === "closed" ? " (closed)" : ""}
        </span>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "CLOSE_CONVERSATION_DOCK", threadId: thread.id })
          }
          style={{
            background: "transparent",
            border: "none",
            color: "#666",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
        {thread.messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <div style={{ color: "#666", fontSize: 9 }}>{m.speakerName}</div>
            <div
              style={{
                color: m.kind === "leave" ? "#a66" : m.kind === "system" ? "#888" : "#ddd",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thread.closedReason && (
          <div style={{ color: "#744", fontSize: 10 }}>{thread.closedReason}</div>
        )}
      </div>

      {pendingForMe ? (
        <div style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid #222" }}>
          <button type="button" onClick={acceptInvite} style={actionBtn}>
            Accept
          </button>
          <button type="button" onClick={declineInvite} style={actionBtn}>
            Decline
          </button>
        </div>
      ) : thread.status === "active" ? (
        <div style={{ borderTop: "1px solid #222", padding: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={`Your words (≤${PLAYER_CHAT_MAX_WORDS})`}
            style={{
              width: "100%",
              background: "#141414",
              border: "1px solid #2a2a2a",
              color: "#ddd",
              resize: "none",
              fontFamily: "inherit",
              fontSize: 11,
              padding: 6,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              color: "#555",
              fontSize: 9,
            }}
          >
            <span>
              {countWords(text)}/{PLAYER_CHAT_MAX_WORDS}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={send}
              style={actionBtn}
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  color: "#aaa",
  fontSize: 10,
  padding: "4px 8px",
  cursor: "pointer",
  fontFamily: "inherit",
};
