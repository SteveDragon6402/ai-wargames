"use client";

import { useEffect, useRef, useState } from "react";
import { STAPLES, itemIcon } from "@/app/epicerie/data/items";
import { Scene } from "@/app/epicerie/components/Scene";
import { Composer } from "@/app/epicerie/components/Composer";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { formatEuros, linesTotal, mergeLines, pay, sumCoins, type Line, type Turn } from "@/app/epicerie/lib/shop";
import type { GestureId } from "@/app/epicerie/lib/gerard";
import { hear, stopHearing } from "../lib/voice";
import { lineMentionsName } from "./Conversation";
import { Wait } from "./Wait";
import type { Recipe } from "../world/recipes";

function asksToPay(line: string): boolean {
  return /ça fait|ca fait|\beuros?\b|l'addition|à payer|a payer/i.test(line);
}

interface ShopDayProps {
  address: "monsieur" | "madame" | "unknown";
  recipe: Recipe;
  purse: number[];
  listening?: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  onDone: (turns: Turn[], basket: Line[], purse: number[]) => void;
}

interface Reply {
  line?: string;
  audio?: string;
  expression?: Turn["expression"];
  gesture?: string;
  counter?: Line[];
  till?: number | string | null;
  dismissed?: boolean;
  error?: string;
}

