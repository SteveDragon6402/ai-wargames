"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EDGES, KINGDOM_NAME, NODES, isForest, isSettlement, neighbors, type NodeId } from "../data/map";
import { APPROACH_WORDS, PRICE } from "../data/constants";
import { WIKI, type UnitTypeId } from "../data/wiki";
import {
  DEFAULT_APPROACH,
  DEFAULT_DRILL,
  defaultNamesFor,
  describeAction,
  foodWarning,
  foodWeeks,
  headcount,
  manPrice,
  namesForSurvivors,
  nextContractTemplate,
  recruitableTypes,
  recruitmentPlan,
  wordCount,
} from "../lib/engine";
import { REPUTATION_LABEL, type GameState } from "../lib/types";
import type { useMercenary } from "../hooks/useMercenary";

type Game = Omit<ReturnType<typeof useMercenary>, "state"> & { state: GameState };

export default function Board({ game }: { game: Game }) {
  const { state } = game;
  const place = NODES[state.location];
  const locked = state.resolveIndex > 0;
  const men = headcount(state.units);
  const weeks = foodWeeks(state);
  const shortage = foodWarning(state);
  const movement = state.weekPlan.movement;
  const deed = state.weekPlan.deed;
  const settlement = isSettlement(state.location);
  const woodHere = isForest(state.location);
  const bandHere = !!state.bandits && state.location === state.bandAt;
  const coming = nextContractTemplate(state);
  const [mapOpen, setMapOpen] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [reading, setReading] = useState<GameState["units"][number] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [wood, setWood] = useState<"list" | "found" | "refused">("list");

  useEffect(() => {
    if (state.screen === "map") setMapOpen(true);
    if (state.screen === "elder") setTalkOpen(true);
    if (state.screen === "forest") setWood("found");
  }, [state.screen]);

  useEffect(() => {
    if (state.screen !== "forest") setWood("list");
  }, [state.location, state.screen]);

  function toggleUnit(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function closeMap() {
    setMapOpen(false);
    if (state.screen === "map") game.show("dashboard");
  }

  function closeTalk() {
    setTalkOpen(false);
    if (state.screen === "elder") game.show("dashboard");
  }

  const special = state.screen === "approach" || state.screen === "result" || state.screen === "chronicle" || state.screen === "choice";

  return (
    <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-black text-white">
      <header className="flex shrink-0 items-end justify-between gap-3 border-b border-white/15 px-4 py-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Stamp word="Food" figure={String(weeks)} note={weeks === 1 ? "week" : "weeks"} tone="red" />
          <Stamp word="Men" figure={String(men)} tone="white" />
          <Stamp word="Coin" figure={String(state.money)} tone="black" />
          <Stamp word="Supplies" figure={String(state.supply)} note="Battlefield" tone="red" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-poster text-xl leading-none">Week {Math.min(state.week, 52)}</p>
          <a href="/" className="text-[13px] text-white/70 underline decoration-white/40 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            All games
          </a>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset this company and start again?")) game.reset();
            }}
            className="text-[13px] text-white/70 underline decoration-white/40 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Reset
          </button>
        </div>
      </header>
      {(shortage || game.error || game.busy) && (
        <p role="alert" className="shrink-0 bg-[#b00000] px-4 py-1 text-[13px] text-white">
          {game.error ?? game.busy ?? shortage}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
        <aside className="flex flex-col gap-2 border-b border-white/15 px-4 py-3 lg:border-b-0 lg:border-r">
          <Stamp word="Move" figure={movement.kind === "march" ? NODES[movement.to].name : "Stay"} tone="white" />
          {!locked && movement.kind === "march" && (
            <button type="button" onClick={() => game.move({ kind: "rest" })} className="text-left text-[13px] text-white/70 underline decoration-white/40 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Stay instead
            </button>
          )}
          <Stamp word="Action" figure={deed.kind === "rest" ? "Rest" : describeAction(deed)} tone="black" />
          {!locked && deed.kind !== "rest" && (
            <button type="button" onClick={() => game.act({ kind: "rest" })} className="text-left text-[13px] text-white/70 underline decoration-white/40 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Rest instead
            </button>
          )}
          <button
            type="button"
            onClick={game.liveWeek}
            disabled={!!game.busy}
            className="mt-auto bg-[#b00000] px-3 py-3 text-left font-poster text-3xl uppercase leading-none text-white shadow-[4px_4px_0_#fff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
          >
            {locked ? "Continue" : "Live the week"}
          </button>
        </aside>

        <section className="min-h-0 overflow-hidden px-4 py-3 lg:px-6">
          {special ? (
            <div className="h-full overflow-y-auto">
              {state.screen === "approach" && <Approach state={state} game={game} />}
              {(state.screen === "result" || state.screen === "chronicle") && <Result state={state} game={game} />}
              {state.screen === "choice" && <Choice state={state} game={game} />}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-funky text-4xl leading-none text-white sm:text-5xl" style={{ textShadow: "4px 4px 0 #e10600" }}>
                    {place.name}
                  </h1>
                  <p className="mt-2 text-[13px] text-white/70">{KINGDOM_NAME[place.kingdom]}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                aria-label={`Map of the kingdom. You are in ${place.name}. Open it.`}
                className="mt-3 h-28 w-full max-w-md shrink-0 border border-white bg-black shadow-[4px_4px_0_#e10600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MapCanvas location={state.location} bandAt={state.bandAt} bandits={!!state.bandits} />
              </button>
              <p className="mt-3 line-clamp-2 max-w-xl text-[14px] leading-snug text-white/80">{state.weekScene ?? place.ground}</p>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <PlaceActions
                  state={state}
                  game={game}
                  settlement={settlement}
                  woodHere={woodHere}
                  bandHere={bandHere}
                  coming={!!coming}
                  wood={wood}
                  locked={locked}
                  onTalk={() => {
                    if (!locked) game.act({ kind: "talk" });
                    setTalkOpen(true);
                  }}
                  onRecruit={() => setRecruitOpen(true)}
                  onBuy={() => setBuyOpen(true)}
                  onSearch={() => setWood("found")}
                  onRefuse={() => setWood("refused")}
                  onBack={() => setWood("list")}
                  onTrain={() => setTrainOpen(true)}
                />
              </div>
            </div>
          )}
        </section>

        <footer className="flex items-end gap-2 overflow-x-auto border-t border-[#e10600] bg-black px-4 py-2 lg:col-span-2">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            disabled={locked}
            className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
          >
            <Stamp word="Select move" figure={movement.kind === "march" ? NODES[movement.to].name : "Map"} tone="red" />
          </button>
          <ul className="flex gap-2">
            {state.units.map((unit) => {
              const on = selected.includes(unit.id);
              return (
                <li key={unit.id} className={on ? "flex shrink-0 items-center border border-[#e10600] bg-white text-black" : "flex shrink-0 items-center border border-white bg-black text-white"}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleUnit(unit.id)}
                    className="px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <span className="block font-funky text-sm leading-none">{unit.name}</span>
                    <span className="mt-1 block text-[12px] opacity-70">
                      {unit.count} {WIKI[unit.type].title.toLowerCase()}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Read about ${unit.name}`}
                    onClick={() => setReading(unit)}
                    className="px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </footer>
      </div>

      <Dialog open={mapOpen} onOpenChange={(open) => (open ? setMapOpen(true) : closeMap())}>
        <DialogContent className="max-w-3xl border-[#e10600] bg-black text-white">
          <DialogTitle className="font-funky text-2xl text-white" style={{ textShadow: "3px 3px 0 #e10600" }}>
            The kingdom
          </DialogTitle>
          <DialogDescription className="text-white/75">Tap a neighbouring place. Move replaces the march.</DialogDescription>
          <KingdomMap
            location={state.location}
            bandAt={state.bandAt}
            bandits={!!state.bandits}
            locked={locked}
            onMove={(to) => {
              game.move({ kind: "march", to });
              closeMap();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={talkOpen} onOpenChange={(open) => (open ? setTalkOpen(true) : closeTalk())}>
        <DialogContent className="max-w-lg border-white bg-black text-white">
          <DialogTitle className="font-funky text-2xl text-white">The elder of {place.name}</DialogTitle>
          <DialogDescription className="text-white/75">{place.ground}</DialogDescription>
          <ElderTalk state={state} game={game} />
        </DialogContent>
      </Dialog>

      <Dialog open={recruitOpen} onOpenChange={setRecruitOpen}>
        <DialogContent className="max-w-lg border-white bg-black text-white">
          <DialogTitle className="font-poster text-4xl uppercase text-white">Recruit</DialogTitle>
          <DialogDescription className="text-white/75">This spends the week's action.</DialogDescription>
          <Recruit state={state} game={game} onDone={() => setRecruitOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md border-white bg-black text-white">
          <DialogTitle className="font-poster text-4xl uppercase text-white">Food</DialogTitle>
          <DialogDescription className="text-white/75">No action. {PRICE.basic} coin a ration. It is in the stores at once.</DialogDescription>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20].map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="outline"
                disabled={state.money < PRICE.basic * amount || locked}
                onClick={() => {
                  game.buyFood(amount);
                  setBuyOpen(false);
                }}
              >
                {amount} for {PRICE.basic * amount} coin
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent className="max-w-lg border-white bg-black text-white">
          <DialogTitle className="font-poster text-4xl uppercase text-white">Train</DialogTitle>
          <DialogDescription className="text-white/75">Select two units in the company. This spends the week's action.</DialogDescription>
          <Train state={state} game={game} selected={selected} onDone={() => setTrainOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!reading} onOpenChange={(open) => !open && setReading(null)}>
        <DialogContent className="max-w-lg border-white bg-black text-white">
          <DialogTitle className="font-funky text-2xl text-white">{reading?.name}</DialogTitle>
          <DialogDescription>
            {reading ? `${reading.count} ${WIKI[reading.type].title.toLowerCase()}` : ""}
          </DialogDescription>
          <div className="space-y-2 text-[14px] leading-relaxed">
            {reading?.lines.map((line, index) => (
              <p key={`${reading.id}-${index}`} className={index === 0 ? "text-foreground" : "text-muted-foreground"}>
                {line}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaceActions({
  state,
  game,
  settlement,
  woodHere,
  bandHere,
  coming,
  wood,
  locked,
  onTalk,
  onRecruit,
  onBuy,
  onSearch,
  onRefuse,
  onBack,
  onTrain,
}: {
  state: GameState;
  game: Game;
  settlement: boolean;
  woodHere: boolean;
  bandHere: boolean;
  coming: boolean;
  wood: "list" | "found" | "refused";
  locked: boolean;
  onTalk: () => void;
  onRecruit: () => void;
  onBuy: () => void;
  onSearch: () => void;
  onRefuse: () => void;
  onBack: () => void;
  onTrain: () => void;
}) {
  const place = NODES[state.location];
  const deed = state.weekPlan.deed;

  if (bandHere && wood === "refused" && state.bandits) {
    return (
      <div>
        <p className="mb-3 max-w-xl text-[15px] leading-relaxed text-white">
          They will not parley. Word goes to {state.leader.name}. He will not treat with you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Row word="Attack" detail="Go in against the band." cost="The week" tone="red" pressed={false} disabled={!!game.busy} onClick={game.fight} />
          <Row word="Run" detail="The week is spent." cost="The week" tone="white" pressed={false} disabled={!!game.busy} onClick={() => void game.runAway()} />
        </div>
      </div>
    );
  }

  if (bandHere && wood === "found" && state.bandits) {
    return (
      <div>
        <p className="mb-3 text-[15px] leading-relaxed text-white">
          {state.leader.name} is in the trees, with {state.bandits.count}.
        </p>
        <div className="flex flex-wrap gap-3">
          <Row word="Attack" detail="Go in against the band." cost="The week" tone="red" pressed={false} disabled={!!game.busy} onClick={game.fight} />
          <Row word="Parley" detail="Ask them to talk." cost="" tone="white" pressed={false} disabled={!!game.busy} onClick={onRefuse} />
          {woodHere && (
            <Row word="Forage" detail="Look for food in the trees." cost="Action" tone="black" pressed={deed.kind === "forage"} disabled={!!game.busy} onClick={() => (state.screen === "forest" ? void game.forageHere() : game.act({ kind: "forage" }))} />
          )}
          <Row word="Sneak" detail="Pass them without a fight." cost="Action" tone="white" pressed={false} disabled={!!game.busy} onClick={() => void game.sneak()} />
        </div>
        {state.screen !== "forest" && (
          <button type="button" onClick={onBack} className="mt-3 text-[13px] text-white underline decoration-white/40 underline-offset-2">
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
      {settlement && (
        <Row word="Talk" detail={place.kind === "village" ? "The village elder." : "The elder."} cost="Action" tone="red" pressed={deed.kind === "talk"} disabled={false} onClick={onTalk} />
      )}
      {settlement && (
        <Row word="Recruit" detail="Men here will take coin." cost="Action" tone="white" pressed={deed.kind === "recruit"} disabled={locked} onClick={onRecruit} />
      )}
      {settlement && (
        <Row word="Food" detail="Buy rations." cost="No action" tone="black" pressed={false} disabled={locked} onClick={onBuy} />
      )}
      {game.rewardReady && (
        <Row word="Pay" detail={`${NODES[state.payAt].name} owes you.`} cost="" tone="red" pressed={false} disabled={!!game.busy} onClick={() => void game.takeReward()} />
      )}
      {woodHere && (
        <Row word="Forage" detail="Look for food in the trees." cost="Action" tone="red" pressed={deed.kind === "forage"} disabled={locked || !!game.busy} onClick={() => (state.screen === "forest" ? void game.forageHere() : game.act({ kind: "forage" }))} />
      )}
      {bandHere && (
        <Row word="Search" detail={`${state.leader.name} is in this ground.`} cost="" tone="white" pressed={false} disabled={!!game.busy} onClick={onSearch} />
      )}
      {bandHere && (
        <Row word="Sneak" detail="Pass them without a fight." cost="Action" tone="black" pressed={false} disabled={!!game.busy} onClick={() => void game.sneak()} />
      )}
      <Row word="Train" detail="Two units drill." cost="Action" tone="white" pressed={deed.kind === "train"} disabled={locked} onClick={onTrain} />
      {coming && (
        <Row word="Offer" detail="Another court has work." cost="" tone="black" pressed={false} disabled={!!game.busy} onClick={() => void game.hearContract()} />
      )}
      </div>
      {state.contract?.status === "offered" && (
        <div className="mt-3 max-w-xl border border-white p-3">
          <p className="text-[15px] leading-relaxed">{state.contract.offer}</p>
          <p className="mt-1 text-[13px] text-white/70">
            {state.contract.purse} coins at {NODES[state.contract.payAt].name}, when {state.contract.bandName} are gone from {NODES[state.contract.place].name}.
          </p>
          <Button type="button" variant="outline" className="mt-2 h-9 border-white bg-black text-white hover:bg-white hover:text-black" disabled={!!game.busy} onClick={game.takeOffer}>
            Take the work
          </Button>
        </div>
      )}
      {state.contract?.status === "taken" && (
        <p className="mt-3 text-[14px] text-white/70">
          {state.contract.leaderName} is at {NODES[state.contract.place].name}.
        </p>
      )}
    </div>
  );
}

function Stamp({
  word,
  figure,
  note,
  tone,
}: {
  word: string;
  figure?: string;
  note?: string;
  tone: "red" | "white" | "black";
}) {
  const face = tone === "red" ? "bg-[#b00000] text-white" : tone === "white" ? "bg-white text-black" : "border border-white bg-black text-white";
  return (
    <div className={`${face} flex h-[4.6rem] min-w-[6.4rem] flex-col justify-end px-2 pb-1.5 shadow-[4px_4px_0_#e10600]`}>
      {note ? <span className="text-[11px] leading-none opacity-80">{note}</span> : null}
      {figure ? <span className="line-clamp-2 font-poster text-[1.35rem] uppercase leading-none">{figure}</span> : null}
      <span className="font-poster text-lg uppercase leading-none">{word}</span>
    </div>
  );
}

function Row({
  word,
  detail,
  cost,
  tone,
  pressed,
  disabled,
  onClick,
}: {
  word: string;
  detail: string;
  cost: string;
  tone: "red" | "white" | "black";
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const face = tone === "red" ? "bg-[#b00000] text-white" : tone === "white" ? "bg-white text-black" : "border border-white bg-black text-white";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`${face} flex h-[5.4rem] w-[8.4rem] flex-col justify-end px-2 pb-2 text-left shadow-[4px_4px_0_#e10600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 ${pressed ? (tone === "white" ? "outline outline-2 outline-offset-2 outline-[#e10600]" : "outline outline-2 outline-offset-2 outline-white") : ""}`}
    >
      <span className="font-poster text-3xl uppercase leading-none">{word}</span>
      <span className="mt-1 line-clamp-2 text-[11px] leading-tight opacity-80">{detail}</span>
      {cost ? <span className="mt-1 text-[11px] font-semibold leading-none">{cost}</span> : null}
    </button>
  );
}

function MapCanvas({ location, bandAt, bandits }: { location: NodeId; bandAt: NodeId; bandits: boolean }) {
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[#e10600]" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="currentColor" strokeWidth="0.6" />
        ))}
      </svg>
      {(Object.values(NODES) as (typeof NODES)[NodeId][]).map((node) => (
        <span
          key={node.id}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          className={node.id === location ? "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e10600]" : "absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"}
        >
          <span className="sr-only">
            {node.name}
            {node.id === location ? ", here" : ""}
            {bandits && node.id === bandAt ? ", watched" : ""}
          </span>
        </span>
      ))}
    </div>
  );
}

function KingdomMap({
  location,
  bandAt,
  bandits,
  locked,
  onMove,
}: {
  location: NodeId;
  bandAt: NodeId;
  bandits: boolean;
  locked: boolean;
  onMove: (to: NodeId) => void;
}) {
  const near = new Set(neighbors(location));
  const [ask, setAsk] = useState<NodeId | null>(null);
  const asked = ask ? NODES[ask] : null;

  return (
    <div className="relative h-[28rem] border border-white bg-black">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[#e10600]" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="currentColor" strokeWidth="0.5" />
        ))}
      </svg>
      {(Object.values(NODES) as (typeof NODES)[NodeId][]).map((node) => {
        const here = node.id === location;
        const canMarch = near.has(node.id) && !locked;
        return (
          <button
            key={node.id}
            type="button"
            disabled={!canMarch}
            aria-current={here ? "true" : undefined}
            onClick={() => setAsk(node.id)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            className={here ? "absolute z-10 -translate-x-1/2 -translate-y-1/2 border border-black bg-[#b00000] px-2 py-1 text-left text-white shadow-[3px_3px_0_#fff]" : canMarch ? "absolute z-10 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-1 text-left text-black shadow-[3px_3px_0_#e10600]" : "absolute z-10 -translate-x-1/2 -translate-y-1/2 border border-white bg-black px-2 py-1 text-left text-white/60"}
          >
            <span className="block font-poster text-lg uppercase leading-none">
              {node.name}
              {here ? " · here" : ""}
            </span>
            <span className="mt-0.5 block text-[11px] opacity-80">{bandits && node.id === bandAt ? "bandits" : node.kind}</span>
          </button>
        );
      })}
      {asked && ask && near.has(ask) && (
        <div
          role="dialog"
          aria-labelledby="move-ask"
          className="absolute z-20 w-44 -translate-x-1/2 border border-white bg-black p-3 text-white shadow-[4px_4px_0_#e10600]"
          style={{ left: `${asked.x}%`, top: asked.y > 68 ? `calc(${asked.y}% - 5.5rem)` : `calc(${asked.y}% + 2.2rem)` }}
        >
          <p id="move-ask" className="font-poster text-2xl uppercase leading-none">
            Move to {asked.name}?
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" autoFocus className="h-8 bg-[#b00000] text-white hover:bg-[#b00000]/90" onClick={() => onMove(ask)}>
              Move
            </Button>
            <Button type="button" variant="outline" className="h-8 border-white bg-black text-white hover:bg-white hover:text-black" onClick={() => setAsk(null)}>
              Stay
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ElderTalk({ state, game }: { state: GameState; game: Game }) {
  const [text, setText] = useState("");
  return (
    <div>
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {state.elderTalk.length === 0 && <p className="text-[13px] text-white/70">He is here.</p>}
        {state.elderTalk.map((turn, index) => (
          <p key={index} className={turn.role === "elder" ? "text-[15px] leading-relaxed text-white" : "text-[14px] text-white/70"}>
            {turn.role === "elder" ? turn.text : `You. ${turn.text}`}
          </p>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || game.busy) return;
          void game.sendElder(text);
          setText("");
        }}
      >
        <label htmlFor="elder-say" className="sr-only">
          Say to the elder
        </label>
        <Input id="elder-say" value={text} onChange={(event) => setText(event.target.value)} placeholder="Say that the work is done" className="h-10 border-white bg-black text-white placeholder:text-white/40" />
        <Button type="submit" disabled={!!game.busy} className="h-10">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {!state.villageWork && state.bandits && state.location === "millcross" && (
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.takeWork()}>
            Take the work
          </Button>
        )}
        {game.rewardReady && (
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.takeReward()}>
            Collect the pay
          </Button>
        )}
      </div>
    </div>
  );
}

function Recruit({ state, game, onDone }: { state: GameState; game: Game; onDone: () => void }) {
  const types = recruitableTypes(state.location);
  const [type, setType] = useState<UnitTypeId>(types[0] ?? "swordsmen");
  const [count, setCount] = useState<3 | 5 | 10 | null>(null);
  const [into, setInto] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const price = manPrice(type);
  const targets = state.units.filter((unit) => unit.type === type && unit.count < 10);
  const plan = count && into ? recruitmentPlan(state.units, type, count, into) : null;

  return (
    <div>
      <ul className="space-y-1">
        {types.map((item) => (
          <li key={item}>
            <button
              type="button"
              aria-pressed={item === type}
              onClick={() => {
                setType(item);
                setCount(null);
                setInto(null);
                setNames([]);
              }}
              className={item === type ? "text-[15px] font-semibold text-white underline decoration-[#e10600] underline-offset-4" : "text-[15px] text-white/70"}
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
            disabled={price * size > state.money}
            onClick={() => {
              setCount(size);
              setInto(null);
              setNames([]);
            }}
          >
            {size} for {price * size}
          </Button>
        ))}
      </div>
      {count && (
        <div className="mt-3 flex flex-col items-start gap-2">
          {targets.map((unit) => (
            <button key={unit.id} type="button" aria-pressed={into === unit.id} onClick={() => choose(unit.id)} className={into === unit.id ? "text-[15px] font-semibold text-white" : "text-[15px] text-white/70"}>
              {unit.name}, {unit.count} of 10
            </button>
          ))}
          <button type="button" aria-pressed={into === "new"} onClick={() => choose("new")} className={into === "new" ? "text-[15px] font-semibold text-white" : "text-[15px] text-white/70"}>
            A new unit
          </button>
        </div>
      )}
      {plan?.fresh.map((fresh, index) => (
        <label key={`${type}-${into}-${index}`} className="mt-3 block text-[14px]">
          Name the new unit of {fresh}
          <Input
            value={names[index] ?? ""}
            maxLength={40}
            onChange={(event) =>
              setNames((current) => {
                const next = [...current];
                next[index] = event.target.value;
                return next;
              })
            }
            className="mt-1 h-9 border-white bg-black text-white"
          />
        </label>
      ))}
      {plan && count && into && (
        <Button
          type="button"
          className="mt-3"
          disabled={price * count > state.money}
          onClick={() => {
            game.act({
              kind: "recruit",
              type,
              count,
              names: plan.fresh.map((_, index) => (names[index] ?? "").trim()),
              into,
            });
            onDone();
          }}
        >
          Hire them
        </Button>
      )}
    </div>
  );

  function choose(next: string) {
    if (!count) return;
    setInto(next);
    const fresh = recruitmentPlan(state.units, type, count, next).fresh;
    setNames(defaultNamesFor(type, fresh.length, state.units.map((unit) => unit.name)));
  }
}

function Train({ state, game, selected, onDone }: { state: GameState; game: Game; selected: string[]; onDone: () => void }) {
  const ids = selected.filter((id) => state.units.some((unit) => unit.id === id));
  const pair = ids.length === 2 ? ([ids[0], ids[1]] as [string, string]) : null;
  const [drill, setDrill] = useState(DEFAULT_DRILL);
  const [ideas, setIdeas] = useState<string[]>([]);
  const named = pair ? pair.map((id) => state.units.find((unit) => unit.id === id)?.name).filter(Boolean).join(" and ") : "";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pair) return;
        game.act({ kind: "train", unitIds: pair, drill: drill.trim() || DEFAULT_DRILL });
        onDone();
      }}
    >
      <p className="text-[15px]">{pair ? named : "Select two units along the bottom, then come back."}</p>
      <label htmlFor="drill" className="sr-only">
        How they train
      </label>
      <Input id="drill" value={drill} onChange={(event) => setDrill(event.target.value)} className="mt-3 h-9 border-white bg-black text-white" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!pair || !!game.busy}
          onClick={async () => {
            if (!pair) return;
            const drills = await game.suggestDrills(pair);
            if (drills) setIdeas(drills);
          }}
        >
          Suggest
        </Button>
        <Button type="submit" disabled={!pair}>
          Drill them
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
    </form>
  );
}

