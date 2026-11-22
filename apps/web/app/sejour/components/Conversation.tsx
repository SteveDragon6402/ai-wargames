"use client";

import { useEffect, useRef, useState } from "react";
import { GesturePad } from "@/app/epicerie/components/GesturePad";
import { GESTURES, type GestureId } from "@/app/epicerie/lib/gerard";
import { flagReadingAssist } from "../lib/reading";
import { hear, hearSequence, stopHearing, talk, type Participant, type TalkReply, type TalkRole, type TalkTurn } from "../lib/voice";
import type { UnlockId } from "../world/places";
import { Wait } from "./Wait";

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Extract the key name token (e.g. "Madame Rousseau" -> "rousseau", "Monsieur Moreau" -> "moreau", "Chloé" -> "chloe"). */
export function nameToken(name: string): string {
  const parts = fold(name)
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "madame" && w !== "monsieur" && w !== "mademoiselle" && w !== "dr" && w !== "docteur");
  return parts[parts.length - 1] ?? fold(name);
}

export function lineMentionsName(line: string, realName: string): boolean {
  const token = nameToken(realName);
  if (!token) return false;
  return fold(line).includes(token);
}

export interface ConversationAction {
  id: string;
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface PaymentEvent {
  id: number;
  shown: string;
  prompt: string;
  updatedContext?: string;
}

function looksLikeReadyToLeave(text: string): boolean {
  return /\b(ready to leave|ready to go|let'?s go|head out|go home|i'?m leaving|time to go|go to bed|go upstairs|allons-y|on y va|je pars|je vais|au revoir|bonne journ[eé]e|bonne soir[eé]e|bonne nuit|[aà] bient[oô]t|boulangerie|[eé]picerie|supermarch[eé]|bistro|auberge|pharmacie)\b/i.test(
    text,
  );
}

function looksLikeVerbalPayment(text: string): boolean {
  return /\b(i paid|i've paid|i have paid|already paid|here is the money|here's the money|take the money|keep the change|c'est pay[eé]|j'ai pay[eé]|voil[aà] l'argent|voici l'argent|tiens l'argent)\b/i.test(
    text,
  );
}

interface ConversationProps {
  title: string;
  portrait?: string;
  character: string;
  role: TalkRole;
  who: string;
  /** Optional list of participants for 2-way or 3-way conversations (e.g. Madame Rousseau + Camille). */
  participants?: Participant[];
  /** Character IDs whose names the player has already learned in earlier scenes. */
  knownIds?: readonly string[];
  /** Called when an NPC says their own name aloud so it is saved in `save.met`. */
  onMeet?: (id: string) => void;
  context: string;
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  unlocked?: UnlockId[];
  knownFrench?: string[];
  listening?: boolean;
  placeholder?: string;
  hearLabel?: string;
  /** Force hiding this name until spoken (by default all NPC names are hidden until spoken or in knownIds). */
  revealName?: string;
  /** NPC speaks first when the scene opens. */
  speakFirst?: boolean;
  endLabel?: string;
  /** Whether the player is allowed to finish/leave this conversation right now (false if they still owe payment). */
  canEnd?: boolean;
  /** Explanation shown if the player tries to leave or claims payment while `canEnd` is false. */
  blockedEndReason?: string;
  blockedActionLabel?: string;
  onBlockedAction?: () => void;
  /** Contextual action buttons shown both next to the NPC name header and in a highlighted callout below the chat. */
  actions?: ConversationAction[];
  actionPrompt?: string;
  /** Fired by parent shop/restaurant when coins are put down on the PaymentTray so the NPC knows the exact amount handed over. */
  paymentEvent?: PaymentEvent | null;
  onReply?: (reply: TalkReply, history: TalkTurn[]) => void;
  onEnd?: (history: TalkTurn[]) => void;
}

export function Conversation({
  title,
  portrait,
  character,
  role,
  who,
  participants: rawParticipants,
  knownIds = [],
  onMeet,
  context,
  memory,
  notes = [],
  onNotes,
  unlocked,
  knownFrench,
  listening = false,
  placeholder,
  hearLabel = "Hear again",
  speakFirst = false,
  endLabel = "That's enough",
  canEnd = true,
  blockedEndReason,
  blockedActionLabel,
  onBlockedAction,
  actions = [],
  actionPrompt,
  paymentEvent,
  onReply,
  onEnd,
}: ConversationProps) {
  const [history, setHistory] = useState<TalkTurn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(speakFirst);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [revealedTurns, setRevealedTurns] = useState<Record<number, boolean>>({});
  const [revealArmed, setRevealArmed] = useState(false);
  const [pendingReveal, setPendingReveal] = useState<number | null>(null);
  const [nudgeKind, setNudgeKind] = useState<"leave" | "pay" | null>(null);
  const alive = useRef(true);
  const lastPayEventId = useRef<number>(0);

  const roster: Participant[] =
    rawParticipants && rawParticipants.length > 0
      ? rawParticipants
      : [{ id: who, name: title, character, portrait }];

  const participantById: Record<string, Participant> = Object.fromEntries(roster.map((p) => [p.id, p]));

  function isNameKnown(p: Participant): boolean {
    if (knownIds.includes(p.id)) return true;
    return history.some(
      (turn) =>
        turn.who === "them" &&
        (!turn.speakerId || turn.speakerId === p.id || roster.length === 1) &&
        lineMentionsName(turn.text, p.name),
    );
  }

  function displaySpeakerName(speakerId?: string): string {
    const p = (speakerId ? participantById[speakerId] : undefined) ?? roster[0];
    if (!p) return "???";
    return isNameKnown(p) ? p.name : "???";
  }

  useEffect(() => {
    alive.current = true;
    if (speakFirst) void openLine();
    return () => {
      alive.current = false;
      stopHearing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!paymentEvent || paymentEvent.id === lastPayEventId.current) return;
    lastPayEventId.current = paymentEvent.id;
    void sendPaymentTurn(paymentEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentEvent]);

  async function sendPaymentTurn(ev: PaymentEvent) {
    setError(null);
    setBusy(true);
    const before = [...history, { who: "you" as const, text: ev.shown }];
    setHistory(before);
    const reply = await talk({
      role,
      who,
      participants: roster,
      history,
      said: ev.prompt,
      context: ev.updatedContext ??       context,
      memory,
      notes,
      unlocked,
      knownFrench,
    });
    if (!alive.current) return;
    setBusy(false);
    if (reply.error || (!reply.line && !reply.turns.length)) {
      setError(reply.error ?? "They didn't answer.");
      return;
    }
    applyReply(reply, before);
  }

  function applyReply(reply: TalkReply, baseHistory: TalkTurn[]) {
    const newTurns: TalkTurn[] =
      reply.turns.length > 0
        ? reply.turns.map((t) => ({ who: "them" as const, text: t.line, audio: t.audio || t.line, speakerId: t.speakerId }))
        : reply.line
          ? [{ who: "them" as const, text: reply.line, audio: reply.audio || reply.line, speakerId: roster[0]?.id ?? who }]
          : [];

    const next = [...baseHistory, ...newTurns];
    setHistory(next);
    if (reply.quiet || (reply.left && canEnd)) setClosed(true);
    if (reply.bedtime || reply.left || reply.suggestedPlaces.length > 0 || reply.settled.length > 0) {
      setNudgeKind(canEnd ? "leave" : "pay");
    } else if (reply.billed && !canEnd) {
      setNudgeKind("pay");
    }

    // Check if any speaker just said their own name aloud
    for (const p of roster) {
      if (!knownIds.includes(p.id)) {
        const spokeOwnName = newTurns.some(
          (t) => (!t.speakerId || t.speakerId === p.id || roster.length === 1) && lineMentionsName(t.text, p.name),
        );
        if (spokeOwnName) {
          onMeet?.(p.id);
        }
      }
    }

    if (reply.notes.length) onNotes?.(reply.notes);
    onReply?.(reply, next);

    // Speak all NPC lines in sequence using their respective voices
    if (reply.turns.length > 0) {
      void hearSequence(
        reply.turns.map((t) => {
          const p = participantById[t.speakerId] ?? roster[0];
          return {
            character: p?.character ?? character,
            text: t.audio || t.line,
          };
        }),
      );
    } else if (reply.line) {
      void hear(character, reply.audio || reply.line, "any");
    }
  }

  async function openLine() {
    setBusy(true);
    const reply = await talk({
      role,
      who,
      participants: roster,
      history: [],
      said: "",
      opening: true,
      context,
      memory,
      notes,
      unlocked,
      knownFrench,
    });
    if (!alive.current) return;
    setBusy(false);
    if (reply.error || (!reply.line && !reply.turns.length)) {
      setError(reply.error ?? "Nothing came back.");
      return;
    }
    applyReply(reply, []);
  }

  async function send(gesture?: GestureId) {
    const said = text.trim();
    if ((!said && !gesture) || busy || closed) return;
    setError(null);
    setText("");
    if (said && !canEnd && looksLikeVerbalPayment(said)) {
      setNudgeKind("pay");
    } else if (said && looksLikeReadyToLeave(said)) {
      setNudgeKind(canEnd ? "leave" : "pay");
    }
    setBusy(true);
    const label = gesture ? `[${GESTURES[gesture]}]` : "";
    const shown = said && label ? `${label} ${said}` : said || label;
    const before = [...history, { who: "you" as const, text: shown }];
    setHistory(before);
    const reply = await talk({
      role,
      who,
      participants: roster,
      history,
      said,
      gesture,
      context,
      memory,
      notes,
      unlocked,
      knownFrench,
    });
    if (!alive.current) return;
    setBusy(false);
    if (reply.error || (!reply.line && !reply.turns.length)) {
      setError(reply.error ?? "They didn't answer.");
      return;
    }
    applyReply(reply, before);
  }

  const lastNpcTurn = [...history].reverse().find((t) => t.who === "them");
  const lastSpeaker = (lastNpcTurn?.speakerId ? participantById[lastNpcTurn.speakerId] : undefined) ?? roster[0];
  const effectiveActions: ConversationAction[] =
    actions.length > 0
      ? actions
      : canEnd && onEnd && history.length > 0
        ? [{ id: "end-scene", label: endLabel, primary: true, onClick: () => onEnd(history) }]
        : [];

  return (
    <div className="space-y-3" data-voice={lastSpeaker?.character ?? character}>
      {/* Header: Single speaker or Multi-speaker participant cards + inline next-step buttons next to name */}
      {roster.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {roster.map((p) => {
              const known = isNameKnown(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-black/15 bg-white/75 px-3 py-2 shadow-sm"
                >
                  {p.portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.portrait} alt="" className="h-12 w-12 rounded-full object-cover object-top" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
                      {p.id === "pistache" ? "🐕" : "👤"}
                    </span>
                  )}
                  <div>
                    <p className="ep-display text-[19px] leading-tight">{known ? p.name : "???"}</p>
                    {p.blurb ? <p className="text-[12px] text-[var(--ep-ink-soft)]">{p.blurb}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {lastNpcTurn ? (
            <button
              type="button"
              className="ep-button"
              onClick={() => void hear(lastSpeaker?.character ?? character, lastNpcTurn.audio || lastNpcTurn.text, "any")}
            >
              {hearLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt="" className="h-14 w-14 rounded-full object-cover object-top" />
            ) : null}
            <h1 className="ep-display text-[26px]">{displaySpeakerName(roster[0]?.id)}</h1>
          </div>
          {lastNpcTurn ? (
            <button
              type="button"
              className="ep-button"
              onClick={() => void hear(character, lastNpcTurn.audio || lastNpcTurn.text, "any")}
            >
              {hearLabel}
            </button>
          ) : null}
        </div>
      )}

      {pendingReveal !== null ? (
        <div role="alertdialog" aria-label="Show the words" className="rounded-xl border-2 border-amber-800/40 bg-amber-50 p-4">
          <p className="text-[15px] font-semibold text-amber-950">Show the words for this conversation?</p>
          <p className="mt-1 text-[14px] text-amber-950">
            You can keep going either way. Reading the lines means this conversation will not count toward your listening skill.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="ep-button ep-primary"
              onClick={() => {
                const index = pendingReveal;
                setRevealArmed(true);
                setPendingReveal(null);
                setRevealedTurns((prev) => ({ ...prev, [index]: true }));
                flagReadingAssist();
              }}
            >
              Show the words
            </button>
            <button type="button" className="ep-button" onClick={() => setPendingReveal(null)}>
              Keep listening
            </button>
          </div>
        </div>
      ) : null}

      <ol className="space-y-2.5" aria-live="polite">
        {history.map((turn, index) => {
          const maskNpc = listening && turn.who === "them" && !revealedTurns[index];
          const spk = turn.who === "them" ? ((turn.speakerId ? participantById[turn.speakerId] : undefined) ?? roster[0]) : null;
          const spkLabel = turn.who === "them" ? displaySpeakerName(turn.speakerId) : "You";
          return (
            <li key={`${index}-${turn.who}`} className={turn.who === "you" ? "sj-you" : "sj-them"}>
              {turn.who === "them" && roster.length > 1 ? (
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {spk?.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={spk.portrait} alt="" className="h-6 w-6 rounded-full object-cover object-top" />
                    ) : null}
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">
                      {spkLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-[var(--ep-ink-soft)] hover:bg-black/5"
                    onClick={() => void hear(spk?.character ?? character, turn.audio || turn.text, "any")}
                  >
                    Hear
                  </button>
                </div>
              ) : null}

              {maskNpc ? (
                <button
                  type="button"
                  className="rounded-md border border-dashed border-amber-900/40 bg-amber-50/70 px-3 py-1.5 text-left text-[15px] italic text-amber-950"
                  onClick={() => {
                    if (revealArmed) {
                      setRevealedTurns((prev) => ({ ...prev, [index]: true }));
                      return;
                    }
                    setPendingReveal(index);
                  }}
                >
                  Listening — the words stay hidden
                </button>
              ) : (
                <span>{turn.text}</span>
              )}
            </li>
          );
        })}
      </ol>

      {busy ? <Wait>Listening…</Wait> : null}
      {error ? <p className="sj-error">{error}</p> : null}

      {/* Inline pop-up / callout when payment is required before leaving */}
      {!canEnd && (nudgeKind === "pay" || blockedEndReason) && history.length > 1 ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3.5 shadow-sm transition ${
            nudgeKind === "pay"
              ? "border-amber-700 bg-amber-100/95 ring-4 ring-amber-400/40"
              : "border-amber-800/30 bg-amber-50/90"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold uppercase tracking-wider text-amber-950">
              {nudgeKind === "pay" ? "💶 Payment required before leaving" : "💶 How to pay"}
            </p>
            <p className="mt-0.5 text-[14px] text-amber-950">
              {blockedEndReason ??
                "Saying you paid in chat does not hand over money. Click the coins/bills in the Payment Tray above and press 'Hand over'!"}
            </p>
          </div>
          {onBlockedAction ? (
            <button type="button" className="ep-button ep-primary" onClick={onBlockedAction}>
              {blockedActionLabel ?? "💶 Go to Payment Tray ↑"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Inline Next-Step Action Card right below the latest reply */}
      {effectiveActions.length > 0 ? (
        <div
          role="region"
          aria-label="Next step actions"
          className={`flex flex-wrap items-center gap-2 ${
            nudgeKind === "leave" && effectiveActions.length === 1
              ? "justify-between rounded-xl border-2 border-emerald-700 bg-emerald-50/95 p-3.5"
              : ""
          }`}
        >
          {nudgeKind === "leave" && effectiveActions.length === 1 ? (
            <p className="text-sm font-semibold text-[#231b12]">Ready to go</p>
          ) : actionPrompt ? (
            <p className="text-sm text-[#4a3b2a]">{actionPrompt}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {effectiveActions.map((act) => (
              <button
                key={act.id}
                type="button"
                disabled={busy}
                className={`ep-button ${act.primary !== false ? "ep-primary" : ""} text-[15px] font-semibold shadow-sm`}
                onClick={act.onClick}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!closed ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <GesturePad disabled={busy} onPick={(gesture) => void send(gesture)} />
          <textarea
            className="ep-ruled min-h-[82px] w-full resize-none rounded-md border border-[rgb(43_29_20/0.28)] bg-white p-3"
            value={text}
            disabled={busy}
            placeholder={placeholder ?? "Speak in French (or ask in English if you're stuck)…"}
            aria-label="What you say"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ep-button ep-primary" disabled={busy || !text.trim()}>
              Say it
            </button>
            {canEnd && onEnd && history.length > 0 ? (
              <button type="button" className="ep-button" disabled={busy} onClick={() => onEnd(history)}>
                {endLabel}
              </button>
            ) : null}
          </div>
        </form>
      ) : canEnd && onEnd ? (
        <button type="button" className="ep-button ep-primary" onClick={() => onEnd(history)}>
          {endLabel}
        </button>
      ) : null}
    </div>
  );
}
