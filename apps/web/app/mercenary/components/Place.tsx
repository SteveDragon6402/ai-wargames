"use client";

import { useEffect, useState, type ButtonHTMLAttributes } from "react";
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

const paper = "border-[var(--merc-line)] bg-[var(--merc-bg)] text-[var(--merc-text)] shadow-none";
const field = "border-[var(--merc-line)] bg-[var(--merc-field)] text-[var(--merc-text)] placeholder:text-[var(--merc-muted)]";
const inkButton = "border border-[var(--merc-line)] bg-transparent px-3 py-2 text-left text-[15px] text-[var(--merc-text)] hover:border-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)] disabled:opacity-40";
const solid = "border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] shadow-none hover:bg-[var(--merc-raise)] hover:text-[var(--merc-text)]";

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
  return `${deed}, then ${march.charAt(0).toLowerCase()}${march.slice(1)}`;
}

export default function Board({ game }: { game: Game }) {
  const { state } = game;
  const place = NODES[state.location];
  const locked = state.resolveIndex > 0;
  const spent =
    locked ||
    !!state.pendingBattle ||
    (!!game.busy && !/thinking|drills|new name|travelling/i.test(game.busy));
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
  const [companyOpen, setCompanyOpen] = useState(false);
  const [unitLinesOpen, setUnitLinesOpen] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
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
      ? state.placePortrait.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2)
      : [place.ground];
  const speaker = city ? "steward" : "elder";
  const reading = readingId ? state.units.find((unit) => unit.id === readingId) ?? null : null;

  return (
    <div data-ground={city ? "city" : place.kind === "village" ? "village" : "woods"} className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[var(--merc-ground)] text-[var(--merc-text)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--merc-line)] px-4 py-2">
        <p className="font-gothic text-lg leading-none">Week {Math.min(state.week, 52)}</p>
        <div className="flex gap-4 text-[14px] text-[var(--merc-muted)]">
          <a href="/" className="underline decoration-[var(--merc-muted)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]">
            All games
          </a>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset this company and start again?")) game.reset();
            }}
            className="underline decoration-[var(--merc-muted)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
          >
            Reset
          </button>
        </div>
      </header>
      {(shortage || game.error || game.busy) && (
        <p role="alert" className="shrink-0 border-b border-[var(--merc-line)] bg-[var(--merc-raise)] px-4 py-1 text-[14px] text-[var(--merc-text)]">
          {game.error ?? game.busy ?? shortage}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[var(--merc-line)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--merc-muted)]">Actions this turn</p>
          <p className="font-gothic text-xl leading-tight">{turnLine(state)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setSlot("move")} disabled={spent} className={`${inkButton} min-w-[7.5rem] disabled:opacity-40`}>
              <span className="block text-[12px] text-[var(--merc-muted)]">Move</span>
              <span className="font-gothic text-lg leading-none">{movement.kind === "march" ? NODES[movement.to].name : "Stay"}</span>
            </button>
            <button type="button" onClick={() => setSlot("action")} disabled={spent} className={`${inkButton} min-w-[7.5rem] disabled:opacity-40`}>
              <span className="block text-[12px] text-[var(--merc-muted)]">Action</span>
              <span className="line-clamp-2 font-gothic text-lg leading-tight">{deed.kind === "rest" ? "Rest" : describeAction(deed)}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={game.liveWeek}
            disabled={!!game.busy}
            className="mt-3 bg-[var(--merc-red-deep)] px-4 py-2 font-gothic text-xl text-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)] disabled:opacity-40"
          >
            {locked ? "Continue" : "Live the week"}
          </button>
        </div>
        <div className="flex gap-5">
          <Figure word="Food" figure={String(weeks)} note={weeks === 1 ? "week" : "weeks"} />
          <div className="relative" onMouseEnter={() => setMenOpen(true)} onMouseLeave={() => setMenOpen(false)}>
            <button type="button" aria-expanded={menOpen} onClick={() => setMenOpen((open) => !open)} className="text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]">
              <Figure word="Men" figure={String(men)} />
            </button>
            {menOpen && (
              <ul className="absolute right-0 z-20 mt-1 w-52 border border-[var(--merc-line)] bg-[var(--merc-bg)] p-2 text-left shadow-none">
                {state.units.map((unit) => (
                  <li key={unit.id} className="flex justify-between gap-3 py-0.5 text-[14px]">
                    <span>{unit.name}</span>
                    <span className="text-[var(--merc-muted)]">{unit.count}</span>
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
        <aside className="hidden border-r border-[var(--merc-line)] p-3 lg:block">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            aria-label={`Map. You are in ${place.name}. Open the kingdom.`}
            className="block h-44 w-full bg-[var(--merc-map)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
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
              <button type="button" onClick={() => setMapOpen(true)} className="mb-3 h-28 w-full max-w-xs bg-[var(--merc-map)] lg:hidden" aria-label={`Map. You are in ${place.name}.`}>
                <MapCanvas location={state.location} bandAt={state.bandAt} bandits={!!state.bandits} />
              </button>
              <h1 className="font-gothic text-6xl leading-none sm:text-7xl">{place.name}</h1>
              <div className="mt-3 h-40 w-full border border-[var(--merc-line)] bg-[var(--merc-field)]" aria-hidden="true" />
              <p className="mt-2 text-[15px] text-[var(--merc-muted)]">{placeLine(state.location)}</p>
              <div className="mt-3 space-y-1">
                {portrait.map((line) => (
                  <p key={line} className="text-[17px] leading-snug">
                    {line}
                  </p>
                ))}
              </div>
              {state.weekScene && <p className="mt-3 text-[15px] leading-relaxed text-[var(--merc-muted)]">{state.weekScene}</p>}
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
                      onTalk={() => setTalkOpen(true)}
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
                  <div className="mt-3 flex flex-col items-start gap-2">
                    <Act disabled={spent} onClick={() => game.act({ kind: "rest" })} hint={woodHere || !settlement ? "Stay, and rest where you are." : "Spend the week here."}>
                      {woodHere || !settlement ? "Make camp" : "Rest"}
                    </Act>
                    <Act disabled={spent} onClick={() => setTrainOpen(true)} hint="Two units drill.">
                      Train
                    </Act>
                    {woodHere && (
                      <Act
                        disabled={spent || !!game.busy}
                        onClick={() => (state.screen === "forest" ? void game.forageHere() : game.act({ kind: "forage" }))}
                        hint="Look for food in the trees."
                      >
                        Forage
                      </Act>
                    )}
                    {woodHere && bandHere && (
                      <Act disabled={spent || !!game.busy} onClick={() => void game.sneak()} hint="Pass them without a fight.">
                        Sneak past
                      </Act>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-[var(--merc-line)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[var(--merc-muted)]">Your units</p>
        <ul className="mt-1 flex gap-2 overflow-x-auto">
          {state.units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                onClick={() => setReadingId(unit.id)}
                className="border border-[var(--merc-line)] px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
              >
                <span className="block font-gothic text-lg leading-none">{unit.name}</span>
                <span className="mt-1 block text-[13px] text-[var(--merc-muted)]">
                  {unit.count} {WIKI[unit.type].title.toLowerCase()}
                  {unit.raw ? ", raw" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        </div>
        <div className="w-full max-w-sm sm:w-72">
          <button
            type="button"
            aria-expanded={companyOpen}
            onClick={() => setCompanyOpen((open) => !open)}
            className="text-[13px] text-[var(--merc-muted)] underline decoration-[var(--merc-muted)] underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]"
          >
            The company
          </button>
          {companyOpen && (
            <div className="mt-2 space-y-1 text-[15px] leading-snug">
              <p>{state.morale}</p>
              <p>{state.condition}</p>
              <p>{state.stance}</p>
              <button
                type="button"
                aria-expanded={unitLinesOpen}
                onClick={() => setUnitLinesOpen((open) => !open)}
                className="mt-1 text-[13px] text-[var(--merc-muted)] underline decoration-[var(--merc-muted)] underline-offset-2"
              >
                Each unit
              </button>
              {unitLinesOpen && (
                <ul className="space-y-2 pt-1">
                  {state.units.map((unit) => (
                    <li key={unit.id}>
                      <p className="font-gothic text-lg leading-none">{unit.name}</p>
                      {unit.lines.map((line) => (
                        <p key={line} className="text-[14px] text-[var(--merc-muted)]">
                          {line}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        </div>
      </footer>

      <Dialog open={slot === "move"} onOpenChange={(open) => !open && setSlot(null)}>
        <DialogContent className={paper}>
          <DialogTitle className="font-gothic text-3xl">Move</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">
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
          <DialogDescription className="text-[var(--merc-muted)]">
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onOpenChange={(open) => (open ? setMapOpen(true) : closeMap())}>
        <DialogContent className={`max-w-3xl ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The kingdom</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">Tap a neighbouring place. Move replaces the march.</DialogDescription>
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
          <DialogDescription className="text-[var(--merc-muted)]">{place.ground}</DialogDescription>
          <ElderTalk state={state} game={game} />
        </DialogContent>
      </Dialog>

      <Dialog open={merchantOpen} onOpenChange={setMerchantOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The merchant</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">Food is {state.foodPrice} coin a ration. Buying does not spend the week.</DialogDescription>
          <MerchantTalk state={state} game={game} onBought={() => setMerchantOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={squareOpen} onOpenChange={setSquareOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The square</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">
            {city ? "A short speech. Men here are not soldiers." : "Farmers, if they will come."}
          </DialogDescription>
          <SquareTalk state={state} game={game} city={city} />
        </DialogContent>
      </Dialog>

      <Dialog open={recruitOpen} onOpenChange={setRecruitOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">The recruiter</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">Trained men. They join at once. This does not spend the week.</DialogDescription>
          <Recruit state={state} game={game} onDone={() => setRecruitOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent className={`max-w-lg ${paper}`}>
          <DialogTitle className="font-gothic text-3xl">Train</DialogTitle>
          <DialogDescription className="text-[var(--merc-muted)]">Two units. This spends the week&apos;s action.</DialogDescription>
          <Train state={state} game={game} onDone={() => setTrainOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!reading} onOpenChange={(open) => !open && setReadingId(null)}>
        <DialogContent className={`max-w-lg ${paper}`}>
          {reading && <UnitSheet unit={reading} game={game} locked={locked} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Act({
  hint,
  mark,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { hint: string; mark?: boolean }) {
  const name = typeof children === "string" ? children : "";
  return (
    <button
      type="button"
      title={hint}
      aria-label={mark && name ? `${name}. Has something to say. ${hint}` : undefined}
      {...props}
      className={inkButton}
    >
      <span className="flex items-center gap-2 font-gothic text-lg leading-none">
        {mark ? (
          <span className="text-[var(--merc-red)]" aria-hidden="true">
            !
          </span>
        ) : null}
        <span>{children}</span>
      </span>
      <span className="mt-1 block max-w-[16rem] text-[13px] leading-snug text-[var(--merc-muted)]">{hint}</span>
    </button>
  );
}

function UnitSheet({ unit, game, locked }: { unit: GameState["units"][number]; game: Game; locked: boolean }) {
  const [name, setName] = useState(unit.name);
  useEffect(() => setName(unit.name), [unit.id, unit.name]);
  const levy = unit.type === "militia";

  return (
    <div>
      <DialogTitle className="font-gothic text-3xl">{unit.name}</DialogTitle>
      <DialogDescription className="text-[var(--merc-muted)]">
        {unit.count} {WIKI[unit.type].title.toLowerCase()}
        {unit.raw ? ", raw" : ""}
      </DialogDescription>
      <div className="space-y-2 text-[16px] leading-relaxed">
        {unit.lines.map((line, index) => (
          <p key={`${unit.id}-${index}`} className={index === 0 ? "text-[var(--merc-text)]" : "text-[var(--merc-muted)]"}>
            {line}
          </p>
        ))}
      </div>
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void game.renameMen(unit.id, name);
        }}
      >
        <label htmlFor="unit-name" className="block text-[15px]">
          Name
          <Input id="unit-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className={`mt-1 h-9 ${field}`} />
        </label>
        <Button type="submit" className={`mt-2 ${solid}`} disabled={locked || !!game.busy || !name.trim() || name.trim() === unit.name}>
          Rename
        </Button>
      </form>
      {levy && (
        <div className="mt-4">
          <p className="text-[15px]">Arm them for {unit.count} coins. They stay raw until a drill.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["spears", "swords", "bows"] as const).map((weapon) => (
              <Button
                key={weapon}
                type="button"
                variant="outline"
                className={solid}
                disabled={locked || game.state.money < unit.count}
                onClick={() => game.armMen(unit.id, weapon === "spears" ? "spearmen" : weapon === "swords" ? "swordsmen" : "archers")}
              >
                {weapon}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({ word, figure, note }: { word: string; figure: string; note?: string }) {
  return (
    <span className="block min-w-[4.5rem] text-right">
      {note ? <span className="block text-[12px] text-[var(--merc-muted)]">{note}</span> : <span className="block text-[12px] text-transparent">.</span>}
      <span className="block font-gothic text-3xl leading-none">{figure}</span>
      <span className="block text-[13px] text-[var(--merc-muted)]">{word}</span>
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
        <Act disabled={!!game.busy} onClick={game.fight} hint="Go in against them.">
          Attack
        </Act>
        <Act disabled={!!game.busy} onClick={() => void game.runAway()} hint="The week is spent.">
          Run
        </Act>
      </>
    );
  }

  if (bandHere && wood === "found" && state.bandits) {
    return (
      <>
        <p className="max-w-sm text-[15px] leading-relaxed">
          {state.leader.name} is in the trees, with {state.bandits.count}.
        </p>
        <Act disabled={!!game.busy} onClick={game.fight} hint="Go in against them.">
          Attack
        </Act>
        <Act disabled={!!game.busy} onClick={onRefuse} hint="Ask them to talk.">
          Seek parley
        </Act>
      </>
    );
  }

  const wantsTalk =
    (state.location === "millcross" && !!state.bandits && !state.villageWork && !state.workHeard) ||
    (game.rewardReady && state.location === state.payAt) ||
    (city && (coming || state.contract?.status === "offered"));

  return (
    <>
      {settlement && (
        <Act onClick={onTalk} mark={wantsTalk} hint={city ? "Talk. Contracts are heard here." : "Talk. He may have work, or the purse."}>
          {city ? "The steward" : "The village elder"}
        </Act>
      )}
      {settlement && (
        <Act onClick={onMerchant} hint="Food. Two coins a ration, unless he agrees one.">
          The merchant
        </Act>
      )}
      {city && (
        <Act onClick={onRecruit} hint="Trained men. Foot is five coins. The country's own is twelve.">
          The recruiter
        </Act>
      )}
      {settlement && (
        <Act onClick={onSquare} hint="You can find men here.">
          The square
        </Act>
      )}
      {bandHere && (
        <Act disabled={!!game.busy} onClick={onSearch} hint="Look for the band in this ground.">
          Search for the bandits
        </Act>
      )}
      {game.rewardReady && (
        <p className="text-[15px]">
          {NODES[state.payAt].name} owes {state.rewardPurse} coins.{" "}
          <button type="button" disabled={!!game.busy} onClick={() => void game.takeReward()} className="underline decoration-[var(--merc-red)] underline-offset-2">
            Collect the pay
          </button>
        </p>
      )}
      {city && coming && (
        <Act disabled={!!game.busy} onClick={() => void game.hearContract()} hint="Another court has a job.">
          Hear of work
        </Act>
      )}
      {state.contract?.status === "offered" && (
        <div className="max-w-sm border border-[var(--merc-line)] p-3">
          <p className="text-[15px] leading-relaxed">{state.contract.offer}</p>
          <p className="mt-1 text-[14px] text-[var(--merc-muted)]">
            {state.contract.purse} coins at {NODES[state.contract.payAt].name}, when {state.contract.bandName} are gone from {NODES[state.contract.place].name}.
          </p>
          <Button type="button" variant="outline" className="mt-2 h-9" disabled={!!game.busy} onClick={game.takeOffer}>
            Take the work
          </Button>
        </div>
      )}
      {state.contract?.status === "taken" && (
        <p className="text-[15px] text-[var(--merc-muted)]">
          {state.contract.leaderName} is at {NODES[state.contract.place].name}.
        </p>
      )}
      {woodHere && !bandHere && <p className="text-[15px] text-[var(--merc-muted)]">The trees are quiet.</p>}
    </>
  );
}

function MapCanvas({ location, bandAt, bandits }: { location: NodeId; bandAt: NodeId; bandits: boolean }) {
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[var(--merc-red)]" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="currentColor" strokeWidth="0.7" />
        ))}
      </svg>
      {(Object.values(NODES) as (typeof NODES)[NodeId][]).map((node) => {
        const here = node.id === location;
        return (
          <span key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
            {here && (
              <svg aria-hidden="true" viewBox="0 0 10 8" className="absolute left-1/2 top-full mt-0.5 h-2 w-2.5 -translate-x-1/2 fill-[var(--merc-red)]">
                <polygon points="5,0 0,8 10,8" />
              </svg>
            )}
            <span className={here ? "block h-2.5 w-2.5 rounded-full bg-[var(--merc-red)]" : "block h-1.5 w-1.5 rounded-full bg-white"} />
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
    <div className="relative h-[28rem] bg-[var(--merc-map)]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[var(--merc-red)]" preserveAspectRatio="none" aria-hidden="true">
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
                ? "absolute z-10 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 text-left text-[var(--merc-red)]"
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
          className="absolute z-20 w-40 -translate-x-1/2 border border-[var(--merc-line)] bg-[var(--merc-bg)] p-3 text-[var(--merc-text)]"
          style={{ left: `${asked.x}%`, top: asked.y > 68 ? `calc(${asked.y}% - 5.5rem)` : `calc(${asked.y}% + 2.2rem)` }}
        >
          <p id="move-ask" className="font-gothic text-xl leading-none">
            Move to {asked.name}?
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" autoFocus className="h-8 bg-[var(--merc-red-deep)] text-[var(--merc-text)] hover:bg-[var(--merc-red-deep)]/90" onClick={() => onMove(ask)}>
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
        {state.elderTalk.length === 0 && <p className="text-[14px] text-[var(--merc-muted)]">He is here.</p>}
        {state.elderTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[var(--merc-muted)]" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
          </p>
        ))}
        {game.busy?.includes("thinking") && state.elderTalk.at(-1)?.role === "player" && (
          <p className="text-[15px] text-[var(--merc-muted)]">{game.busy}</p>
        )}
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
        <Button type="submit" disabled={!!game.busy} className="h-10 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]">
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
            <button type="button" disabled={!!game.busy} onClick={() => void game.takeReward()} className="underline decoration-[var(--merc-red)] underline-offset-2">
              Collect the pay
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function MerchantTalk({ state, game, onBought }: { state: GameState; game: Game; onBought: () => void }) {
  const [text, setText] = useState("");
  const price = state.foodPrice === 1 ? 1 : 2;
  return (
    <div>
      <div className="max-h-48 space-y-3 overflow-y-auto">
        {state.merchantTalk.length === 0 && <p className="text-[14px] text-[var(--merc-muted)]">Posted price, {price} coins a ration.</p>}
        {state.merchantTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[var(--merc-muted)]" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
          </p>
        ))}
        {game.busy?.includes("thinking") && state.merchantTalk.at(-1)?.role === "player" && (
          <p className="text-[15px] text-[var(--merc-muted)]">{game.busy}</p>
        )}
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
        <Button type="submit" disabled={!!game.busy} className="h-10 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]">
          Say it
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {[5, 10, 20].map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            disabled={state.money < price * amount}
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
        {state.squareTalk.length === 0 && <p className="text-[14px] text-[var(--merc-muted)]">{city ? "They will not give you a speech until you speak." : "The square is open."}</p>}
        {state.squareTalk.map((turn, index) => (
          <p key={index} className={turn.role === "player" ? "text-[15px] text-[var(--merc-muted)]" : "text-[16px] leading-relaxed"}>
            {turn.role === "player" ? `You. ${turn.text}` : turn.text}
          </p>
        ))}
        {game.busy?.includes("thinking") && state.squareTalk.at(-1)?.role === "player" && (
          <p className="text-[15px] text-[var(--merc-muted)]">{game.busy}</p>
        )}
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
        <Button type="submit" disabled={!!game.busy} className="h-10 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]">
          Say it
        </Button>
      </form>
      <Button type="button" variant="outline" className="mt-3" disabled={!!game.busy} onClick={() => void say("We call for men.")}>
        Call for men
      </Button>
      {levies !== null && (
        <div className="mt-3">
          <p className="text-[15px]">{levies} will come, free and unarmed. You can leave them and equip them from the company.</p>
          <label htmlFor="levy-name" className="mt-2 block text-[14px]">
            Name them
            <Input id="levy-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className={`mt-1 h-9 ${field}`} />
          </label>
          <Button
            type="button"
            className="mt-2 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]"
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
              className={item === type ? "text-[16px] underline decoration-[var(--merc-red)] underline-offset-4" : "text-[16px] text-[var(--merc-muted)]"}
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
            <button key={unit.id} type="button" aria-pressed={into === unit.id} onClick={() => choose(unit.id)} className={into === unit.id ? "text-[16px] underline decoration-[var(--merc-red)]" : "text-[16px] text-[var(--merc-muted)]"}>
              {unit.name}, {unit.count} of 10
            </button>
          ))}
          <button type="button" aria-pressed={into === "new"} onClick={() => choose("new")} className={into === "new" ? "text-[16px] underline decoration-[var(--merc-red)]" : "text-[16px] text-[var(--merc-muted)]"}>
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
          className="mt-3 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]"
          disabled={price * count > state.money}
          onClick={() => {
            game.enlist(
              type,
              count,
              plan.fresh.map((_, index) => (names[index] ?? "").trim()),
              into,
            );
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
              <span className="block text-[12px] text-[var(--merc-muted)]">Unit {index + 1}</span>
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
                className="text-[16px] underline decoration-[var(--merc-muted)] underline-offset-2"
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
        <Button type="submit" disabled={!pair} className="border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]">
          Drill them
        </Button>
      </div>
      {ideas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => setDrill(idea)} className="border border-[var(--merc-line)] px-2 py-1 text-[14px]">
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
      <p className="mt-1 text-[13px] text-[var(--merc-muted)]">
        {words} / {APPROACH_WORDS}
      </p>
      <label htmlFor="supply-spent" className="mt-3 block text-[16px]">
        Supply to spend, up to {state.supply}
        <Input id="supply-spent" type="number" min={0} max={state.supply} value={supply} onChange={(event) => setSupply(Number(event.target.value))} className={`mt-2 h-9 w-24 ${field}`} />
      </label>
      <Button type="button" className="mt-4 bg-[var(--merc-red-deep)] text-[var(--merc-text)] hover:bg-[var(--merc-red-deep)]/90" disabled={!!game.busy || words < 1 || words > APPROACH_WORDS} onClick={() => void game.sendBattle(approach, supply)}>
        {game.busy ?? "Send them in"}
      </Button>
    </div>
  );
}

function Result({ state, game }: { state: GameState; game: Game }) {
  const full = state.screen === "chronicle";
  return (
    <div>
      <button type="button" onClick={() => game.show("dashboard")} className="text-[15px] underline decoration-[var(--merc-muted)] underline-offset-2">
        Back to {NODES[state.location].name}
      </button>
      <h2 className="mt-2 font-gothic text-4xl">The fight</h2>
      <p className="mt-3 text-[17px] leading-relaxed">{state.lastBrief}</p>
      {state.reputationShift.length > 0 && (
        <ul className="mt-3 space-y-2">
          {state.reputationShift.map((shift) => (
            <li key={shift.key} className="text-[15px] leading-relaxed">
              <span className="text-[var(--merc-muted)]">{REPUTATION_LABEL[shift.key]}. </span>
              {shift.text}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => game.show(full ? "dashboard" : "chronicle")} className="mt-3 text-[14px] text-[var(--merc-muted)]">
        {full ? "Hide the account" : "Read the account"}
      </button>
      {full && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--merc-muted)]">{state.lastChronicle}</p>}
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
        <Button type="button" className="mt-4 border border-[var(--merc-line)] bg-[var(--merc-raise)] text-[var(--merc-text)] hover:bg-[var(--merc-raise)]" disabled={!!game.busy} onClick={() => void game.choose("kill", [])}>
          Leave the dead
        </Button>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-[15px] text-[var(--merc-muted)]">{survivors} of them are still alive.</p>
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
