"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Faction,
  GameAction,
  GameState,
  NpcRuntimePatch,
} from "../types";
import {
  makeMessage,
  readConverseNdjson,
  snapshotForApi,
} from "../lib/converse-client";
import {
  ensureStewardThread,
  findStewardThread,
  stewardIdFor,
} from "../lib/steward";
import {
  buildStewardDigest,
  fallbackStewardBrief,
  stewardRecommendedChips,
  stewardSpeakerName,
} from "../lib/steward-prompts";
import {
  countWords,
  factionLordId,
  PLAYER_STEWARD_MAX_WORDS,
} from "../data/characters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  faction: Faction;
  /** Generate the turn briefing once from the parent. */
  briefing?: StewardBriefRequest | null;
  onBriefingConsumed?: () => void;
}

export interface StewardBriefRequest {
  turn: number;
  faction: Faction;
}

function prettyToolName(name: string): string {
  const labels: Record<string, string> = {
    inspect_hold: "asking after a holding",
    survey_map: "studying the map",
    find_forces: "counting banners",
    search_faction_events: "recalling the campaign",
    get_battle_logs: "recalling the battles",
    who_is: "placing a name",
    march_history: "recalling the marches",
    turns_to: "counting the march",
    explain_rules: "consulting the order of the day",
    inspect_orders: "reading the standing orders",
    search_deeds: "reading the war record",
    prisoners_held: "counting captives",
    write_notepad: "making a private note",
    append_notepad: "making a private note",
    read_notepad: "consulting their notes",
  };
  return labels[name] ?? "considering";
}

