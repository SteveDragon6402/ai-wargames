"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NODES, neighbors, type NodeId } from "../data/map";
import { KINGDOM_NAME } from "../data/map";
import { APPROACH_WORDS, PRICE } from "../data/constants";
import { WIKI, type UnitTypeId } from "../data/wiki";
import { describeAction, foodBlocksWeek, headcount, manPrice, namesForSurvivors, recruitableTypes, recruitmentPlan, wordCount } from "../lib/engine";
import { REPUTATION_KEYS, REPUTATION_LABEL, type Aftermath, type GameState, type WeekAction } from "../lib/types";

type GameApi = {
  busy: string | null;
  error: string | null;
  rewardReady: boolean;
  queue: (action: WeekAction) => void;
  unqueue: (index: number) => void;
  ration: (value: "hearty" | "plain") => void;
  stance: (value: string) => void;
  show: (screen: GameState["screen"]) => void;
  liveWeek: () => void;
  suggestDrills: (unitIds: [string, string]) => Promise<string[] | null>;
  sendElder: (message: string) => void;
  takeWork: () => void;
  takeReward: () => void;
  fight: () => void;
  retreat: () => void;
  sneak: () => void;
  sendBattle: (approach: string, supply: number) => void;
  choose: (choice: Aftermath, names: string[]) => void;
  reset: () => void;
};

export default function Play({ state, api }: { state: GameState; api: GameApi }) {
  const place = NODES[state.location];
  const locked = state.resolveIndex > 0;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6 sm:px-6">
      <header className="border-b border-border pb-4">
        <a href="/" className="text-[13px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          All games
        </a>
        <h1 className="mt-2 max-w-[18ch] text-balance font-display text-4xl font-semibold leading-none text-foreground">{state.companyName}</h1>
        <p className="mt-2 text-[15px] text-foreground">
          Week {Math.min(state.week, 52)} of 52, {place.name}, {KINGDOM_NAME[place.kingdom]}
        </p>
      </header>

      {state.phase === "play" && state.screen !== "dashboard" && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <span>{headcount(state.units)} men</span>
          <span>{state.money} coin</span>
          <span className={state.basicFood + state.goodFood < headcount(state.units) ? "text-bad" : undefined}>
            {state.basicFood + state.goodFood} food
          </span>
          <span>
            {state.queue.length} of 2 actions
          </span>
        </p>
      )}

      {api.error && (
        <p role="alert" className="mt-4 text-[15px] text-bad">
          {api.error}
        </p>
      )}
      {api.busy && (
        <p aria-live="polite" className="mt-4 text-[15px] text-foreground">
          {api.busy}
        </p>
      )}

      {state.phase === "wiped" && <End title="The company is gone" body="There is no one left to lead." onReset={api.reset} />}
      {state.phase === "year-end" && <End title="The year is over" body={`${state.companyName} is still in the field.`} onReset={api.reset} />}

      {state.phase === "play" && state.screen === "map" && <MapScreen state={state} api={api} />}
      {state.phase === "play" && state.screen === "elder" && <ElderScreen state={state} api={api} />}
      {state.phase === "play" && state.screen === "forest" && <ForestScreen state={state} api={api} />}
      {state.phase === "play" && state.screen === "approach" && <ApproachScreen state={state} api={api} />}
      {state.phase === "play" && (state.screen === "result" || state.screen === "chronicle") && <ResultScreen state={state} api={api} />}
      {state.phase === "play" && state.screen === "choice" && <ChoiceScreen state={state} api={api} />}
      {state.phase === "play" && state.screen === "dashboard" && <Dashboard state={state} api={api} locked={locked} />}
    </main>
  );
}

function End({ title, body, onReset }: { title: string; body: string; onReset: () => void }) {
  return (
    <section className="mt-8 rounded-sm border border-border bg-card p-5">
      <h2 className="font-display text-3xl text-foreground">{title}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      <Button type="button" variant="outline" onClick={onReset} className="mt-4 h-10 text-[13px]">
        Raise another company
      </Button>
    </section>
  );
}

