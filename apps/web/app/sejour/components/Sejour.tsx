"use client";

import { useState } from "react";
import { offerLesson, levelBrief } from "../data/handouts";
import { PERSON_BY_ID } from "../data/people";
import { RESTAURANT_BY_ID, RESTAURANTS } from "../data/restaurants";
import { STOP_BY_ID } from "../lib/station";
import { destinationFor, useSejour, type Activity } from "../hooks/useSejour";
import type { TalkReply, TalkTurn } from "../lib/voice";
import { Conversation } from "./Conversation";
import { SelectionMenu } from "./SelectionMenu";
import { Meal } from "./Meal";
import { Phrasebook } from "./Phrasebook";
import { PostcardDesk } from "./PostcardDesk";
import { Review } from "./Review";
import { Lessons } from "./Lessons";
import { ShopDay } from "./ShopDay";
import { Station } from "./Station";

const ACTIVITIES: { id: Activity; label: string; go: string }[] = [
  { id: "cook", label: "Cook something", go: "Let's cook" },
  { id: "friending", label: "Speed friending", go: "Let's go" },
  { id: "restaurant", label: "Try a restaurant", go: "Let's go" },
  { id: "postcard", label: "Send a postcard", go: "Let's write" },
];

function memoryText(turns: TalkTurn[] | undefined): string {
  if (!turns?.length) return "";
  return turns.map((turn) => `${turn.who === "them" ? "You" : "Them"}: ${turn.text}`).join("\n");
}

