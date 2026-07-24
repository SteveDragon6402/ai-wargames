"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AdviceRecord,
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
  /** Fill the talk hub */
  fill?: boolean;
}

export default function ChatWindow({ thread, state, dispatch, fill }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lordId = activeLordId(state.activeFaction);
  const lord = state.characters[lordId];
  const isCouncil = thread.kind === "war_council";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.messages.length, thread.id]);

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
            ...snapshotForApi(state),
            thread: liveThread,
            responderIds: responders,
            playerMessage: trimmed,
            playerName: lord?.name ?? "Lord",
            turn: state.turn,
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
          adviceRecords?: AdviceRecord[];
        };

        if (data.patches?.length) {
          dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
        }
        if (data.adviceRecords?.length) {
          dispatch({ type: "APPEND_ADVICE", records: data.adviceRecords });
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
          setBusy(false);
          return;
        }

        const res = await fetch("/api/got-houses/converse/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...snapshotForApi(state),
            thread: liveThread,
            npcCharacterId: npcId,
            playerMessage: trimmed,
            turn: state.turn,
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          patches?: NpcRuntimePatch[];
          left?: boolean;
          leaveReason?: string;
          adviceRecords?: AdviceRecord[];
        };

        if (data.patches?.length) {
          dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
        }
        if (data.adviceRecords?.length) {
          dispatch({ type: "APPEND_ADVICE", records: data.adviceRecords });
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

  const title = isCouncil
    ? "War council"
    : thread.participantIds
        .filter((id) => id !== lordId)
        .map((id) => state.characters[id]?.name ?? id)
        .join(" · ") || "Conversation";

  const councilPresent = isCouncil
    ? thread.participantIds.filter(
        (id) =>
          id !== lordId &&
          !thread.leftParticipantIds.includes(id) &&
          state.characters[id]?.alive !== false
      )
    : [];

  return (
    <div
      style={{
        flex: fill ? 1 : undefined,
        width: fill ? "100%" : 280,
        minHeight: 0,
        height: fill ? "100%" : 340,
        background: "#0c0c0c",
        border: fill ? "none" : "1px solid #2a2a2a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        style={{
          padding: fill ? "14px 16px" : "8px 10px",
          borderBottom: "1px solid #222",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                color: isCouncil ? "#c8941a" : "#9a9a6a",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontSize: fill ? 11 : 9,
                fontWeight: 700,
              }}
            >
              {title}
              {thread.status === "closed" ? " · closed" : ""}
              {thread.status === "pending_invite" ? " · invitation" : ""}
            </div>
            {isCouncil && councilPresent.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {councilPresent.map((id) => (
                  <span
                    key={id}
                    style={{
                      fontSize: 10,
                      color: "#8a9a8a",
                      border: "1px solid #2a332a",
                      padding: "3px 8px",
                      background: "#121612",
                    }}
                  >
                    {state.characters[id]?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "CLOSE_CONVERSATION_DOCK", threadId: thread.id })
            }
            style={{
              background: "transparent",
              border: "1px solid #333",
              color: "#777",
              cursor: "pointer",
              fontSize: 10,
              padding: "4px 8px",
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: fill ? "16px 18px" : 10,
          minHeight: 0,
        }}
      >
        {thread.messages.map((m) => {
          if (m.kind === "turn_break") {
            return (
              <div
                key={m.id}
                style={{
                  margin: fill ? "18px 0" : "12px 0",
                  textAlign: "center",
                  color: "#555",
                  fontSize: fill ? 10 : 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  borderTop: "1px solid #222",
                  borderBottom: "1px solid #222",
                  padding: "8px 0",
                }}
              >
                {m.text}
              </div>
            );
          }
          const mine = m.speakerId === lordId;
          return (
            <div
              key={m.id}
              style={{
                marginBottom: fill ? 14 : 8,
                maxWidth: isCouncil ? "92%" : "88%",
                marginLeft: mine ? "auto" : 0,
              }}
            >
              <div
                style={{
                  color: mine ? "#6a8aaa" : "#666",
                  fontSize: fill ? 10 : 9,
                  marginBottom: 3,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textAlign: mine ? "right" : "left",
                }}
              >
                {m.speakerName}
              </div>
              <div
                style={{
                  color:
                    m.kind === "leave"
                      ? "#a66"
                      : m.kind === "system"
                        ? "#777"
                        : "#e4e4e4",
                  fontSize: fill ? 13 : 11,
                  lineHeight: 1.45,
                  background: mine ? "#121820" : "#141414",
                  border: `1px solid ${mine ? "#1e2a38" : "#222"}`,
                  padding: fill ? "10px 12px" : "6px 8px",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {thread.closedReason && (
          <div style={{ color: "#744", fontSize: 11, marginTop: 8 }}>
            {thread.closedReason}
          </div>
        )}
        {busy && (
          <div style={{ color: "#555", fontSize: 11, marginTop: 8 }}>
            They consider their words…
          </div>
        )}
      </div>

      {pendingForMe ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: fill ? 14 : 8,
            borderTop: "1px solid #222",
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={acceptInvite} style={actionBtn(true)}>
            Accept
          </button>
          <button type="button" onClick={declineInvite} style={actionBtn(false)}>
            Decline
          </button>
        </div>
      ) : thread.status === "active" ? (
        <div
          style={{
            borderTop: "1px solid #222",
            padding: fill ? 14 : 8,
            flexShrink: 0,
            background: "#0a0a0a",
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={fill ? 3 : 2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              isCouncil
                ? `Address the council (≤${PLAYER_CHAT_MAX_WORDS} words)`
                : `Your words (≤${PLAYER_CHAT_MAX_WORDS})`
            }
            style={{
              width: "100%",
              background: "#141414",
              border: "1px solid #2a2a2a",
              color: "#ddd",
              resize: "none",
              fontFamily: "inherit",
              fontSize: fill ? 13 : 11,
              lineHeight: 1.4,
              padding: fill ? 10 : 6,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              color: "#555",
              fontSize: 10,
            }}
          >
            <span>
              {countWords(text)}/{PLAYER_CHAT_MAX_WORDS}
              {fill ? " · Enter to send" : ""}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={send}
              style={actionBtn(true)}
            >
              {busy ? "…" : isCouncil ? "Speak" : "Send"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function actionBtn(accent: boolean): React.CSSProperties {
  return {
    background: accent ? "#1a1810" : "#1a1a1a",
    border: `1px solid ${accent ? "#3a2a00" : "#333"}`,
    color: accent ? "#c8941a" : "#aaa",
    fontSize: 11,
    padding: "8px 14px",
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  };
}
