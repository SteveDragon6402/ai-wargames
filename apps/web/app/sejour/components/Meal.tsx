"use client";

import { useRef, useState } from "react";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { formatEuros, pay, sumCoins } from "@/app/epicerie/lib/shop";
import { dishById, type Restaurant } from "../data/restaurants";
import type { TalkReply, TalkTurn } from "../lib/voice";
import { Conversation, type PaymentEvent } from "./Conversation";

interface MealProps {
  place: Restaurant;
  purse: number[];
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  listening?: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  onPhrase?: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: (turns: TalkTurn[], purse: number[]) => void;
}

export function Meal({ place, purse: initialPurse, memory, notes = [], onNotes, listening = false, knownIds = [], onMeet, onPhrase, onDone }: MealProps) {
  const [stage, setStage] = useState<"ordering" | "eating" | "bill_and_pay">("ordering");
  const [menuOpen, setMenuOpen] = useState(true);
  const [pointed, setPointed] = useState<string | null>(null);
  const [served, setServed] = useState<string[]>([]);
  const [eaten, setEaten] = useState<Record<string, number>>({});
  const [billRequested, setBillRequested] = useState(false);
  const [turnsWhenWaiterCalled, setTurnsWhenWaiterCalled] = useState(0);
  const [paidCents, setPaidCents] = useState(0);
  const [purse, setPurse] = useState(initialPurse);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [paidNote, setPaidNote] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [biteNote, setBiteNote] = useState("");
  const [paymentEvent, setPaymentEvent] = useState<PaymentEvent | null>(null);
  const payTrayRef = useRef<HTMLDivElement>(null);

  const dish = pointed ? dishById(place.id, pointed) : null;
  const total = served.reduce((sum, id) => sum + (dishById(place.id, id)?.price ?? 0), 0);
  const remainingDue = Math.max(0, total - paidCents);
  const paid = total > 0 && remainingDue === 0;
  const totalBitesTaken = Object.values(eaten).reduce((sum, n) => sum + n, 0);
  const hasEatenEnough = served.length > 0 && totalBitesTaken >= Math.min(3, served.length * 3);
  const postEatPlayerTurns = turns.slice(turnsWhenWaiterCalled).filter((t) => t.who === "you").length;
  const showPayTray = stage === "bill_and_pay" && (billRequested || postEatPlayerTurns >= 1) && total > 0 && remainingDue > 0;

  function onReply(reply: TalkReply, history: TalkTurn[]) {
    setTurns(history);
    if (reply.phrases.length) onPhrase?.(reply.phrases, place.waiter);
    if (reply.billed) {
      setBillRequested(true);
    }
    if (reply.served.length) {
      const valid = reply.served.filter((id) => dishById(place.id, id));
      if (valid.length) {
        setServed((current) => [...current, ...valid]);
        setMenuOpen(false);
        setStage((curr) => (curr === "ordering" ? "eating" : curr));
      }
    }
  }

  function eatOrSip(dishId: string) {
    const item = dishById(place.id, dishId);
    if (!item) return;
    const count = (eaten[dishId] ?? 0) + 1;
    setEaten((prev) => ({ ...prev, [dishId]: count }));
    if (stage === "ordering") setStage("eating");
    setBiteNote(
      item.kind === "drink"
        ? `Vous buvez une gorgée de ${item.fr} — très bon !`
        : `Vous goûtez ${item.fr} — délicieux !`,
    );
  }

  function callWaiterBack() {
    if (!hasEatenEnough) return;
    setStage("bill_and_pay");
    setTurnsWhenWaiterCalled(turns.length);
    setPaymentEvent({
      id: Date.now(),
      shown: "✋ Monsieur, s'il vous plaît ! (Called waiter back to the table)",
      prompt: `[The guest has finished eating (${served.map((id) => dishById(place.id, id)?.fr ?? id).join(", ")}) and waves you back over to the table ("Monsieur, s'il vous plaît !"). Come back to the table, ask if everything went well with the meal ("Tout s'est bien passé ? Ça vous a plu ?"), and invite them to tell you how it was and ask for l'addition ("L'addition, s'il vous plaît")!]`,
      updatedContext: buildContext(paidCents, "Stage: bill_and_pay. Customer finished eating and just called you back to the table."),
    });
  }

  function buildContext(nextPaidCents: number, extraNote = ""): string {
    const rem = Math.max(0, total - nextPaidCents);
    const isPaid = total > 0 && rem === 0;
    return `${place.name}. Restaurant stage: ${stage}. ${dish ? `They are pointing at ${dish.fr} (${dish.id}).` : "They are not pointing."} Already brought to table: ${
      served.map((id) => dishById(place.id, id)?.fr ?? id).join(", ") || "nothing"
    }. Eaten so far: ${Object.keys(eaten).join(", ") || "not yet"}. Total bill: ${formatEuros(total)}. Amount paid so far: ${formatEuros(
      nextPaidCents,
    )}. Remaining due: ${formatEuros(rem)}. PAID: ${
      isPaid
        ? `YES (bill paid in full: ${formatEuros(total)})`
        : `NO (still owes ${formatEuros(rem)} — do NOT accept verbal claims of payment and do NOT let them leave with only a partial payment!)`
    }.${
      stage === "ordering"
        ? " Take their order in French, call `served` with the dish IDs when they order, and wish them Bon appétit before stepping away while they eat."
        : stage === "bill_and_pay"
          ? " You have returned to their table after they ate. Ask how the meal was, and when they ask for the bill (l'addition) or say they are ready to pay, call `bill` and tell them the total in French."
          : ""
    }${extraNote ? ` ${extraNote}` : ""}`;
  }

  function handOver(coins: number[]): boolean {
    if (remainingDue <= 0) return false;
    const offered = sumCoins(coins);
    const result = pay(purse, coins, remainingDue);
    if (!result.ok) {
      if (result.reason === "short") {
        const missing = remainingDue - offered;
        setShortNote(
          `❌ You put down ${eurosInWords(offered)}, which is not enough! The bill due is ${eurosInWords(remainingDue)} (short by ${eurosInWords(missing)}).`,
        );
        setPaidNote("");
        setPaymentEvent({
          id: Date.now(),
          shown: `[Put down ${eurosInWords(offered)} — short of ${eurosInWords(remainingDue)}]`,
          prompt: `[The customer put ${formatEuros(offered)} on the bill tray, which is SHORT of the ${formatEuros(
            remainingDue,
          )} addition (missing ${formatEuros(missing)}). Push the ${formatEuros(offered)} back, call bill, and tell them in French how much they put down (${formatEuros(
            offered,
          )}) and that l'addition is ${formatEuros(remainingDue)} so ${formatEuros(missing)} is still missing!]`,
          updatedContext: buildContext(paidCents, `Customer just tried to pay only ${formatEuros(offered)} on a ${formatEuros(remainingDue)} bill.`),
        });
        return true;
      }
      return false;
    }
    const nextPaid = total;
    setPurse(result.purse);
    setPaidCents(nextPaid);
    setShortNote("");
    const back = result.change.reduce((sum, coin) => sum + coin, 0);
    setPaidNote(
      `✅ The bill was ${eurosInWords(remainingDue)}. You handed over ${eurosInWords(result.paid)}${back ? ` and got ${formatEuros(back)} back` : ""}.`,
    );
    setPaymentEvent({
      id: Date.now(),
      shown: `[Handed over ${eurosInWords(result.paid)}${back ? ` · received ${formatEuros(back)} change` : ""}]`,
      prompt: `[The customer handed over ${formatEuros(result.paid)} to pay the ${formatEuros(remainingDue)} addition.${
        back ? ` You gave them ${formatEuros(back)} in change.` : " Exact change."
      } The bill of ${formatEuros(total)} is now PAID IN FULL. Thank them in French, mention the change if any, and wish them bonne journée!]`,
      updatedContext: buildContext(nextPaid),
    });
    return true;
  }

  return (
    <section aria-label={place.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={place.scene} alt={place.room} className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">
              {place.tier === "formal" ? "Restaurant gastronomique · Vous only" : "Bistro décontracté"}
            </p>
            <h2 className="ep-display text-[28px]">{place.name}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" className="ep-button" onClick={() => setMenuOpen((prev) => !prev)}>
              📖 {menuOpen ? "Close La Carte" : "Open La Carte (Menu)"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-[15px]">{place.room}</p>

        {/* Menu Card Pop-Up */}
        {menuOpen ? (
          <div
            role="dialog"
            aria-label={`Menu for ${place.name}`}
            className="mt-3 rounded-xl border-2 border-amber-900/30 bg-[#fbf6ec] p-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-amber-900/20 pb-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--ep-ink-soft)]">La Carte du Jour</p>
                <h3 className="ep-display text-[24px]">{place.name}</h3>
              </div>
              <button type="button" className="ep-button text-[13px]" onClick={() => setMenuOpen(false)}>
                Put menu down
              </button>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(["food", "drink"] as const).map((kind) => (
                <div key={kind}>
                  <h4 className="text-[13px] font-semibold uppercase tracking-wide text-amber-950">
                    {kind === "food" ? "Plats & Desserts" : "Boissons"}
                  </h4>
                  <ul className="mt-1.5 space-y-1.5">
                    {place.menu
                      .filter((item) => item.kind === kind)
                      .map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-pressed={pointed === item.id}
                            onClick={() => setPointed(item.id)}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                              pointed === item.id
                                ? "border-[var(--ep-ink)] bg-amber-200/70"
                                : "border-black/10 bg-white/80 hover:bg-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-xl">{item.icon}</span>
                              <span>
                                <span className="block text-[14px] font-semibold">{item.fr}</span>
                                <span className="block text-[12px] text-[var(--ep-ink-soft)]">{item.en}</span>
                              </span>
                            </span>
                            <span className="text-[14px] font-medium">
                              {item.price === 0 ? "Gratuit" : eurosInWords(item.price)}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] italic text-[var(--ep-ink-soft)]">
              {dish
                ? `Pointing at ${dish.fr} (${dish.en}). Order in French!`
                : `Tap a line on the menu to point at it, then order in French.`}
            </p>
          </div>
        ) : null}

        {/* 3-stage Restaurant Stepper */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-900/20 bg-amber-50/70 px-3 py-2 text-[13px]">
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${stage === "ordering" ? "bg-amber-900 text-white" : "bg-emerald-100 text-emerald-900"}`}>
            1. Commander (Order with {place.waiter})
          </span>
          <span>→</span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${stage === "eating" ? "bg-amber-900 text-white" : stage === "bill_and_pay" ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-600"}`}>
            2. Déguster (Eat your meal)
          </span>
          <span>→</span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${stage === "bill_and_pay" ? "bg-amber-900 text-white" : "bg-stone-200 text-stone-600"}`}>
            3. L&apos;addition &amp; Payer (Call waiter back &amp; pay)
          </span>
        </div>

        {/* Served dishes on the table — click to eat/drink */}
        {served.length > 0 ? (
          <div className="mt-3 rounded-xl border-2 border-amber-900/30 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-amber-950">
                🍽️ On your table — {stage === "eating" ? `${place.waiter} stepped away while you eat. Tap your dish to eat!` : "Click to eat or drink"}
              </p>
              {stage === "eating" ? (
                <button
                  type="button"
                  disabled={!hasEatenEnough}
                  onClick={callWaiterBack}
                  className={`ep-button ${hasEatenEnough ? "ep-primary ring-2 ring-emerald-600" : "opacity-60"}`}
                >
                  {hasEatenEnough
                    ? `✋ Call ${place.waiter} back (« Monsieur, s'il vous plaît ! »)`
                    : `🍴 Eat your meal first (${totalBitesTaken}/3 bites)`}
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {served.map((id, idx) => {
                const item = dishById(place.id, id);
                if (!item) return null;
                const bites = eaten[id] ?? 0;
                const done = bites >= 3;
                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    onClick={() => eatOrSip(id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[14px] transition ${
                      done ? "border-stone-300 bg-stone-100 opacity-75" : "border-amber-800/40 bg-amber-50 hover:scale-105"
                    }`}
                  >
                    <span className="text-2xl">{done ? "🍽️" : item.icon}</span>
                    <span className="text-left">
                      <span className="block font-semibold">{item.fr}</span>
                      <span className="block text-[11px] text-[var(--ep-ink-soft)]">
                        {done ? "Finished!" : `${3 - bites} bites left — tap to taste`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {biteNote ? <p className="mt-2 text-[14px] font-medium text-amber-950">{biteNote}</p> : null}
          </div>
        ) : null}

        {shortNote ? (
          <div className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-100 p-3 text-[15px] font-semibold text-amber-950">
            {shortNote}
          </div>
        ) : null}

        {paidNote ? (
          <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-[15px] font-medium">
            {paidNote}
          </div>
        ) : null}

        {showPayTray ? (
          <div ref={payTrayRef} className="mt-3">
            <PaymentTray
              title={`L'addition est sur la table (${eurosInWords(remainingDue)} due)`}
              till={remainingDue}
              purse={purse}
              busy={false}
              onHandOver={handOver}
            />
          </div>
        ) : !paid ? (
          <div className="mt-3 rounded-xl bg-[var(--ep-walnut)] p-3">
            <Purse purse={purse} />
          </div>
        ) : null}

        <div className="mt-4">
          <Conversation
            title={place.waiter}
            portrait={place.portrait}
            character={place.voice}
            role="waiter"
            who={place.id}
            knownIds={knownIds}
            onMeet={onMeet}
            speakFirst
            listening={listening}
            memory={memory}
            notes={notes}
            onNotes={onNotes}
            context={buildContext(paidCents)}
            paymentEvent={paymentEvent}
            canEnd={paid}
            blockedEndReason={
              stage === "ordering"
                ? `Step 1: Order a dish or drink from La Carte in French with ${place.waiter}.`
                : stage === "eating"
                  ? hasEatenEnough
                    ? `Step 2 complete! Press "✋ Call ${place.waiter} back" above so you can talk to him and ask for l'addition.`
                    : `Step 2: Eat your meal on the table above (${totalBitesTaken}/3 bites), then call ${place.waiter} back for the bill.`
                  : !showPayTray
                    ? `Step 3: Tell ${place.waiter} how the meal was and ask for the bill in French (« L'addition, s'il vous plaît »)!`
                    : `Your bill is ${eurosInWords(remainingDue)}. Tap your coins/notes in the Payment Tray above and press "Hand it over" to pay the full ${eurosInWords(remainingDue)} before leaving!`
            }
            blockedActionLabel={showPayTray ? "💶 Scroll to Bill Tray ↑" : undefined}
            onBlockedAction={
              showPayTray ? () => payTrayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined
            }
            endLabel="🍽️ Leave the restaurant →"
            actionPrompt="✅ L'addition est réglée ! Press here to leave the restaurant:"
            onReply={onReply}
            onEnd={(history) => onDone(history.length ? history : turns, purse)}
          />
        </div>
      </div>
    </section>
  );
}