function Approach({ state, game }: { state: GameState; game: Game }) {
  const [approach, setApproach] = useState(DEFAULT_APPROACH);
  const [supply, setSupply] = useState(0);
  const words = wordCount(approach);
  return (
    <div>
      <h2 className="font-funky text-3xl text-white" style={{ textShadow: "3px 3px 0 #e10600" }}>Before the fight</h2>
      <label htmlFor="approach" className="mt-3 block text-[15px]">
        How you mean to fight, in {APPROACH_WORDS} words or fewer
      </label>
      <textarea id="approach" value={approach} onChange={(event) => setApproach(event.target.value)} rows={4} className="mt-2 w-full border border-white bg-black p-3 text-[15px] text-white" />
      <p className="mt-1 text-[12px] text-muted-foreground">
        {words} / {APPROACH_WORDS}
      </p>
      <label htmlFor="supply-spent" className="mt-3 block text-[15px]">
        Supply to spend, up to {state.supply}
        <Input id="supply-spent" type="number" min={0} max={state.supply} value={supply} onChange={(event) => setSupply(Number(event.target.value))} className="mt-2 h-9 w-24 border-white bg-black text-white" />
      </label>
      <Button type="button" className="mt-4" disabled={!!game.busy || words < 1 || words > APPROACH_WORDS} onClick={() => void game.sendBattle(approach, supply)}>
        {game.busy ?? "Send them in"}
      </Button>
    </div>
  );
}

