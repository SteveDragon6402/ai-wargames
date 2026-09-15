"use client";

import type { ConversationThread, GameAction, GameState } from "../types";
import CharacterPicker from "./CharacterPicker";
import ChatWindow from "./ChatWindow";
import {
  activeLordId,
  pendingInvitesForFaction,
} from "../lib/converse-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="text-[12px] font-medium text-muted-foreground">Conversations</div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={showCompose ? "secondary" : "outline"}
            className="h-7 px-2 text-[12px]"
            onClick={() => dispatch({ type: "FOCUS_CONVERSATION", threadId: null })}
          >
            New
          </Button>
        </div>
      </div>

      {threads.length > 0 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-2.5 py-2">
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
                className={cn(
                  "min-w-[100px] shrink-0 rounded-sm border px-2.5 py-1.5 text-left text-[12px]",
                  active
                    ? t.kind === "war_council"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-north/40 bg-north-deep text-foreground"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                <div className="text-[10px] text-muted-foreground">
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

      <div className="flex min-h-0 flex-1 flex-col">
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
