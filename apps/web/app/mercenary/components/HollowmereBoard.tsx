"use client";

import { useEffect, useState } from "react";
import {
  BANNER_COLOURS,
  groupCount,
  NAMED,
  neighbors,
  PLACES,
  SIGILS,
  TRADES,
  type Colour,
  type GroupId,
  type NpcId,
  type PlaceId,
  type Sigil,
  type Trade,
} from "../data/hollowmere";
import { START_BREAD, START_GOLD, START_MEN, UNIT_SLOTS } from "../data/tuning";
import type { useHollowmere } from "../hooks/useHollowmere";
import { netWorth, TUTORIAL_STEPS } from "../lib/play";

const primary =
  "w-full bg-[var(--merc-red-deep)] px-4 py-3 text-left font-gothic text-2xl text-[var(--merc-text)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const quiet =
  "min-h-11 w-full border border-[var(--merc-line)] bg-transparent px-3 py-3 text-left text-[15px] text-[var(--merc-text)] hover:border-[var(--merc-text)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const choice =
  "min-h-11 w-full border border-[var(--merc-text)] bg-transparent px-3 py-3 text-left text-[16px] text-[var(--merc-text)] hover:bg-[var(--merc-raise)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const inline =
  "border border-[var(--merc-line)] bg-transparent px-3 py-2 text-[15px] text-[var(--merc-text)] hover:border-[var(--merc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const link =
  "text-[15px] text-[var(--merc-muted)] underline decoration-[var(--merc-line)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const field =
  "mt-1 w-full border border-[var(--merc-text)] bg-[var(--merc-field)] px-3 py-2 text-[16px] text-[var(--merc-text)] outline-none placeholder:text-[var(--merc-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--merc-red)]";
const label = "block text-[15px] text-[var(--merc-muted)]";

const COLOUR_WORD: Record<Colour, string> = {
  azure: "blue",
  purpure: "purple",
  sable: "black",
  tenne: "tawny",
  murrey: "mulberry",
};
const SWATCH: Record<Colour, string> = {
  azure: "#3c6e9a",
  purpure: "#7a3e86",
  sable: "#141414",
  tenne: "#c47a2c",
  murrey: "#8a3050",
};

const GUARDS: Partial<Record<PlaceId, GroupId>> = {
  thornwick: "thorn-guards",
  "salt-ferry": "ferry-guards",
  crownmarket: "crown-guards",
};

const TEACH: Record<(typeof TUTORIAL_STEPS)[number], string> = {
  card: "These two units are the company.",
  hale: "Marta Hale is the reeve of Thornwick. She wants a word.",
  quest: "She can put thirty gold on the table, due in four weeks.",
  fenn: "Fenn, the merchant, can spare some bread.",
  speech: "Say something to the person you opened.",
  end: "When you are finished here, end the week. Food and pay are settled then.",
  report: "The week has closed. Read the gold and the bread, then go on.",
  volunteers: "Thornwick can spare two spearmen.",
  barn: "Men are waiting in the barn.",
};

function teachLine(
  step: (typeof TUTORIAL_STEPS)[number],
  week: number,
  gold: number,
  bread: number,
  offer: { amount: number; currency: string; dueWeek: number } | undefined,
  speaker: NpcId | null,
): string {
  if (step === "report") return `${gold} gold and ${bread} bread are what you hold now.`;
  if (step === "fenn" && offer) return `Marta Hale's offer is on the table: ${offer.amount} ${offer.currency}, due week ${offer.dueWeek}.`;
  if (step === "speech" && !speaker) return "Speak with Marta Hale. Then write the line in the box under her name.";
  if (step === "speech" && speaker) return "";
  return TEACH[step];
}

type Game = ReturnType<typeof useHollowmere>;
type FoundingStep = "name" | "captain" | "banner" | "trades" | "units";

function peasantGroup(id: PlaceId): "thorn-peasants" | "ferry-peasants" | "crown-peasants" | null {
  if (id === "thornwick") return "thorn-peasants";
  if (id === "salt-ferry") return "ferry-peasants";
  if (id === "crownmarket") return "crown-peasants";
  return null;
}