function Result({ state, game }: { state: GameState; game: Game }) {
  const full = state.screen === "chronicle";
  return (
    <div>
      <button type="button" onClick={() => game.show("dashboard")} className="text-[14px] text-white underline decoration-white/40 underline-offset-2">
        Back to {NODES[state.location].name}
      </button>
      <h2 className="mt-2 font-funky text-3xl text-white" style={{ textShadow: "3px 3px 0 #e10600" }}>The fight</h2>
      <p className="mt-3 text-[16px] leading-relaxed">{state.lastBrief}</p>
      {state.reputationShift.length > 0 && (
        <ul className="mt-3 space-y-2">
          {state.reputationShift.map((shift) => (
            <li key={shift.key} className="text-[14px] leading-relaxed">
              <span className="text-muted-foreground">{REPUTATION_LABEL[shift.key]}. </span>
              {shift.text}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => game.show(full ? "dashboard" : "chronicle")} className="mt-3 text-[13px] text-muted-foreground">
        {full ? "Hide the account" : "Read the account"}
      </button>
      {full && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">{state.lastChronicle}</p>}
    </div>
  );
}

function Choice({ state, game }: { state: GameState; game: Game }) {
  const survivors = state.banditSurvivors ?? 0;
  const needed = namesForSurvivors(survivors);
  const [names, setNames] = useState<string[]>(() => defaultNamesFor("bandit", needed, state.units.map((unit) => unit.name)));
  return (
    <div>
      <h2 className="font-funky text-3xl text-white" style={{ textShadow: "3px 3px 0 #e10600" }}>After the fight</h2>
      <p className="mt-3 text-[15px] leading-relaxed">{state.lastBrief}</p>
      {survivors <= 0 ? (
        <Button type="button" className="mt-4" disabled={!!game.busy} onClick={() => void game.choose("kill", [])}>
          Leave the dead
        </Button>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-[14px] text-muted-foreground">{survivors} of them are still alive.</p>
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.choose("kill", [])}>
            Kill them
          </Button>
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.choose("justice", [])}>
            Bring them to justice
          </Button>
          {names.map((name, index) => (
            <label key={index} className="text-[14px]">
              {needed === 1 ? "Name the unit" : `Name unit ${index + 1}`}
              <Input
                value={name}
                maxLength={40}
                onChange={(event) =>
                  setNames((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })
                }
                className="mt-1 h-9 border-white bg-black text-white"
              />
            </label>
          ))}
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.choose("recruit", names)}>
            Recruit them
          </Button>
        </div>
      )}
    </div>
  );
}
