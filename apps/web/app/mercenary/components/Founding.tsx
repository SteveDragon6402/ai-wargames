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
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <div className="flex items-center justify-between">
        <a href="/" className="text-[13px] text-muted-foreground hover:text-foreground">
          All games
        </a>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset this company and start again?")) onReset();
          }}
          className="text-[13px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Reset
        </button>
      </div>
      <p className="mt-8 text-[12px] uppercase tracking-[0.16em] text-muted-foreground">The Mercenary Band</p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-foreground">
        {state.phase === "name" && "Name the company"}
        {state.phase === "types" && "Choose two trades"}
        {state.phase === "unit-names" && "Name the units"}
        {state.phase === "reputation" && state.companyName}
      </h1>

      <div className="mt-8 rounded-sm border border-border bg-card p-5">
        {state.phase === "name" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onName(name);
            }}
            className="space-y-4"
          >
            <label htmlFor="company" className="block text-[13px] text-muted-foreground">
              What are they called?
            </label>
            <Input id="company" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className="h-10 bg-background" />
            <Button type="submit" className="h-10 w-full text-[13px]">
              This is the company
            </Button>
          </form>
        )}

        {state.phase === "types" && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">You take five men of each. Pick two.</p>
            {BASE_TYPES.map((type) => {
              const on = picked.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type)}
                  className={on ? "block w-full rounded-sm border border-foreground/40 bg-secondary px-3 py-3 text-left" : "block w-full rounded-sm border border-border px-3 py-3 text-left"}
                >
                  <div className="text-[14px] text-foreground">{WIKI[type].title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{WIKI[type].origin}</p>
                </button>
              );
            })}
            <Button type="button" disabled={picked.length !== 2} onClick={() => onTypes(picked)} className="h-10 w-full text-[13px]">
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
                <label className="mb-1.5 block text-[13px] text-muted-foreground">
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
                  className="h-10 bg-background"
                />
              </div>
            ))}
            <Button type="submit" className="h-10 w-full text-[13px]">
              These are their names
            </Button>
          </form>
        )}

        {state.phase === "reputation" && (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {state.units.map((unit) => `${unit.name}, five ${WIKI[unit.type].title.toLowerCase()}`).join(". ")}. They are unknown. The first word of them goes out now.
            </p>
            <Button type="button" disabled={!!busy} onClick={onReputation} className="h-10 w-full text-[13px]">
              {busy ?? "Let them be known"}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
    </main>
  );
}
