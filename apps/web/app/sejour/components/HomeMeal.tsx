"use client";

import { useState } from "react";
import { hear } from "../lib/voice";
import type { Participant, TalkReply, TalkTurn } from "../lib/voice";
import type { UnlockId } from "../world/places";
import type { Recipe } from "../world/recipes";
import { Conversation } from "./Conversation";

interface HomeMealProps {
  day: number;
  dishFr: string;
  dishEn: string;
  icon: string;
  recipe?: Recipe | null;
  participants?: Participant[];
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  unlocked: UnlockId[];
  knownFrench: string[];
  listening: boolean;
  practiceWords?: { fr: string; en: string }[];
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onSettled: (ids: string[]) => void;
  onDone: (turns: TalkTurn[]) => void;
}

const DEFAULT_MEAL_WORDS = [
  { fr: "Le pain est tout chaud.", en: "The bread is still warm." },
  { fr: "La croûte est croustillante.", en: "The crust is crispy." },
  { fr: "Bon appétit !", en: "Enjoy your meal!" },
  { fr: "Merci pour le repas.", en: "Thank you for the meal." },
];

export function HomeMeal({
  day,
  dishFr,
  dishEn,
  icon,
  recipe,
  participants,
  knownIds = [],
  onMeet,
  memory,
  notes = [],
  onNotes,
  unlocked,
  knownFrench,
  listening,
  practiceWords,
  onPhrase,
  onSettled,
  onDone,
}: HomeMealProps) {
  const totalBites = 2;
  const [bitesLeft, setBitesLeft] = useState(totalBites);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [readyForBed, setReadyForBed] = useState(false);

  const words = (practiceWords?.length ? practiceWords : recipe?.mealWords?.length ? recipe.mealWords : DEFAULT_MEAL_WORDS).slice(0, 4);

  function takeBite() {
    if (bitesLeft <= 0) return;
    setBitesLeft((prev) => Math.max(0, prev - 1));
  }

  function onReply(reply: TalkReply, history: TalkTurn[]) {
    setTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, "Madame Rousseau");
    if (reply.settled.length) onSettled(reply.settled);
    const playerTurnsNow = history.filter((turn) => turn.who === "you").length;
    if (reply.bedtime && playerTurnsNow >= 3) setReadyForBed(true);
  }

  const finishedPlate = bitesLeft === 0;
  const playerTurns = turns.filter((t) => t.who === "you").length;
  const minTurnsRequired = 3;
  const canLeaveTable = readyForBed && playerTurns >= minTurnsRequired;

  return (
    <section aria-label="Eating together">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/v2/scenes/dining.jpg" alt="Madame Rousseau's dining table" className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">À table · Evening meal</p>
            <h2 className="ep-display text-[28px]">Eating together: {dishFr}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-900/25 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-950">
              🍽️ {totalBites - bitesLeft}/{totalBites} bites · 💬 {Math.min(playerTurns, minTurnsRequired)}/{minTurnsRequired} turns
            </span>
          </div>
        </div>

        {/* Interactive plate */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-900/20 bg-white/80 p-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={takeBite}
              disabled={finishedPlate}
              aria-label={finishedPlate ? "Plate is empty" : `Eat a bite of ${dishEn}`}
              className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 transition ${
                finishedPlate
                  ? "border-stone-300 bg-stone-100 opacity-70"
                  : "border-amber-700/40 bg-amber-50 shadow-md hover:scale-105 active:scale-95"
              }`}
            >
              <span className="text-4xl">{finishedPlate ? "🍽️" : icon}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
                {finishedPlate ? "Fini !" : `${bitesLeft} left`}
              </span>
            </button>
            <div>
              <p className="text-[17px] font-semibold">
                {finishedPlate ? "You finished your plate!" : `On your plate: ${dishFr} (${dishEn})`}
              </p>
              <p className="mt-0.5 text-[14px] text-[var(--ep-ink-soft)]">
                {finishedPlate
                  ? "Stay at the table until Madame says the meal is finished."
                  : "Click your plate to take a bite while talking about the food."}
              </p>
              {!finishedPlate ? (
                <button type="button" className="ep-button mt-2" onClick={takeBite}>
                  🍴 Take a bite ({totalBites - bitesLeft + 1}/{totalBites})
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-w-[200px]">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">Table vocabulary (click to hear)</p>
            <ul className="mt-1 space-y-1 text-[13px]">
              {words.map((w) => (
                <li key={w.fr}>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => void hear("rousseau", w.fr, "any")}
                  >
                    <strong>{w.fr}</strong> — <span className="text-[var(--ep-ink-soft)]">{w.en}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <Conversation
            title="Madame Rousseau"
            portrait="/sejour/rousseau.jpg"
            character="rousseau"
            role={participants && participants.length > 1 ? "family" : "host"}
            who="rousseau"
            participants={participants}
            knownIds={knownIds}
            onMeet={onMeet}
            speakFirst
            listening={listening}
            unlocked={unlocked}
            knownFrench={knownFrench}
            memory={memory}
            notes={notes}
            onNotes={onNotes}
            context={`MEAL. Day ${day}. Dinner at the table, eating ${dishFr} (${dishEn}). Words around the table: ${words.map((w) => w.fr).join(", ")}.`}
            canEnd={canLeaveTable}
            endLabel="Finish dinner"
            actionPrompt="✅ You've finished your dinner and chatted with Madame Rousseau! Ready to head upstairs for the night:"
            onReply={onReply}
            onEnd={(history) => onDone(history.length ? history : turns)}
          />
        </div>
      </div>
    </section>
  );
}
