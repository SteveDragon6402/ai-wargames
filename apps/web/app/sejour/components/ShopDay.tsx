"use client";

import { useEffect, useRef, useState } from "react";
import { STAPLES, ITEM_BY_ID, itemIcon } from "@/app/epicerie/data/items";
import { Scene } from "@/app/epicerie/components/Scene";
import { Composer } from "@/app/epicerie/components/Composer";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { formatEuros, linesTotal, mergeLines, pay, sumCoins, type Line, type Turn } from "@/app/epicerie/lib/shop";
import type { GestureId } from "@/app/epicerie/lib/gerard";
import { looksFrench } from "@/app/epicerie/lib/french";
import { hear, stopHearing } from "../lib/voice";
import { Wait } from "./Wait";
import type { Recipe } from "../lib/ladder";

function asksToPay(line: string): boolean {
  return /ça fait|ca fait|\beuros?\b|l'addition|à payer|a payer/i.test(line);
}

interface ShopDayProps {
  address: "monsieur" | "madame" | "unknown";
  recipe: Recipe;
  purse: number[];
  onDone: (turns: Turn[], basket: Line[], purse: number[]) => void;
}

interface Reply {
  line?: string;
  audio?: string;
  expression?: Turn["expression"];
  gesture?: string;
  counter?: Line[];
  till?: number | null;
  dismissed?: boolean;
  error?: string;
}

export function ShopDay({ address, recipe, purse: initialPurse, onDone }: ShopDayProps) {
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

  const errand = `You have never met this customer. Your notebook is empty. They are buying for Madame Rousseau: ${recipe.lines
    .map((line) => `${line.qty} × ${ITEM_BY_ID[line.itemId]?.fr ?? line.itemId} (id ${line.itemId})`)
    .join(", ")}. Butter, oil and bay are on the crate and you will sell them.`;

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
      if (!response.ok && !reply.error) reply.error = "Gérard didn't answer.";
    } catch {
      reply = { error: "No connection." };
    }
    setBusy(false);
    if (reply.error || !reply.line) {
      setError(reply.error ?? "Gérard didn't answer.");
      return;
    }
    const spoken: Turn = { role: "gerard", text: reply.line, expression: reply.expression ?? "neutral", audio: reply.audio, action: reply.gesture };
    setExpression(spoken.expression ?? "neutral");
    const counterNext = Array.isArray(reply.counter) ? reply.counter : snapshot.counter;
    const spokenTill = typeof reply.till === "number" ? reply.till : typeof reply.till === "string" && reply.till.trim() ? Number(reply.till) : Number.NaN;
    const nextTill = Number.isFinite(spokenTill) ? Math.round(spokenTill) : counterNext.length && asksToPay(reply.line ?? "") ? linesTotal(counterNext) : null;
    setCounter(counterNext);
    setTill(nextTill);
    setTranscript([...history, turn, spoken]);
    if (alive.current && looksFrench(reply.audio || reply.line)) {
      const problem = await hear("gerard", reply.audio || reply.line);
      if (alive.current && problem) setError(problem);
    }
  }

  function say(said: string, gesture: GestureId | null) {
    if (busy) return;
    void ask({ role: "you", text: said.trim(), pointed: pointed ?? undefined, gesture: gesture ?? undefined });
    setPointed(null);
  }

  function handOver(coins: number[]): boolean {
    const result = pay(purse, coins, till);
    if (!result.ok) {
      if (result.reason === "short" && till !== null) {
        void ask(
          { role: "event", text: `You put down ${formatEuros(result.paid)}. It is not enough, and he pushes the money back.` },
          { counter, till, basket, purse, transcript },
        );
      }
      return true;
    }
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
        text: `You hand over ${formatEuros(result.paid)}. ${change ? `He gives you ${formatEuros(change)} change.` : "Exact money."} The shopping goes into the bag.`,
      },
      next,
    );
    return true;
  }

  const last = [...transcript].reverse().find((turn) => turn.role === "gerard");

  return (
    <section aria-label="Gérard's shop" data-voice="gerard">
      <div className={shelves ? "block" : "hidden md:block"}>
        <Scene counter={counter} rungUp={till !== null} bagCount={basket.reduce((sum, line) => sum + line.qty, 0)} pointed={pointed} expression={expression ?? "neutral"} talking={busy} onPoint={setPointed} />
      </div>
      <div className="sj-sheet mt-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="ep-display text-[26px]">Gérard</h2>
            <p className="sj-line">{last?.text ?? "The bell over the door rings."}</p>
            {busy && transcript.at(-1) && transcript.at(-1)?.role !== "gerard" ? <p className="sj-you mt-1">You: {transcript.at(-1)?.text}</p> : null}
            {busy ? <Wait>He's thinking.</Wait> : null}
            {last?.action ? <p className="sj-you">{last.action}</p> : null}
            {error ? <p className="sj-error">{error}</p> : null}
            {till !== null ? (
              <div ref={payRef} className="mt-3">
                <PaymentTray till={till} purse={purse} busy={busy} onHandOver={handOver} title="Tap a coin, then hand it over" />
              </div>
            ) : null}
          </div>
          <aside className="max-w-xs rounded-lg bg-white/60 p-3" aria-label="Her list">
            <p className="text-[13px] uppercase tracking-wide">Her list</p>
            <ul className="mt-1 text-[15px]">
              {recipe.note.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button type="button" className="ep-button mt-3" onClick={() => onDone(transcript, basket, purse)}>
              Head home
            </button>
          </aside>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[14px]">On the crate</p>
          <div className="flex gap-2">
            {STAPLES.map((item) => (
              <button key={item.id} type="button" className="ep-button" aria-pressed={pointed === item.id} aria-label={`Point at ${item.en}`} onClick={() => setPointed(item.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemIcon(item.id)} alt="" width={36} height={36} />
                <span className="mt-1 block text-[12px]">{item.en}</span>
              </button>
            ))}
          </div>
        </div>
        {till === null ? (
          <div className="mt-3 rounded-xl bg-[var(--ep-walnut)] p-3">
            <Purse purse={purse} />
          </div>
        ) : null}
        <Composer pointed={pointed} busy={busy} disabled={false} text={text} onText={setText} onClearPoint={() => setPointed(null)} onOpenShelves={() => setShelves(true)} onSend={say} />
      </div>
    </section>
  );
}
