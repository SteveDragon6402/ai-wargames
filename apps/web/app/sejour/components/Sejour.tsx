"use client";

import { useState } from "react";
import { spokenForDay } from "@/app/course/content/spoken";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { sumCoins } from "@/app/epicerie/lib/shop";
import { levelBrief } from "../data/handouts";
import { PERSON_BY_ID } from "../data/people";
import { RESTAURANT_BY_ID } from "../data/restaurants";
import { useSejour } from "../hooks/useSejour";
import type { Participant, TalkReply, TalkTurn } from "../lib/voice";
import { EVENT_SPECS } from "../world/events";
import { PLACE_INFO, PLACES, type OutingId, type PlaceId } from "../world/places";
import { suggestRecipe } from "../world/recipes";
import { Bakery } from "./Bakery";
import { Conversation, type ConversationAction } from "./Conversation";
import { Cooking } from "./Cooking";
import { HomeMeal } from "./HomeMeal";
import { Lessons } from "./Lessons";
import { Meal } from "./Meal";
import { Outing } from "./Outing";
import { Pharmacie } from "./Pharmacie";
import { Phrasebook } from "./Phrasebook";
import { DayPractice } from "./DayPractice";
import { Review } from "./Review";
import { SelectionMenu } from "./SelectionMenu";
import { ShopDay } from "./ShopDay";
import { SignUpForm } from "./SignUpForm";
import { StreakClose } from "./StreakClose";
import { StageLayer } from "./StageLayer";
import { Supermarche } from "./Supermarche";

function memoryText(turns: TalkTurn[] | undefined): string {
  if (!turns?.length) return "";
  return turns.map((turn) => `${turn.who === "them" ? "You" : "Guest"}: ${turn.text}`).join("\n");
}

const ROUSSEAU_PARTICIPANT: Participant = {
  id: "rousseau",
  name: "Madame Rousseau",
  character: "rousseau",
  portrait: "/sejour/rousseau.jpg",
  blurb: "Host of the house",
};

const CAMILLE_PARTICIPANT: Participant = {
  id: "camille",
  name: "Camille",
  character: "camille",
  portrait: "/sejour/v2/people/camille.jpg",
  blurb: "Visiting from Dijon",
};

