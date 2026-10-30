"use client";

import { useState } from "react";
import { PaymentTray } from "@/app/epicerie/components/Money";
import { formatEuros, pay } from "@/app/epicerie/lib/shop";
import { dishById, type Restaurant } from "../data/restaurants";
import type { TalkReply, TalkTurn } from "../lib/voice";
import { Conversation } from "./Conversation";

const ROOM: Record<string, string> = {
  auberge: "/sejour/bistro.jpg",
  quai: "/sejour/quay.jpg",
  terrasse: "/sejour/terrace.jpg",
};

interface MealProps {
  place: Restaurant;
  purse: number[];
  memory: string;
  onDone: (turns: TalkTurn[], purse: number[]) => void;
}

export function Meal({ place, purse: initialPurse, memory, onDone }: MealProps) {
  const [pointed, setPointed] = useState<string | null>(null);
  const [served, setServed] = useState<string[]>([]);
  const [billed, setBilled] = useState(false);
  const [purse, setPurse] = useState(initialPurse);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [paidNote, setPaidNote] = useState("");
  const waiterVoice = place.waiter === "Joël" ? "joel" : place.waiter.toLowerCase();
  const dish = pointed ? dishById(place.id, pointed) : null;
  const total = served.reduce((sum, id) => sum + (dishById(place.id, id)?.price ?? 0), 0);

  function onReply(reply: TalkReply, history: TalkTurn[]) {
    setTurns(history);
    if (reply.served.length) {
      setServed((current) => [...current, ...reply.served.filter((id) => dishById(place.id, id))]);
    }
    if (reply.billed) setBilled(true);
  }

  function handOver(coins: number[]): boolean {
    const result = pay(purse, coins, total);
    if (!result.ok) return false;
    setPurse(result.purse);
    setBilled(false);
    const back = result.change.reduce((sum, coin) => sum + coin, 0);
    setPaidNote(
      `The bill was ${formatEuros(total)}. You handed over ${formatEuros(result.paid)}${back ? ` and got ${formatEuros(back)} back` : ""}.`,
    );
    setServed([]);
    return true;
  }

  return (
    <section aria-label={place.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ROOM[place.id] ?? "/sejour/bistro.jpg"} alt={place.room} className="sj-photo" />
      <div className="sj-sheet">
        <h2 className="ep-display text-[28px]">{place.name}</h2>
        <p className="text-[15px]">{place.room}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(["food", "drink"] as const).map((kind) => (
            <div key={kind}>
              <h3 className="text-[13px] uppercase tracking-wide">{kind === "food" ? "To eat" : "To drink"}</h3>
              <ul className="mt-1">
                {place.menu
                  .filter((item) => item.kind === kind)
                  .map((item) => (
                    <li key={item.id}>
                      <button type="button" className="ep-button mt-1 w-full" aria-pressed={pointed === item.id} onClick={() => setPointed(item.id)}>
                        {item.fr}
                        <span className="ml-2 text-[13px] text-[var(--ep-ink-soft)]">{item.en}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[14px]">{dish ? `Pointing at ${dish.en}.` : "Point at a dish, a glass, or just talk."}</p>
        {served.length ? <p className="mt-1 text-[14px]">On the table: {served.map((id) => dishById(place.id, id)?.en).join(", ")}</p> : null}
        {paidNote ? <p className="mt-1 text-[14px]">{paidNote}</p> : null}
        {billed ? <PaymentTray title="The bill is on the table" till={total} purse={purse} busy={false} onHandOver={handOver} /> : null}
        <div className="mt-4">
          <Conversation
            title={place.waiter}
            character={waiterVoice}
            role="waiter"
            who={place.id}
            memory={memory}
            context={`${place.name}. ${dish ? `They are pointing at ${dish.fr} (${dish.id}).` : "They are not pointing."} Already brought: ${served.join(", ") || "nothing"}. BILL: ${formatEuros(total)}.`}
            endLabel="Head home"
            onReply={onReply}
            onEnd={(history) => onDone(history.length ? history : turns, purse)}
          />
        </div>
      </div>
    </section>
  );
}
