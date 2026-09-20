"use client";

import { useState } from "react";
import type { Audience, Faction, GameAction, GameState } from "../types";
import { countWords, PLAYER_CHAT_MAX_WORDS } from "../data/characters";
import { audienceThisTurn, AUDIENCE_FREE_TEXT_WORDS } from "../lib/audience";
import { Button } from "@/components/ui/button";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  viewerFaction: Faction;
}

const WORD_CAP = Math.min(PLAYER_CHAT_MAX_WORDS, AUDIENCE_FREE_TEXT_WORDS);

function statusOf(a: Audience | undefined): string {
  if (!a) return "seeking";
  if (a.skipped) return "skipped";
  if (!a.text) return "seeking";
  if (!a.answer) return "open";
  if (!a.effectsApplied) return "settling";
  return "done";
}

export default function CounselPanel({ state, dispatch, viewerFaction }: Props) {
  const admin = state.adminMode;
  const mine = admin ? state.activeFaction : viewerFaction;
  const audience = audienceThisTurn(state.audiences, state.turn, mine);
  const otherFaction: Faction = mine === "north" ? "westerlands" : "north";
  const other = audienceThisTurn(state.audiences, state.turn, otherFaction);
  const speaker = audience?.speakerId
    ? state.characters[audience.speakerId]
    : null;
  const lord = audience?.addresseeId
    ? state.characters[audience.addresseeId]
    : null;

  const [freeText, setFreeText] = useState("");
  const words = countWords(freeText);
  const over = words > WORD_CAP;

  const mineStatus = statusOf(audience);
  const otherStatus = statusOf(other);

  function answer(optionId: string | null, text: string | null) {
    if (!audience) return;
    dispatch({
      type: "SET_AUDIENCE_ANSWER",
      audienceId: audience.id,
      answer: { optionId, freeText: text },
      asFaction: mine,
    });
  }

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/85 p-4">
      <div className="w-[480px] max-w-[92vw] max-h-[90vh] overflow-y-auto rounded-sm border border-border bg-card p-5 shadow-xl">
        <div className="font-display text-2xl text-foreground">Counsel</div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          A bannerman seeks a word.
        </p>

        {mineStatus === "seeking" && (
          <p className="mt-6 text-[14px] text-muted-foreground">
            A bannerman is seeking a word with you…
          </p>
        )}

        {mineStatus === "skipped" && (
          <p className="mt-6 text-[14px] text-muted-foreground">
            No one approached you this turn.
          </p>
        )}

        {audience && mineStatus === "open" && (
          <div className="mt-5 space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wide text-primary">
              {speaker?.name ?? "A bannerman"} seeks a word
              {lord ? ` with ${lord.name}` : ""}
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
              {audience.text}
            </p>
            <div className="space-y-2">
              {audience.options.map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  variant="outline"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-left text-[13px]"
                  onClick={() => answer(opt.id, null)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">
                Or your own word ({WORD_CAP} words)
              </div>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-sm border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
              />
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={`text-[11px] ${over ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {words} / {WORD_CAP}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={over || words === 0}
                  onClick={() => answer(null, freeText.trim())}
                >
                  Speak
                </Button>
              </div>
            </div>
          </div>
        )}

        {(mineStatus === "settling" || mineStatus === "done") && audience && (
          <div className="mt-5 space-y-3">
            <div className="text-[12px] font-medium text-muted-foreground">
              You answered {speaker?.name ?? "them"}.
            </div>
            {audience.narration ? (
              <p className="text-[14px] leading-relaxed text-foreground/90">
                {audience.narration}
              </p>
            ) : state.mapStatus === "resolving" ? (
              <p className="text-[14px] text-muted-foreground">
                The hosts are still on the road…
              </p>
            ) : (
              <p className="text-[14px] text-muted-foreground">
                The camp is taking your word…
              </p>
            )}
          </div>
        )}

        {otherStatus === "open" && mineStatus !== "open" && (
          <p className="mt-6 text-[13px] text-muted-foreground">
            The other lord still sits in counsel.
          </p>
        )}
        {otherStatus === "seeking" && mineStatus !== "seeking" && mineStatus !== "open" && (
          <p className="mt-6 text-[13px] text-muted-foreground">
            Waiting on the other camp…
          </p>
        )}
      </div>
    </div>
  );
}
