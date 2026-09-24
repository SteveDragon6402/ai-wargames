"use client";

import { Button } from "@/components/ui/button";
import { useMercenary } from "../hooks/useMercenary";
import Founding from "./Founding";
import Board from "./Place";
import type { GameState } from "../lib/types";

export default function Play({ state, api }: { state: GameState; api: ReturnType<typeof useMercenary> }) {
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

function YearEnd({ state, onReset }: { state: GameState; onReset: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-[#f3f0e8] px-4 py-6 text-[#1a1a1a]">
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
                {unit.name} <span className="font-normal text-[15px] text-[#1a1a1a]/55">{unit.count}</span>
              </p>
              {unit.lines.map((line, index) => (
                <p key={`${unit.id}-${index}`} className="mt-1 text-[16px] leading-relaxed text-[#1a1a1a]/70">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
        {state.decisions.length > 0 && (
          <ul className="space-y-1 text-[15px] text-[#1a1a1a]/70">
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
    <main className="mx-auto min-h-dvh max-w-3xl bg-[#f3f0e8] px-4 py-10 text-[#1a1a1a]">
      <h1 className="font-gothic text-4xl">{title}</h1>
      <p className="mt-2 text-[16px] text-[#1a1a1a]/70">{body}</p>
      <Button type="button" variant="outline" onClick={onReset} className="mt-4">
        Raise another company
      </Button>
    </main>
  );
}
