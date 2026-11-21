"use client";

import { useEffect, useState } from "react";
import { ITEM_BY_ID, itemIcon } from "@/app/epicerie/data/items";
import { hear, stopHearing } from "../lib/voice";
import { UTENSILS, type Recipe, type UtensilId } from "../world/recipes";

interface CookingProps {
  recipe: Recipe;
  listening: boolean;
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: () => void;
}

interface TrayItem {
  id: string;
  fr: string;
  en: string;
  icon?: string;
  image?: string;
}

export function Cooking({ recipe, listening, onPhrase, onDone }: CookingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [utensilState, setUtensilState] = useState<Partial<Record<UtensilId, { id: string; fr: string; icon: string }>>>({});

  const step = recipe.steps[stepIndex];
  const finished = stepIndex >= recipe.steps.length;

  useEffect(() => {
    setShowHint(false);
    setFeedback(null);
    if (step) {
      void hear("rousseau", step.say, "any");
    } else {
      void hear("rousseau", `Bravo ! ${recipe.fr}, c'est prêt ! À table !`, "any");
    }
    return () => stopHearing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, recipe.id]);

  // Build list of available draggable items on the counter
  const usedRawIds = new Set(recipe.steps.slice(0, stepIndex).map((s) => s.item));
  const rawTray: TrayItem[] = recipe.lines
    .filter((line) => !usedRawIds.has(line.itemId))
    .map((line) => {
      const shopItem = ITEM_BY_ID[line.itemId];
      return {
        id: line.itemId,
        fr: shopItem?.word ?? line.itemId,
        en: shopItem?.en ?? line.itemId,
        image: shopItem ? itemIcon(shopItem.id) : undefined,
      };
    });

  // Also allow dragging an intermediate item off a utensil (e.g. chopped tomatoes from the cutting board onto the salad bowl)
  const intermediateTray: TrayItem[] = Object.entries(utensilState)
    .filter(([, state]) => state && !usedRawIds.has(state.id))
    .map(([utensilId, state]) => ({
      id: state!.id,
      fr: `${state!.fr} (from ${UTENSILS[utensilId as UtensilId].fr})`,
      en: state!.fr,
      icon: state!.icon,
    }));

  const availableItems = [...rawTray, ...intermediateTray];

  function attemptPlace(itemId: string, targetUtensil: UtensilId) {
    if (!step) return;
    if (itemId === step.item && targetUtensil === step.into) {
      // Remove intermediate state from source utensil if it came from another utensil
      const nextUtensils = { ...utensilState };
      for (const [uId, st] of Object.entries(nextUtensils)) {
        if (st?.id === itemId && uId !== targetUtensil) {
          delete nextUtensils[uId as UtensilId];
        }
      }
      nextUtensils[targetUtensil] = {
        id: step.result,
        fr: step.resultFr,
        icon: step.resultIcon,
      };
      setUtensilState(nextUtensils);
      setSelectedItem(null);
      setFeedback(`Très bien ! ${step.resultFr}.`);
      onPhrase([{ fr: step.say, en: step.en }], "Madame Rousseau (Kitchen)");
      setStepIndex((prev) => prev + 1);
    } else {
      const targetName = UTENSILS[targetUtensil].fr;
      setFeedback(`Pas tout à fait — écoutez bien ce que demande Madame Rousseau (${targetName}).`);
      setSelectedItem(null);
    }
  }

  return (
    <section aria-label="Cooking together">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/v2/scenes/cooking.jpg" alt="Madame Rousseau's kitchen worktop" className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">
              En cuisine · Step {Math.min(stepIndex + 1, recipe.steps.length)} of {recipe.steps.length}
            </p>
            <h2 className="ep-display text-[28px]">Cooking: {recipe.fr}</h2>
          </div>
          {finished ? (
            <button type="button" className="ep-button ep-primary" onClick={onDone}>
              🍽️ Bring {recipe.fr} to the table
            </button>
          ) : null}
        </div>

        {/* Madame Rousseau's spoken instruction banner */}
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-900/20 bg-white/85 p-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sejour/rousseau.jpg" alt="Madame Rousseau" className="h-16 w-12 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">Madame Rousseau</p>
            {finished ? (
              <p className="mt-1 text-[18px] font-medium">
                « Bravo ! {recipe.fr}, c&apos;est prêt ! On passe à table. »
              </p>
            ) : (
              <>
                <p className="mt-1 text-[18px] font-medium">
                  {listening ? "[listening mode — listen to her instruction]" : `« ${step.say} »`}
                </p>
                {showHint ? <p className="mt-1 text-[14px] text-[var(--ep-ink-soft)]">{step.en}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ep-button text-[13px]"
                    onClick={() => void hear("rousseau", step.say, "any")}
                  >
                    🔊 Hear instruction again
                  </button>
                  <button
                    type="button"
                    className="ep-button text-[13px]"
                    onClick={() => setShowHint((prev) => !prev)}
                  >
                    {showHint ? "Hide English hint" : "Show English hint"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {feedback ? (
          <p className="mt-2 rounded-md bg-amber-100/80 px-3 py-1.5 text-[14px] font-medium">{feedback}</p>
        ) : null}

        {!finished ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Left: Ingredients & prepared items */}
            <div className="rounded-xl border border-black/15 bg-white/60 p-3">
              <p className="text-[13px] font-semibold uppercase tracking-wide">
                1. Drag an ingredient (or tap to pick up)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {availableItems.map((item) => {
                  const picked = selectedItem === item.id;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        setSelectedItem(item.id);
                      }}
                      onClick={() => setSelectedItem(picked ? null : item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedItem(picked ? null : item.id);
                      }}
                      className={`flex cursor-grab items-center gap-2 rounded-lg border p-2.5 transition ${
                        picked
                          ? "border-[var(--ep-ink)] bg-amber-200/80 ring-2 ring-amber-700/40"
                          : "border-black/15 bg-white hover:bg-amber-50/70"
                      }`}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" className="h-9 w-9 object-contain" />
                      ) : (
                        <span className="text-2xl">{item.icon ?? "🥘"}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold">{item.fr}</p>
                        <p className="text-[11px] text-[var(--ep-ink-soft)]">{item.en}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Utensils on the worktop */}
            <div className="rounded-xl border border-black/15 bg-white/60 p-3">
              <p className="text-[13px] font-semibold uppercase tracking-wide">
                2. Drop onto the right utensil (or tap utensil)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {recipe.utensils.map((uId) => {
                  const utensil = UTENSILS[uId];
                  const state = utensilState[uId];
                  return (
                    <div
                      key={uId}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedId = e.dataTransfer.getData("text/plain") || selectedItem;
                        if (droppedId) attemptPlace(droppedId, uId);
                      }}
                      onClick={() => {
                        if (selectedItem) {
                          attemptPlace(selectedItem, uId);
                        } else if (state) {
                          // Picking up the prepared contents from this utensil to move to another utensil
                          setSelectedItem(state.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && selectedItem) {
                          attemptPlace(selectedItem, uId);
                        }
                      }}
                      className={`flex min-h-[110px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition ${
                        selectedItem
                          ? "border-amber-800/60 bg-amber-50/80 hover:bg-amber-100"
                          : "border-black/20 bg-white/90"
                      }`}
                    >
                      {state ? (
                        <>
                          <span className="text-4xl">{state.icon}</span>
                          <p className="mt-1 text-[14px] font-bold">{utensil.fr}</p>
                          <p className="text-[12px] font-medium text-amber-900">{state.fr}</p>
                        </>
                      ) : (
                        <>
                          {utensil.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={utensil.image} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <span className="text-4xl">{utensil.icon}</span>
                          )}
                          <p className="mt-1 text-[14px] font-bold">{utensil.fr}</p>
                          <p className="text-[12px] text-[var(--ep-ink-soft)]">{utensil.en}</p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-emerald-800/30 bg-emerald-50/80 p-6 text-center">
            <span className="text-5xl">{recipe.steps.at(-1)?.resultIcon ?? "🍽️"}</span>
            <p className="mt-2 ep-display text-[26px]">{recipe.fr}</p>
            <p className="text-[15px] text-[var(--ep-ink-soft)]">Ready to eat together at the dining table!</p>
            <button type="button" className="ep-button ep-primary mt-4" onClick={onDone}>
              🍽️ Sit down &amp; eat together
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
