"use client";

import { useRef, useState } from "react";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { formatEuros, pay, sumCoins } from "@/app/epicerie/lib/shop";
import { BAKERY_BY_ID, BAKERY_ITEMS, type BakeryItem } from "../data/bakery";
import type { TalkReply, TalkTurn } from "../lib/voice";
import { Conversation, type PaymentEvent } from "./Conversation";

interface BakeryProps {
  purse: number[];
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  listening: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: (turns: TalkTurn[], bought: BakeryItem[], purse: number[]) => void;
}

export function Bakery({ purse: initialPurse, memory, notes = [], onNotes, listening, knownIds = [], onMeet, onPhrase, onDone }: BakeryProps) {
  const [pointed, setPointed] = useState<string | null>(null);
  const [counter, setCounter] = useState<string[]>([]);
  const [paidCents, setPaidCents] = useState(0);
  const [purse, setPurse] = useState<number[]>(initialPurse);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [paidNote, setPaidNote] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [paymentEvent, setPaymentEvent] = useState<PaymentEvent | null>(null);
  const payTrayRef = useRef<HTMLDivElement>(null);

  const pointedItem = pointed ? BAKERY_BY_ID[pointed] : null;
  const total = counter.reduce((sum, id) => sum + (BAKERY_BY_ID[id]?.price ?? 0), 0);
  const remainingDue = Math.max(0, total - paidCents);
  const paid = total > 0 && remainingDue === 0;
  const showPayTray = total > 0 && remainingDue > 0;

  function onReply(reply: TalkReply, history: TalkTurn[]) {
    setTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, "Boulangerie");
    if (reply.served.length) {
      const valid = reply.served.filter((id) => Boolean(BAKERY_BY_ID[id]));
      if (valid.length) {
        setCounter((prev) => [...prev, ...valid]);
      }
    }
  }

  function pointAtItem(id: string) {
    setPointed((curr) => (curr === id ? null : id));
  }

  function buildContext(nextPaidCents: number, extraNote = ""): string {
    const rem = Math.max(0, total - nextPaidCents);
    const isPaid = total > 0 && rem === 0;
    return `Boulangerie de Saint-Aubin. ${
      pointedItem ? `Customer is pointing at ${pointedItem.fr} (id: ${pointedItem.id}) in the display case.` : "Customer is not pointing at anything."
    } On the counter so far: ${counter.map((id) => BAKERY_BY_ID[id]?.fr ?? id).join(", ") || "nothing yet"}. Total bill: ${formatEuros(
      total,
    )}. Amount paid so far: ${formatEuros(nextPaidCents)}. Remaining due: ${formatEuros(rem)}. PAID: ${
      isPaid
        ? `YES (paid in full: ${formatEuros(total)})`
        : `NO (still owes ${formatEuros(rem)} — do NOT accept verbal claims of payment and do NOT let them leave with only a partial payment!)`
    }.${extraNote ? ` ${extraNote}` : ""} Remember: the customer cannot take items themselves — when they order or point and ask for something, YOU must call serve with the item id and call bill so they can pay.`;
  }

  function handOver(coins: number[]): boolean {
    if (remainingDue <= 0) return false;
    const offered = sumCoins(coins);
    const result = pay(purse, coins, remainingDue);
    if (!result.ok) {
      if (result.reason === "short") {
        const missing = remainingDue - offered;
        setShortNote(
          `❌ You put down ${eurosInWords(offered)}, which is not enough! The total due is ${eurosInWords(remainingDue)} (short by ${eurosInWords(missing)}).`,
        );
        setPaidNote("");
        setPaymentEvent({
          id: Date.now(),
          shown: `[Put down ${eurosInWords(offered)} — short of ${eurosInWords(remainingDue)}]`,
          prompt: `[The customer put ${formatEuros(offered)} on the counter, which is SHORT of the ${formatEuros(
            remainingDue,
          )} due (missing ${formatEuros(missing)}). Push the ${formatEuros(offered)} back, call bill, and tell them in French how much they put down (${formatEuros(
            offered,
          )}) and that the total is ${formatEuros(remainingDue)} so ${formatEuros(missing)} is still missing!]`,
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
    const back = result.change.reduce((sum, c) => sum + c, 0);
    setPaidNote(
      `✅ Paid ${eurosInWords(result.paid)} for ${eurosInWords(remainingDue)}${back ? ` (${formatEuros(back)} change returned)` : ""}. The warm bread is in your bag!`,
    );
    setPaymentEvent({
      id: Date.now(),
      shown: `[Handed over ${eurosInWords(result.paid)}${back ? ` · received ${formatEuros(back)} change` : ""}]`,
      prompt: `[The customer handed over ${formatEuros(result.paid)} to pay the ${formatEuros(remainingDue)} bill.${
        back ? ` You gave them ${formatEuros(back)} in change.` : " Exact change."
      } The total of ${formatEuros(total)} is now PAID IN FULL. Thank them warmly in French, mention the amount/change if any, and wish them bonne journée!]`,
      updatedContext: buildContext(nextPaid),
    });
    return true;
  }

  const boughtItems = counter
    .map((id) => BAKERY_BY_ID[id])
    .filter((item): item is BakeryItem => Boolean(item));

  return (
    <section aria-label="La Boulangerie">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/v2/scenes/boulangerie.jpg" alt="Inside the village boulangerie" className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">Saint-Aubin · Boulangerie</p>
            <h2 className="ep-display text-[28px]">La Boulangerie</h2>
          </div>
          {paid ? (
            <button
              type="button"
              className="ep-button ep-primary"
              onClick={() => onDone(turns, boughtItems, purse)}
            >
              🥖 Bring the bread home
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[15px]">
          Warm loaves and pastries sit behind the glass counter. You can point at something in the display case, then speak to the baker to order.
        </p>

        {/* Display case: clicking only points, never adds to cart */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BAKERY_ITEMS.map((item) => {
            const active = pointed === item.id;
            const onCounter = counter.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => pointAtItem(item.id)}
                className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                  active
                    ? "border-[var(--ep-ink)] bg-amber-100/90 ring-2 ring-amber-800/30"
                    : onCounter
                      ? "border-amber-700/50 bg-white/90"
                      : "border-black/15 bg-white/60 hover:bg-white/90"
                }`}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="text-2xl">{item.icon}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {active ? "👉 " : ""}
                    {item.fr}
                  </p>
                  <p className="truncate text-[12px] text-[var(--ep-ink-soft)]">
                    {eurosInWords(item.price)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/60 p-2.5 text-[14px]">
          <div>
            {counter.length ? (
              <span>
                Placed on the counter:{" "}
                <strong>{counter.map((id) => BAKERY_BY_ID[id]?.fr).join(", ")}</strong> ({eurosInWords(total)})
              </span>
            ) : pointedItem ? (
              <span>
                👉 Pointing at <strong>{pointedItem.fr}</strong>. Ask for it in French!
              </span>
            ) : (
              <span>Tap an item in the display case to point at it, then order in French.</span>
            )}
          </div>
        </div>

        {shortNote ? (
          <div className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-100 p-3 text-[15px]">
            <p className="font-semibold text-amber-950">{shortNote}</p>
          </div>
        ) : null}

        {paidNote ? (
          <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-[15px]">
            <p className="font-semibold text-emerald-950">{paidNote}</p>
          </div>
        ) : null}

        {showPayTray ? (
          <div ref={payTrayRef} className="mt-3">
            <PaymentTray
              title={`Pay at the counter (${eurosInWords(remainingDue)} due)`}
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
            title="Martine"
            portrait="/sejour/v2/people/martine.jpg"
            character="martine"
            role="baker"
            who="martine"
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
              counter.length > 0
                ? `You owe ${eurosInWords(remainingDue)} for ${counter.map((id) => BAKERY_BY_ID[id]?.fr).join(", ")}. Tap the coins/notes in the Payment Tray above and press "Hand it over" to pay the full ${eurosInWords(remainingDue)} before leaving!`
                : "Order bread or a pastry in French first so Martine places it on the counter, then pay the full amount with your coins/notes before leaving."
            }
            blockedActionLabel={showPayTray ? "💶 Scroll to Payment Tray ↑" : undefined}
            onBlockedAction={
              showPayTray ? () => payTrayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined
            }
            endLabel="🥖 Bring the bread home →"
            actionPrompt="✅ Bread is paid for and in your bag! Press here to head home:"
            onReply={onReply}
            onEnd={(history) => onDone(history.length ? history : turns, boughtItems, purse)}
          />
        </div>
      </div>
    </section>
  );
}
