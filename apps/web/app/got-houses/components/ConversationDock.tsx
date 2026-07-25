"use client";

import type { ConversationThread, GameAction, GameState } from "../types";
import CharacterPicker from "./CharacterPicker";
import ChatWindow from "./ChatWindow";
import {
  activeLordId,
  pendingInvitesForFaction,
} from "../lib/converse-client";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function threadLabel(thread: ConversationThread, state: GameState): string {
  if (thread.kind === "war_council") return "War council";
  const lord = activeLordId(state.activeFaction);
  const other = thread.participantIds.find((id) => id !== lord);
  return state.characters[other ?? ""]?.name ?? "Conversation";
}

/**
 * Talk UI for the right rail — map stays full-bleed; this replaces the army panel.
 */
export default function ConversationDock({ state, dispatch }: Props) {
  if (state.phase !== "planning") return null;

  const invites = pendingInvitesForFaction(state, state.activeFaction);
  const threadIds = [...state.openConversationIds];
  for (const inv of invites) {
    if (!threadIds.includes(inv.id)) threadIds.push(inv.id);
  }

  const threads = threadIds
    .map((id) => state.conversations.find((t) => t.id === id))
    .filter(Boolean) as ConversationThread[];

  const focusedId =
    state.focusedConversationId &&
    threads.some((t) => t.id === state.focusedConversationId)
      ? state.focusedConversationId
      : threads[threads.length - 1]?.id ?? null;

  const focused = focusedId
    ? threads.find((t) => t.id === focusedId) ?? null
    : null;

  const showCompose = !focused;
  const isCouncil = focused?.kind === "war_council";
  const width = isCouncil ? 380 : 340;

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        height: "100%",
        minHeight: 0,
        borderLeft: "1px solid #1e1e1e",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #1e1e1e",
          flexShrink: 0,
          background: "#0c0c0c",
        }}
      >
        <div
          style={{
            color: "#c8941a",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
          }}
        >
          Talk
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "FOCUS_CONVERSATION", threadId: null })
            }
            style={{
              ...chipBtn,
              color: showCompose ? "#c8941a" : "#666",
              borderColor: showCompose ? "#3a2a00" : "#2a2a2a",
            }}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "TOGGLE_TALK_PICKER" })}
            style={chipBtn}
          >
            Close
          </button>
        </div>
      </div>

      {threads.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 10px",
            borderBottom: "1px solid #1a1a1a",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {threads.map((t) => {
            const active = t.id === focusedId && !showCompose;
            const pending =
              t.status === "pending_invite" &&
              t.inviteTo === activeLordId(state.activeFaction);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  dispatch({ type: "FOCUS_CONVERSATION", threadId: t.id })
                }
                style={{
                  flexShrink: 0,
                  background: active
                    ? t.kind === "war_council"
                      ? "#1a1510"
                      : "#141820"
                    : "#101010",
                  border: `1px solid ${
                    active
                      ? t.kind === "war_council"
                        ? "#3a2a00"
                        : "#2a3a4a"
                      : "#222"
                  }`,
                  color: active ? "#ddd" : "#777",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 10,
                  textAlign: "left",
                  minWidth: 100,
                }}
              >
                <div
                  style={{
                    color: active
                      ? t.kind === "war_council"
                        ? "#c8941a"
                        : "#8ab"
                      : "#666",
                    fontSize: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 2,
                  }}
                >
                  {t.kind === "war_council"
                    ? "Council"
                    : pending
                      ? "Invite"
                      : "Private"}
                </div>
                <div>{threadLabel(t, state)}</div>
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {showCompose || !focused ? (
          <CharacterPicker state={state} dispatch={dispatch} embedded />
        ) : (
          <ChatWindow
            thread={focused}
            state={state}
            dispatch={dispatch}
            fill
          />
        )}
      </div>
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a2a",
  color: "#666",
  fontSize: 9,
  cursor: "pointer",
  padding: "4px 8px",
  fontFamily: "inherit",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};
