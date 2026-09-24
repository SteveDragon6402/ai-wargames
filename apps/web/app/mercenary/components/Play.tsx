"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NODES, neighbors, type NodeId } from "../data/map";
import { KINGDOM_NAME } from "../data/map";
import { APPROACH_WORDS, PRICE } from "../data/constants";
import { WIKI, type UnitTypeId } from "../data/wiki";
import { describeAction, namesForSurvivors, recruitableTypes, unitsNeeded, wordCount } from "../lib/engine";
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
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <a href="/" className="text-[12px] text-muted-foreground hover:text-foreground">
            All games
          </a>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-none text-foreground">{state.companyName}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Week {Math.min(state.week, 52)} of 52 · {place.name} · {KINGDOM_NAME[place.kingdom]}
          </p>
        </div>
        <div className="flex size-16 shrink-0 items-center justify-center border border-border font-display text-2xl text-muted-foreground">
          ✠
        </div>
      </header>

      {api.error && <p className="mt-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">{api.error}</p>}
      {api.busy && <p className="mt-4 text-[13px] text-muted-foreground">{api.busy}</p>}

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
  return (
    <div className="mt-6 space-y-6">
      <section aria-label="Standing" className="rounded-sm border border-border px-4 py-3">
        <h2 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Standing</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">{state.morale}</p>
        <StanceLine state={state} api={api} />
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {REPUTATION_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-[12px] text-muted-foreground">{REPUTATION_LABEL[key]}</dt>
              <dd className="text-[13px] leading-snug text-foreground">{state.reputation[key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="The company">
        <h2 className="font-display text-2xl text-foreground">The company</h2>
        <ul className="mt-3 space-y-2">
          {state.units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} />
          ))}
        </ul>
      </section>

      <section aria-label="Stores" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Store label="Coin" value={String(state.money)} />
        <Store label="Plain food" value={String(state.basicFood)} />
        <Store label="Good food" value={String(state.goodFood)} />
        <Store label="Supply" value={String(state.supply)} />
      </section>

      <div className="flex flex-wrap gap-2 text-[13px]">
        <span className="text-muted-foreground">Ration</span>
        <button type="button" onClick={() => api.ration("plain")} className={state.ration === "plain" ? "text-foreground" : "text-muted-foreground"}>
          Plain
        </button>
        <button type="button" onClick={() => api.ration("hearty")} className={state.ration === "hearty" ? "text-foreground" : "text-muted-foreground"}>
          Hearty
        </button>
      </div>

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

      <section aria-label="This week" className="rounded-sm border border-foreground/20 bg-card p-4">
        <h2 className="font-display text-2xl text-foreground">This week</h2>
        <ol className="mt-3 space-y-2">
          {state.queue.map((action, index) => (
            <li key={`${action.kind}-${index}`} className="flex items-center justify-between gap-3 text-[14px]">
              <span>
                {index < state.resolveIndex ? "Done. " : `${index + 1}. `}
                {describeAction(action)}
              </span>
              {state.resolveIndex === 0 && (
                <button type="button" onClick={() => api.unqueue(index)} className="text-[12px] text-muted-foreground">
                  Drop
                </button>
              )}
            </li>
          ))}
          {state.queue.length === 0 && <li className="text-[13px] text-muted-foreground">Nothing ordered. A quiet week still spends food.</li>}
        </ol>
        {!locked && state.phase === "play" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => api.show("map")} className="h-9 text-[13px]">
              Map
            </Button>
            {place.kind !== "wild" && <RecruitBuy state={state} api={api} />}
            <ConvertButtons api={api} />
            {state.units.length >= 2 && <TrainBox state={state} api={api} />}
            {place.id === "millcross" && (
              <Button type="button" variant="outline" onClick={() => api.show("elder")} className="h-9 text-[13px]">
                Talk to the elder
              </Button>
            )}
            {api.rewardReady && (
              <Button type="button" onClick={api.takeReward} disabled={!!api.busy} className="h-9 text-[13px]">
                Collect the village's pay
              </Button>
            )}
          </div>
        )}
        <Button type="button" onClick={api.liveWeek} disabled={!!api.busy} className="mt-4 h-10 w-full text-[13px]">
          {state.resolveIndex > 0 ? "Continue the week" : "Live this week"}
        </Button>
      </section>
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
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-baseline justify-between px-4 py-3 text-left">
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

