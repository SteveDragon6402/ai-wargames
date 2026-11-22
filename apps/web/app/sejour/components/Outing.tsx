"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CINEMA_CLIPS, type CinemaClip } from "../data/clips";
import type { Person } from "../data/people";
import { flagReadingAssist } from "../lib/reading";
import { hear, stopHearing, type Participant, type TalkReply, type TalkTurn } from "../lib/voice";
import { PLACE_INFO, type OutingId } from "../world/places";
import { Conversation } from "./Conversation";
import { SignUpForm } from "./SignUpForm";

interface OutingProps {
  outing: OutingId;
  friend: Person;
  memory: string;
  notes?: string[];
  onNotes?: (notes: string[]) => void;
  listening: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  formProfile: Record<string, string>;
  onSaveForm: (values: Record<string, string>) => void;
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: (turns: TalkTurn[]) => void;
}

const DOG_ACTIONS = [
  { labelFr: "Caresser la tête", labelEn: "Pet his head", icon: "🤚", reactionFr: "Pistache ferme les yeux et remue la queue !" },
  { labelFr: "Donne la patte !", labelEn: "Give your paw!", icon: "🐾", reactionFr: "Ouaf ! Il pose sa patte dans votre main !" },
  { labelFr: "Donner un biscuit", labelEn: "Give a dog biscuit", icon: "🦴", reactionFr: "Miam ! Il s'assoit sagement." },
];

export type FrisbeeDir = "up" | "down" | "left" | "right";

export const FRISBEE_DIRS: Record<
  FrisbeeDir,
  {
    callFr: string;
    phraseEn: string;
    pointText: string;
    pointHand: string;
  }
> = {
  left: {
    callFr: "À gauche !",
    phraseEn: "To the left!",
    pointText: "points towards your left",
    pointHand: "👈",
  },
  right: {
    callFr: "À droite !",
    phraseEn: "To the right!",
    pointText: "points towards your right",
    pointHand: "👉",
  },
  up: {
    callFr: "En haut !",
    phraseEn: "Up / forward!",
    pointText: "points straight ahead (up)",
    pointHand: "👆",
  },
  down: {
    callFr: "En bas !",
    phraseEn: "Down / back!",
    pointText: "points behind you (down)",
    pointHand: "👇",
  },
};

const DIR_ORDER: FrisbeeDir[] = ["left", "right", "up", "down"];

export function pickNextFrisbeeDir(current: FrisbeeDir, seed: number): FrisbeeDir {
  const others = DIR_ORDER.filter((d) => d !== current);
  return others[(seed * 5 + 1) % others.length] ?? "right";
}

