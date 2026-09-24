"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EDGES, KINGDOM_NAME, NODES, isForest, isSettlement, neighbors, type NodeId } from "../data/map";
import { APPROACH_WORDS } from "../data/constants";
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

const paper = "border-[#1a1a1a]/20 bg-[#f3f0e8] text-[#1a1a1a] shadow-none";
const field = "border-[#1a1a1a]/30 bg-transparent text-[#1a1a1a] placeholder:text-[#1a1a1a]/40";
const inkButton = "border border-[#1a1a1a]/30 bg-transparent px-3 py-2 text-left text-[15px] text-[#1a1a1a] hover:border-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c] disabled:opacity-40";

function placeLine(id: NodeId): string {
  const place = NODES[id];
  const realm = KINGDOM_NAME[place.kingdom];
  if (place.kind === "village") return `A farming village in ${realm}`;
  if (place.kind === "capital") return `A city in ${realm}`;
  if (isForest(id)) return `A forest in ${realm}`;
  return `Wild ground in ${realm}`;
}

function turnLine(state: GameState): string {
  const movement = state.weekPlan.movement;
  const march = movement.kind === "march" ? `March to ${NODES[movement.to].name}` : "Stay";
  const deed = state.weekPlan.deed.kind === "rest" ? "Rest" : describeAction(state.weekPlan.deed);
  if (state.weekPlan.order === "movement-first") return `${march}, then ${deed.charAt(0).toLowerCase()}${deed.slice(1)}`;
  return `${deed}, then ${march.charAt(0).toLowerCase()}${march.slice(1)}`;
}

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
  const city = place.kind === "capital";
  const woodHere = isForest(state.location);
  const bandHere = !!state.bandits && state.location === state.bandAt;
  const coming = nextContractTemplate(state);
  const [mapOpen, setMapOpen] = useState(false);
  const [slot, setSlot] = useState<"move" | "action" | null>(null);
  const [talkOpen, setTalkOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [squareOpen, setSquareOpen] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [menOpen, setMenOpen] = useState(false);
  const [reading, setReading] = useState<GameState["units"][number] | null>(null);
  const [wood, setWood] = useState<"list" | "found" | "refused">("list");

  useEffect(() => {
    if (state.screen === "map") setMapOpen(true);
    if (state.screen === "elder") setTalkOpen(true);
    if (state.screen === "forest") setWood("found");
  }, [state.screen]);

  useEffect(() => {
    if (state.screen !== "forest") setWood("list");
  }, [state.location, state.screen]);

  function closeMap() {
    setMapOpen(false);
    if (state.screen === "map") game.show("dashboard");
  }

  function closeTalk() {
    setTalkOpen(false);
    if (state.screen === "elder") game.show("dashboard");
  }

  const special = state.screen === "approach" || state.screen === "result" || state.screen === "chronicle" || state.screen === "choice";
  const portrait =
    state.portraitAt === state.location && state.placePortrait
      ? state.placePortrait.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5)
      : [place.ground];
  const speaker = city ? "steward" : "elder";

  return (
    <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[#f3f0e8] text-[#1a1a1a]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1a1a1a]/15 px-4 py-2">
        <p className="font-gothic text-lg leading-none">Week {Math.min(state.week, 52)}</p>
        <div className="flex gap-4 text-[14px] text-[#1a1a1a]/60">
          <a href="/" className="underline decoration-[#1a1a1a]/30 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]">
            All games
          </a>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset this company and start again?")) game.reset();
            }}
            className="underline decoration-[#1a1a1a]/30 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]"
          >
            Reset
          </button>
        </div>
      </header>
      {(shortage || game.error || game.busy) && (
        <p role="alert" className="shrink-0 border-b border-[#9b1c1c]/30 bg-[#9b1c1c]/10 px-4 py-1 text-[14px] text-[#9b1c1c]">
          {game.error ?? game.busy ?? shortage}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[#1a1a1a]/15 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[#1a1a1a]/55">Actions this turn</p>
          <p className="font-gothic text-xl leading-tight">{turnLine(state)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setSlot("move")} disabled={locked} className={`${inkButton} min-w-[7.5rem] disabled:opacity-40`}>
              <span className="block text-[12px] text-[#1a1a1a]/55">Move</span>
              <span className="font-gothic text-lg leading-none">{movement.kind === "march" ? NODES[movement.to].name : "Stay"}</span>
            </button>
            <button type="button" onClick={() => setSlot("action")} disabled={locked} className={`${inkButton} min-w-[7.5rem] disabled:opacity-40`}>
              <span className="block text-[12px] text-[#1a1a1a]/55">Action</span>
              <span className="line-clamp-2 font-gothic text-lg leading-tight">{deed.kind === "rest" ? "Rest" : describeAction(deed)}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={game.liveWeek}
            disabled={!!game.busy}
            className="mt-3 bg-[#9b1c1c] px-4 py-2 font-gothic text-xl text-[#f3f0e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c] disabled:opacity-40"
          >
            {locked ? "Continue" : "Live the week"}
          </button>
        </div>
        <div className="flex gap-5">
          <Figure word="Food" figure={String(weeks)} note={weeks === 1 ? "week" : "weeks"} />
          <div className="relative" onMouseEnter={() => setMenOpen(true)} onMouseLeave={() => setMenOpen(false)}>
            <button type="button" aria-expanded={menOpen} onClick={() => setMenOpen((open) => !open)} className="text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]">
              <Figure word="Men" figure={String(men)} />
            </button>
            {menOpen && (
              <ul className="absolute right-0 z-20 mt-1 w-52 border border-[#1a1a1a]/20 bg-[#f3f0e8] p-2 text-left shadow-none">
                {state.units.map((unit) => (
                  <li key={unit.id} className="flex justify-between gap-3 py-0.5 text-[14px]">
                    <span>{unit.name}</span>
                    <span className="text-[#1a1a1a]/55">{unit.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Figure word="Coin" figure={String(state.money)} />
          <Figure word="Supplies" figure={String(state.supply)} note="Battlefield" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#1a1a1a]/15 p-3 lg:block">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            aria-label={`Map. You are in ${place.name}. Open the kingdom.`}
            className="block h-44 w-full bg-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]"
          >
            <MapCanvas location={state.location} bandAt={state.bandAt} bandits={!!state.bandits} />
          </button>
        </aside>

        <section className="min-h-0 overflow-y-auto px-4 py-4 lg:px-8">
          {special ? (
            <>
              {state.screen === "approach" && <Approach state={state} game={game} />}
              {(state.screen === "result" || state.screen === "chronicle") && <Result state={state} game={game} />}
              {state.screen === "choice" && <Choice state={state} game={game} />}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setMapOpen(true)} className="mb-3 h-28 w-full max-w-xs bg-[#1a1a1a] lg:hidden" aria-label={`Map. You are in ${place.name}.`}>
                <MapCanvas location={state.location} bandAt={state.bandAt} bandits={!!state.bandits} />
              </button>
              <h1 className="font-gothic text-6xl leading-none sm:text-7xl">{place.name}</h1>
              <p className="mt-2 text-[15px] text-[#1a1a1a]/60">{placeLine(state.location)}</p>
              <div className="mt-3 max-w-xl space-y-1">
                {portrait.map((line) => (
                  <p key={line} className="text-[17px] leading-snug">
                    {line}
                  </p>
                ))}
              </div>
              {state.weekScene && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#1a1a1a]/60">{state.weekScene}</p>}
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                <div>
                  <h2 className="font-gothic text-2xl">The place</h2>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <Ground
                      state={state}
                      game={game}
                      settlement={settlement}
                      city={city}
                      woodHere={woodHere}
                      bandHere={bandHere}
                      coming={!!coming}
                      wood={wood}
                      locked={locked}
                      onTalk={() => {
                        if (!locked) game.act({ kind: "talk" });
                        setTalkOpen(true);
                      }}
                      onMerchant={() => setMerchantOpen(true)}
                      onSquare={() => setSquareOpen(true)}
                      onRecruit={() => setRecruitOpen(true)}
                      onSearch={() => setWood("found")}
                      onRefuse={() => setWood("refused")}
                    />
                  </div>
                </div>
                <div>
                  <h2 className="font-gothic text-2xl">The company</h2>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <button type="button" disabled={locked} onClick={() => game.act({ kind: "rest" })} className={inkButton}>
                      {woodHere || !settlement ? "Make camp" : "Rest"}
                    </button>
                    <button type="button" disabled={locked} onClick={() => setTrainOpen(true)} className={inkButton}>
                      Train
                    </button>
                    {woodHere && (
                      <button
                        type="button"
                        disabled={locked || !!game.busy}
                        onClick={() => (state.screen === "forest" ? void game.forageHere() : game.act({ kind: "forage" }))}
                        className={inkButton}
                      >
                        Forage
                      </button>
                    )}
                    {woodHere && bandHere && (
                      <button type="button" disabled={!!game.busy} onClick={() => void game.sneak()} className={inkButton}>
                        Sneak past
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-[#1a1a1a]/15 px-4 py-3">
        <p className="text-[13px] text-[#1a1a1a]/55">Your units</p>
        <ul className="mt-1 flex gap-2 overflow-x-auto">
          {state.units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                onClick={() => setReading(unit)}
                className="border border-[#1a1a1a]/20 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1c1c]"
              >
                <span className="block font-gothic text-lg leading-none">{unit.name}</span>
                <span className="mt-1 block text-[13px] text-[#1a1a1a]/55">
                  {unit.count} {WIKI[unit.type].title.toLowerCase()}
                  {unit.raw ? ", raw" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </footer>

      <Dialog open={slot === "move"} onOpenChange={(open) => !open && setSlot(null)}>
        <DialogContent className={paper}>
          <DialogTitle className="font-gothic text-3xl">Move</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">
            {movement.kind === "march" ? `Set to march to ${NODES[movement.to].name}.` : "Set to stay."}
          </DialogDescription>
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              className={inkButton}
              onClick={() => {
                game.move({ kind: "rest" });
                setSlot(null);
              }}
            >
              Stay
            </button>
            <button
              type="button"
              className={inkButton}
              onClick={() => {
                setSlot(null);
                setMapOpen(true);
              }}
            >
              Open the map
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={slot === "action"} onOpenChange={(open) => !open && setSlot(null)}>
        <DialogContent className={paper}>
          <DialogTitle className="font-gothic text-3xl">Action</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">
            {deed.kind === "rest" ? "Set to rest." : describeAction(deed)}
          </DialogDescription>
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              className={inkButton}
              onClick={() => {
                game.act({ kind: "rest" });
                setSlot(null);
              }}
            >
              Rest
            </button>
            <button
              type="button"
              className={inkButton}
              onClick={() => {
                setSlot(null);
                setTrainOpen(true);
              }}
            >
              Train
            </button>
            {woodHere && (
              <button
                type="button"
                className={inkButton}
                onClick={() => {
                  game.act({ kind: "forage" });
                  setSlot(null);
                }}
              >
                Forage
              </button>
            )}
            {city && (
              <button
                type="button"
                className={inkButton}
                onClick={() => {
                  setSlot(null);
                  setRecruitOpen(true);
                }}
              >
                Recruit
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onOpenChange={(open) => (open ? setMapOpen(true) : closeMap())}>
        <DialogContent className={`max-w-3xl ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The kingdom</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">Tap a neighbouring place. Move replaces the march.</DialogDescription>
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
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The {speaker} of {place.name}</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">{place.ground}</DialogDescription>
          <ElderTalk state={state} game={game} />
        </DialogContent>
      </Dialog>

      <Dialog open={merchantOpen} onOpenChange={setMerchantOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The merchant</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">Food is {state.foodPrice} coin a ration. Buying does not spend the week.</DialogDescription>
          <MerchantTalk state={state} game={game} locked={locked} onBought={() => setMerchantOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={squareOpen} onOpenChange={setSquareOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The square</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">
            {city ? "A short speech. Men here are not soldiers." : "Farmers, if they will come."}
          </DialogDescription>
          <SquareTalk state={state} game={game} city={city} />
        </DialogContent>
      </Dialog>

      <Dialog open={recruitOpen} onOpenChange={setRecruitOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The recruiter</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">Trained men. This spends the week&apos;s action.</DialogDescription>
          <Recruit state={state} game={game} onDone={() => setRecruitOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">Train</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">Two units. This spends the week&apos;s action.</DialogDescription>
          <Train state={state} game={game} onDone={() => setTrainOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!reading} onOpenChange={(open) => !open && setReading(null)}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">{reading?.name}</DialogTitle>
          <DialogDescription className="text-[#1a1a1a]/70">
            {reading ? `${reading.count} ${WIKI[reading.type].title.toLowerCase()}${reading.raw ? ", raw" : ""}` : ""}
          </DialogDescription>
          <div className="space-y-2 text-[16px] leading-relaxed">
            {reading?.lines.map((line, index) => (
              <p key={`${reading.id}-${index}`} className={index === 0 ? "" : "text-[#1a1a1a]/70"}>
                {line}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Figure({ word, figure, note }: { word: string; figure: string; note?: string }) {
  return (
    <span className="block min-w-[4.5rem] text-right">
      {note ? <span className="block text-[12px] text-[#1a1a1a]/50">{note}</span> : <span className="block text-[12px] text-transparent">.</span>}
      <span className="block font-gothic text-3xl leading-none">{figure}</span>
      <span className="block text-[13px] text-[#1a1a1a]/55">{word}</span>
    </span>
  );
}

function Ground({
  state,
  game,
  settlement,
  city,
  woodHere,
  bandHere,
  coming,
  wood,
  locked,
  onTalk,
  onMerchant,
  onSquare,
  onRecruit,
  onSearch,
  onRefuse,
}: {
  state: GameState;
  game: Game;
  settlement: boolean;
  city: boolean;
  woodHere: boolean;
  bandHere: boolean;
  coming: boolean;
  wood: "list" | "found" | "refused";
  locked: boolean;
  onTalk: () => void;
  onMerchant: () => void;
  onSquare: () => void;
  onRecruit: () => void;
  onSearch: () => void;
  onRefuse: () => void;
}) {
  if (bandHere && wood === "refused" && state.bandits) {
    return (
      <>
        <p className="max-w-sm text-[15px] leading-relaxed">
          They will not parley. Word goes to {state.leader.name}. He will not treat with you.
        </p>
        <button type="button" disabled={!!game.busy} onClick={game.fight} className={inkButton}>
          Attack
        </button>
        <button type="button" disabled={!!game.busy} onClick={() => void game.runAway()} className={inkButton}>
          Run
        </button>
      </>
    );
  }

  if (bandHere && wood === "found" && state.bandits) {
    return (
      <>
        <p className="max-w-sm text-[15px] leading-relaxed">
          {state.leader.name} is in the trees, with {state.bandits.count}.
        </p>
        <button type="button" disabled={!!game.busy} onClick={game.fight} className={inkButton}>
          Attack
        </button>
        <button type="button" disabled={!!game.busy} onClick={onRefuse} className={inkButton}>
          Seek parley
        </button>
      </>
    );
  }

  return (
    <>
      {settlement && (
        <button type="button" onClick={onTalk} className={inkButton}>
          {city ? "The steward" : "The village elder"}
        </button>
      )}
      {settlement && (
        <button type="button" disabled={locked} onClick={onMerchant} className={inkButton}>
          The merchant
        </button>
      )}
      {city && (
        <button type="button" disabled={locked} onClick={onRecruit} className={inkButton}>
          The recruiter
        </button>
      )}
      {settlement && (
        <button type="button" onClick={onSquare} className={inkButton}>
          The square
        </button>
      )}
      {bandHere && (
        <button type="button" disabled={!!game.busy} onClick={onSearch} className={inkButton}>
          Search for the bandits
        </button>
      )}
      {game.rewardReady && (
        <p className="text-[15px]">
          {NODES[state.payAt].name} owes {state.rewardPurse} coins.{" "}
          <button type="button" disabled={!!game.busy} onClick={() => void game.takeReward()} className="underline decoration-[#9b1c1c] underline-offset-2">
            Collect the pay
          </button>
        </p>
      )}
      {city && coming && (
        <button type="button" disabled={!!game.busy} onClick={() => void game.hearContract()} className={inkButton}>
          Hear of work
        </button>
      )}
      {state.contract?.status === "offered" && (
        <div className="max-w-sm border border-[#1a1a1a]/20 p-3">
          <p className="text-[15px] leading-relaxed">{state.contract.offer}</p>
          <p className="mt-1 text-[14px] text-[#1a1a1a]/60">
            {state.contract.purse} coins at {NODES[state.contract.payAt].name}, when {state.contract.bandName} are gone from {NODES[state.contract.place].name}.
          </p>
          <Button type="button" variant="outline" className="mt-2 h-9" disabled={!!game.busy} onClick={game.takeOffer}>
            Take the work
          </Button>
        </div>
      )}
      {state.contract?.status === "taken" && (
        <p className="text-[15px] text-[#1a1a1a]/70">
          {state.contract.leaderName} is at {NODES[state.contract.place].name}.
        </p>
      )}
      {woodHere && !bandHere && <p className="text-[15px] text-[#1a1a1a]/60">The trees are quiet.</p>}
    </>
  );
}

function MapCanvas({ location, bandAt, bandits }: { location: NodeId; bandAt: NodeId; bandits: boolean }) {
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[#9b1c1c]" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="currentColor" strokeWidth="0.7" />
        ))}
      </svg>
      {(Object.values(NODES) as (typeof NODES)[NodeId][]).map((node) => {
        const here = node.id === location;
        return (
          <span key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
            {here && (
              <svg aria-hidden="true" viewBox="0 0 10 8" className="absolute bottom-full left-1/2 mb-0.5 h-2 w-2.5 -translate-x-1/2 fill-[#9b1c1c]">
                <polygon points="5,8 0,0 10,0" />
              </svg>
            )}
            <span className={here ? "block h-2.5 w-2.5 rounded-full bg-[#9b1c1c]" : "block h-1.5 w-1.5 rounded-full bg-white"} />
            <span className="sr-only">
              {node.name}
              {here ? ", here" : ""}
              {bandits && node.id === bandAt ? ", watched" : ""}
            </span>
          </span>
        );
      })}
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
    <div className="relative h-[28rem] bg-[#1a1a1a]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[#9b1c1c]" preserveAspectRatio="none" aria-hidden="true">
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
            className={
              here
                ? "absolute z-10 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-left text-[#9b1c1c]"
                : canMarch
                  ? "absolute z-10 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-left text-white"
                  : "absolute z-10 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-left text-white/45"
            }
          >
            <span className="block font-gothic text-[13px] leading-none">
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
          className="absolute z-20 w-40 -translate-x-1/2 border border-[#1a1a1a]/20 bg-[#f3f0e8] p-3 text-[#1a1a1a]"
          style={{ left: `${asked.x}%`, top: asked.y > 68 ? `calc(${asked.y}% - 5.5rem)` : `calc(${asked.y}% + 2.2rem)` }}
        >
          <p id="move-ask" className="font-gothic text-xl leading-none">
            Move to {asked.name}?
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" autoFocus className="h-8 bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90" onClick={() => onMove(ask)}>
              Move
            </Button>
            <Button type="button" variant="outline" className="h-8" onClick={() => setAsk(null)}>
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
  const workHere = !state.villageWork && !!state.bandits && state.location === state.payAt && state.location === "millcross";
  return (
    <div>
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {state.elderTalk.length === 0 && <p className="text-[14px] text-[#1a1a1a]/60">He is here.</p>}
        {state.elderTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[#1a1a1a]/70" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
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
          Say it
        </label>
        <Input id="elder-say" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask him what he needs" className={`h-10 ${field}`} />
        <Button type="submit" disabled={!!game.busy} className="h-10 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {workHere && state.workHeard && (
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.takeWork()}>
            Take the work
          </Button>
        )}
        {game.rewardReady && (
          <p className="text-[15px]">
            The purse is owed.{" "}
            <button type="button" disabled={!!game.busy} onClick={() => void game.takeReward()} className="underline decoration-[#9b1c1c] underline-offset-2">
              Collect the pay
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function MerchantTalk({ state, game, locked, onBought }: { state: GameState; game: Game; locked: boolean; onBought: () => void }) {
  const [text, setText] = useState("");
  const price = state.foodPrice === 1 ? 1 : 2;
  return (
    <div>
      <div className="max-h-48 space-y-3 overflow-y-auto">
        {state.merchantTalk.length === 0 && <p className="text-[14px] text-[#1a1a1a]/60">Posted price, {price} coins a ration.</p>}
        {state.merchantTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[#1a1a1a]/70" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
          </p>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || game.busy) return;
          void game.sendMerchant(text);
          setText("");
        }}
      >
        <label htmlFor="merchant-say" className="sr-only">
          Say to the merchant
        </label>
        <Input id="merchant-say" value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask the price down" className={`h-10 ${field}`} />
        <Button type="submit" disabled={!!game.busy} className="h-10 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {[5, 10, 20].map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            disabled={state.money < price * amount || locked}
            onClick={() => {
              game.buyFood(amount);
              onBought();
            }}
          >
            {amount} for {price * amount}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SquareTalk({ state, game, city }: { state: GameState; game: Game; city: boolean }) {
  const [text, setText] = useState("");
  const [levies, setLevies] = useState<number | null>(null);
  const [name, setName] = useState("The Levies");
  const unarmed = state.units.filter((unit) => unit.type === "militia");

  return (
    <div>
      <div className="max-h-48 space-y-3 overflow-y-auto">
        {state.squareTalk.length === 0 && <p className="text-[14px] text-[#1a1a1a]/60">{city ? "They will not give you a speech until you speak." : "The square is open."}</p>}
        {state.squareTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[#1a1a1a]/70" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
          </p>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void say(text);
        }}
      >
        <label htmlFor="square-say" className="sr-only">
          Say to the square
        </label>
        <Input id="square-say" value={text} onChange={(event) => setText(event.target.value)} placeholder="Speak to them" className={`h-10 ${field}`} />
        <Button type="submit" disabled={!!game.busy} className="h-10 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90">
          Say it
        </Button>
      </form>
      <Button type="button" variant="outline" className="mt-3" disabled={!!game.busy} onClick={() => void say("We call for men.")}>
        Call for men
      </Button>
      {levies !== null && (
        <div className="mt-3">
          <p className="text-[15px]">{levies} will come, free and unarmed.</p>
          <label htmlFor="levy-name" className="mt-2 block text-[14px]">
            Name them
            <Input id="levy-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className={`mt-1 h-9 ${field}`} />
          </label>
          <Button
            type="button"
            className="mt-2 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90"
            onClick={() => {
              game.takeMilitia(levies, name);
              setLevies(null);
            }}
          >
            Take them
          </Button>
        </div>
      )}
      {unarmed.map((unit) => (
        <div key={unit.id} className="mt-3">
          <p className="text-[15px]">
            Arm {unit.name}, {unit.count} coins.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["spears", "swords", "bows"] as const).map((weapon) => (
              <Button
                key={weapon}
                type="button"
                variant="outline"
                disabled={state.money < unit.count}
                onClick={() => game.armMen(unit.id, weapon === "spears" ? "spearmen" : weapon === "swords" ? "swordsmen" : "archers")}
              >
                {weapon}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  async function say(message: string) {
    if (!message.trim() || game.busy) return;
    const offered = await game.sendSquare(message);
    setText("");
    if (offered) setLevies(offered);
  }
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
              className={item === type ? "text-[16px] underline decoration-[#9b1c1c] underline-offset-4" : "text-[16px] text-[#1a1a1a]/70"}
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
            <button key={unit.id} type="button" aria-pressed={into === unit.id} onClick={() => choose(unit.id)} className={into === unit.id ? "text-[16px] underline decoration-[#9b1c1c]" : "text-[16px] text-[#1a1a1a]/70"}>
              {unit.name}, {unit.count} of 10
            </button>
          ))}
          <button type="button" aria-pressed={into === "new"} onClick={() => choose("new")} className={into === "new" ? "text-[16px] underline decoration-[#9b1c1c]" : "text-[16px] text-[#1a1a1a]/70"}>
            A new unit
          </button>
        </div>
      )}
      {plan?.fresh.map((fresh, index) => (
        <label key={`${type}-${into}-${index}`} className="mt-3 block text-[15px]">
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
            className={`mt-1 h-9 ${field}`}
          />
        </label>
      ))}
      {plan && count && into && (
        <Button
          type="button"
          className="mt-3 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90"
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

function Train({ state, game, onDone }: { state: GameState; game: Game; onDone: () => void }) {
  const [boxes, setBoxes] = useState<[string | null, string | null]>([null, null]);
  const [picking, setPicking] = useState<0 | 1 | null>(null);
  const [drill, setDrill] = useState(DEFAULT_DRILL);
  const [ideas, setIdeas] = useState<string[]>([]);
  const pair = boxes[0] && boxes[1] && boxes[0] !== boxes[1] ? ([boxes[0], boxes[1]] as [string, string]) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!pair) return;
        game.act({ kind: "train", unitIds: pair, drill: drill.trim() || DEFAULT_DRILL });
        onDone();
      }}
    >
      <div className="flex gap-2">
        {([0, 1] as const).map((index) => {
          const id = boxes[index];
          const unit = id ? state.units.find((item) => item.id === id) : null;
          return (
            <button key={index} type="button" onClick={() => setPicking(picking === index ? null : index)} className={`${inkButton} min-h-[4.5rem] min-w-[8rem]`}>
              <span className="block text-[12px] text-[#1a1a1a]/55">Unit {index + 1}</span>
              <span className="font-gothic text-lg leading-none">{unit ? unit.name : "Empty"}</span>
            </button>
          );
        })}
      </div>
      {picking !== null && (
        <ul className="mt-2 space-y-1">
          {state.units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                onClick={() => {
                  setBoxes((current) => {
                    const next: [string | null, string | null] = [...current];
                    next[picking] = unit.id;
                    return next;
                  });
                  setPicking(null);
                }}
                className="text-[16px] underline decoration-[#1a1a1a]/30 underline-offset-2"
              >
                {unit.name}, {unit.count}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="drill" className="sr-only">
        How they train
      </label>
      <Input id="drill" value={drill} onChange={(event) => setDrill(event.target.value)} className={`mt-3 h-9 ${field}`} />
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
        <Button type="submit" disabled={!pair} className="bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90">
          Drill them
        </Button>
      </div>
      {ideas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => setDrill(idea)} className="border border-[#1a1a1a]/25 px-2 py-1 text-[14px]">
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
      <h2 className="font-gothic text-4xl">Before the fight</h2>
      <label htmlFor="approach" className="mt-3 block text-[16px]">
        How you mean to fight, in {APPROACH_WORDS} words or fewer
      </label>
      <textarea id="approach" value={approach} onChange={(event) => setApproach(event.target.value)} rows={4} className={`mt-2 w-full border p-3 text-[16px] ${field}`} />
      <p className="mt-1 text-[13px] text-[#1a1a1a]/55">
        {words} / {APPROACH_WORDS}
      </p>
      <label htmlFor="supply-spent" className="mt-3 block text-[16px]">
        Supply to spend, up to {state.supply}
        <Input id="supply-spent" type="number" min={0} max={state.supply} value={supply} onChange={(event) => setSupply(Number(event.target.value))} className={`mt-2 h-9 w-24 ${field}`} />
      </label>
      <Button type="button" className="mt-4 bg-[#9b1c1c] text-[#f3f0e8] hover:bg-[#9b1c1c]/90" disabled={!!game.busy || words < 1 || words > APPROACH_WORDS} onClick={() => void game.sendBattle(approach, supply)}>
        {game.busy ?? "Send them in"}
      </Button>
    </div>
  );
}

function Result({ state, game }: { state: GameState; game: Game }) {
  const full = state.screen === "chronicle";
  return (
    <div>
      <button type="button" onClick={() => game.show("dashboard")} className="text-[15px] underline decoration-[#1a1a1a]/30 underline-offset-2">
        Back to {NODES[state.location].name}
      </button>
      <h2 className="mt-2 font-gothic text-4xl">The fight</h2>
      <p className="mt-3 text-[17px] leading-relaxed">{state.lastBrief}</p>
      {state.reputationShift.length > 0 && (
        <ul className="mt-3 space-y-2">
          {state.reputationShift.map((shift) => (
            <li key={shift.key} className="text-[15px] leading-relaxed">
              <span className="text-[#1a1a1a]/55">{REPUTATION_LABEL[shift.key]}. </span>
              {shift.text}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => game.show(full ? "dashboard" : "chronicle")} className="mt-3 text-[14px] text-[#1a1a1a]/60">
        {full ? "Hide the account" : "Read the account"}
      </button>
      {full && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[#1a1a1a]/70">{state.lastChronicle}</p>}
    </div>
  );
}

function Choice({ state, game }: { state: GameState; game: Game }) {
  const survivors = state.banditSurvivors ?? 0;
  const needed = namesForSurvivors(survivors);
  const [names, setNames] = useState<string[]>(() => defaultNamesFor("bandit", needed, state.units.map((unit) => unit.name)));
  return (
    <div>
      <h2 className="font-gothic text-4xl">After the fight</h2>
      <p className="mt-3 text-[16px] leading-relaxed">{state.lastBrief}</p>
      {survivors <= 0 ? (
        <Button type="button" className="mt-4 bg-[#1a1a1a] text-[#f3f0e8] hover:bg-[#1a1a1a]/90" disabled={!!game.busy} onClick={() => void game.choose("kill", [])}>
          Leave the dead
        </Button>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-[15px] text-[#1a1a1a]/60">{survivors} of them are still alive.</p>
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.choose("kill", [])}>
            Kill them
          </Button>
          <Button type="button" variant="outline" disabled={!!game.busy} onClick={() => void game.choose("justice", [])}>
            Bring them to justice
          </Button>
          {names.map((name, index) => (
            <label key={index} className="text-[15px]">
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
                className={`mt-1 h-9 ${field}`}
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