export function Sejour() {
  const stay = useSejour();
  const [hostTurns, setHostTurns] = useState<TalkTurn[]>([]);
  const [lessonTurns, setLessonTurns] = useState<TalkTurn[]>([]);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [lastInvitedOuting, setLastInvitedOuting] = useState<OutingId | null>(null);
  const [friendTurns, setFriendTurns] = useState<TalkTurn[]>([]);
  const [mentioned, setMentioned] = useState<PlaceId[]>([]);

  if (!stay.loaded) return <p className="sj-wrap">The house is waking up.</p>;

  const day = stay.save.day + 1;
  const knownIds = stay.save.met;
  const hostName = knownIds.includes("rousseau") ? "Madame Rousseau" : "???";
  const hostMemory = memoryText(stay.save.memories.rousseau);
  const knownFrench = stay.save.phrases.map((p) => p.fr);
  const level = levelBrief(stay.save.mastered, stay.save.gaps, stay.courseDay);
  const walletTotal = sumCoins(stay.save.wallet);

  const unlockedPlaces: PlaceId[] = PLACES.filter((p) => stay.save.unlocked.includes(p));
  const nextSuggestedRecipe = suggestRecipe(stay.save.cooked);

  const arrivalPlayerTurns = hostTurns.filter((t) => t.who === "you").length;
  const arrivalMinTurns = 3;
  const canEndArrival = arrivalPlayerTurns >= arrivalMinTurns;

  const arrivalActions: ConversationAction[] = canEndArrival
    ? [
        {
          id: "arrival-bed",
          label: "🌙 Go upstairs to bed →",
          primary: true,
          onClick: () => {
            const current = hostTurns;
            setHostTurns([]);
            stay.finishArrival(current);
          },
        },
      ]
    : [];

  const morningActions: ConversationAction[] = [
    ...mentioned.filter((placeId) => stay.save.unlocked.includes(placeId)).map((placeId) => {
      const info = PLACE_INFO[placeId];
      return {
        id: `place-${placeId}`,
        label: `Go to ${info.label}`,
        primary: false,
        onClick: () => {
          const current = hostTurns;
          setHostTurns([]);
          stay.pickPlace(placeId, current);
        },
      };
    }),
    ...(stay.save.pendingInvite
      ? [
          {
            id: "outing-invite",
            label: `Meet ${
              knownIds.includes(stay.save.pendingInvite.friendId)
                ? (PERSON_BY_ID[stay.save.pendingInvite.friendId]?.name ?? "them")
                : "them"
            } at ${PLACE_INFO[stay.save.pendingInvite.outing].label}`,
            primary: false,
            onClick: () => {
              const current = hostTurns;
              setHostTurns([]);
              stay.pickOutingInvite(stay.save.pendingInvite!, current);
            },
          },
        ]
      : []),
  ];

  const lessonActions: ConversationAction[] = [
    {
      id: "lesson-head-out",
      label: `🚪 Head out${stay.targetPlace ? ` to ${PLACE_INFO[stay.targetPlace].label}` : ""} →`,
      primary: true,
      onClick: () => {
        const current = lessonTurns;
        setLessonTurns([]);
        stay.completeLessonAndLeave(stay.currentLesson.id, current);
      },
    },
  ];

  function onHostReply(reply: TalkReply, history: TalkTurn[]) {
    setHostTurns(history);
    if (reply.phrases.length) stay.absorbPhrases(reply.phrases, hostName);
    if (reply.settled.length) stay.noteStudy([], reply.settled);
    if (reply.stage) stay.setStageCall(reply.stage);
    stay.observeLiveConversation("host", history, reply.suggestedPlaces);
    if (stay.phase === "morning") {
      stay.noteMorningTurn();
      if (reply.suggestedPlaces.length) {
        setMentioned((current) => [...new Set([...current, ...reply.suggestedPlaces])]);
      }
    }
    if (stay.phase === "arrival" && reply.bedtime && history.filter((t) => t.who === "you").length >= arrivalMinTurns) {
      setHostTurns([]);
      stay.finishArrival(history);
    }
  }

  function onLessonReply(reply: TalkReply, history: TalkTurn[]) {
    setLessonTurns(history);
    if (reply.phrases.length) stay.absorbPhrases(reply.phrases, hostName);
    if (reply.settled.length || history.some((t) => t.who === "you")) {
      stay.markLessonPracticed(stay.currentLesson.id);
    }
    if (reply.stage) stay.setStageCall(reply.stage);
  }

  const person = PERSON_BY_ID[stay.friendIds[stay.friendIndex] ?? ""];
  const restaurant =
    stay.targetPlace === "bistro" || stay.targetPlace === "auberge"
      ? RESTAURANT_BY_ID[stay.targetPlace]
      : RESTAURANT_BY_ID.bistro;
  const outingFriend = stay.targetOuting ? (PERSON_BY_ID[stay.targetOuting.friendId] ?? PERSON_BY_ID.paul) : PERSON_BY_ID.paul;
  const outingFriendLabel = knownIds.includes(outingFriend.id) ? outingFriend.name : "???";

  const familyTableParticipants: Participant[] = [ROUSSEAU_PARTICIPANT, CAMILLE_PARTICIPANT];

  return (
    <main className="sj-wrap">
      {stay.dayClose ? (
        <StreakClose
          streak={stay.dayClose.streak}
          previousStreak={stay.dayClose.previousStreak}
          examReady={stay.dayClose.examReady}
        />
      ) : null}
      {stay.listenConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-label="Turn listening mode off">
          <div className="w-full max-w-md rounded-xl bg-[#fbf7ee] p-5 text-[#231b12]">
            <h2 className="ep-display text-[26px]">Read the words instead?</h2>
            <p className="mt-2 text-[15px]">
              You can turn listening mode off and keep playing. This day will not count toward your listening skill, and new places that depend on listening will stay closed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="ep-button ep-primary" onClick={stay.confirmListeningOff}>
                Show the words
              </button>
              <button type="button" className="ep-button" onClick={() => stay.setListenConfirm(false)}>
                Keep listening
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {stay.villageNote ? (
        <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-[14px] text-amber-950" role="status">
          {stay.villageNote}
        </p>
      ) : null}
      <header className="mb-4 flex items-center justify-between gap-4 text-[var(--ep-cream)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em]">
          {stay.phase === "arrival" ? "Evening" : `Day ${day}`}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-pressed={stay.textHidden("host")}
            title="Madame's words stay hidden. More of the village hides its words as the weeks go on. Turning this off limits listening progress."
            className="min-h-11 text-sm font-semibold text-[var(--ep-cream)] underline"
            onClick={stay.toggleListening}
          >
            {stay.textHidden("host") ? "Listening" : "Reading"}
          </button>
          <details className="relative">
            <summary className="cursor-pointer text-sm font-semibold underline">More</summary>
            <div className="absolute right-0 z-30 mt-2 flex w-48 flex-col gap-1 rounded-xl bg-[#fbf7ee] p-2 text-[#231b12] shadow-lg">
              <p className="px-2 py-1 text-sm text-[#6e563a]">{eurosInWords(walletTotal)}</p>
              <button type="button" className="rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-black/5" onClick={() => setLessonsOpen(true)}>
                Lessons
              </button>
              <button type="button" className="rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-black/5" onClick={() => stay.setBookOpen(true)}>
                Phrasebook ({stay.save.phrases.length})
              </button>
              <a href="/home" className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-black/5">Leave</a>
              <button
                type="button"
                className="rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-black/5"
                onClick={() => {
                  if (window.confirm("Start the stay over? Your progress and phrasebook will be reset.")) {
                    setHostTurns([]);
                    setLessonTurns([]);
                    stay.reset();
                  }
                }}
              >
                Start over
              </button>
            </div>
          </details>
        </div>
      </header>

      <StageLayer stage={stay.stageCall} onDismiss={() => stay.setStageCall(null)} />

      {/* PHASE 1: ARRIVAL EVENING */}
      {stay.phase === "arrival" ? (
        <section className="sj-sheet rounded-xl">
          <Conversation
            key="arrival"
            title="Madame Rousseau"
            portrait="/sejour/rousseau.jpg"
            character="rousseau"
            role="host"
            who="rousseau"
            knownIds={knownIds}
            onMeet={stay.markMet}
            speakFirst
            memory={hostMemory}
            unlocked={stay.save.unlocked}
            knownFrench={knownFrench}
            listening={stay.textHidden("host")}
            placeholder="Say hello (or tell her in English if you don't know any French yet)..."
            hearLabel="Hear her"
            context="ARRIVAL. First evening at your house in Saint-Aubin, rue des Tilleuls. You are Madame Rousseau. Your first line only: welcome them, say your name, and ask their name. After that, answer the line they just said. If they told you about the journey, react to that and correct one French mistake if there is one. Do not welcome them again. Do not ask a question they already answered. If they say they do not understand, or they know no French, switch to English, explain the last line, and teach one short phrase. After a few exchanges, wish them bonne nuit and call bedtime."
            actions={arrivalActions}
            actionPrompt="🌙 Ready to turn in for the night? Press the button to go upstairs:"
            onReply={onHostReply}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--ep-ink-soft)]">How to address you:</span>
              <button
                type="button"
                className={`ep-button text-[14px] ${stay.save.address === "monsieur" ? "ep-primary" : ""}`}
                onClick={() => stay.chooseAddress("monsieur")}
              >
                Monsieur
              </button>
              <button
                type="button"
                className={`ep-button text-[14px] ${stay.save.address === "madame" ? "ep-primary" : ""}`}
                onClick={() => stay.chooseAddress("madame")}
              >
                Madame
              </button>
              <button
                type="button"
                className={`ep-button text-[14px] ${stay.save.address === "bonjour" ? "ep-primary" : ""}`}
                onClick={() => stay.chooseAddress("bonjour")}
              >
                Just bonjour
              </button>
            </div>

            {canEndArrival ? (
              <button
                type="button"
                className="ep-button ep-primary"
                onClick={() => {
                  const current = hostTurns;
                  setHostTurns([]);
                  stay.finishArrival(current);
                }}
              >
                🌙 Go upstairs to bed →
              </button>
            ) : (
              <span className="rounded-full border border-amber-900/25 bg-amber-50 px-3 py-1.5 text-[13px] font-medium text-amber-950">
                💬 Chat with Madame Rousseau first ({arrivalPlayerTurns}/{arrivalMinTurns} turns)
              </span>
            )}
          </div>
        </section>
      ) : null}

      {/* PHASE 2: MORNING AT HOME */}
      {stay.phase === "morning" ? (
        <section className="sj-sheet rounded-xl">
          {/* Subtle diegetic note if a special morning event has arrived */}
          {stay.availableEvent ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900/25 bg-amber-50/80 p-3.5">
              <div>
                <p className="text-[16px] font-semibold text-amber-950">
                  {EVENT_SPECS[stay.availableEvent].title}
                </p>
                <p className="mt-0.5 text-[14px] text-amber-900/90">
                  {EVENT_SPECS[stay.availableEvent].intro}
                </p>
              </div>
              <button
                type="button"
                className="ep-button ep-primary"
                onClick={() => {
                  const current = hostTurns;
                  setHostTurns([]);
                  stay.startEvent(stay.availableEvent!, current);
                }}
              >
                {stay.availableEvent === "sick" ? "Go upstairs to check →" : "Join them at the table →"}
              </button>
            </div>
          ) : null}

          <Conversation
            key={`morning-${day}`}
            title="Madame Rousseau"
            portrait="/sejour/rousseau.jpg"
            character="rousseau"
            role="host"
            who="rousseau"
            knownIds={[...knownIds, "rousseau"]}
            onMeet={stay.markMet}
            speakFirst
            memory={hostMemory}
            unlocked={stay.save.unlocked}
            knownFrench={knownFrench}
            listening={stay.textHidden("host")}
            placeholder="Talk in French or English..."
            hearLabel="Hear her"
            context={`MORNING. Day ${day}. Call them ${stay.save.address || "bonjour"}. ${level}
Available places you can suggest today: ${unlockedPlaces.length ? unlockedPlaces.join(", ") : "none yet (help them practice introducing themselves with 'Bonjour, je m'appelle...' first; if they don't know French, teach them in English!)"}.
${
  !unlockedPlaces.length
    ? "Warmly greet them at breakfast. Help them practice introducing themselves in French (teach them in English if they need help)."
    : unlockedPlaces.includes("epicerie") && !stay.save.visits.epicerie
      ? `Suggest cooking together today ('Peut-être qu'aujourd'hui on cuisine ?') — ${nextSuggestedRecipe.fr} (${nextSuggestedRecipe.name}) — and going to the épicerie, and call suggest_place with epicerie.`
      : unlockedPlaces.includes("bistro") && !stay.save.visits.bistro
        ? "Suggest trying the casual village bistro Le Petit Bistro or another place, and call suggest_place."
        : "This is a short breakfast, a few turns. Help them choose one place for today and call suggest_place. Do not teach the day's grammar here. That lesson comes after this talk."
}`}
            actions={morningActions}
            onReply={onHostReply}
          />
        </section>
      ) : null}

      {/* PHASE 3: DAILY FRENCH LESSON */}
      {stay.phase === "lesson" ? (
        <section className="sj-sheet rounded-xl">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-wider text-[var(--ep-ink-soft)]">
                Before you head out · Week {stay.currentLesson.week}, day {stay.currentLesson.day}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="ep-display text-[26px]">{stay.currentLesson.title}</h2>
                {stay.lessonPracticed ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[12px] font-semibold text-emerald-900">
                    ✓ Practiced! Ready to head out
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="ep-button text-[14px]"
              onClick={() => {
                setLessonTurns([]);
                stay.skipCurrentLesson(stay.currentLesson.id);
              }}
            >
              I already know that → Next
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-amber-900/20 bg-white/80 p-3.5">
            <p className="text-[15px] font-medium">{stay.currentLesson.useItPrompt}</p>
            {stay.textHidden("lesson") ? (
              <p className="mt-2 text-[14px] text-[var(--ep-ink-soft)]">
                Madame says the examples out loud. The French stays off the page unless you turn listening mode off.
              </p>
            ) : (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {stay.currentLesson.examples.map((ex) => (
                  <div key={ex.fr} className="rounded-lg border border-black/10 bg-amber-50/60 px-3 py-2">
                    <p className="text-[15px] font-semibold">{ex.fr}</p>
                    <p className="text-[13px] text-[var(--ep-ink-soft)]">{ex.en}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(stay.targetPlace === "epicerie" || stay.targetPlace === "supermarche") && stay.recipe ? (
            <div className="mb-4 rounded-xl border border-black/10 bg-white/70 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">
                Shopping List — {stay.recipe.fr} ({stay.recipe.name})
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-[15px]">
                {stay.recipe.note.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Conversation
            key={`lesson-${stay.currentLesson.id}`}
            title="Madame Rousseau"
            portrait="/sejour/rousseau.jpg"
            character="rousseau"
            role="lesson"
            who="rousseau"
            knownIds={knownIds}
            onMeet={stay.markMet}
            speakFirst
            memory=""
            unlocked={stay.save.unlocked}
            knownFrench={knownFrench}
            listening={stay.textHidden("lesson")}
            placeholder="Try one of the phrases in French (or ask a question in English)..."
            hearLabel="Hear her"
            context={`DAILY LESSON before heading out. Lesson id: "${stay.currentLesson.id}". Title: "${stay.currentLesson.title}". How to use it today: ${stay.currentLesson.useItPrompt}. Examples: ${stay.currentLesson.examples.map((e) => `${e.fr} (${e.en})`).join("; ")}. Say the French out loud. Explain in English if they are stuck, then invite them to try one phrase in French. When they try it, praise them and call settled({ ids: ["${stay.currentLesson.id}"] }).`}
            actions={lessonActions}
            actionPrompt="🚪 Ready to head out to the village? Press here:"
            onReply={onLessonReply}
          />
        </section>
      ) : null}

      {/* PHASE 4: SHORT WALK TRANSITION */}
      {stay.phase === "walk" ? (
        <section className="sj-sheet rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sejour/v2/scenes/street.jpg" alt="Saint-Aubin street" className="sj-photo mb-3" />
          <p className="text-[12px] uppercase tracking-wider text-[var(--ep-ink-soft)]">Saint-Aubin</p>
          <h2 className="ep-display text-[28px]">
            {stay.targetOuting
              ? `${PLACE_INFO[stay.targetOuting.outing].label} with ${outingFriendLabel}`
              : stay.targetPlace
                ? PLACE_INFO[stay.targetPlace].label
                : "In the village"}
          </h2>
          {stay.cashAddedNote > 0 ? (
            <p className="mt-2 rounded-lg bg-emerald-900/10 px-3 py-2 text-[15px] text-emerald-950">
              💶 {hostName} handed you {eurosInWords(stay.cashAddedNote)} for the outing (Wallet:{" "}
              {eurosInWords(walletTotal)}).
            </p>
          ) : null}
          <div className="mt-4">
            <button type="button" className="ep-button ep-primary" onClick={stay.arriveAtDestination}>
              Step inside →
            </button>
          </div>
        </section>
      ) : null}

      {/* PHASE 5: BOULANGERIE */}
      {stay.phase === "boulangerie" ? (
        <Bakery
          purse={stay.save.wallet}
          memory={memoryText(stay.save.memories.martine)}
          listening={stay.textHidden("boulangerie")}
          knownIds={knownIds}
          onMeet={stay.markMet}
          onPhrase={stay.absorbPhrases}
          onDone={stay.bakeryDone}
        />
      ) : null}

      {/* PHASE 6: ÉPICERIE (TRADITIONAL GROCER) SHOPPING */}
      {stay.phase === "shop" && stay.recipe ? (
        <ShopDay
          address={stay.save.address === "bonjour" || !stay.save.address ? "unknown" : stay.save.address}
          recipe={stay.recipe}
          purse={stay.save.wallet}
          listening={stay.textHidden("epicerie")}
          knownIds={knownIds}
          onMeet={stay.markMet}
          onDone={stay.shopDone}
        />
      ) : null}

      {/* PHASE 6B: SUPERMARCHÉ (SELF-SERVICE SUPERMARKET) SHOPPING */}
      {stay.phase === "supermarche" && stay.recipe ? (
        <Supermarche
          recipe={stay.recipe}
          purse={stay.save.wallet}
          memory={memoryText(stay.save.memories.elodie)}
          listening={stay.textHidden("supermarche")}
          knownIds={knownIds}
          onMeet={stay.markMet}
          onPhrase={stay.absorbPhrases}
          onDone={stay.shopDone}
        />
      ) : null}

      {/* PHASE 7: COOKING MINIGAME */}
      {stay.phase === "cooking" && stay.recipe ? (
        <Cooking
          recipe={stay.recipe}
          listening={stay.textHidden("cooking")}
          onPhrase={stay.absorbPhrases}
          onDone={stay.cookingDone}
        />
      ) : null}

      {/* PHASE 8: EATING TOGETHER AT HOME (2-WAY OR 3-WAY WHEN CAMILLE VISITS) */}
      {stay.phase === "homemeal" ? (
        <HomeMeal
          day={day}
          dishFr={stay.mealDish.fr}
          dishEn={stay.mealDish.en}
          icon={stay.mealDish.icon}
          recipe={stay.recipe}
          participants={stay.activeEvent === "family" ? familyTableParticipants : undefined}
          knownIds={knownIds}
          onMeet={stay.markMet}
          memory={hostMemory}
          unlocked={stay.save.unlocked}
          knownFrench={knownFrench}
          listening={stay.textHidden("meal")}
          practiceWords={[...stay.save.drill, ...spokenForDay(day)].slice(0, 4)}
          onPhrase={stay.absorbPhrases}
          onSettled={(ids) => stay.noteStudy([], ids)}
          onDone={stay.homeMealDone}
        />
      ) : null}

      {/* PHASE 9: RESTAURANT (CASUAL BISTRO OR FORMAL AUBERGE) */}
      {stay.phase === "meal" ? (
        <Meal
          place={restaurant}
          purse={stay.save.wallet}
          memory={memoryText(stay.save.memories[restaurant.id])}
          listening={stay.textHidden(restaurant.id)}
          knownIds={knownIds}
          onMeet={stay.markMet}
          onPhrase={stay.absorbPhrases}
          onDone={stay.restaurantDone}
        />
      ) : null}

      {/* PHASE 10: SPEED FRIENDING A1 REGISTRATION FORM */}
      {stay.phase === "signup" ? (
        <SignUpForm
          kind="speedfriending"
          initialValues={stay.save.formProfile}
          onPhrase={stay.absorbPhrases}
          onSubmit={stay.finishSignUp}
        />
      ) : null}

      {/* PHASE 11: SPEED FRIENDING CONVERSATIONS */}
      {stay.phase === "friends" && person ? (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={person.portrait} alt="" className="mb-3 h-56 w-40 rounded-md object-cover object-top" />
          <div className="sj-sheet rounded-xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] text-[var(--ep-ink-soft)]">
                Table {stay.friendIndex + 1} of {stay.friendIds.length} · from {person.place}
              </p>
              <span className="rounded-full border border-amber-900/25 bg-amber-50 px-3 py-0.5 text-[12px] font-semibold text-amber-950">
                💬 {Math.min(friendTurns.filter((t) => t.who === "you").length, 4)}/4 turns required
              </span>
            </div>
            <Conversation
              key={`${person.id}-${stay.friendIndex}`}
              title={person.name}
              portrait={person.portrait}
              character={person.id}
              role="friend"
              who={person.id}
              knownIds={knownIds}
              onMeet={stay.markMet}
              unlocked={stay.save.unlocked}
              knownFrench={knownFrench}
              listening={stay.textHidden("speedfriending")}
              memory={memoryText(stay.save.memories[person.id])}
              context={`Speed friending at the Salle des Fêtes, day ${day}. Slot ${stay.friendIndex + 1} of ${stay.friendIds.length}. ${
                knownIds.includes(person.id)
                  ? "You have met them before; greet them warmly like an acquaintance."
                  : "You have not met them yet. The screen shows ??? until you say your name in French."
              } ${person.blurb} ${
                stay.save.unlocked.includes("invite_parc")
                  ? `If the conversation goes well and they engage with you, invite them to ${person.favoriteOuting} tomorrow and only call the invite tool with ${person.favoriteOuting} once they agree in French!`
                  : ""
              }`}
              canEnd={friendTurns.filter((t) => t.who === "you").length >= 4}
              blockedEndReason={`Chat a little more with ${knownIds.includes(person.id) ? person.name : "this villager"} before moving on (${friendTurns.filter((t) => t.who === "you").length}/4 turns completed).`}
              endLabel={stay.friendIndex + 1 < stay.friendIds.length ? "Move to next person →" : "Finish speed friending →"}
              actionPrompt={
                stay.friendIndex + 1 < stay.friendIds.length
                  ? "🔔 The bell rings! You can move to the next person whenever you're ready:"
                  : "🔔 Final bell of the evening! Head home when you're ready:"
              }
              onReply={(reply, history) => {
                setFriendTurns(history);
                if (reply.phrases.length) stay.absorbPhrases(reply.phrases, person.name);
                if (reply.invited) setLastInvitedOuting(reply.invited);
              }}
              onEnd={(history) => {
                const invited = lastInvitedOuting;
                setLastInvitedOuting(null);
                setFriendTurns([]);
                stay.friendDone(person.id, history, invited);
              }}
            />
          </div>
        </section>
      ) : null}

      {/* PHASE 12: FRIEND OUTING (PARC / CINEMA / SPORT) */}
      {stay.phase === "outing" && stay.targetOuting ? (
        <Outing
          outing={stay.targetOuting.outing}
          friend={outingFriend}
          memory={memoryText(stay.save.memories[outingFriend.id])}
          listening={stay.textHidden(stay.targetOuting.outing)}
          knownIds={knownIds}
          onMeet={stay.markMet}
          formProfile={stay.save.formProfile}
          onSaveForm={stay.saveFormProfile}
          onPhrase={stay.absorbPhrases}
          onDone={stay.outingDone}
        />
      ) : null}

      {/* PHASE 13: THREE-WAY CONVERSATION — MADAME ROUSSEAU + GRANDDAUGHTER CAMILLE */}
      {stay.phase === "event_family" ? (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sejour/v2/scenes/dining.jpg" alt="Family dining table" className="sj-photo" />
          <div className="sj-sheet rounded-xl">
            <Conversation
              key="event-family"
              title="Madame Rousseau & Camille"
              character="rousseau"
              role="family"
              who="rousseau"
              participants={familyTableParticipants}
              knownIds={knownIds}
              onMeet={stay.markMet}
              speakFirst
              unlocked={stay.save.unlocked}
              knownFrench={knownFrench}
              listening={stay.textHidden("family")}
              memory={`${hostMemory}\n${memoryText(stay.save.memories.camille)}`.trim()}
              context={`Three-way conversation at the dining table on day ${day} between the guest, Madame Rousseau ("rousseau"), and her 22-year-old granddaughter Camille ("camille", visiting from Dijon). Have Madame Rousseau and Camille riff naturally with each other and with the guest in each turn (e.g. Madame introduces Camille, then Camille speaks; or Camille asks a question and Madame chimes in to translate or comment). If the guest speaks English or is unsure, Madame Rousseau gladly explains in English and helps them reply to Camille.`}
              endLabel="Sit down to eat lunch together →"
              onReply={(reply) => {
                if (reply.phrases.length) stay.absorbPhrases(reply.phrases, "Family lunch");
                if (reply.stage) stay.setStageCall(reply.stage);
              }}
              onEnd={stay.familyEventDone}
            />
          </div>
        </section>
      ) : null}

      {/* PHASE 14: MADAME ROUSSEAU IS SICK (PHARMACIE) */}
      {stay.phase === "event_sick" ? (
        <Pharmacie
          purse={stay.save.wallet}
          memory={memoryText(stay.save.memories.pharmacien)}
          listening={stay.textHidden("pharmacie")}
          knownIds={knownIds}
          onMeet={stay.markMet}
          onPhrase={stay.absorbPhrases}
          onDone={stay.sickEventDone}
        />
      ) : null}

      {/* PHASE 15: POST-CONVERSATION REVIEW */}
      {stay.phase === "vocab" ? (
        <DayPractice day={day} extra={stay.save.drill} onDone={() => stay.setPhase("homemeal")} />
      ) : null}

      {stay.phase === "review" ? (
        <section className="sj-sheet rounded-xl">
          <Review
            lines={stay.reviewLines}
            scene={stay.reviewScene}
            newUnlocks={stay.newUnlocks}
            readingAssist={stay.save.readText || stay.save.listeningMode === "off"}
            onContinue={stay.reviewDone}
            onStudy={stay.noteStudy}
            onDrill={stay.rememberDrill}
            continueLabel={stay.reviewScene === "meal" ? "Sleep" : "Continue"}
          />
        </section>
      ) : null}

      {stay.bookOpen ? (
        <Phrasebook
          save={stay.save}
          onClose={() => stay.setBookOpen(false)}
          onAdd={stay.addOwnPhrase}
          onPage={stay.addPage}
          onMove={stay.movePhraseTo}
          onJournal={stay.updateJournal}
        />
      ) : null}
      {lessonsOpen ? (
        <Lessons
          save={stay.save}
          gaps={stay.save.gaps}
          onPracticeLesson={(id) => {
            setLessonTurns([]);
            stay.practiceSpecificLesson(id);
          }}
          onToggleSkip={stay.toggleSkipLesson}
          onClose={() => setLessonsOpen(false)}
        />
      ) : null}
      <SelectionMenu phrases={stay.save.phrases} onAdd={stay.addOwnPhrase} />
    </main>
  );
}