export function ShopDay({
  address,
  recipe,
  purse: initialPurse,
  listening = false,
  knownIds = [],
  onMeet,
  onDone,
}: ShopDayProps) {
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [counter, setCounter] = useState<Line[]>([]);
  const [till, setTill] = useState<number | null>(null);
  const [basket, setBasket] = useState<Line[]>([]);
  const [purse, setPurse] = useState(initialPurse);
  const [pointed, setPointed] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [expression, setExpression] = useState<Turn["expression"]>("neutral");
  const alive = useRef(true);
  const payRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopHearing();
    };
  }, []);

  useEffect(() => {
    if (till !== null) payRef.current?.scrollIntoView({ block: "nearest" });
  }, [till]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shelves, setShelves] = useState(false);
  const [payWarning, setPayWarning] = useState<string | null>(null);

  const effectiveTill = till;
  const canLeaveShop = basket.length > 0 && counter.length === 0;

  const errand = `They are staying with Madame Rousseau. They have not ordered anything. A greeting is not an order: say your name if you have not met, and wait for them to name one item or point at it. Do not set the counter, do not say a price, and do not ask them to pay until then. Butter, oil and bay are on the crate if they ask.`;

  const gerardKnown =
    knownIds.includes("gerard") ||
    transcript.some((t) => t.role === "gerard" && lineMentionsName(t.text, "Gérard"));

  async function ask(turn: Turn, snapshot = { counter, till, basket, purse, transcript }) {
    stopHearing();
    setBusy(true);
    setError(null);
    const history = snapshot.transcript;
    setTranscript([...history, turn]);
    let reply: Reply = {};
    try {
      const response = await fetch("/api/epicerie/shopkeeper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turn,
          history,
          counter: snapshot.counter,
          till: snapshot.till,
          basket: snapshot.basket,
          notes: [],
          visits: 0,
          address,
          errand,
        }),
      });
      reply = (await response.json()) as Reply;
      if (!response.ok && !reply.error) reply.error = "He didn't answer.";
    } catch {
      reply = { error: "No connection." };
    }
    setBusy(false);
    if (reply.error || !reply.line) {
      setError(reply.error ?? "He didn't answer.");
      return;
    }
    if (lineMentionsName(reply.line, "Gérard")) {
      onMeet?.("gerard");
    }
    const spoken: Turn = {
      role: "gerard",
      text: reply.line,
      expression: reply.expression ?? "neutral",
      audio: reply.audio,
      action: reply.gesture,
    };
    setExpression(spoken.expression ?? "neutral");
    const counterNext = Array.isArray(reply.counter) ? reply.counter : snapshot.counter;
    const spokenTill =
      typeof reply.till === "number"
        ? reply.till
        : typeof reply.till === "string" && reply.till.trim()
          ? Number(reply.till)
          : Number.NaN;
    const nextTill = Number.isFinite(spokenTill)
      ? Math.round(spokenTill)
      : counterNext.length && asksToPay(reply.line ?? "")
        ? linesTotal(counterNext)
        : null;
    setCounter(counterNext);
    setTill(nextTill);
    setTranscript([...history, turn, spoken]);
    if (alive.current && (reply.audio || reply.line)) {
      const problem = await hear("gerard", reply.audio || reply.line, "any");
      if (alive.current && problem) setError(problem);
    }
  }

  function say(said: string, gesture: GestureId | null) {
    if (busy) return;
    const trimmed = said.trim();
    if (
      counter.length > 0 &&
      /\b(i paid|i've paid|already paid|here is the money|here's the money|c'est payé|j'ai payé|voilà l'argent|voici l'argent)\b/i.test(
        trimmed,
      )
    ) {
      setPayWarning(
        `Saying you paid in chat does not hand over money! Tap the coins/notes in the Payment Tray (${eurosInWords(effectiveTill ?? 0)}) and press "Hand over".`,
      );
      payRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (!canLeaveShop && /\b(leave|go home|head home|ready to go|au revoir|bonne journée|je pars)\b/i.test(trimmed)) {
      setPayWarning(
        counter.length > 0
          ? `You still have unpaid items on the counter (${eurosInWords(effectiveTill ?? 0)})! Pay with your coins/notes on the Payment Tray before leaving.`
          : "Ask Gérard for the items on your shopping list and pay at the counter before heading home!",
      );
    } else {
      setPayWarning(null);
    }
    void ask({ role: "you", text: trimmed, pointed: pointed ?? undefined, gesture: gesture ?? undefined });
    setPointed(null);
  }

  function handOver(coins: number[]): boolean {
    const due = effectiveTill;
    const result = pay(purse, coins, due);
    if (!result.ok) {
      if (result.reason === "short" && due !== null) {
        const missing = due - result.paid;
        setPayWarning(
          `You put down ${eurosInWords(result.paid)}, which is short! The total due is ${eurosInWords(due)} (missing ${eurosInWords(missing)}).`,
        );
        void ask(
          {
            role: "event",
            text: `You put down ${eurosInWords(result.paid)}. The total is ${eurosInWords(due)} (short by ${eurosInWords(missing)}). It is not enough, and he pushes the ${eurosInWords(result.paid)} back and tells you the price.`,
          },
          { counter, till: due, basket, purse, transcript },
        );
      }
      return true;
    }
    setPayWarning(null);
    const nextBasket = mergeLines(basket, counter);
    const next = { counter: [] as Line[], till: null, basket: nextBasket, purse: result.purse, transcript };
    setBasket(nextBasket);
    setPurse(result.purse);
    setCounter([]);
    setTill(null);
    const change = sumCoins(result.change);
    void ask(
      {
        role: "event",
        text: `You hand over ${eurosInWords(result.paid)}. ${change ? `He gives you ${formatEuros(change)} change.` : "Exact money."} The shopping goes into the bag.`,
      },
      next,
    );
    return true;
  }

  function tryLeaveShop() {
    if (!canLeaveShop) {
      setPayWarning(
        counter.length > 0
          ? `You cannot leave without paying! Tap your coins/notes in the Payment Tray (${eurosInWords(effectiveTill ?? 0)}) and press "Hand over".`
          : "Order at least one item from Gérard in French and pay at the counter before heading home.",
      );
      if (counter.length > 0) {
        payRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    onDone(transcript, basket, purse);
  }

  const last = [...transcript].reverse().find((turn) => turn.role === "gerard");

  return (
    <section aria-label="L'Épicerie" data-voice="gerard">
      <div className={shelves ? "block" : "hidden md:block"}>
        <Scene
          counter={counter}
          rungUp={till !== null}
          bagCount={basket.reduce((sum, line) => sum + line.qty, 0)}
          pointed={pointed}
          expression={expression ?? "neutral"}
          talking={busy}
          onPoint={setPointed}
        />
      </div>
      <div className="sj-sheet mt-3">
        <p className="mb-3 rounded-lg bg-white/60 px-3 py-2 text-[14px] text-[var(--ep-ink-soft)]">
          🧺 <strong>L&apos;Épicerie (Traditional Grocer):</strong> Click any item on the shelves or crate to point at it, then speak to the grocer in French so he puts it on the counter and rings you up.
        </p>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ep-display text-[26px]">{gerardKnown ? "Gérard" : "???"}</h2>
              {canLeaveShop ? (
                <button
                  type="button"
                  className="ep-button ep-primary text-[13px] shadow-sm ring-2 ring-amber-500/40"
                  onClick={tryLeaveShop}
                >
                  🧺 Bring groceries home &amp; cook →
                </button>
              ) : null}
              {last ? (
                <button
                  type="button"
                  className="ep-button text-[13px]"
                  onClick={() => void hear("gerard", last.audio || last.text, "any")}
                >
                  🔊 Hear again
                </button>
              ) : null}
            </div>
            <p className="sj-line">
              {last ? (listening ? "[listening mode — words hidden]" : last.text) : "The bell over the door rings."}
            </p>
            {busy && transcript.at(-1) && transcript.at(-1)?.role !== "gerard" ? (
              <p className="sj-you mt-1">You: {transcript.at(-1)?.text}</p>
            ) : null}
            {busy ? <Wait>He&apos;s thinking.</Wait> : null}
            {last?.action ? <p className="sj-you">{last.action}</p> : null}
            {error ? <p className="sj-error">{error}</p> : null}
            {payWarning ? (
              <div className="mt-2 rounded-xl border-2 border-amber-700 bg-amber-100/95 p-3 text-[14px] font-medium text-amber-950 ring-4 ring-amber-400/30">
                💶 {payWarning}
              </div>
            ) : null}
            {canLeaveShop ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-emerald-700 bg-emerald-50/95 p-3">
                <span className="text-[14px] font-semibold text-emerald-950">
                  ✅ Paid &amp; in your shopping bag! Ready to head home?
                </span>
                <button type="button" className="ep-button ep-primary" onClick={tryLeaveShop}>
                  🧺 Bring groceries home &amp; cook →
                </button>
              </div>
            ) : null}
            {effectiveTill !== null ? (
              <div ref={payRef} className="mt-3">
                <PaymentTray
                  till={effectiveTill}
                  purse={purse}
                  busy={busy}
                  onHandOver={handOver}
                  title={`Pay at the counter (${eurosInWords(effectiveTill)}) — tap coins/notes, then press Hand over`}
                />
              </div>
            ) : null}
          </div>
          <aside className="max-w-xs rounded-lg bg-white/60 p-3" aria-label="Her list">
            <p className="text-[13px] uppercase tracking-wide">Shopping list</p>
            <ul className="mt-1 text-[15px]">
              {recipe.note.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`ep-button mt-3 ${canLeaveShop ? "ep-primary" : "opacity-75"}`}
              onClick={tryLeaveShop}
            >
              {canLeaveShop ? "🧺 Head home →" : "🔒 Pay first to head home"}
            </button>
          </aside>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[14px]">On the crate (click to point)</p>
          <div className="flex flex-wrap gap-2">
            {STAPLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ep-button"
                aria-pressed={pointed === item.id}
                aria-label={`Point at ${item.en}`}
                onClick={() => setPointed(pointed === item.id ? null : item.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemIcon(item.id)} alt="" width={36} height={36} />
              </button>
            ))}
          </div>
        </div>
        {effectiveTill === null ? (
          <div className="mt-3 rounded-xl bg-[var(--ep-walnut)] p-3">
            <Purse purse={purse} />
          </div>
        ) : null}
        <Composer
          pointed={pointed}
          busy={busy}
          disabled={false}
          text={text}
          onText={setText}
          onClearPoint={() => setPointed(null)}
          onOpenShelves={() => setShelves(true)}
          onSend={say}
        />
      </div>
    </section>
  );
}