function Store({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border px-3 py-2">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function ConvertButtons({ api }: { api: GameApi }) {
  return (
    <>
      <Button type="button" variant="outline" onClick={() => api.queue({ kind: "convert", direction: "to-good" })} className="h-9 text-[13px]">
        Improve food
      </Button>
      <Button type="button" variant="outline" onClick={() => api.queue({ kind: "convert", direction: "to-basic" })} className="h-9 text-[13px]">
        Stretch food
      </Button>
    </>
  );
}

function RecruitBuy({ state, api }: { state: GameState; api: GameApi }) {
  const types = recruitableTypes(state.location);
  const [type, setType] = useState<UnitTypeId>(types[0] ?? "swordsmen");
  const [count, setCount] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const [store, setStore] = useState<"basic" | "good" | "supply">("basic");
  const [amount, setAmount] = useState(5);
  const plan = unitsNeeded(state.units, type, count);

  return (
    <div className="flex w-full flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] text-muted-foreground">
          Hire
          <select value={type} onChange={(event) => setType(event.target.value as UnitTypeId)} className="mt-1 block h-9 bg-background px-2 text-[13px] text-foreground">
            {types.map((item) => (
              <option key={item} value={item}>
                {WIKI[item].title} · {PRICE[item === "light_cavalry" || item === "heavy_cavalry" || item === "berserkers" ? "specialMan" : "baseMan"]} coin
              </option>
            ))}
          </select>
        </label>
        <Input type="number" min={1} max={40} value={count} onChange={(event) => setCount(Number(event.target.value))} className="h-9 w-20 bg-background" />
        <Button
          type="button"
          variant="outline"
          className="h-9 text-[13px]"
          onClick={() => api.queue({ kind: "recruit", type, count, names: plan.fresh.map((_, index) => names[index] ?? "") })}
        >
          Add hiring
        </Button>
      </div>
      {plan.fresh.length > 0 &&
        plan.fresh.map((fresh, index) => (
          <Input
            key={`${type}-${index}`}
            placeholder={`Name the new unit of ${fresh}`}
            value={names[index] ?? ""}
            maxLength={40}
            onChange={(event) =>
              setNames((current) => {
                const next = [...current];
                next[index] = event.target.value;
                return next;
              })
            }
            className="h-9 bg-background"
          />
        ))}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[12px] text-muted-foreground">
          Buy
          <select value={store} onChange={(event) => setStore(event.target.value as "basic" | "good" | "supply")} className="mt-1 block h-9 bg-background px-2 text-[13px] text-foreground">
            <option value="basic">Plain food · {PRICE.basic}</option>
            <option value="good">Good food · {PRICE.good}</option>
            <option value="supply">Supply · {PRICE.supply}</option>
          </select>
        </label>
        <Input type="number" min={1} max={100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="h-9 w-20 bg-background" />
        <Button type="button" variant="outline" className="h-9 text-[13px]" onClick={() => api.queue({ kind: "buy", store, amount })}>
          Add purchase
        </Button>
      </div>
    </div>
  );
}

function TrainBox({ state, api }: { state: GameState; api: GameApi }) {
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
    <div className="w-full border-t border-border pt-3">
      <p className="text-[12px] text-muted-foreground">Drill two units</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {state.units.map((unit) => (
          <button key={unit.id} type="button" onClick={() => toggle(unit.id)} className={ids.includes(unit.id) ? "text-[13px] text-foreground" : "text-[13px] text-muted-foreground"}>
            {unit.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
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
        <button type="button" onClick={() => api.show("dashboard")} className="text-[13px] text-muted-foreground">
          Back
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
              onClick={() => {
                api.queue({ kind: "move", to: node.id });
                api.show("dashboard");
              }}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={here ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-foreground bg-secondary px-2 py-1 text-left" : "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-background px-2 py-1 text-left disabled:opacity-80"}
            >
              <span className="block text-[13px] text-foreground">
                {node.name}
                {node.id === "blackwood" && state.bandits ? " !" : ""}
              </span>
              <span className="block text-[11px] text-muted-foreground">{node.kind}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">A tap on a neighbouring place queues the march. One march is a week.</p>
    </section>
  );
}

function ElderScreen({ state, api }: { state: GameState; api: GameApi }) {
  const [text, setText] = useState("Do you need any help?");
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">The elder of Millcross</h2>
        <button type="button" onClick={() => api.show("dashboard")} className="text-[13px] text-muted-foreground">
          Back
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
        <Input value={text} onChange={(event) => setText(event.target.value)} className="h-10 bg-background" />
        <Button type="submit" disabled={!!api.busy} className="h-10 text-[13px]">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {!state.villageWork && state.bandits && (
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={api.takeWork} className="h-9 text-[13px]">
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
    <section className="mt-6 rounded-sm border border-foreground/20 bg-card p-5">
      <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Blackwood</p>
      <h2 className="mt-1 font-display text-3xl">{state.leader.name}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-foreground">{state.leader.blurb}</p>
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
      <h2 className="font-display text-3xl">Before the fight</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">Say how you mean to fight, in {APPROACH_WORDS} words or fewer, and how much supply to spend.</p>
      <textarea
        value={approach}
        onChange={(event) => setApproach(event.target.value)}
        rows={4}
        className="mt-4 w-full rounded-sm border border-border bg-background p-3 text-[14px]"
      />
      <p className="mt-1 text-[12px] text-muted-foreground">
        {words} / {APPROACH_WORDS}
      </p>
      <label className="mt-3 block text-[13px] text-muted-foreground">
        Supply, up to {state.supply}
        <Input type="number" min={0} max={state.supply} value={supply} onChange={(event) => setSupply(Number(event.target.value))} className="mt-1 h-9 w-24 bg-background" />
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
      <button type="button" onClick={() => api.show("dashboard")} className="text-[13px] text-muted-foreground">
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
          <Button type="button" disabled={!!api.busy} onClick={() => api.choose("kill", [])} className="h-10 text-[13px]">
            Kill them
          </Button>
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={() => api.choose("justice", [])} className="h-10 text-[13px]">
            Bring them to justice
          </Button>
          {names.map((name, index) => (
            <Input
              key={index}
              value={name}
              placeholder={needed === 1 ? "Name the unit" : `Name unit ${index + 1}`}
              maxLength={40}
              onChange={(event) =>
                setNames((current) => {
                  const next = [...current];
                  next[index] = event.target.value;
                  return next;
                })
              }
              className="h-9 bg-background"
            />
          ))}
          <Button type="button" variant="outline" disabled={!!api.busy} onClick={() => api.choose("recruit", names)} className="h-10 text-[13px]">
            Recruit them
          </Button>
        </div>
      )}
    </section>
  );
}
