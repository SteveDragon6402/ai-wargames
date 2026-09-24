"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_TYPES, WIKI, type BaseTypeId } from "../data/wiki";
import { DEFAULT_COMPANY_NAME, defaultUnitName } from "../lib/engine";
import type { GameState } from "../lib/types";

export default function Founding({
  state,
  busy,
  error,
  onName,
  onTypes,
  onUnitNames,
  onReputation,
  onReset,
}: {
  state: GameState;
  busy: string | null;
  error: string | null;
  onName: (name: string) => void;
  onTypes: (types: BaseTypeId[]) => void;
  onUnitNames: (names: [string, string]) => void;
  onReputation: () => void;
  onReset: () => void;
}) {
  const [name, setName] = useState(state.companyName || DEFAULT_COMPANY_NAME);
  const [picked, setPicked] = useState<BaseTypeId[]>(state.chosenTypes);
  const [unitNames, setUnitNames] = useState<[string, string]>(["", ""]);

  useEffect(() => {
    if (state.phase !== "unit-names" || state.units.length < 2) return;
    const first = defaultUnitName(state.units[0].type, []);
    const second = defaultUnitName(state.units[1].type, [first]);
    setUnitNames([first, second]);
  }, [state.phase, state.units]);

  function toggle(type: BaseTypeId) {
    setPicked((current) => {
      if (current.includes(type)) return current.filter((item) => item !== type);
      if (current.length >= 2) return [current[1], type];
      return [...current, type];
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-[#f3f0e8] px-6 py-16 text-[#1a1a1a]">
      <div className="flex items-center justify-between">
        <a href="/" className="text-[14px] text-[#1a1a1a]/60 underline decoration-[#1a1a1a]/30 underline-offset-2">
          All games
        </a>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset this company and start again?")) onReset();
          }}
          className="text-[14px] text-[#1a1a1a]/60 underline decoration-[#1a1a1a]/30 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]"
        >
          Reset
        </button>
      </div>
      <p className="mt-8 text-[14px] text-[#1a1a1a]/55">The Mercenary Band</p>
      <h1 className="mt-2 font-gothic text-5xl text-[#1a1a1a]">
        {state.phase === "name" && "Name the company"}
        {state.phase === "types" && "Choose two trades"}
        {state.phase === "unit-names" && "Name the units"}
        {state.phase === "reputation" && state.companyName}
      </h1>

      <div className="mt-8 border border-[#1a1a1a]/20 p-5">
        {state.phase === "name" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onName(name);
            }}
            className="space-y-4"
          >
            <label htmlFor="company" className="block text-[15px] text-[#1a1a1a]/70">
              What are they called?
            </label>
            <Input id="company" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className="h-10 border-[#1a1a1a]/30 bg-transparent text-[#1a1a1a]" />
            <Button type="submit" className="h-10 w-full bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90">
              This is the company
            </Button>
          </form>
        )}

        {state.phase === "types" && (
          <div className="space-y-3">
            <p className="text-[15px] text-[#1a1a1a]/70">You take five men of each. Pick two.</p>
            {BASE_TYPES.map((type) => {
              const on = picked.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type)}
                  className={on ? "block w-full border border-[#9b1c1c] px-3 py-3 text-left" : "block w-full border border-[#1a1a1a]/20 px-3 py-3 text-left"}
                >
                  <div className="font-gothic text-xl">{WIKI[type].title}</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#1a1a1a]/70">{WIKI[type].origin}</p>
                </button>
              );
            })}
            <Button type="button" disabled={picked.length !== 2} onClick={() => onTypes(picked)} className="h-10 w-full bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90">
              Take these men
            </Button>
          </div>
        )}

        {state.phase === "unit-names" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onUnitNames(unitNames);
            }}
            className="space-y-4"
          >
            {state.units.map((unit, index) => (
              <div key={unit.id}>
                <label className="mb-1.5 block text-[15px] text-[#1a1a1a]/70">
                  Five {WIKI[unit.type].title.toLowerCase()}
                </label>
                <Input
                  value={unitNames[index]}
                  maxLength={40}
                  onChange={(event) =>
                    setUnitNames((current) => {
                      const next: [string, string] = [...current];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                  className="h-10 border-[#1a1a1a]/30 bg-transparent text-[#1a1a1a]"
                />
              </div>
            ))}
            <Button type="submit" className="h-10 w-full bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90">
              These are their names
            </Button>
          </form>
        )}

        {state.phase === "reputation" && (
          <div className="space-y-4">
            <p className="text-[16px] leading-relaxed text-[#1a1a1a]/75">
              {state.units.map((unit) => `${unit.name}, five ${WIKI[unit.type].title.toLowerCase()}`).join(". ")}. They are unknown. The first word of them goes out now.
            </p>
            <Button type="button" disabled={!!busy} onClick={onReputation} className="h-10 w-full bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90">
              {busy ?? "Let them be known"}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
    </main>
  );
}