export default function HollowmereBoard({ game }: { game: Game }) {
  const { world, view } = game;
  if (!world || !view || !world.company) return <main className="min-h-dvh bg-[var(--merc-ground)]" />;
  if (!world.company.founded) return <Founding game={game} />;
  if (world.lost) return <End game={game} title="The company is gone" body="There is no one left to lead." />;
  if (world.ended || world.week > 12) return <Chronicle game={game} />;
  return <Week game={game} />;
}

function Week({ game }: { game: Game }) {
  const world = game.world!;
  const view = game.view!;
  const company = world.company!;
  const place = PLACES[company.location];
  const [speaker, setSpeaker] = useState<NpcId | null>(null);
  const [say, setSay] = useState("");
  const people = world.people.filter((person) => person.npcId && person.placeId === company.location && person.alive);
  const speakerHere = speaker !== null && people.some((person) => person.npcId === speaker);
  const captives = world.people.filter((person) => person.alive && person.forceId === "captive").length;
  useEffect(() => {
    setSpeaker(null);
    setSay("");
  }, [company.location]);
  const moves = neighbors(company.location);
  const step = TUTORIAL_STEPS[world.tutorialStep];
  const guardGroup = GUARDS[company.location];
  const guardsLive = guardGroup ? groupCount(world.people, guardGroup) > 0 : false;
  const peasants = peasantGroup(company.location);
  const news = [...world.decisions].reverse().filter((item) => !item.text.startsWith("Founded")).slice(0, 2);
  const offered = view.deals;
  const flagged = people.some((person) => view.flags.includes(person.npcId ?? ""));

  let lead = "end";
  if (world.intentChip) lead = "chip";
  else if (world.pendingBattle) lead = "fight";
  else if (!world.tutorialDone && step === "fenn" && offered.length > 0) lead = "accept";
  else if (!world.tutorialDone && step) lead = step === "speech" && !speaker ? "hale" : step;
  else if (world.pendingBattle) lead = "fight";
  else if (offered.length > 0) lead = "accept";
  else if (flagged && !speaker) lead = "speak";
  else if (!company.actionUsed && place.kind === "wild") lead = "search";
  else if (!company.actionUsed && place.kind === "village") lead = "work";
  else if (!company.actionUsed) lead = "rest";

  if (!world.tutorialDone && step === "card") {
    return (
      <div className="fixed inset-0 z-10 flex flex-col bg-[var(--merc-ground)] text-[var(--merc-text)]">
        <header className="flex shrink-0 items-end justify-between gap-4 border-b border-[var(--merc-line)] px-4 py-3">
          <div>
            <p className="font-gothic text-2xl leading-none">{company.name}</p>
            <p className="mt-1 text-[15px] tabular-nums text-[var(--merc-muted)]">
              Week {view.week} of {view.weekMax} · {view.gold} gold · {view.bread} bread
            </p>
          </div>
          <button type="button" onClick={() => window.confirm("Reset this company and start again?") && game.reset()} className={link}>
            Reset
          </button>
        </header>
        <main className="mx-auto w-full max-w-lg px-6 py-12">
          <p className="text-[15px] text-[var(--merc-muted)]">The company</p>
          <ul className="mt-3">
            {view.units.map((unit) => (
              <li key={unit.id} className="mt-4">
                <p className="font-gothic text-4xl">{unit.name}</p>
                <p className="text-[17px]">{unit.headcount} {unit.trade}</p>
              </li>
            ))}
          </ul>
          <button type="button" className={`${primary} mt-8`} onClick={game.followTeaching}>
            Meet Marta Hale
          </button>
          <button type="button" className={`${link} mt-4 block`} onClick={game.skipTutorial}>
            Skip the teaching
          </button>
        </main>
      </div>
    );
  }

  const spent = company.actionUsed || !!game.busy || !!world.pendingBattle;
  const teaching = !world.tutorialDone && !!step;
  const showLabours = !world.pendingBattle && (!teaching || step === "volunteers");
  const showMarch = !teaching && !world.pendingBattle;
  const showEnd = (!teaching || step === "end") && !world.pendingBattle;

  return (
    <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[var(--merc-ground)] text-[var(--merc-text)]">
      <header className="flex shrink-0 items-end justify-between gap-4 border-b border-[var(--merc-line)] px-4 py-3">
        <div>
          <p className="font-gothic text-2xl leading-none">{company.name}</p>
          <p className="mt-1 text-[15px] tabular-nums text-[var(--merc-muted)]">
            Week {view.week} of {view.weekMax} · {view.gold} gold · {view.bread} bread
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.confirm("Reset this company and start again?") && game.reset()}
          className={link}
        >
          Reset
        </button>
      </header>
      {game.error && (
        <p role="alert" className="border-b border-[var(--merc-line)] px-4 py-2 text-[15px] text-[var(--merc-red)]">
          {game.error}
        </p>
      )}
      {!world.tutorialDone && step && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--merc-line)] px-4 py-3">
          {(() => {
            const taught = world.pendingBattle
              ? "A fight is waiting. Hold the ground, or take one in hand."
              : step === "report" && news[0]
                ? news[0].text
                : teachLine(step, view.week, view.gold, view.bread, offered[0], speaker);
            return taught ? <p className="max-w-xl text-[16px] leading-snug">{taught}</p> : <span />;
          })()}
          <button type="button" className={`${link} shrink-0`} onClick={game.skipTutorial}>
            Skip the teaching
          </button>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_20rem]">
        <section className="overflow-y-auto border-[var(--merc-line)] p-4 md:border-r">
          <h1 className="font-gothic text-5xl leading-none">{place.name}</h1>
          {!(teaching && step === "card") && <p className="mt-2 text-[17px] text-[var(--merc-muted)]">{place.meaning}</p>}
          {news.length > 0 && step !== "report" && !world.pendingBattle && (
            <div className="mt-3 space-y-1">
              {news.map((item, index) => (
                <p key={`${item.week}-${index}`} className="text-[16px]">{item.text}</p>
              ))}
            </div>
          )}
          {lead === "report" && (
            <button type="button" className={`${primary} mt-4`} onClick={game.followTeaching}>
              Start the next week
            </button>
          )}
          {lead === "barn" && (
            <button type="button" className={`${primary} mt-4`} onClick={game.followTeaching}>
              Face the men in the barn
            </button>
          )}
          {world.pendingBattle && (
            <div className="mt-5 border border-[var(--merc-text)] p-3">
              <p className="font-gothic text-3xl">A fight is waiting</p>
              <p className="mt-1 text-[17px]">{world.pendingBattle.foe}.</p>
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" className={lead === "fight" ? primary : quiet} onClick={() => game.fight("stand")}>
                  <span className="block">Hold the ground</span>
                  <span className="mt-1 block text-[15px] font-normal leading-snug">They get away. None of yours are hurt.</span>
                </button>
                <button type="button" className={choice} onClick={() => game.fight("take")}>
                  <span className="block">Take one in hand</span>
                  <span className="mt-1 block text-[15px] leading-snug">You keep a captive. One of yours is hurt.</span>
                </button>
              </div>
            </div>
          )}
          {world.pendingBattle && news[0] && <p className="mt-3 text-[16px]">{news[0].text}</p>}
          {!(teaching && step === "card") && <ul className="mt-6 space-y-3">
            {people.map((person) => {
              const id = person.npcId!;
              const named = NAMED[id];
              const wants = view.flags.includes(id);
              const loud = wants && (lead === "speak" || (id === "hale" && (lead === "hale" || lead === "quest")) || (id === "fenn" && lead === "fenn"));
              return (
                <li key={person.id} className={loud ? "border border-[var(--merc-text)] px-3 py-3" : "px-3 py-2"}>
                  <p className={loud ? "font-gothic text-3xl" : "font-gothic text-xl text-[var(--merc-muted)]"}>{named.name}</p>
                  <p className="text-[15px] text-[var(--merc-muted)]">{loud ? `${named.role}. They want a word.` : named.role}</p>
                  {id === "hale" && lead === "hale" && (
                    <button
                      type="button"
                      className={`${primary} mt-3`}
                      onClick={() => {
                        setSpeaker(id);
                        if (!world.tutorialDone && step === "hale") game.followTeaching();
                      }}
                    >
                      Speak with {named.name}
                    </button>
                  )}
                  {id === "hale" && lead === "quest" && (
                    <button type="button" className={`${primary} mt-3`} onClick={game.followTeaching}>
                      Put the offer on the table
                    </button>
                  )}
                  {id === "fenn" && lead === "fenn" && (
                    <button type="button" className={`${primary} mt-3`} onClick={game.followTeaching}>
                      Take Fenn&apos;s bread
                    </button>
                  )}
                  {loud && speaker !== id && lead === "speak" && (
                    <button type="button" className={`${primary} mt-3`} onClick={() => setSpeaker(id)}>
                      Speak with {named.name}
                    </button>
                  )}
                  {world.tutorialDone && !world.pendingBattle && speaker !== id && lead !== "speak" && (
                    <button type="button" className={`${link} mt-2 block min-h-11 py-2 text-left`} onClick={() => setSpeaker(id)}>
                      Speak with {named.name}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>}
          {speakerHere && speaker && !world.pendingBattle && (world.tutorialDone || step === "speech") && (
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!say.trim()) return;
                game.talk(say.trim());
                setSay("");
              }}
            >
              <label className={label} htmlFor="say">
                Write the line for {NAMED[speaker].name}
              </label>
              <input id="say" name="say" value={say} placeholder="The words you will say" onChange={(event) => setSay(event.target.value)} className={field} />
              {say.trim() ? (
                <button type="submit" className={`${lead === "speech" ? primary : choice} mt-2`}>
                  Say it to {NAMED[speaker].name}
                </button>
              ) : (
                <p className="mt-2 text-[15px] text-[var(--merc-muted)]">Write the line, and the send appears.</p>
              )}
            </form>
          )}
          {world.intentChip && (
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className={lead === "chip" ? primary : quiet} onClick={game.acceptChip}>
                {world.intentChip.label}
              </button>
              <button type="button" className={`${link} self-start`} onClick={game.dismissChip}>
                Leave it
              </button>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {offered.map((deal, index) => (
              <DealSlip key={deal.id} game={game} deal={deal} lead={lead === "accept" && index === 0} />
            ))}
          </div>
        </section>
        <section className="overflow-y-auto p-4">
          <p className="text-[15px] text-[var(--merc-muted)]">The company</p>
          <ul className="mt-2 space-y-2">
            {view.units.map((unit) => (
              <li key={unit.id} className="py-2">
                <p className="font-gothic text-xl">{unit.name === "New File" ? "The Recruits" : unit.name}</p>
                <p className="text-[15px]">
                  {unit.headcount} {unit.trade}
                </p>
              </li>
            ))}
          </ul>
          {!(teaching && step === "card") && (
            <p className="mt-2 text-[14px] text-[var(--merc-muted)]">
              {Math.max(0, UNIT_SLOTS - view.units.length)} places left, if you raise another unit.
            </p>
          )}
          {lead === "card" && (
            <button type="button" className={`${primary} mt-3`} onClick={game.followTeaching}>
              I have looked at them
            </button>
          )}
          {captives > 0 && <p className="mt-3 text-[15px]">{captives === 1 ? "One captive is with the company." : `${captives} captives are with the company.`}</p>}
          {showLabours && company.actionUsed && !game.busy && (
            <p className="mt-6 text-[15px] text-[var(--merc-muted)]">This week's action is spent.</p>
          )}
          {showLabours && game.busy && <p className="mt-6 text-[16px]">{game.busy}</p>}
          {showLabours && !company.actionUsed && !game.busy && <div className="mt-6 flex flex-col gap-2">
            <p className="text-[15px] text-[var(--merc-muted)]">
              {step === "volunteers" && teaching ? "Two spearmen can join." : "One action this week."}
            </p>
            {!(teaching && step === "volunteers") && place.kind === "village" && (
              <button type="button" className={lead === "work" ? primary : quiet} disabled={spent} onClick={game.work}>
                Work the fields
              </button>
            )}
            {!(teaching && step === "volunteers") && place.kind === "wild" && (
              <button type="button" className={lead === "search" ? primary : quiet} disabled={spent} onClick={() => void game.search()}>
                {game.busy ?? "Search this ground"}
              </button>
            )}
            {!(teaching && step === "volunteers") && place.kind === "wild" && (
              <button type="button" className={quiet} disabled={spent} onClick={game.hide}>
                Hide until next week
              </button>
            )}
            {!(teaching && step === "volunteers") && (
            <button type="button" className={lead === "rest" ? primary : quiet} disabled={spent} onClick={game.rest}>
              Rest the company
            </button>
            )}
            {peasants && (
              <button
                type="button"
                className={lead === "volunteers" ? primary : quiet}
                disabled={spent && lead !== "volunteers"}
                onClick={() => {
                  if (!world.tutorialDone && step === "volunteers") game.followTeaching();
                  else game.recruit(peasants, "spearmen");
                }}
              >
                Call for two spearmen
              </button>
            )}
            {!teaching && !guardsLive && place.kind !== "wild" && (
              <button type="button" className={`${link} self-start py-1`} disabled={spent} onClick={game.pillage}>
                Pillage this place
              </button>
            )}
          </div>}
          {showMarch && company.moveUsed && <p className="mt-6 text-[15px] text-[var(--merc-muted)]">You have already marched.</p>}
          {showMarch && !company.moveUsed && <div className="mt-6 flex flex-col gap-2">
            <p className="text-[15px] text-[var(--merc-muted)]">{`Then leave ${place.name}, or stay.`}</p>
            {moves.map((id) => (
              <button key={id} type="button" className={quiet} onClick={() => game.move(id)}>
                March to {PLACES[id].name}
              </button>
            ))}
          </div>}
          {showEnd && (
          <button
            type="button"
            className={`${lead === "end" ? primary : quiet} mt-6`}
            onClick={() => {
              if (!world.tutorialDone && step === "end") game.followTeaching();
              else game.endWeek();
            }}
          >
            End the week
          </button>
          )}
        </section>
      </div>
    </div>
  );
}

function DealSlip({
  game,
  deal,
  lead,
}: {
  game: Game;
  deal: { id: string; from: string; amount: number; currency: string; dueWeek: number };
  lead: boolean;
}) {
  const [amount, setAmount] = useState(String(deal.amount));
  const who = deal.from in NAMED ? NAMED[deal.from as NpcId].name : deal.from;
  return (
    <form className="border border-[var(--merc-text)] p-3" onSubmit={(event) => event.preventDefault()}>
      <p className="font-gothic text-2xl">{who} offers {deal.amount} {deal.currency}</p>
      <p className="text-[15px] text-[var(--merc-muted)]">Due week {deal.dueWeek}.</p>
      <button type="button" className={`${lead ? primary : quiet} mt-3`} onClick={() => game.acceptDeal(deal.id)}>
        Accept the {deal.amount} {deal.currency}
      </button>
      <label className={`${label} mt-3`} htmlFor={`counter-${deal.id}`}>
        Or name a different amount
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id={`counter-${deal.id}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-24 border border-[var(--merc-line)] bg-[var(--merc-field)] px-2 py-2 text-[16px]"
        />
        <button type="button" className={inline} onClick={() => game.counterDeal(deal.id, Number(amount) || deal.amount)}>
          Counter
        </button>
        <button type="button" className={inline} onClick={() => game.declineDeal(deal.id)}>
          Decline
        </button>
      </div>
    </form>
  );
}

function Founding({ game }: { game: Game }) {
  const [step, setStep] = useState<FoundingStep>("name");
  const [name, setName] = useState("The Grey Company");
  const [origin, setOrigin] = useState("Raised to clear a debt.");
  const [captain, setCaptain] = useState("Harl");
  const [background, setBackground] = useState<"Deserter" | "Noble's Bastard" | "Former Quartermaster">("Deserter");
  const [colours, setColours] = useState<[Colour, Colour]>(["azure", "sable"]);
  const [sigil, setSigil] = useState<Sigil>("spear");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [unitNames, setUnitNames] = useState<[string, string]>(["The File", "The Bows"]);

  function toggle(trade: Trade) {
    setTrades((current) => {
      if (current.includes(trade)) return current.filter((item) => item !== trade);
      if (current.length >= 2) return [current[1]!, trade];
      return [...current, trade];
    });
  }

  function pickField(colour: Colour) {
    setColours(([, second]) => (colour === second ? [colour, colours[0]] : [colour, second]));
  }

  function pickSecond(colour: Colour) {
    setColours(([first]) => (colour === first ? [colours[1], colour] : [first, colour]));
  }

  const titles: Record<FoundingStep, string> = {
    name: "Name the company",
    captain: "Who leads them",
    banner: "The mark they carry",
    trades: "Choose two trades",
    units: "Name the two units",
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 py-10 text-[var(--merc-text)]">
      <h1 className="font-gothic text-5xl leading-none">{titles[step]}</h1>
      {step === "name" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setStep("captain");
          }}
        >
          <p className="text-[16px] text-[var(--merc-muted)]">
            Thornwick. {START_GOLD} gold and {START_BREAD} bread.
          </p>
          <label className={label} htmlFor="company-name">
            Company name
          </label>
          <input id="company-name" value={name} onChange={(event) => setName(event.target.value)} className={field} />
          <label className={label} htmlFor="origin">
            Why they were raised
          </label>
          <input id="origin" value={origin} onChange={(event) => setOrigin(event.target.value)} className={field} />
          <button type="submit" className={primary}>
            This is the company
          </button>
        </form>
      )}
      {step === "captain" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!captain.trim()) return;
            setStep("banner");
          }}
        >
          <label className={label} htmlFor="captain">
            Captain&apos;s name
          </label>
          <input id="captain" value={captain} onChange={(event) => setCaptain(event.target.value)} className={field} />
          <label className={label} htmlFor="background">
            What they were before
          </label>
          <select id="background" value={background} onChange={(event) => setBackground(event.target.value as typeof background)} className={field}>
            <option value="Deserter">Deserter</option>
            <option value="Noble's Bastard">Noble&apos;s bastard</option>
            <option value="Former Quartermaster">Former quartermaster</option>
          </select>
          <button type="submit" className={primary}>
            This is the captain
          </button>
          <button type="button" className={link} onClick={() => setStep("name")}>
            Back
          </button>
        </form>
      )}
      {step === "banner" && (
        <div className="mt-6 space-y-4">
          <p className="text-[16px] text-[var(--merc-muted)]">People know the company by two colours and one mark. The chosen ones say so.</p>
          <div>
            <p className={label}>Field colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BANNER_COLOURS.map((colour) => (
                <ColourChoice key={colour} colour={colour} on={colours[0] === colour} onClick={() => pickField(colour)} />
              ))}
            </div>
          </div>
          <div>
            <p className={label}>Second colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BANNER_COLOURS.map((colour) => (
                <ColourChoice key={colour} colour={colour} on={colours[1] === colour} onClick={() => pickSecond(colour)} />
              ))}
            </div>
          </div>
          <div>
            <p className={label}>Mark</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SIGILS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={sigil === item}
                  onClick={() => setSigil(item)}
                  className={sigil === item ? "border border-[var(--merc-red)] bg-[var(--merc-raise)] px-3 py-2 text-left text-[16px]" : "border border-[var(--merc-line)] px-3 py-2 text-left text-[16px] hover:border-[var(--merc-text)]"}
                >
                  {item}
                  {sigil === item ? " · Chosen" : ""}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className={primary} onClick={() => setStep("trades")}>
            This is the mark
          </button>
          <button type="button" className={link} onClick={() => setStep("captain")}>
            Back
          </button>
        </div>
      )}
      {step === "trades" && (
        <div className="mt-6 space-y-3">
          <p className="text-[16px] text-[var(--merc-muted)]">Each trade starts as {START_MEN} soldiers. Pick two. A chosen trade says so.</p>
          {TRADES.map((trade) => {
            const on = trades.includes(trade);
            const order = trades.indexOf(trade);
            return (
              <button
                key={trade}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(trade)}
                className={on ? "border border-[var(--merc-red)] bg-[var(--merc-raise)] px-3 py-3 text-left text-[16px]" : quiet}
              >
                <span className="font-gothic text-2xl">{trade}</span>
                {on && <span className="mt-1 block text-[14px] text-[var(--merc-muted)]">{order === 0 ? "First unit" : "Second unit"} · Chosen</span>}
              </button>
            );
          })}
          <button type="button" className={primary} disabled={trades.length !== 2} onClick={() => setStep("units")}>
            {trades.length === 2 ? "Take these men" : "Choose two trades"}
          </button>
          <button type="button" className={link} onClick={() => setStep("banner")}>
            Back
          </button>
        </div>
      )}
      {step === "units" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trades.length !== 2) return;
            game.found({
              name,
              origin,
              colours,
              sigil,
              captainName: captain,
              captainBackground: background,
              trades: [trades[0]!, trades[1]!],
              unitNames,
            });
          }}
        >
          <label className={label} htmlFor="unit-a">
            {START_MEN} {trades[0]}
          </label>
          <input id="unit-a" value={unitNames[0]} onChange={(event) => setUnitNames([event.target.value, unitNames[1]])} className={field} />
          <label className={label} htmlFor="unit-b">
            {START_MEN} {trades[1]}
          </label>
          <input id="unit-b" value={unitNames[1]} onChange={(event) => setUnitNames([unitNames[0], event.target.value])} className={field} />
          {game.error && <p role="alert">{game.error}</p>}
          <button type="submit" className={primary}>
            March out of Thornwick
          </button>
          <button type="button" className={link} onClick={() => setStep("trades")}>
            Back
          </button>
        </form>
      )}
    </main>
  );
}

function ColourChoice({ colour, on, onClick }: { colour: Colour; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={on ? "flex items-center gap-2 border border-[var(--merc-red)] bg-[var(--merc-raise)] px-2 py-1.5 text-left text-[15px]" : "flex items-center gap-2 border border-[var(--merc-line)] px-2 py-1.5 text-left text-[15px] hover:border-[var(--merc-text)]"}
    >
      <span className="inline-block size-4 border border-[var(--merc-text)]" style={{ background: SWATCH[colour] }} />
      <span>{COLOUR_WORD[colour]}</span>
      {on && <span className="text-[13px] text-[var(--merc-muted)]">Chosen</span>}
    </button>
  );
}

function End({ game, title, body }: { game: Game; title: string; body: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-[var(--merc-text)]">
      <h1 className="font-gothic text-5xl">{title}</h1>
      <p className="mt-3 text-[17px]">{body}</p>
      <button type="button" className={`${primary} mt-6`} onClick={game.reset}>
        Begin again
      </button>
    </main>
  );
}

function Chronicle({ game }: { game: Game }) {
  const world = game.world;
  if (!world?.company) return null;
  const banner = world.company.banner;
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-[var(--merc-text)]">
      <h1 className="font-gothic text-5xl">{world.company.name}</h1>
      <p className="mt-2 text-[16px] text-[var(--merc-muted)]">
        {banner ? `${banner.colours[0]} and ${banner.colours[1]}, a ${banner.sigil}` : "No banner"}
      </p>
      <p className="mt-6 font-gothic text-4xl tabular-nums">{netWorth(world)}</p>
      <p className="text-[15px] text-[var(--merc-muted)]">Net worth, in gold</p>
      <ol className="mt-6 list-decimal space-y-1 pl-5 text-[16px]">
        {world.decisions.slice(0, 3).map((item) => (
          <li key={item.text}>{item.text}</li>
        ))}
      </ol>
      <ul className="mt-4 text-[16px]">
        {game.view?.seals.map((seal) => (
          <li key={seal.id}>{seal.name}</li>
        ))}
      </ul>
      <button type="button" className={`${primary} mt-6`} onClick={game.reset}>
        Begin again
      </button>
    </main>
  );
}