export function Sejour() {
  const stay = useSejour();
  const [hostTurns, setHostTurns] = useState<TalkTurn[]>([]);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  if (!stay.loaded) return <p className="sj-wrap">The house is waking up.</p>;

  const day = stay.save.day + 1;
  const hostMemory = memoryText(stay.save.memories.rousseau);
  const again = stay.recipe ? stay.save.cooked.includes(stay.recipe.id) : false;
  const lesson = offerLesson(day, stay.save.mastered, stay.save.gaps);
  const level = levelBrief(stay.save.mastered, stay.save.gaps);
  const going = stay.activity && stay.activity !== "postcard" ? destinationFor(stay.activity, stay.restaurantId, "out") : null;
  const stop = going ? STOP_BY_ID[going] : null;
  const lessonBlock = `${level} LESSON: ${lesson.offer}. HOW: ${lesson.teach}`;
  const placeLine = stop
    ? `They are going to ${stop.en}. Do not name the station, the street, or the platform. Platforms open only in the five minutes before a train leaves. Once the lesson is settled, tell them to ask the conductor which train.`
    : "They are not taking a train.";
  const briefing = `${
    stay.activity === "cook" && stay.recipe
      ? `Day ${day}. Call them ${stay.save.address}. OUTING: cook. DISH: ${stay.recipe.name} / ${stay.recipe.fr}. ${again ? "Say you will cook it again." : "This dish is new."} English list: ${stay.recipe.note.join(", ")}. Give that list and the cash only after the lesson is taken or refused.`
      : `Day ${day}. Call them ${stay.save.address}. OUTING: ${stay.activity}${stay.restaurantId ? ` at ${RESTAURANT_BY_ID[stay.restaurantId]?.name}` : ""}. After the lesson is taken or refused, tell them how it works, in English, and add a few French phrases.`
  } ${placeLine} ${lessonBlock}`;

  function heard(reply: TalkReply, history: TalkTurn[]) {
    setHostTurns(history);
    if (reply.phrases.length) stay.absorbPhrases(reply.phrases, "Madame Rousseau");
  }

  function choose(activity: Activity) {
    stay.keep("rousseau", hostTurns);
    setHostTurns([]);
    stay.pick(activity);
  }

  const person = PERSON_BY_ID[stay.friendIds[stay.friendIndex] ?? ""];
  const place = stay.restaurantId ? RESTAURANT_BY_ID[stay.restaurantId] : null;

  return (
    <main className="sj-wrap">
      <header className="mb-3 flex items-center justify-between text-[var(--ep-cream)]">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em]">Saint-Aubin</p>
          <h1 className="ep-display text-[32px]">Le Séjour</h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[18px] text-[var(--ep-cream)]">{stay.phase === "intro" ? "Evening" : `Day ${day}`}</p>
          <button
            type="button"
            className="min-h-[44px] rounded-full border border-[var(--ep-cream)] px-4 text-[15px] text-[var(--ep-cream)]"
            onClick={() => {
              if (window.confirm("Start the week over? She will forget you, and the phrasebook will be emptied.")) {
                setHostTurns([]);
                stay.reset();
              }
            }}
          >
            Start over
          </button>
          <button type="button" className="ep-button" onClick={() => setLessonsOpen(true)}>
            Lessons
          </button>
          <button type="button" className="ep-button ep-primary" onClick={() => stay.setBookOpen(true)}>
            Phrasebook
          </button>
        </div>
      </header>

      {stay.phase === "intro" ? (
        <section className="sj-sheet rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sejour/rousseau.jpg" alt="Madame Rousseau" className="mb-3 h-48 w-36 rounded-md object-cover" />
          <Conversation
            key="arrival"
            title="Madame Rousseau"
            character="rousseau"
            role="host"
            who="rousseau"
            speakFirst
            memory={hostMemory}
            placeholder="Answer in English"
            hearLabel="Hear her"
            context="ARRIVAL. The first evening. They have just arrived and they are tired. Welcome them to the homestay. You are glad they will stay the week and learn French. The room is at the top of the stairs. You will talk about the village in the morning, not tonight. Ask what you should call them: monsieur, madame, or just bonjour. Do not mention cooking, trains, restaurants, postcards, or buttons."
            onReply={heard}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="ep-button ep-primary" onClick={() => stay.chooseAddress("monsieur")}>Monsieur</button>
            <button type="button" className="ep-button ep-primary" onClick={() => stay.chooseAddress("madame")}>Madame</button>
            <button type="button" className="ep-button" onClick={() => stay.chooseAddress("bonjour")}>Just bonjour</button>
          </div>
        </section>
      ) : null}

      {stay.phase === "morning" || stay.phase === "briefing" || stay.phase === "dinner" ? (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stay.phase === "dinner" ? "/sejour/kitchen.jpg" : "/sejour/rousseau.jpg"} alt="" className={stay.phase === "dinner" ? "sj-photo" : "hidden"} />
          <div className="sj-sheet rounded-xl">
            {stay.phase === "dinner" ? (
              <p className="mb-3 text-[16px]">
                {stay.activity === "cook" && stay.recipe ? `The two of you are eating ${stay.recipe.fr}.` : "She has made something simple."}
              </p>
            ) : null}
            <Conversation
              key={stay.phase}
              title="Madame Rousseau"
              portrait={stay.phase === "dinner" ? undefined : "/sejour/rousseau.jpg"}
              character="rousseau"
              role="host"
              who="rousseau"
              speakFirst
              memory={hostMemory}
              context={
                stay.phase === "dinner"
                  ? `Dinner on day ${day}. ${level} ${stay.activity === "cook" && stay.recipe ? `EATING: ${stay.recipe.fr}. You are already eating. Do not tell them to eat, sit, or start.` : "You made something simple."} Today: ${stay.dayLog.join(" ") || "They have not said much about the day."} No shopping list.`
                  : stay.phase === "briefing"
                    ? briefing
                    : `MORNING. Day ${day}. Call them ${stay.save.address}. They slept here. Hope they slept well, and ask what they would like to do today. ${stay.save.mastered.length ? `They already manage: ${stay.save.mastered.join(", ")}. Do not plan to teach those.` : "You do not know their French yet. Ask, lightly, whether they have spoken any, and listen."} ${stay.save.gaps.length ? `Gaps so far: ${stay.save.gaps.map((gap) => gap.id).join(", ")}.` : ""} The four things are: cook something, speed friending, try a restaurant, send a postcard. Call that outing speed friending, never meeting people. If they ask for anything else, name those four and ask which one. Do not say press a button. There is no DISH. Do not name a recipe. Do not open a lesson until they have chosen. Any French word in your line gets its English on the same line.`
              }
              placeholder="Answer in English"
              hearLabel="Hear her"
              endLabel={stay.phase === "briefing" ? (ACTIVITIES.find((item) => item.id === stay.activity)?.go ?? "Let's go") : stay.phase === "dinner" ? "That's enough for tonight" : undefined}
              onReply={heard}
              onEnd={
                stay.phase === "morning"
                  ? undefined
                  : (history) => {
                      if (stay.phase === "briefing") {
                        stay.keep("rousseau", history);
                        stay.leaveBriefing();
                      } else stay.dinnerDone(history);
                    }
              }
            />
            {stay.phase === "briefing" && stay.activity === "cook" && stay.recipe ? (
              <div className="mt-4 rounded-lg bg-white/60 p-3">
                <p className="text-[13px] uppercase tracking-wide">To buy</p>
                <p className="mt-1 text-[18px]">
                  {again ? "The same dish again. " : ""}
                  {stay.recipe.fr} — {stay.recipe.name}
                </p>
                <ul className="mt-2 list-disc pl-5 text-[16px]">
                  {stay.recipe.note.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {stay.phase === "morning" && stay.activity !== "restaurant" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {ACTIVITIES.map((item) => (
                  <button key={item.id} type="button" className="ep-button ep-primary" onClick={() => choose(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            {stay.phase === "morning" && stay.activity === "restaurant" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {RESTAURANTS.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    type="button"
                    className="ep-button ep-primary"
                    onClick={() => {
                      stay.keep("rousseau", hostTurns);
                      setHostTurns([]);
                      stay.pickPlace(restaurant.id);
                    }}
                  >
                    {restaurant.name}
                  </button>
                ))}
                <button type="button" className="ep-button" onClick={stay.cancelPlace}>
                  Not tonight
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {stay.phase === "depart" || stay.phase === "return" ? (
        <section className="sj-sheet rounded-xl">
          <h2 className="ep-display text-[28px]">{stay.phase === "return" ? "Home" : "Getting there"}</h2>
          <p className="mt-2">Train, or walk?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="ep-button ep-primary" onClick={() => stay.goBy("train")}>Train</button>
            <button type="button" className="ep-button" onClick={() => stay.goBy("walk")}>Walk</button>
          </div>
        </section>
      ) : null}

      {stay.phase === "station" && stay.activity ? (
        <Station
          board={stay.board}
          destination={destinationFor(stay.activity, stay.restaurantId, stay.leg)}
          here={stay.leg === "back" ? destinationFor(stay.activity, stay.restaurantId, "out") : "home"}
          wrongStop={stay.wrongStop}
          memory={(id) => memoryText(stay.save.memories[id])}
          onRide={(platform) => stay.ride(platform)}
          onWalk={stay.walkFromStation}
          onWait={stay.waitMinute}
          onTalk={stay.stationTalk}
        />
      ) : null}

      {stay.phase === "shop" && stay.recipe ? (
        <ShopDay
          address={stay.save.address === "bonjour" || !stay.save.address ? "unknown" : stay.save.address}
          recipe={stay.recipe}
          purse={stay.purse}
          onDone={stay.shopDone}
        />
      ) : null}

      {stay.phase === "friends" && person ? (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={person.image} alt={person.place} className="sj-photo" />
          <div className="sj-sheet">
            <p className="mb-2 text-[14px]">
              {stay.friendIndex + 1} of {stay.friendIds.length}, from {person.place}.
            </p>
            <Conversation
              key={person.id}
              title={person.name}
              character={person.id}
              role="friend"
              who={person.id}
              memory={memoryText(stay.save.memories[person.id])}
              context={`Speed friending, day ${day}. ${stay.save.memories[person.id]?.length ? "You have met them on an earlier day." : "You have not met them before."} ${person.blurb}`}
              endLabel="Next"
              onReply={(reply) => {
                if (reply.phrases.length) stay.absorbPhrases(reply.phrases, person.name);
              }}
              onEnd={(history) => stay.friendDone(person.id, history)}
            />
          </div>
        </section>
      ) : null}

      {stay.phase === "meal" && place ? (
        <Meal place={place} purse={stay.purse} memory={memoryText(stay.save.memories[place.id])} onDone={stay.mealDone} />
      ) : null}

      {stay.phase === "postcard" ? <PostcardDesk cards={stay.save.cards} onSend={stay.cardSent} onDone={stay.finishPostcard} /> : null}

      {stay.phase === "review" ? (
        <section className="sj-sheet rounded-xl">
          <Review
            lines={stay.reviewLines}
            scene={stay.after === "station" ? "station" : stay.activity === "friending" ? "friends" : stay.activity === "restaurant" ? "restaurant" : stay.activity === "postcard" ? "postcard" : "shop"}
            onContinue={stay.reviewDone}
            onStudy={stay.noteStudy}
          />
        </section>
      ) : null}

      {stay.bookOpen ? (
        <Phrasebook save={stay.save} onClose={() => stay.setBookOpen(false)} onAdd={stay.addOwnPhrase} onPage={stay.addPage} onMove={stay.movePhraseTo} onJournal={stay.updateJournal} />
      ) : null}
      {lessonsOpen ? <Lessons gaps={stay.save.gaps} onClose={() => setLessonsOpen(false)} /> : null}
      <SelectionMenu phrases={stay.save.phrases} onAdd={stay.addOwnPhrase} />
    </main>
  );
}