export default function StewardDock({
  state,
  dispatch,
  faction,
  briefing,
  onBriefingConsumed,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [consulting, setConsulting] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const stewardId = stewardIdFor(faction);
  const stewardName = stewardSpeakerName(state, faction);
  const lordId = factionLordId(faction);
  const lordName = state.characters[lordId]?.name ?? "Lord";
  const thread = findStewardThread(state, faction);
  const open = !!state.stewardOpen;
  const unread = state.stewardUnread?.[faction] ?? false;
  const chips = stewardRecommendedChips(state, faction);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length, thread?.id, streamingReply, open]);

  function ensureThread() {
    const found = findStewardThread(state, faction);
    if (found) return found;
    const { thread: created } = ensureStewardThread(
      state.conversations,
      faction,
      state.turn
    );
    dispatch({ type: "UPSERT_CONVERSATION", thread: created });
    return created;
  }

  async function runSteward(opts: {
    intent: "brief" | "chat" | "advice";
    playerMessage?: string;
    digest?: string;
  }) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSendError(null);
    setStreamingReply("");
    setConsulting(null);

    const live = ensureThread();
    if (opts.playerMessage) {
      dispatch({
        type: "APPEND_MESSAGES",
        threadId: live.id,
        messages: [makeMessage(lordId, lordName, opts.playerMessage, "chat")],
      });
    }

    const snap = snapshotForApi(state);
    try {
      const res = await fetch("/api/got-houses-v2/converse/steward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: opts.intent,
          faction,
          thread: live,
          playerMessage: opts.playerMessage,
          digest: opts.digest,
          ...snap,
        }),
      });

      const payload = await readConverseNdjson(res, {
        onDelta: (chunk) => {
          setStreamingReply((prev) => (prev ?? "") + chunk);
        },
        onTool: (name) => setConsulting(prettyToolName(name)),
      });

      if (payload.error || !payload.reply) {
        if (opts.intent === "brief") {
          const fallback = fallbackStewardBrief(state.turn, opts.digest ?? "");
          dispatch({
            type: "APPEND_MESSAGES",
            threadId: live.id,
            messages: [makeMessage(stewardId, stewardName, fallback, "chat")],
          });
        } else {
          setSendError(payload.error ?? "No answer came back.");
        }
      } else {
        dispatch({
          type: "APPEND_MESSAGES",
          threadId: live.id,
          messages: [makeMessage(stewardId, stewardName, payload.reply, "chat")],
        });
        if (payload.patches?.length) {
          dispatch({
            type: "PATCH_CHARACTERS",
            patches: payload.patches as NpcRuntimePatch[],
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.intent === "brief") {
        const fallback = fallbackStewardBrief(state.turn, opts.digest ?? "");
        dispatch({
          type: "APPEND_MESSAGES",
          threadId: live.id,
          messages: [makeMessage(stewardId, stewardName, fallback, "chat")],
        });
      } else {
        setSendError(msg);
      }
    } finally {
      setStreamingReply(null);
      setConsulting(null);
      setBusy(false);
      busyRef.current = false;
    }
  }

  useEffect(() => {
    if (!briefing) return;
    if (briefing.faction !== faction) return;
    onBriefingConsumed?.();
    void runSteward({
      intent: "brief",
      digest: buildStewardDigest(state, faction),
    });
    // Frozen at request time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing?.turn, briefing?.faction]);

  async function sendLine(raw: string, intent: "chat" | "advice" = "chat") {
    const trimmed = raw.trim();
    if (!trimmed || busyRef.current) return;
    if (countWords(trimmed) > PLAYER_STEWARD_MAX_WORDS) {
      setSendError(`Keep it under ${PLAYER_STEWARD_MAX_WORDS} words.`);
      return;
    }
    setText("");
    await runSteward({ intent, playerMessage: trimmed });
  }

  function openDock() {
    dispatch({ type: "SET_STEWARD_OPEN", open: true });
  }

  function closeDock() {
    dispatch({ type: "SET_STEWARD_OPEN", open: false });
  }

  if (state.phase !== "planning") return null;
  if (state.outcome) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[22] flex flex-col items-start gap-2">
      {!open && (
        <button
          type="button"
          onClick={openDock}
          className="pointer-events-auto flex items-center gap-2 rounded-sm border border-border bg-card/95 px-3 py-2 text-left shadow-lg backdrop-blur hover:bg-accent"
        >
          <span className="text-[12px] font-medium text-foreground">Steward</span>
          {unread && (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          )}
        </button>
      )}

      {open && (
        <div className="pointer-events-auto flex h-[440px] w-[340px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-sm border border-border bg-card/95 shadow-xl backdrop-blur">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <div>
              <div className="text-[12px] font-medium text-foreground">Steward</div>
              <div className="text-[11px] text-muted-foreground">{stewardName}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px]"
              onClick={closeDock}
            >
              Close
            </Button>
          </div>

          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          >
            {(thread?.messages ?? []).map((m) => {
              if (m.kind === "turn_break") {
                return (
                  <div
                    key={m.id}
                    className="my-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {m.text}
                  </div>
                );
              }
              const mine = m.speakerId === lordId;
              return (
                <div
                  key={m.id}
                  className={cn("mb-3 max-w-[88%]", mine && "ml-auto")}
                >
                  <div
                    className={cn(
                      "mb-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground",
                      mine && "text-right"
                    )}
                  >
                    {m.speakerName}
                  </div>
                  <div
                    className={cn(
                      "rounded-sm border border-border px-2.5 py-2 text-[13px] leading-snug text-foreground",
                      mine ? "bg-accent/40" : "bg-background"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
            {streamingReply !== null && (
              <div className="mb-3 max-w-[88%]">
                <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {stewardName}
                </div>
                <div className="rounded-sm border border-border bg-background px-2.5 py-2 text-[13px] leading-snug text-foreground">
                  {streamingReply}
                  <span className="text-muted-foreground">▌</span>
                </div>
              </div>
            )}
            {busy && streamingReply === null && (
              <div className="mt-2 text-[12px] text-muted-foreground">
                {consulting
                  ? `They pause, ${consulting}…`
                  : "They consider their words…"}
              </div>
            )}
            {sendError && (
              <div className="mt-2 text-[12px] text-destructive">{sendError}</div>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendLine(chip.text, chip.intent)}
                  className="rounded-sm border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void sendLine(text);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask the steward…"
                disabled={busy}
                className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-[12px]"
                disabled={busy || !text.trim()}
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