export function Outing({
  outing,
  friend,
  memory,
  notes = [],
  onNotes,
  listening,
  knownIds = [],
  onMeet,
  formProfile,
  onSaveForm,
  onPhrase,
  onDone,
}: OutingProps) {
  const friendLabel = knownIds.includes(friend.id) ? friend.name : "???";
  const [stage, setStage] = useState<"form" | "before" | "play" | "after">(outing === "sport" ? "form" : "before");
  const [beforeTurns, setBeforeTurns] = useState<TalkTurn[]>([]);
  const [dogTurns, setDogTurns] = useState<TalkTurn[]>([]);
  const [afterTurns, setAfterTurns] = useState<TalkTurn[]>([]);

  // Parc state
  const [parcSub, setParcSub] = useState<"dog" | "frisbee">("dog");
  const [dogPets, setDogPets] = useState(0);
  const [dogReaction, setDogReaction] = useState<string | null>(null);

  // Frisbee center-cross state
  const [targetDir, setTargetDir] = useState<FrisbeeDir>("left");
  const [wrongTries, setWrongTries] = useState(0);
  const [catches, setCatches] = useState(0);
  const [lastMoved, setLastMoved] = useState<FrisbeeDir | null>(null);
  const [justCaught, setJustCaught] = useState(false);
  const [frisbeeFeedback, setFrisbeeFeedback] = useState<string | null>(null);

  // Cinema state
  const [selectedClip, setSelectedClip] = useState<CinemaClip>(CINEMA_CLIPS[0]);
  const [customYt, setCustomYt] = useState("");
  const [showSubs, setShowSubs] = useState(!listening);
  const [subsWarned, setSubsWarned] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playingLineIdx, setPlayingLineIdx] = useState<number | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const clipRunRef = useRef(0);

  useEffect(() => {
    return () => {
      clipRunRef.current += 1;
      stopHearing();
    };
  }, []);

  // Sport state
  const [goals, setGoals] = useState(0);
  const [shots, setShots] = useState(0);
  const [shotNote, setShotNote] = useState<string | null>(null);

  const info = PLACE_INFO[outing];

  const dogParticipants: Participant[] = [
    {
      id: friend.id,
      name: friend.name,
      character: friend.id,
      portrait: friend.portrait,
      blurb: "Dog's owner",
    },
    {
      id: "pistache",
      name: "Pistache",
      character: "pistache",
      blurb: "Le chien 🐕",
    },
  ];

  const chooseDirection = useCallback(
    (chosen: FrisbeeDir) => {
      setLastMoved(chosen);
      const spec = FRISBEE_DIRS[targetDir];
      if (chosen === targetDir) {
        const nextCatches = catches + 1;
        setCatches(nextCatches);
        setWrongTries(0);
        setJustCaught(true);
        onPhrase([{ fr: spec.callFr, en: spec.phraseEn }], "Le Parc (Frisbee)");
        const nextDir = pickNextFrisbeeDir(targetDir, nextCatches);
        const nextSpec = FRISBEE_DIRS[nextDir];
        setFrisbeeFeedback(`🥏 Bien rattrapé ! (${spec.callFr})`);
        void hear(friend.id, `Bien rattrapé ! Maintenant : ${nextSpec.callFr}`, "any");
        setTimeout(() => {
          setTargetDir(nextDir);
          setLastMoved(null);
          setJustCaught(false);
        }, 700);
      } else {
        const nextWrong = wrongTries + 1;
        setWrongTries(nextWrong);
        setJustCaught(false);
        if (nextWrong >= 2) {
          setFrisbeeFeedback(
            `« ${spec.callFr} » — ${friendLabel} ${spec.pointText} ${spec.pointHand}`,
          );
        } else {
          setFrisbeeFeedback(`Raté ! ${friendLabel} crie encore : « ${spec.callFr} »`);
        }
        void hear(friend.id, `Non, ${spec.callFr}`, "any");
      }
    },
    [catches, friend.id, friendLabel, onPhrase, targetDir, wrongTries],
  );

  // Allow keyboard arrow keys during the Frisbee minigame
  useEffect(() => {
    if (stage !== "play" || outing !== "parc" || parcSub !== "frisbee") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        chooseDirection("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        chooseDirection("down");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        chooseDirection("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        chooseDirection("right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooseDirection, outing, parcSub, stage]);

  function startFrisbeeSub() {
    setParcSub("frisbee");
    setWrongTries(0);
    setLastMoved(null);
    setJustCaught(false);
    const spec = FRISBEE_DIRS[targetDir];
    void hear(friend.id, `Attention, je lance ! ${spec.callFr}`, "any");
  }

  function handleReplyBefore(reply: TalkReply, history: TalkTurn[]) {
    setBeforeTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, friendLabel);
    if (reply.left) setStage("play");
  }

  function handleReplyDog(reply: TalkReply, history: TalkTurn[]) {
    setDogTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, "Le Parc");
  }

  function handleReplyAfter(reply: TalkReply, history: TalkTurn[]) {
    setAfterTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, friendLabel);
  }

  async function playClipDialogue(clip: CinemaClip, startAt = 0) {
    const runId = ++clipRunRef.current;
    stopHearing();
    for (let i = startAt; i < clip.lines.length; i++) {
      if (clipRunRef.current !== runId) return;
      setFrameIdx(i);
      setPlayingLineIdx(i);
      const line = clip.lines[i];
      await hear(line.voice, line.fr, "any");
    }
    if (clipRunRef.current === runId) {
      setPlayingLineIdx(null);
      onPhrase(clip.words, clip.film);
    }
  }

  function stopClipDialogue() {
    clipRunRef.current += 1;
    stopHearing();
    setPlayingLineIdx(null);
  }

  function playSingleCinemaLine(clip: CinemaClip, idx: number) {
    clipRunRef.current += 1;
    setFrameIdx(idx);
    setPlayingLineIdx(idx);
    const line = clip.lines[idx];
    if (!line) return;
    const runId = clipRunRef.current;
    void hear(line.voice, line.fr, "any").then(() => {
      if (clipRunRef.current === runId) setPlayingLineIdx(null);
    });
  }

  function shootFootball(dirFr: string, dirEn: string) {
    const nextShots = shots + 1;
    setShots(nextShots);
    const keeperIdx = (nextShots + dirFr.length) % 3;
    const scored = keeperIdx !== 0 || goals < 2;
    if (scored) {
      setGoals((g) => g + 1);
      setShotNote(`⚽ BUT ! Vous tirez ${dirFr.toLowerCase()} — « Magnifique tir ! »`);
      onPhrase([{ fr: `Tir ${dirFr.toLowerCase()} — But !`, en: `Shot ${dirEn.toLowerCase()} — Goal!` }], "Football");
    } else {
      setShotNote(`🧤 Arrêt du gardien sur votre tir ${dirFr.toLowerCase()} ! « Presque ! Encore un essai ! »`);
    }
  }

  if (stage === "form") {
    return (
      <SignUpForm
        kind="sport"
        initialValues={formProfile}
        onPhrase={onPhrase}
        onSubmit={(values) => {
          onSaveForm(values);
          setStage("before");
        }}
      />
    );
  }

  const currentFrisbeeSpec = FRISBEE_DIRS[targetDir];

  return (
    <section aria-label={info.label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={info.scene} alt={info.label} className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">
              Sortie · {stage === "before" ? "Before" : stage === "play" ? "In progress" : "Afterwards"}
            </p>
            <h2 className="ep-display text-[28px]">
              {info.icon} {info.label} with {friendLabel}
            </h2>
          </div>
          {stage === "before" ? (
            <button type="button" className="ep-button ep-primary" onClick={() => setStage("play")}>
              {outing === "parc" ? "🐕 Go to the lawn" : outing === "cinema" ? "🎬 Enter the screening room" : "⚽ Kick off the match"}
            </button>
          ) : stage === "play" ? (
            <button type="button" className="ep-button ep-primary" onClick={() => setStage("after")}>
              💬 Talk with {friendLabel} about it →
            </button>
          ) : null}
        </div>

        {stage === "before" ? (
          <div className="mt-3">
            <Conversation
              key="outing-before"
              title={friend.name}
              portrait={friend.portrait}
              character={friend.id}
              role="friend_outing"
              who={friend.id}
              knownIds={knownIds}
              onMeet={onMeet}
              speakFirst
              listening={listening}
              memory={memory}
              notes={notes}
              onNotes={onNotes}
              context={`BEFORE OUTING: ${info.fr} (${info.label}) with ${friend.name}. You have just met up. Talk in simple French about what you are about to do (${outing === "parc" ? "walking in the park with the dog Pistache and playing frisbee" : outing === "cinema" ? "watching a short French film together" : "playing five-a-side football"}).`}
              endLabel="Start the activity"
              onReply={handleReplyBefore}
              onEnd={(history) => {
                setBeforeTurns(history);
                setStage("play");
              }}
            />
          </div>
        ) : null}

        {stage === "play" && outing === "parc" ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`ep-button ${parcSub === "dog" ? "ep-primary" : ""}`}
                onClick={() => setParcSub("dog")}
              >
                🐕 Play &amp; talk with the dog
              </button>
              <button
                type="button"
                className={`ep-button ${parcSub === "frisbee" ? "ep-primary" : ""}`}
                onClick={startFrisbeeSub}
              >
                🥏 Play Frisbee (Directions)
              </button>
            </div>

            {parcSub === "dog" ? (
              <div className="space-y-4 rounded-xl border border-amber-900/20 bg-white/85 p-4">
                <div className="flex flex-wrap items-center gap-4 border-b border-black/10 pb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const action = DOG_ACTIONS[dogPets % DOG_ACTIONS.length];
                      setDogPets((p) => p + 1);
                      setDogReaction(action.reactionFr);
                      onPhrase([{ fr: action.labelFr, en: action.labelEn }], "Le Parc");
                    }}
                    className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-amber-700/40 bg-amber-50 text-center shadow transition hover:scale-105"
                  >
                    <span className="text-4xl">{dogPets >= 3 ? "🐶❤️" : "🐕"}</span>
                    <span className="mt-1 text-[11px] font-semibold">Caresser</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-[var(--ep-ink-soft)]">
                      Pet the dog or talk to both {friendLabel} and the dog below:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DOG_ACTIONS.map((act) => (
                        <button
                          key={act.labelFr}
                          type="button"
                          className="ep-button text-[13px]"
                          onClick={() => {
                            setDogPets((p) => p + 1);
                            setDogReaction(act.reactionFr);
                            onPhrase([{ fr: act.labelFr, en: act.labelEn }], "Le Parc");
                          }}
                        >
                          {act.icon} {act.labelFr}
                        </button>
                      ))}
                    </div>
                    {dogReaction ? (
                      <p className="mt-2 rounded bg-amber-100/80 px-3 py-1.5 text-[14px] font-medium">{dogReaction}</p>
                    ) : null}
                  </div>
                </div>

                {/* Three-way conversation: You + Owner + Dog */}
                <Conversation
                  key="outing-dog-3way"
                  title={`${friend.name} & Pistache`}
                  character={friend.id}
                  role="friend_outing"
                  who={friend.id}
                  participants={dogParticipants}
                  knownIds={knownIds}
                  onMeet={onMeet}
                  speakFirst
                  listening={listening}
                  memory={memory}
              notes={notes}
              onNotes={onNotes}
                  context={`THREE-WAY CONVERSATION IN THE PARK between the player, ${friend.name} ("${friend.id}"), and the dog Pistache ("pistache"). Pets given so far: ${dogPets}. Both ${friend.name} and Pistache ("pistache") should speak/react in each turn so the player talks with both the owner and the dog!`}
                  endLabel="Switch to Frisbee 🥏"
                  onReply={handleReplyDog}
                  onEnd={(history) => {
                    setDogTurns(history);
                    startFrisbeeSub();
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-amber-900/20 bg-white/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="ep-display text-[22px]">
                      🥏 Frisbee on the Lawn ({catches} caught)
                    </h3>
                    <p className="text-[14px] text-[var(--ep-ink-soft)]">
                      You are in the center (🏃). Listen to {friendLabel}&apos;s call and dive in that direction!
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ep-button"
                    onClick={() => void hear(friend.id, currentFrisbeeSpec.callFr, "any")}
                  >
                    🔊 Hear call again
                  </button>
                </div>

                {/* Friend's spoken call + pointing gesture after 2 misses */}
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-800/30 bg-emerald-50 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={friend.portrait} alt="" className="h-12 w-12 rounded-full object-cover object-top" />
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-emerald-900">
                      {friendLabel} shouts:
                    </p>
                    <p className="text-[20px] font-bold text-emerald-950">
                      {listening ? "🎧 [listening mode]" : `« ${currentFrisbeeSpec.callFr} »`}
                    </p>
                    {wrongTries >= 2 ? (
                      <p className="mt-0.5 text-[14px] font-medium italic text-amber-900">
                        *{friendLabel} {currentFrisbeeSpec.pointText}.*
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Visual Center-Cross Lawn: You in the middle, 4 direction buttons around you */}
                <div className="mx-auto my-6 grid max-w-xs grid-cols-3 place-items-center gap-3 rounded-2xl border-2 border-emerald-900/25 bg-emerald-800/15 p-5">
                  <div />
                  <button
                    type="button"
                    aria-label="Go up"
                    onClick={() => chooseDirection("up")}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-emerald-900/30 bg-white/90 text-2xl shadow transition hover:scale-105 hover:bg-amber-50 active:scale-95"
                  >
                    <span>{lastMoved === "up" ? (justCaught ? "🏃🥏" : "🏃") : "⬆️"}</span>
                  </button>
                  <div />

                  <button
                    type="button"
                    aria-label="Go left"
                    onClick={() => chooseDirection("left")}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-emerald-900/30 bg-white/90 text-2xl shadow transition hover:scale-105 hover:bg-amber-50 active:scale-95"
                  >
                    <span>{lastMoved === "left" ? (justCaught ? "🏃🥏" : "🏃") : "⬅️"}</span>
                  </button>

                  <div
                    aria-label="Your starting spot in the center"
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-dashed border-emerald-900/40 bg-emerald-100/80 text-3xl"
                  >
                    <span>{lastMoved === null ? "🏃" : "🌿"}</span>
                  </div>

                  <button
                    type="button"
                    aria-label="Go right"
                    onClick={() => chooseDirection("right")}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-emerald-900/30 bg-white/90 text-2xl shadow transition hover:scale-105 hover:bg-amber-50 active:scale-95"
                  >
                    <span>{lastMoved === "right" ? (justCaught ? "🏃🥏" : "🏃") : "➡️"}</span>
                  </button>

                  <div />
                  <button
                    type="button"
                    aria-label="Go down"
                    onClick={() => chooseDirection("down")}
                    className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-emerald-900/30 bg-white/90 text-2xl shadow transition hover:scale-105 hover:bg-amber-50 active:scale-95"
                  >
                    <span>{lastMoved === "down" ? (justCaught ? "🏃🥏" : "🏃") : "⬇️"}</span>
                  </button>
                  <div />
                </div>

                {frisbeeFeedback ? (
                  <p className="rounded-lg bg-amber-100/90 px-3.5 py-2 text-center text-[15px] font-semibold text-amber-950">
                    {frisbeeFeedback}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {stage === "play" && outing === "cinema" ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {CINEMA_CLIPS.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    className={`ep-button ${selectedClip.id === clip.id ? "ep-primary" : ""}`}
                    onClick={() => {
                      stopClipDialogue();
                      setSelectedClip(clip);
                      setFrameIdx(0);
                      setQuizAnswer(null);
                    }}
                  >
                    Level {clip.level}: {clip.film} ({clip.year})
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ep-button text-[13px]"
                onClick={() => {
                  if (!showSubs && listening && !subsWarned) {
                    const show = window.confirm(
                      "Showing the subtitles will limit your listening progress for today. You can still watch. Show them?",
                    );
                    if (!show) return;
                    setSubsWarned(true);
                    flagReadingAssist();
                  }
                  setShowSubs((shown) => !shown);
                }}
              >
                {showSubs ? "Hide English subtitles" : "Show English subtitles"}
              </button>
            </div>

            {(() => {
              const activeLine = selectedClip.lines[frameIdx] ?? selectedClip.lines[0];
              const backdropSrc = activeLine?.backdrop || selectedClip.poster || "/sejour/v2/scenes/cinema.jpg";
              const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedClip.youtubeQuery)}`;
              return (
                <div className="rounded-xl border border-black/20 bg-stone-900 p-4 text-stone-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="ep-display text-[22px] text-amber-200">
                        {selectedClip.title} — <em>{selectedClip.film}</em> ({selectedClip.year})
                      </h3>
                      <p className="text-[13px] text-stone-300">{selectedClip.context}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {playingLineIdx !== null ? (
                        <button
                          type="button"
                          className="rounded-full bg-rose-500 px-4 py-2 text-[14px] font-semibold text-white hover:bg-rose-400"
                          onClick={stopClipDialogue}
                        >
                          ⏹ Stop Screening
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full bg-amber-400 px-4 py-2 text-[14px] font-semibold text-stone-950 hover:bg-amber-300"
                          onClick={() => void playClipDialogue(selectedClip, 0)}
                        >
                          ▶️ Play Film Scene
                        </button>
                      )}
                      <a
                        href={ytSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-stone-600 bg-stone-800 px-3.5 py-2 text-[13px] font-medium text-amber-200 hover:bg-stone-700"
                      >
                        🎬 Watch on YouTube ↗
                      </a>
                    </div>
                  </div>

                  {/* Widescreen Interactive Cinema Screen */}
                  {customYt.trim() ? (
                    <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
                      <iframe
                        key={customYt.trim()}
                        src={`https://www.youtube-nocookie.com/embed/${customYt.trim()}?rel=0`}
                        title={selectedClip.title}
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="relative mt-3 overflow-hidden rounded-xl border-2 border-amber-500/30 bg-black shadow-2xl">
                      {/* Top cinema letterbox bar */}
                      <div className="flex items-center justify-between bg-black/95 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                        <span>🎞️ Cinéma de Saint-Aubin · Salle 1</span>
                        <span>
                          Plan {frameIdx + 1} / {selectedClip.lines.length}
                        </span>
                      </div>

                      {/* Illustrated film frame */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={backdropSrc}
                          alt={activeLine?.shot ?? selectedClip.title}
                          className={`h-full w-full object-cover transition-all duration-700 ${
                            playingLineIdx !== null ? "scale-105 brightness-95" : "scale-100 brightness-90"
                          }`}
                        />
                        <div className=" inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Shot caption & emoji badge */}
                        <div className="absolute left-4 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-[12px] text-amber-200 backdrop-blur-sm">
                          <span>{activeLine?.emoji ?? "🎬"}</span>
                          <span>{activeLine?.shot ?? selectedClip.film}</span>
                        </div>

                        {/* Center big play overlay if not currently playing */}
                        {playingLineIdx === null ? (
                          <button
                            type="button"
                            onClick={() => void playClipDialogue(selectedClip, frameIdx)}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 bg-black/75 px-5 py-3 text-[15px] font-semibold text-amber-200 shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-amber-400 hover:text-stone-950"
                          >
                            ▶️ Play from Shot {frameIdx + 1}
                          </button>
                        ) : (
                          <div className="absolute right-4 top-3 flex items-center gap-1.5 rounded-full bg-amber-400/90 px-3 py-1 text-[12px] font-bold text-stone-950">
                            <span>🔊 Projection en cours…</span>
                          </div>
                        )}

                        {/* Cinema Subtitles Overlay at bottom of screen */}
                        {activeLine ? (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-6 pb-4 pt-8 text-center">
                            <p className="text-[12px] font-semibold uppercase tracking-widest text-amber-300">
                              {activeLine.speaker}
                            </p>
                            <p className="mt-0.5 text-[18px] font-semibold leading-snug text-white drop-shadow sm:text-[21px]">
                              {listening && !showSubs ? "🎧 [listening mode — listen to the line]" : `« ${activeLine.fr} »`}
                            </p>
                            {showSubs ? (
                              <p className="mt-1 text-[14px] italic text-amber-100/85">{activeLine.en}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {/* Bottom transport & reel progress bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={frameIdx === 0}
                            onClick={() => playSingleCinemaLine(selectedClip, Math.max(0, frameIdx - 1))}
                            className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 text-[12px] text-stone-200 hover:bg-stone-700 disabled:opacity-40"
                          >
                            ⏮ Prev shot
                          </button>
                          <button
                            type="button"
                            onClick={() => playSingleCinemaLine(selectedClip, frameIdx)}
                            className="rounded border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-[12px] font-semibold text-amber-200 hover:bg-amber-500/30"
                          >
                            🔊 Hear this shot
                          </button>
                          <button
                            type="button"
                            disabled={frameIdx >= selectedClip.lines.length - 1}
                            onClick={() =>
                              playSingleCinemaLine(selectedClip, Math.min(selectedClip.lines.length - 1, frameIdx + 1))
                            }
                            className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 text-[12px] text-stone-200 hover:bg-stone-700 disabled:opacity-40"
                          >
                            Next shot ⏭
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {selectedClip.lines.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`Jump to shot ${idx + 1}`}
                              onClick={() => playSingleCinemaLine(selectedClip, idx)}
                              className={`h-2.5 rounded-full transition-all ${
                                frameIdx === idx ? "w-8 bg-amber-400" : "w-2.5 bg-stone-600 hover:bg-stone-400"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Scene Script */}
                  <div className="mt-3 rounded-lg bg-stone-800/90 p-3">
                    <p className="text-[12px] uppercase tracking-wider text-amber-300/90">
                      Scene dialogue (click any line to jump &amp; hear it in French)
                    </p>
                    <ul className="mt-2 space-y-2 text-[14px]">
                      {selectedClip.lines.map((line, idx) => (
                        <li
                          key={idx}
                          className={`rounded p-2 transition ${
                            playingLineIdx === idx
                              ? "bg-amber-500/25 ring-1 ring-amber-400"
                              : frameIdx === idx
                                ? "bg-stone-700/80"
                                : "bg-stone-900/60"
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => playSingleCinemaLine(selectedClip, idx)}
                          >
                            <span className="font-semibold text-amber-200">
                              {line.emoji ? `${line.emoji} ` : ""}
                              {line.speaker}:{" "}
                            </span>
                            <span>{listening && !showSubs ? "[listening mode]" : line.fr}</span>
                            {showSubs ? <span className="block text-[12px] text-stone-400">{line.en}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Quick comprehension whisper with your friend */}
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-stone-800/70 p-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-300">
                      💬 {friendLabel} whispers to you: « {selectedClip.question.promptFr} »
                    </p>
                    {showSubs ? (
                      <p className="text-[12px] text-stone-400">({selectedClip.question.promptEn})</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedClip.question.choices.map((ch) => {
                        const picked = quizAnswer === ch.fr;
                        return (
                          <button
                            key={ch.fr}
                            type="button"
                            onClick={() => {
                              setQuizAnswer(ch.fr);
                              void hear(friend.id, ch.correct ? `Oui, exact ! ${ch.fr} !` : `Mais non ! Regarde bien la scène !`, "any");
                              if (ch.correct) {
                                onPhrase(selectedClip.words, selectedClip.film);
                              }
                            }}
                            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                              picked
                                ? ch.correct
                                  ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                                  : "border-rose-400 bg-rose-500/25 text-rose-200"
                                : "border-stone-600 bg-stone-900 text-stone-200 hover:bg-stone-700"
                            }`}
                          >
                            {ch.fr} {picked ? (ch.correct ? "✓" : "✗") : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-stone-400">
                    <span>
                      Key words:{" "}
                      {selectedClip.words.map((w) => `${w.fr} (${w.en})`).join(" · ")}
                    </span>
                    <input
                      type="text"
                      value={customYt}
                      onChange={(e) => setCustomYt(e.target.value)}
                      placeholder="Optional: custom YouTube ID"
                      className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-[12px] text-stone-200"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        {stage === "play" && outing === "sport" ? (
          <div className="mt-4 rounded-xl border border-amber-900/20 bg-white/85 p-4">
            <h3 className="ep-display text-[22px]">
              ⚽ Five-a-side Penalty Shootout ({goals} goals / {shots} shots)
            </h3>
            <p className="text-[14px] text-[var(--ep-ink-soft)]">
              Pick where to place your shot in French:
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { fr: "À gauche", en: "To the left" },
                { fr: "Au centre", en: "In the center" },
                { fr: "À droite", en: "To the right" },
              ].map((dir) => (
                <button
                  key={dir.fr}
                  type="button"
                  onClick={() => shootFootball(dir.fr, dir.en)}
                  className="flex flex-col items-center justify-center rounded-xl border border-black/20 bg-emerald-50/80 p-4 hover:bg-emerald-100"
                >
                  <span className="text-3xl">🥅⚽</span>
                  <span className="mt-1 font-semibold">{dir.fr}</span>
                </button>
              ))}
            </div>
            {shotNote ? (
              <p className="mt-3 rounded-lg bg-amber-100/80 p-2.5 text-[14px] font-medium">{shotNote}</p>
            ) : null}
          </div>
        ) : null}

        {stage === "after" ? (
          <div className="mt-3">
            <Conversation
              key="outing-after"
              title={friend.name}
              portrait={friend.portrait}
              character={friend.id}
              role="friend_outing"
              who={friend.id}
              knownIds={knownIds}
              onMeet={onMeet}
              speakFirst
              listening={listening}
              memory={memory}
              notes={notes}
              onNotes={onNotes}
              context={`AFTER OUTING: You and ${friend.name} just finished ${
                outing === "parc"
                  ? `hanging out at the park (talked and played with Pistache the dog ${dogPets} times, and caught the frisbee ${catches} times following French direction calls like à gauche, à droite, en haut, en bas)`
                  : outing === "cinema"
                    ? `watching "${selectedClip.title}" from ${selectedClip.film} at the cinema`
                    : `playing five-a-side football (scored ${goals} goals)`
              }. Talk in French about what you liked and how it went!`}
              endLabel="Finish outing & see review"
              onReply={handleReplyAfter}
              onEnd={(history) => onDone([...beforeTurns, ...dogTurns, ...(history.length ? history : afterTurns)])}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
