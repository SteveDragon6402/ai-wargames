"use client";

import { useRef, useState } from "react";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { formatEuros, pay, sumCoins } from "@/app/epicerie/lib/shop";
import { PHARMACIE_BY_ID } from "../data/pharmacie";
import type { TalkReply, TalkTurn } from "../lib/voice";
import { Conversation, type PaymentEvent } from "./Conversation";

interface PharmacieProps {
  purse: number[];
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  hostMemory?: string;
  hostNotes?: string[];
  onHostNotes?: (notes: string[]) => void;
  listening: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: (turns: TalkTurn[], purse: number[]) => void;
}

export function Pharmacie({ purse: initialPurse, memory, notes = [], onNotes, hostMemory = "", hostNotes = [], onHostNotes, listening, knownIds = [], onMeet, onPhrase, onDone }: PharmacieProps) {
  const [step, setStep] = useState<"bedside" | "shop">("bedside");
  const [bedsideTurns, setBedsideTurns] = useState<TalkTurn[]>([]);
  const [shopTurns, setShopTurns] = useState<TalkTurn[]>([]);
  const [counter, setCounter] = useState<string[]>([]);
  const [paidCents, setPaidCents] = useState(0);
  const [purse, setPurse] = useState<number[]>(initialPurse);
  const [paidNote, setPaidNote] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [paymentEvent, setPaymentEvent] = useState<PaymentEvent | null>(null);
  const payTrayRef = useRef<HTMLDivElement>(null);

  const total = counter.reduce((sum, id) => sum + (PHARMACIE_BY_ID[id]?.price ?? 0), 0);
  const remainingDue = Math.max(0, total - paidCents);
  const paid = total > 0 && remainingDue === 0;
  const showPayTray = total > 0 && remainingDue > 0;

  function onShopReply(reply: TalkReply, history: TalkTurn[]) {
    setShopTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, "Pharmacie");
    if (reply.served.length) {
      const valid = reply.served.filter((id) => Boolean(PHARMACIE_BY_ID[id]));
      if (valid.length) setCounter((prev) => [...new Set([...prev, ...valid])]);
    }
  }

  function buildContext(nextPaidCents: number, extraNote = ""): string {
    const rem = Math.max(0, total - nextPaidCents);
    const isPaid = total > 0 && rem === 0;
    return `Pharmacie de Saint-Aubin. All medicines are behind the counter; the guest cannot point at anything and must tell you the symptoms in words (e.g. cough / toux, sore throat / mal à la gorge, fever / fièvre). Once they describe the symptoms or ask for medicine, call serve with the matching medicine id(s) and call bill. On counter so far: ${
      counter.map((id) => PHARMACIE_BY_ID[id]?.fr ?? id).join(", ") || "nothing yet"
    }. Total bill: ${formatEuros(total)}. Amount paid so far: ${formatEuros(nextPaidCents)}. Remaining due: ${formatEuros(rem)}. PAID: ${
      isPaid
        ? `YES (paid in full: ${formatEuros(total)})`
        : `NO (still owes ${formatEuros(rem)} — do NOT accept verbal claims of payment and do NOT let them leave with only a partial payment!)`
    }.${extraNote ? ` ${extraNote}` : ""}`;
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
      `✅ Paid ${eurosInWords(result.paid)} for ${eurosInWords(remainingDue)}${back ? ` (${formatEuros(back)} change returned)` : ""}. Time to bring the medicine back to the house!`,
    );
    setPaymentEvent({
      id: Date.now(),
      shown: `[Handed over ${eurosInWords(result.paid)}${back ? ` · received ${formatEuros(back)} change` : ""}]`,
      prompt: `[The customer handed over ${formatEuros(result.paid)} to pay the ${formatEuros(remainingDue)} total.${
        back ? ` You gave them ${formatEuros(back)} in change.` : " Exact change."
      } The total of ${formatEuros(total)} is now PAID IN FULL. Thank them in French, mention the change if any, and wish Madame Rousseau a speedy recovery!]`,
      updatedContext: buildContext(nextPaid),
    });
    return true;
  }

  const hostLabel = knownIds.includes("rousseau") ? "Madame Rousseau" : "???";

  if (step === "bedside") {
    return (
      <section aria-label="Unwell at home">
        <div className="sj-sheet rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-widest text-amber-900">
                La Maison · Morning
              </p>
              <h2 className="ep-display text-[28px]">Upstairs: {hostLabel} has a fever</h2>
            </div>
            <button type="button" className="ep-button ep-primary" onClick={() => setStep("shop")}>
              ➕ Go to the Pharmacie
            </button>
          </div>
          <p className="mt-1 text-[15px]">
            {hostLabel} is resting in bed with a blanket and herbal tea. Listen to her symptoms before heading to the village pharmacie.
          </p>
          <div className="mt-3">
            <Conversation
              key="sick-bedside"
              title="Madame Rousseau"
              portrait="/sejour/v2/people/rousseau-sick.jpg"
              character="rousseau"
              role="host"
              who="rousseau"
              knownIds={knownIds}
              onMeet={onMeet}
              speakFirst
              listening={listening}
              memory={hostMemory}
              notes={hostNotes}
              onNotes={onHostNotes}
              context="SICK EVENT. You are in bed with a cold: a sore throat, j'ai mal à la gorge, and a cough, je tousse. You need un sirop pour la toux and des pastilles pour la gorge from the pharmacie. You can hand them the cash."
              endLabel="Head to the Pharmacie"
              onReply={(reply, history) => {
                setBedsideTurns(history);
                if (reply.phrases.length) onPhrase(reply.phrases, hostLabel);
              }}
              onEnd={(history) => {
                setBedsideTurns(history);
                setStep("shop");
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="La Pharmacie">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/v2/scenes/pharmacie.jpg" alt="Inside the village pharmacie" className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">Saint-Aubin · La Pharmacie</p>
            <h2 className="ep-display text-[28px]">La Pharmacie</h2>
          </div>
          {paid ? (
            <button
              type="button"
              className="ep-button ep-primary"
              onClick={() => onDone([...bedsideTurns, ...shopTurns], purse)}
            >
              🍵 Bring medicine home
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[15px]">
          All medicines are kept behind the counter. Talk to the pharmacist and describe the symptoms in French so he can give you the right medicine.
        </p>

        {/* Only show items that the pharmacist has actually placed on the counter */}
        {counter.length > 0 ? (
          <div className="mt-3 rounded-xl border border-emerald-800/30 bg-white/85 p-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-emerald-950">
              Placed on the counter by the pharmacist ({eurosInWords(total)})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {counter.map((id) => {
                const item = PHARMACIE_BY_ID[id];
                if (!item) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-50/70 px-3 py-2 text-[14px]"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="font-semibold">{item.fr}</p>
                      <p className="text-[12px] text-[var(--ep-ink-soft)]">{eurosInWords(item.price)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {shortNote ? (
          <div className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-100 p-3 text-[15px] font-semibold text-amber-950">
            {shortNote}
          </div>
        ) : null}

        {paidNote ? (
          <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-50 p-3 text-[15px] font-semibold">
            {paidNote}
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
            title="Monsieur Moreau"
            portrait="/sejour/v2/people/pharmacien.jpg"
            character="pharmacien"
            role="pharmacist"
            who="pharmacien"
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
                ? `You owe ${eurosInWords(remainingDue)} for the medicine. Tap your coins/notes in the Payment Tray above and press "Hand it over" to pay the full ${eurosInWords(remainingDue)} before leaving!`
                : "Describe the symptoms in French (toux, mal à la gorge) so the pharmacist places the medicine on the counter, then pay with your coins/notes before leaving."
            }
            blockedActionLabel={showPayTray ? "💶 Scroll to Payment Tray ↑" : undefined}
            onBlockedAction={
              showPayTray ? () => payTrayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined
            }
            endLabel="🍵 Bring medicine home →"
            actionPrompt="✅ Medicine is paid for! Press here to bring it home:"
            onReply={onShopReply}
            onEnd={(history) => onDone([...bedsideTurns, ...(history.length ? history : shopTurns)], purse)}
          />
        </div>
      </div>
    </section>
  );
}
