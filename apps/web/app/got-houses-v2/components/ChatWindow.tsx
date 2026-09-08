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
import type { SurrenderDecision } from "../lib/character-tools";
import { applySurrenderDecision } from "../lib/surrender";

interface Props {
  thread: ConversationThread;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  /** Fill the talk hub */
  fill?: boolean;
}

interface MessageStreamPayload {
  reply?: string;
  patches?: NpcRuntimePatch[];
  adviceRecords?: AdviceRecord[];
  surrender?: { holdId: string; decision: SurrenderDecision } | null;
  error?: string;
}

/**
 * Read the NDJSON reply stream.
 *
 * Frames are `delta` (words as spoken), `tool` (what they are checking), and a
 * closing `done` or `error`. A non-streaming body (an error page, say) is still
 * parsed as plain JSON so failures surface properly.
 */
async function readMessageStream(
  res: Response,
  hooks: { onDelta: (chunk: string) => void; onTool: (name: string) => void }
): Promise<MessageStreamPayload> {
  const reader = res.body?.getReader();
  if (!reader) {
    return (await res.json().catch(() => ({}))) as MessageStreamPayload;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let payload: MessageStreamPayload = {};

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
    if (frame.type === "delta" && typeof frame.text === "string") {
      hooks.onDelta(frame.text);
    } else if (frame.type === "tool" && typeof frame.name === "string") {
      hooks.onTool(frame.name);
    } else if (frame.type === "done" || frame.type === "error") {
      payload = frame as MessageStreamPayload;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      handleLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");
    }
  }
  handleLine(buffer);

  return payload;
}

/** Tool names read like code; this is what the player sees instead. */
function prettyToolName(name: string): string {
  const labels: Record<string, string> = {
    inspect_my_castle: "checking the walls",
    inspect_hold: "asking after a holding",
    survey_map: "studying the map",
    find_forces: "counting banners",
    search_faction_events: "recalling the campaign",
    search_advice: "recalling counsel",
    get_battle_logs: "recalling the battles",
    who_is: "placing a name",
    read_terms: "reading the terms",
    record_advice: "noting their counsel",
    write_notepad: "making a private note",
    append_notepad: "making a private note",
    read_notepad: "consulting their notes",
    get_recent_messages: "recalling what was said",
    get_thread_history: "recalling an older talk",
    list_past_threads: "recalling past talks",
    accept_terms: "weighing surrender",
    reject_terms: "weighing surrender",
    propose_terms: "drafting terms",
  };
  return labels[name] ?? "considering";
}

export default function ChatWindow({ thread, state, dispatch, fill }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [consulting, setConsulting] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lordId = activeLordId(state.activeFaction);
  const lord = state.characters[lordId];
  const isCouncil = thread.kind === "war_council";

  // Who the in-flight reply belongs to, for the streaming bubble's byline.
  const speakingNpcId =
    thread.kind === "war_council"
      ? null
      : thread.inviteTo === lordId
        ? thread.inviteFrom
        : thread.inviteTo;
  const speakingName = speakingNpcId
    ? state.characters[speakingNpcId]?.name ?? null
    : null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.messages.length, thread.id, streamingReply]);

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

    setSendError(null);
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
        );

        const res = await fetch("/api/got-houses-v2/converse/war-council", {
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
          }[];
          patches?: NpcRuntimePatch[];
          adviceRecords?: AdviceRecord[];
          error?: string;
        };

        if (!res.ok) {
          setSendError(data.error?.trim() || "War council failed.");
        } else {
          if (data.patches?.length) {
            dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
          }
          if (data.adviceRecords?.length) {
            dispatch({ type: "APPEND_ADVICE", records: data.adviceRecords });
          }

          const msgs = (data.replies ?? [])
            .filter((r) => r.text?.trim())
            .map((r) => makeMessage(r.characterId, r.name, r.text, "chat"));
          if (msgs.length) {
            dispatch({
              type: "APPEND_MESSAGES",
              threadId: thread.id,
              messages: msgs,
            });
          }
        }
      } else {
        const npcId =
          thread.inviteTo === lordId ? thread.inviteFrom : thread.inviteTo;
        if (!npcId || state.characters[npcId]?.kind !== "npc") {
          setSendError(
            "Negotiator is gone — the castellan may have been dismissed. Close and open Talk again."
          );
          setBusy(false);
          return;
        }

        const res = await fetch("/api/got-houses-v2/converse/message", {
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

        // The reply streams back as newline-delimited frames so the words show
        // up as they are said, and looking things up reads as looking things up
        // rather than as a stall.
        const data = await readMessageStream(res, {
          onDelta: (chunk) =>
            setStreamingReply((prev) => (prev ?? "") + chunk),
          onTool: (name) => setConsulting(prettyToolName(name)),
        });
        setStreamingReply(null);
        setConsulting(null);

        if (!res.ok || !data.reply?.trim()) {
          setSendError(data.error?.trim() || "Message failed — no reply.");
        } else {
          if (data.patches?.length) {
            dispatch({ type: "PATCH_CHARACTERS", patches: data.patches });
          }
          if (data.adviceRecords?.length) {
            dispatch({ type: "APPEND_ADVICE", records: data.adviceRecords });
          }

          dispatch({
            type: "APPEND_MESSAGES",
            threadId: thread.id,
            messages: [
              makeMessage(
                npcId,
                state.characters[npcId]?.name ?? npcId,
                data.reply,
                "chat"
              ),
            ],
          });

          // The castellan committed with a tool call, so the board moves too.
          if (data.surrender) {
            const note = applySurrenderDecision(
              dispatch,
              state,
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
        }
      }
    } catch (err) {
      console.error("Chat send failed", err);
      setSendError("Message failed — network or server error.");
    } finally {
      setStreamingReply(null);
      setConsulting(null);
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
          id !== lordId && state.characters[id]?.alive !== false
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
                  color: m.kind === "system" ? "#777" : "#e4e4e4",
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
        {streamingReply !== null && (
          <div
            style={{
              marginBottom: fill ? 14 : 8,
              maxWidth: isCouncil ? "92%" : "88%",
            }}
          >
            <div
              style={{
                color: "#666",
                fontSize: fill ? 10 : 9,
                marginBottom: 3,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {speakingName ?? "\u00a0"}
            </div>
            <div
              style={{
                color: "#e4e4e4",
                fontSize: fill ? 13 : 11,
                lineHeight: 1.45,
                background: "#141414",
                border: "1px solid #222",
                padding: fill ? "10px 12px" : "6px 8px",
              }}
            >
              {streamingReply}
              <span style={{ color: "#555" }}>▌</span>
            </div>
          </div>
        )}
        {busy && streamingReply === null && (
          <div style={{ color: "#555", fontSize: 11, marginTop: 8 }}>
            {consulting
              ? `They pause, ${consulting}…`
              : "They consider their words…"}
          </div>
        )}
        {sendError && (
          <div style={{ color: "#c05050", fontSize: 11, marginTop: 8 }}>
            {sendError}
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
