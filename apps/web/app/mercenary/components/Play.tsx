"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMercenary } from "../hooks/useMercenary";
import Founding from "./Founding";
import Board from "./Place";
import type { GameState, WeekLedger } from "../lib/types";

export default function Play({ state, api }: { state: GameState; api: ReturnType<typeof useMercenary> }) {
  if (state.screen === "resolving" && state.ledger) return <Resolving ledger={state.ledger} onContinue={api.enterWeek} />;
  if (state.phase === "wiped") return <End title="The company is gone" body="There is no one left to lead." onReset={api.reset} />;
  if (state.phase === "year-end") return <YearEnd state={state} onReset={api.reset} />;
  return <Board game={{ ...api, state }} />;
}

export function MercenaryPlay({ game }: { game: ReturnType<typeof useMercenary> }) {
  const founding = game.state && (game.state.phase === "name" || game.state.phase === "types" || game.state.phase === "unit-names" || game.state.phase === "reputation");
  if (!game.state) return <main className="min-h-dvh" />;
  if (founding) {
    return (
      <Founding
        state={game.state}
        busy={game.busy}
        error={game.error}
        onName={game.nameCompany}
        onTypes={game.pickTypes}
        onUnitNames={game.nameUnits}
        onReputation={() => void game.rollReputation()}
        onReset={game.reset}
      />
    );
  }
  return <Play state={game.state} api={game} />;
}

function Resolving({ ledger, onContinue }: { ledger: WeekLedger; onContinue: () => void }) {
  const showMen = ledger.menBefore !== ledger.menAfter;
  const cards = 3 + (showMen ? 1 : 0);
  const [shown, setShown] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? cards : -1,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setShown(cards);
      return;
    }
    if (shown >= cards) return;
    const id = window.setTimeout(() => setShown((value) => value + 1), 700);
    return () => window.clearTimeout(id);
  }, [shown, cards]);

  function face(index: number, before: string, after: string) {
    if (shown < index) return null;
    return shown === index ? before : after;
  }

  const week = face(0, String(ledger.fromWeek), String(ledger.toWeek));
  const food = face(1, `${ledger.foodWeeksBefore} ${ledger.foodWeeksBefore === 1 ? "week" : "weeks"}`, `${ledger.foodWeeksAfter} ${ledger.foodWeeksAfter === 1 ? "week" : "weeks"}`);
  const coin = face(2, String(ledger.moneyBefore), String(ledger.moneyAfter));
  const men = showMen ? face(3, String(ledger.menBefore), String(ledger.menAfter)) : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--merc-bg)] px-6 text-center text-[var(--merc-text)]">
      <p className="text-[14px] text-[var(--merc-muted)]">The week is resolving.</p>
      <p className="mt-2 font-gothic text-4xl">{ledger.move}</p>
      <div className="mt-10 flex flex-wrap items-start justify-center gap-10">
        {week !== null && <Count word="Week" figure={week} />}
        {food !== null && (
          <Count word="Food" figure={food} note={`${shown === 1 ? ledger.foodBefore : ledger.foodAfter} rations`} lines={shown > 1 ? ledger.foodNotes : []} />
        )}
        {coin !== null && <Count word="Coin" figure={coin} lines={shown > 2 && ledger.moneyNote ? [ledger.moneyNote] : []} />}
        {men !== null && <Count word="Men" figure={men} lines={shown > 3 && ledger.menNote ? [ledger.menNote] : []} />}
      </div>
      <Button
        type="button"
        disabled={!ledger.ready}
        onClick={onContinue}
        className="mt-12 bg-[var(--merc-red-deep)] px-6 py-2 font-gothic text-2xl text-[var(--merc-text)] hover:bg-[var(--merc-red-deep)] disabled:opacity-40"
      >
        Continue
      </Button>
    </main>
  );
}

function Count({ word, figure, note, lines = [] }: { word: string; figure: string; note?: string; lines?: string[] }) {
  return (
    <div className="min-w-[7rem]">
      <p className="font-gothic text-5xl leading-none">{figure}</p>
      <p className="mt-2 text-[14px] text-[var(--merc-muted)]">{word}</p>
      {note && <p className="mt-1 text-[14px]">{note}</p>}
      {lines.map((line) => (
        <p key={line} className="mt-1 text-[14px] text-[var(--merc-muted)]">
          {line}
        </p>
      ))}
    </div>
  );
}

function YearEnd({ state, onReset }: { state: GameState; onReset: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6 text-[var(--merc-text)]">
      <h1 className="font-gothic text-5xl">{state.companyName}</h1>
      <section className="mt-8 space-y-6">
        <div>
          <h2 className="font-gothic text-4xl">The year is over</h2>
          <p className="mt-3 text-[17px] leading-relaxed">{state.yearClosing ?? `${state.companyName} is still in the field.`}</p>
        </div>
        <ul className="space-y-4">
          {state.units.map((unit) => (
            <li key={unit.id}>
              <p className="font-gothic text-2xl">
                {unit.name} <span className="font-normal text-[15px] text-[var(--merc-muted)]">{unit.count}</span>
              </p>
              {unit.lines.map((line, index) => (
                <p key={`${unit.id}-${index}`} className="mt-1 text-[16px] leading-relaxed text-[var(--merc-muted)]">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
        {state.decisions.length > 0 && (
          <ul className="space-y-1 text-[15px] text-[var(--merc-muted)]">
            {state.decisions.map((decision) => (
              <li key={`${decision.week}-${decision.text}`}>
                Week {decision.week}. {decision.text}
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" onClick={onReset}>
          Raise another company
        </Button>
      </section>
    </main>
  );
}

function End({ title, body, onReset }: { title: string; body: string; onReset: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 text-[var(--merc-text)]">
      <h1 className="font-gothic text-4xl">{title}</h1>
      <p className="mt-2 text-[16px] text-[var(--merc-muted)]">{body}</p>
      <Button type="button" variant="outline" onClick={onReset} className="mt-4">
        Raise another company
      </Button>
    </main>
  );
}
