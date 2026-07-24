"use client";

import type { GameAction, GameState } from "../types";
import CharacterPicker from "./CharacterPicker";
import ChatWindow from "./ChatWindow";
import { pendingInvitesForFaction } from "../lib/converse-client";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export default function ConversationDock({ state, dispatch }: Props) {
  const invites = pendingInvitesForFaction(state, state.activeFaction);
  const openThreads = state.openConversationIds
    .map((id) => state.conversations.find((t) => t.id === id))
    .filter(Boolean);

  // Also surface pending invites to me that aren't docked yet
  for (const inv of invites) {
    if (!state.openConversationIds.includes(inv.id)) {
      openThreads.push(inv);
    }
  }

  return (
    <>
      <CharacterPicker state={state} dispatch={dispatch} />

      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          zIndex: 35,
          maxWidth: "calc(100vw - 360px)",
          overflowX: "auto",
        }}
      >
        {openThreads.map(
          (thread) =>
            thread && (
              <ChatWindow
                key={thread.id}
                thread={thread}
                state={state}
                dispatch={dispatch}
              />
            )
        )}
      </div>
    </>
  );
}