function Dashboard({ state, api, locked }: { state: GameState; api: GameApi; locked: boolean }) {
  const place = NODES[state.location];
  const men = headcount(state.units);
  const food = state.basicFood + state.goodFood;
  const foodStop = foodBlocksWeek(state);
  const atMarket = place.kind !== "wild";
  const moved = state.movedThisWeek || state.queue.some((action) => action.kind === "move");
  const slotsLeft = 2 - state.queue.length;
  const [panel, setPanel] = useState<null | "recruit" | "buy" | "train" | "cook">(null);
  const offerWork = place.id === "millcross" && !state.villageWork && !!state.bandits;
  const lead = api.rewardReady ? "pay" : offerWork ? "elder" : foodStop && atMarket ? "buy" : foodStop ? "march" : "live";

  function openPanel(next: "recruit" | "buy" | "train" | "cook") {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="mt-8 space-y-8">
      <section aria-label="Status">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <p className="font-display text-3xl font-semibold leading-none text-foreground">
            {men} <span className="font-sans text-[15px] font-normal text-muted-foreground">men</span>
          </p>
          <p className="font-display text-3xl font-semibold leading-none text-foreground">
            {state.money} <span className="font-sans text-[15px] font-normal text-muted-foreground">coin</span>
          </p>
          <p className={food < men ? "font-display text-3xl font-semibold leading-none text-bad" : "font-display text-3xl font-semibold leading-none text-foreground"}>
            {food} <span className={food < men ? "font-sans text-[15px] font-normal text-bad" : "font-sans text-[15px] font-normal text-muted-foreground"}>{food < men ? "food, short" : "food"}</span>
          </p>
          <p className="font-display text-3xl font-semibold leading-none text-foreground">
            {state.supply} <span className="font-sans text-[15px] font-normal text-muted-foreground">supply</span>
          </p>
        </div>
        <div role="group" aria-label="Ration for this week" className="mt-4 flex flex-wrap gap-4">
          <button
            type="button"
            aria-pressed={state.ration === "plain"}
            onClick={() => api.ration("plain")}
            className={state.ration === "plain" ? "text-[15px] font-semibold text-foreground underline decoration-primary underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "text-[15px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
          >
            Plain ration
          </button>
          <button
            type="button"
            aria-pressed={state.ration === "hearty"}
            onClick={() => api.ration("hearty")}
            className={state.ration === "hearty" ? "text-[15px] font-semibold text-foreground underline decoration-primary underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "text-[15px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
          >
            Hearty ration
          </button>
        </div>
      </section>

      <p className="text-[15px] leading-relaxed text-foreground">{state.morale}</p>

      {offerWork && <p className="text-[15px] leading-relaxed text-foreground">The elder of Millcross is in the yard. The Blackwood road is not safe.</p>}
      {place.id === "millcross" && state.villageWork && state.bandits && (
        <p className="text-[15px] leading-relaxed text-foreground">You took the work. Harl the Reed is still in Blackwood.</p>
      )}
      {api.rewardReady && <p className="text-[15px] leading-relaxed text-foreground">Millcross owes you for the Blackwood road.</p>}

      {(api.rewardReady || place.id === "millcross") && (
      <div className="flex flex-wrap gap-3">
        {api.rewardReady && (
          <Button type="button" variant={lead === "pay" ? "default" : "outline"} onClick={api.takeReward} disabled={!!api.busy} className="h-12 px-5 text-[15px]">
            Collect the village's pay
          </Button>
        )}
        {offerWork && (
          <Button type="button" variant={lead === "elder" ? "default" : "outline"} onClick={() => api.show("elder")} className="h-12 px-5 text-[15px]">
            Ask the elder for work
          </Button>
        )}
        {place.id === "millcross" && !offerWork && (
          <Button type="button" variant="link" onClick={() => api.show("elder")} className="h-12 px-0 text-[15px]">
            Talk to the elder
          </Button>
        )}
      </div>
      )}

      <section aria-label="This week" className="rounded-sm border border-border bg-card p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="max-w-[12ch] text-balance font-display text-3xl font-semibold text-foreground">This week</h2>
          <p className="text-[15px] text-muted-foreground">{state.queue.length} of 2 actions</p>
        </div>
        {foodStop && (
          <p id="food-stop" role="alert" className="mt-4 text-[15px] leading-relaxed text-bad">
            {foodStop}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((index) => {
            const action = state.queue[index];
            const done = index < state.resolveIndex;
            return (
              <div key={index} className="flex min-h-16 items-start justify-between gap-3 bg-background px-3 py-3">
                {action ? (
                  <p className="text-[15px] leading-snug text-foreground">
                    {done ? "Done. " : ""}
                    {describeAction(action)}
                  </p>
                ) : (
                  <p className="text-[15px] text-muted-foreground">{index === 0 ? "First action is open" : "Second action is open"}</p>
                )}
                {action && state.resolveIndex === 0 && (
                  <button
                    type="button"
                    onClick={() => api.unqueue(index)}
                    className="shrink-0 text-[13px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Drop
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!locked && slotsLeft > 0 && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={lead === "march" ? "default" : "outline"}
                disabled={moved}
                onClick={() => api.show("map")}
                className="h-11 text-[15px]"
              >
                March
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!atMarket}
                aria-expanded={panel === "recruit"}
                onClick={() => openPanel("recruit")}
                className="h-11 text-[15px]"
              >
                Recruit
              </Button>
              <Button
                type="button"
                variant={lead === "buy" ? "default" : "outline"}
                disabled={!atMarket}
                aria-expanded={panel === "buy"}
                onClick={() => openPanel("buy")}
                className="h-11 text-[15px]"
              >
                Buy
              </Button>
            </div>
            {!atMarket && <p className="mt-3 text-[15px] text-muted-foreground">Recruit and buy in a village or a capital.</p>}
            {moved && <p className="mt-3 text-[15px] text-muted-foreground">The march is already ordered.</p>}
            <div className="mt-3 flex gap-4">
              <Button type="button" variant="link" disabled={state.units.length < 2} aria-expanded={panel === "train"} onClick={() => openPanel("train")} className="h-9 px-0 text-[15px]">
                Train
              </Button>
              <Button type="button" variant="link" aria-expanded={panel === "cook"} onClick={() => openPanel("cook")} className="h-9 px-0 text-[15px]">
                Cook
              </Button>
            </div>
          </div>
        )}

        {panel === "recruit" && atMarket && <RecruitPanel state={state} api={api} onDone={() => setPanel(null)} />}
        {panel === "buy" && atMarket && <BuyPanel state={state} api={api} onDone={() => setPanel(null)} />}
        {panel === "train" && <TrainBox state={state} api={api} onDone={() => setPanel(null)} />}
        {panel === "cook" && <CookPanel api={api} onDone={() => setPanel(null)} />}

        <Button
          type="button"
          variant={lead === "live" ? "default" : "outline"}
          onClick={api.liveWeek}
          disabled={!!api.busy || !!foodStop}
          aria-describedby={foodStop ? "food-stop" : undefined}
          className="mt-6 h-12 w-full text-[15px]"
        >
          {state.resolveIndex > 0 ? "Continue the week" : "Live this week"}
        </Button>
      </section>

      {state.notices.length > 0 && (
        <ul className="text-[13px] text-muted-foreground">
          {state.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}

      {state.lastBrief && (
        <button type="button" onClick={() => api.show("chronicle")} className="block text-left text-[14px] leading-relaxed text-foreground">
          {state.lastBrief}
          <span className="mt-1 block text-[12px] text-muted-foreground">Read the account</span>
        </button>
      )}

      <section aria-label="The company">
        <h2 className="font-display text-2xl text-foreground">The company</h2>
        <StanceLine state={state} api={api} />
        <ul className="mt-3 space-y-2">
          {state.units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} />
          ))}
        </ul>
      </section>

      <details className="rounded-sm border border-border px-4 py-3">
        <summary className="cursor-pointer text-[15px] text-muted-foreground">What people say of you</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {REPUTATION_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-[13px] text-muted-foreground">{REPUTATION_LABEL[key]}</dt>
              <dd className="text-[15px] leading-snug text-foreground">{state.reputation[key] || "—"}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Disband this company and start again?")) api.reset();
          }}
          className="mt-4 text-[13px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Disband the company
        </button>
      </details>
    </div>
  );
}

function StanceLine({ state, api }: { state: GameState; api: GameApi }) {
  const [value, setValue] = useState(state.stance);
  return (
    <label className="mt-3 block text-[13px] text-muted-foreground">
      Stance
      <Input
        value={value}
        maxLength={240}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => api.stance(value)}
        className="mt-1 h-9 bg-background text-foreground"
      />
    </label>
  );
}

function UnitRow({ unit }: { unit: GameState["units"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-sm border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-baseline justify-between px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="font-display text-xl text-foreground">{unit.name}</span>
        <span className="text-[13px] text-muted-foreground">
          {unit.count} {WIKI[unit.type].title.toLowerCase()}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-[14px] leading-relaxed text-foreground">
          <p>{unit.origin}</p>
          {unit.lines.map((line) => (
            <p key={line} className="mt-1 text-muted-foreground">
              {line}
            </p>
          ))}
          {unit.battles.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
              {unit.battles.map((battle, index) => (
                <li key={`${battle.week}-${index}`}>
                  Week {battle.week}, {battle.place}: {battle.result} Lost {battle.deaths}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function RecruitPanel({ state, api, onDone }: { state: GameState; api: GameApi; onDone: () => void }) {
  const types = recruitableTypes(state.location);
  const [type, setType] = useState<UnitTypeId>(types[0] ?? "swordsmen");
  const [count, setCount] = useState<3 | 5 | 10 | null>(null);
  const [into, setInto] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const price = manPrice(type);
  const targets = state.units.filter((unit) => unit.type === type && unit.count < 10);
  const plan = count && into ? recruitmentPlan(state.units, type, count, into) : null;
  const named = plan ? plan.fresh.every((_, index) => (names[index] ?? "").trim()) : false;

  function chooseType(next: UnitTypeId) {
    setType(next);
    setCount(null);
    setInto(null);
    setNames([]);
  }

  function chooseInto(next: string) {
    if (!count) return;
    setInto(next);
    setNames(recruitmentPlan(state.units, type, count, next).fresh.map(() => ""));
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl text-foreground">Who will take service</h3>
        <button type="button" onClick={onDone} className="text-[12px] text-muted-foreground">
          Close
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {types.map((item) => (
          <li key={item}>
            <button
              type="button"
              aria-pressed={item === type}
              onClick={() => chooseType(item)}
              className={item === type ? "text-[15px] font-semibold text-foreground underline decoration-primary underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "text-[15px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
            >
              {WIKI[item].title}, {manPrice(item)} coin a man
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {([3, 5, 10] as const).map((size) => (
          <Button
            key={size}
            type="button"
            variant={count === size ? "default" : "outline"}
            aria-pressed={count === size}
            disabled={price * size > state.money}
            onClick={() => {
              setCount(size);
              setInto(null);
              setNames([]);
            }}
            className="h-10 text-[13px]"
          >
            {size} for {price * size} coin
          </Button>
        ))}
      </div>
      {count && (
        <div className="mt-4">
          <p className="text-[15px] text-foreground">Add them to</p>
          <div role="group" aria-label="Add them to" className="mt-2 flex flex-col items-start gap-2">
            {targets.map((unit) => (
              <button
                key={unit.id}
                type="button"
                aria-pressed={into === unit.id}
                onClick={() => chooseInto(unit.id)}
                className={into === unit.id ? "text-[15px] font-semibold text-foreground underline decoration-primary underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "text-[15px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
              >
                {unit.name}, {unit.count} of 10
              </button>
            ))}
            <button
              type="button"
              aria-pressed={into === "new"}
              onClick={() => chooseInto("new")}
              className={into === "new" ? "text-[15px] font-semibold text-foreground underline decoration-primary underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "text-[15px] text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
            >
              A new unit
            </button>
          </div>
        </div>
      )}
      {plan &&
        plan.fresh.map((fresh, index) => (
          <label key={`${type}-${into}-${index}`} htmlFor={`recruit-name-${index}`} className="mt-3 block text-[15px] text-foreground">
            Name the new unit of {fresh}
          <Input
            id={`recruit-name-${index}`}
            value={names[index] ?? ""}
            maxLength={40}
            onChange={(event) =>
              setNames((current) => {
                const next = [...current];
                next[index] = event.target.value;
                return next;
              })
            }
            className="mt-2 h-9 bg-background"
          />
          </label>
        ))}
      {plan && count && into && (
        <Button
          type="button"
          disabled={!named || price * count > state.money}
          onClick={() => {
            api.queue({
              kind: "recruit",
              type,
              count,
              names: plan.fresh.map((_, index) => (names[index] ?? "").trim()),
              into,
            });
            onDone();
          }}
          className="mt-3 h-10 text-[13px]"
        >
          Hire {count} {WIKI[type].title.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function BuyPanel({ state, api, onDone }: { state: GameState; api: GameApi; onDone: () => void }) {
  const rows = [
    { store: "basic" as const, label: "Plain food", price: PRICE.basic },
    { store: "good" as const, label: "Good food", price: PRICE.good },
    { store: "supply" as const, label: "Supply", price: PRICE.supply },
  ];
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl text-foreground">The stores</h3>
        <button type="button" onClick={onDone} className="text-[12px] text-muted-foreground">
          Close
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.store} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] text-foreground">
            {row.label}, {row.price} coin
          </span>
          <div className="flex gap-2">
            {[5, 10, 20].map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outline"
                disabled={state.money < row.price * amount}
                onClick={() => {
                  api.queue({ kind: "buy", store: row.store, amount });
                  onDone();
                }}
                className="h-9 text-[13px]"
              >
                {amount}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CookPanel({ api, onDone }: { api: GameApi; onDone: () => void }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl text-foreground">The cook</h3>
        <button type="button" onClick={onDone} className="text-[12px] text-muted-foreground">
          Close
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">Two plain meals become one good meal, up to ten. Or the other way.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            api.queue({ kind: "convert", direction: "to-good" });
            onDone();
          }}
          className="h-10 text-[13px]"
        >
          Improve food
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            api.queue({ kind: "convert", direction: "to-basic" });
            onDone();
          }}
          className="h-10 text-[13px]"
        >
          Stretch food
        </Button>
      </div>
    </div>
  );
}

function TrainBox({ state, api, onDone }: { state: GameState; api: GameApi; onDone: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [drill, setDrill] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);

  function toggle(id: string) {
    setIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl text-foreground">Drill two units</h3>
        <button type="button" onClick={onDone} className="text-[12px] text-muted-foreground">
          Close
        </button>
      </div>
      <div className="mt-3 flex flex-col items-start gap-1">
        {state.units.map((unit) => (
          <button key={unit.id} type="button" onClick={() => toggle(unit.id)} className={ids.includes(unit.id) ? "text-[15px] text-foreground" : "text-[15px] text-muted-foreground"}>
            {unit.name}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input value={drill} onChange={(event) => setDrill(event.target.value)} placeholder="How they train" className="h-9 max-w-sm bg-background" />
        <Button
          type="button"
          variant="outline"
          disabled={ids.length !== 2 || !!api.busy}
          className="h-9 text-[13px]"
          onClick={async () => {
            const drills = await api.suggestDrills([ids[0], ids[1]]);
            if (drills) setIdeas(drills);
          }}
        >
          Suggest
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={ids.length !== 2 || !drill.trim()}
          className="h-9 text-[13px]"
          onClick={() => {
            api.queue({ kind: "train", unitIds: [ids[0], ids[1]], drill: drill.trim() });
            setDrill("");
            setIdeas([]);
            onDone();
          }}
        >
          Add drill
        </Button>
      </div>
      {ideas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => setDrill(idea)} className="rounded-sm border border-border px-2 py-1 text-[13px]">
              {idea}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MapScreen({ state, api }: { state: GameState; api: GameApi }) {
  const near = new Set(neighbors(state.location));
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">The country</h2>
        <button type="button" onClick={() => api.show("dashboard")} className="text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Back to the company
        </button>
      </div>
      <div className="relative mt-4 h-[28rem] rounded-sm border border-border bg-card">
        {(Object.values(NODES) as (typeof NODES)[NodeId][]).map((node) => {
          const here = node.id === state.location;
          const canMarch = near.has(node.id) && state.resolveIndex === 0;
          return (
            <button
              key={node.id}
              type="button"
              disabled={!canMarch}
              aria-current={here ? "true" : undefined}
              onClick={() => {
                api.queue({ kind: "move", to: node.id });
                api.show("dashboard");
              }}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={here ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-foreground bg-secondary px-2 py-1 text-left" : "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-background px-2 py-1 text-left disabled:opacity-80"}
            >
              <span className="block text-[13px] text-foreground">
                {node.name}
                {here ? ", here" : ""}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {node.id === "blackwood" && state.bandits ? "bandits" : node.kind}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">A tap on a neighbouring place queues the march. This march uses one of your two actions.</p>
    </section>
  );
}

function ElderScreen({ state, api }: { state: GameState; api: GameApi }) {
  const [text, setText] = useState("Do you need any help?");
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">The elder of Millcross</h2>
        <button type="button" onClick={() => api.show("dashboard")} className="text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Back to the company
        </button>
      </div>
      <div className="mt-4 space-y-3 rounded-sm border border-border bg-card p-4">
        {state.elderTalk.length === 0 && <p className="text-[13px] text-muted-foreground">He is in the yard.</p>}
        {state.elderTalk.map((turn, index) => (
          <p key={index} className={turn.role === "elder" ? "text-[15px] leading-relaxed text-foreground" : "text-[14px] text-muted-foreground"}>
            {turn.role === "elder" ? turn.text : `You. ${turn.text}`}
          </p>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || api.busy) return;
          api.sendElder(text);
          setText("");
        }}
      >
        <label htmlFor="elder-say" className="sr-only">
          Say to the elder
        </label>
        <Input id="elder-say" value={text} onChange={(event) => setText(event.target.value)} className="h-10 bg-background" />
        <Button type="submit" disabled={!!api.busy} className="h-10 text-[15px]">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {!state.villageWork && state.bandits && (
          <Button type="button" disabled={!!api.busy} onClick={api.takeWork} className="h-11 text-[15px]">
            Take the work
          </Button>
        )}
        {api.rewardReady && (
          <Button type="button" disabled={!!api.busy} onClick={api.takeReward} className="h-9 text-[13px]">
            Collect the pay
          </Button>
        )}
      </div>
    </section>
  );
}

function ForestScreen({ state, api }: { state: GameState; api: GameApi }) {
  return (
    <section className="mt-8 rounded-sm border border-border bg-card p-4 sm:p-6">
      <h2 className="font-display text-3xl font-semibold">{state.leader.name}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">Blackwood</p>
      <p className="mt-4 text-[15px] leading-relaxed text-foreground">{state.leader.blurb}</p>
      <p className="mt-2 text-[13px] text-muted-foreground">{state.bandits ? `${state.bandits.count} of them are in the trees.` : ""}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button type="button" disabled={!!api.busy} onClick={api.fight} className="h-10 text-[13px]">
          Fight them
        </Button>
        <Button type="button" variant="outline" disabled={!!api.busy} onClick={api.retreat} className="h-10 text-[13px]">
          Retreat
        </Button>
        <Button type="button" variant="outline" disabled={!!api.busy} onClick={api.sneak} className="h-10 text-[13px]">
          Try to sneak past
        </Button>
      </div>
    </section>
  );
}

function ApproachScreen({ state, api }: { state: GameState; api: GameApi }) {
  const [approach, setApproach] = useState("");
  const [supply, setSupply] = useState(0);
  const words = wordCount(approach);
  return (
    <section className="mt-6 rounded-sm border border-border bg-card p-5">
      <h2 className="font-display text-3xl font-semibold">Before the fight</h2>
      <label htmlFor="approach" className="mt-4 block text-[15px] text-foreground">
        How you mean to fight, in {APPROACH_WORDS} words or fewer
      </label>
      <textarea
        id="approach"
        value={approach}
        onChange={(event) => setApproach(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-sm border border-border bg-background p-3 text-[15px]"
      />
      <p className="mt-1 text-[12px] text-muted-foreground">
        {words} / {APPROACH_WORDS}
      </p>
      <label htmlFor="supply-spent" className="mt-4 block text-[15px] text-foreground">
        Supply to spend, up to {state.supply}
        <Input id="supply-spent" type="number" min={0} max={state.supply} value={supply} onChange={(event) => setSupply(Number(event.target.value))} className="mt-2 h-9 w-24 bg-background" />
      </label>
      <Button type="button" disabled={!!api.busy || words < 1 || words > APPROACH_WORDS} onClick={() => api.sendBattle(approach, supply)} className="mt-4 h-10 w-full text-[13px]">
        {api.busy ?? "Send them in"}
      </Button>
    </section>
  );
}

function ResultScreen({ state, api }: { state: GameState; api: GameApi }) {
  const full = state.screen === "chronicle";
  return (
    <section className="mt-6">
      <button type="button" onClick={() => api.show("dashboard")} className="text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Back to the company
      </button>
      <h2 className="mt-3 font-display text-3xl">The fight</h2>
      <p className="mt-3 text-[16px] leading-relaxed text-foreground">{state.lastBrief}</p>
      <button type="button" onClick={() => api.show(full ? "dashboard" : "chronicle")} className="mt-3 text-[13px] text-muted-foreground">
        {full ? "Hide the account" : "Read the account"}
      </button>
      {full && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">{state.lastChronicle}</p>}
    </section>
  );
}

function ChoiceScreen({ state, api }: { state: GameState; api: GameApi }) {
  const survivors = state.banditSurvivors ?? 0;
  const needed = namesForSurvivors(survivors);
  const [names, setNames] = useState<string[]>(Array.from({ length: needed }, () => ""));
  const [account, setAccount] = useState(false);
  return (
    <section className="mt-6 rounded-sm border border-foreground/20 bg-card p-5">
      <h2 className="font-display text-3xl">After the fight</h2>
      <p className="mt-3 text-[15px] leading-relaxed">{state.lastBrief}</p>
      <button type="button" onClick={() => setAccount((open) => !open)} className="mt-2 text-[13px] text-muted-foreground">
        {account ? "Hide the account" : "Read the account"}
      </button>
      {account && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">{state.lastChronicle}</p>}
      {survivors <= 0 ? (
        <div className="mt-4">
          <p className="text-[14px] text-muted-foreground">No one on their side is left to spare.</p>
          <Button type="button" disabled={!!api.busy} onClick={() => api.choose("kill", [])} className="mt-3 h-10 text-[13px]">
            Leave the dead
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[14px] text-muted-foreground">{survivors} of them are still alive.</p>
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={() => api.choose("kill", [])} className="h-11 text-[15px]">
            Kill them
          </Button>
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={() => api.choose("justice", [])} className="h-11 text-[15px]">
            Bring them to justice
          </Button>
          {names.map((name, index) => (
            <label key={index} htmlFor={`survivor-name-${index}`} className="text-[15px] text-foreground">
              {needed === 1 ? "Name the unit" : `Name unit ${index + 1}`}
              <Input
                id={`survivor-name-${index}`}
                value={name}
                maxLength={40}
                onChange={(event) =>
                  setNames((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })
                }
                className="mt-2 h-9 bg-background"
              />
            </label>
          ))}
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={() => api.choose("recruit", names)} className="h-11 text-[15px]">
            Recruit them
          </Button>
        </div>
      )}
    </section>
  );
}
