"use client";

import { useCallback, useEffect, useState } from "react";
import { ITEM_BY_ID } from "@/app/epicerie/data/items";
import { linesTotal, makeChange, type Line } from "@/app/epicerie/lib/shop";
import { pickFriends } from "../data/people";
import { HANDOUT_IDS } from "../data/handouts";
import { suggestRecipe, type Recipe } from "../lib/ladder";
import { allGone, boardFor, gate, tickBoard, trainOn, type Departure } from "../lib/station";
import { addBookPage, addPhrase, emptySave, movePhrase, parseSave, recordStudy, remember, SAVE_KEY, type Address, type Card, type Gap, type Phrase, type Save } from "../lib/save";
import { stopHearing, type TalkTurn } from "../lib/voice";

export type Activity = "cook" | "friending" | "restaurant" | "postcard";
export type Phase = "intro" | "morning" | "briefing" | "depart" | "station" | "shop" | "friends" | "meal" | "postcard" | "review" | "return" | "dinner";
type After = "next-friend" | "return" | "dinner" | "station";

export interface ReviewLine {
  role: "you" | "gerard";
  text: string;
}

function load(): Save {
  if (typeof window === "undefined") return emptySave();
  try {
    return parseSave(JSON.parse(localStorage.getItem(SAVE_KEY) ?? "")) ?? emptySave();
  } catch {
    return emptySave();
  }
}

export function purseFor(activity: Activity, lines: Line[]): number[] {
  if (activity === "cook") return makeChange(linesTotal(lines) + 200);
  if (activity === "restaurant") return makeChange(3500);
  if (activity === "friending") return makeChange(800);
  return [];
}

export function destinationFor(activity: Activity, restaurantId: string | null, leg: "out" | "back"): string {
  if (leg === "back") return "home";
  if (activity === "cook") return "market";
  if (activity === "friending") return "hall";
  return restaurantId ?? "auberge";
}

export function useSejour() {
  const [save, setSave] = useState<Save>(emptySave);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhaseState] = useState<Phase>("intro");
  const setPhase = useCallback((next: Phase) => {
    stopHearing();
    setPhaseState(next);
  }, []);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [purse, setPurse] = useState<number[]>([]);
  const [leg, setLeg] = useState<"out" | "back">("out");
  const [board, setBoard] = useState<Departure[]>([]);
  const [wrongStop, setWrongStop] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendIndex, setFriendIndex] = useState(0);
  const [dayLog, setDayLog] = useState<string[]>([]);
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);
  const [after, setAfter] = useState<After>("return");
  const [bookOpen, setBookOpen] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);

  useEffect(() => {
    const stay = load();
    setSave(stay);
    setPhase(stay.address ? "morning" : "intro");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [loaded, save]);

  const patch = useCallback((next: Save | ((current: Save) => Save)) => {
    setSave((current) => (typeof next === "function" ? next(current) : next));
  }, []);

  const reset = useCallback(() => {
    setSave(emptySave());
    setPhase("intro");
    setActivity(null);
    setRestaurantId(null);
    setRecipe(null);
    setPurse([]);
    setLeg("out");
    setBoard([]);
    setWrongStop(null);
    setFriendIds([]);
    setFriendIndex(0);
    setDayLog([]);
    setReviewLines([]);
    setAfter("return");
    setBookOpen(false);
    setPosted(null);
  }, []);

  const chooseAddress = useCallback((address: Address) => {
    patch((current) => ({ ...current, address }));
    setPhase("morning");
  }, [patch]);

  const absorbPhrases = useCallback((phrases: { fr: string; en: string }[], source: string) => {
    patch((current) => ({
      ...current,
      phrases: phrases.reduce((book, phrase) => addPhrase(book, { ...phrase, source, day: current.day }), current.phrases),
    }));
  }, [patch]);

  const addOwnPhrase = useCallback((fr: string, en: string, pageId?: string) => {
    patch((current) => ({ ...current, phrases: addPhrase(current.phrases, { fr, en, source: "you", day: current.day, pageId: pageId || current.pages[0]?.id }) }));
  }, [patch]);

  const addPage = useCallback((title: string) => {
    patch((current) => ({ ...current, pages: addBookPage(current.pages, title) }));
  }, [patch]);

  const movePhraseTo = useCallback((phraseId: string, pageId: string) => {
    patch((current) => ({ ...current, phrases: movePhrase(current.phrases, phraseId, pageId) }));
  }, [patch]);

  const updateJournal = useCallback((journal: string) => {
    patch((current) => ({ ...current, journal: journal.slice(0, 4000) }));
  }, [patch]);

  const noteStudy = useCallback((gaps: Gap[], mastered: string[]) => {
    const allowed = new Set<string>(HANDOUT_IDS);
    patch((current) => ({
      ...current,
      ...recordStudy(
        current,
        gaps.filter((item) => allowed.has(item.id)),
        mastered.filter((id) => allowed.has(id)),
      ),
    }));
  }, [patch]);

  const note = useCallback((text: string) => {
    setDayLog((current) => [...current, text].slice(-12));
  }, []);

  const pick = useCallback((next: Activity) => {
    setActivity(next);
    setLeg("out");
    setWrongStop(null);
    if (next === "cook") setRecipe(suggestRecipe(save.day + 1, save.cooked));
    else setRecipe(null);
    if (next === "friending") {
      setFriendIds(pickFriends(save.day + 1, save.met));
      setFriendIndex(0);
    }
    if (next !== "restaurant") {
      setRestaurantId(null);
      setPhase("briefing");
    }
  }, [save.cooked, save.day, save.met]);

  const pickPlace = useCallback((id: string) => {
    setRestaurantId(id);
    setPhase("briefing");
  }, []);

  const cancelPlace = useCallback(() => {
    setActivity(null);
    setRestaurantId(null);
  }, []);

  const leaveBriefing = useCallback(() => {
    if (!activity) return;
    const lines = recipe?.lines ?? [];
    setPurse(purseFor(activity, lines));
    note(activity === "cook" && recipe ? `Cooking ${recipe.name}.` : `Out for ${activity}.`);
    setPhase(activity === "postcard" ? "postcard" : "depart");
  }, [activity, note, recipe]);

  const goActivity = useCallback(() => {
    if (activity === "cook") setPhase("shop");
    else if (activity === "friending") setPhase("friends");
    else if (activity === "restaurant") setPhase("meal");
    else setPhase("postcard");
  }, [activity]);

  const goBy = useCallback((mode: "train" | "walk") => {
    if (!activity) return;
    if (mode === "walk") {
      if (leg === "back") setPhase("dinner");
      else goActivity();
      return;
    }
    setWrongStop(null);
    setBoard(boardFor(save.day + 1, destinationFor(activity, restaurantId, leg)));
    setPhase("station");
  }, [activity, goActivity, leg, restaurantId, save.day]);

  const waitMinute = useCallback(() => {
    setBoard((current) => tickBoard(current));
  }, []);

  const ride = useCallback((platform: number): "ok" | "wrong" | "none" | "early" | "gone" => {
    const train = trainOn(board, platform);
    if (!train || !activity) return "none";
    const door = gate(train);
    if (door === "gone") return "gone";
    if (door === "early") return "early";
    const wanted = destinationFor(activity, restaurantId, leg);
    if (train.stopId !== wanted) {
      setWrongStop(train.stopId);
      return "wrong";
    }
    setWrongStop(null);
    if (leg === "back") setPhase("dinner");
    else goActivity();
    return "ok";
  }, [activity, board, goActivity, leg, restaurantId]);

  const walkFromStation = useCallback(() => {
    setWrongStop(null);
    if (allGone(board)) note("The trains had left, so they walked.");
    if (leg === "back") setPhase("dinner");
    else goActivity();
  }, [board, goActivity, leg, note]);

  const openReview = useCallback((lines: ReviewLine[], next: After) => {
    if (!lines.some((line) => line.role === "gerard")) {
      if (next === "next-friend") {
        setFriendIndex((index) => index + 1);
        setPhase("friends");
      } else if (next === "station") {
        setPhase("station");
      } else if (next === "return") {
        setLeg("back");
        setPhase("return");
      } else setPhase("dinner");
      return;
    }
    setReviewLines(lines);
    setAfter(next);
    setPhase("review");
  }, []);

  const toReview = useCallback((turns: TalkTurn[], next: After) => {
    openReview(
      turns.filter((turn) => turn.text.trim()).map((turn) => ({ role: turn.who === "them" ? "gerard" : "you", text: turn.text })),
      next,
    );
  }, [openReview]);

  const shopDone = useCallback((turns: { role: string; text: string }[], basket: Line[], nextPurse: number[]) => {
    setPurse(nextPurse);
    const bought = basket.map((line) => `${line.qty} × ${ITEM_BY_ID[line.itemId]?.en ?? line.itemId}`).join(", ");
    note(bought ? `Came home with ${bought}.` : "Came home from the shop with nothing.");
    openReview(
      turns.filter((turn) => turn.role === "you" || turn.role === "gerard").map((turn) => ({
        role: turn.role === "gerard" ? "gerard" : "you",
        text: turn.text,
      })),
      "return",
    );
  }, [note, openReview]);

  const friendDone = useCallback((personId: string, turns: TalkTurn[]) => {
    patch((current) => remember(current, personId, turns, true));
    note(`Talked with ${personId}.`);
    const more = friendIndex < friendIds.length - 1;
    toReview(turns, more ? "next-friend" : "return");
  }, [friendIds.length, friendIndex, note, patch, toReview]);

  const mealDone = useCallback((turns: TalkTurn[], nextPurse: number[]) => {
    setPurse(nextPurse);
    if (restaurantId) patch((current) => remember(current, restaurantId, turns));
    note(`Ate at ${restaurantId ?? "a restaurant"}.`);
    toReview(turns, "return");
  }, [note, patch, restaurantId, toReview]);

  const cardSent = useCallback((card: Omit<Card, "id" | "day">) => {
    patch((current) => ({
      ...current,
      cards: [...current.cards, { ...card, id: `card-${current.cards.length}`, day: current.day }],
    }));
    note("Sent a postcard.");
    setPosted(card.text.trim());
  }, [note, patch]);

  const finishPostcard = useCallback(() => {
    const text = posted ?? "";
    setPosted(null);
    toReview(text ? [{ who: "you", text }, { who: "them", text: "La carte est dans la boîte." }] : [], "dinner");
  }, [posted, toReview]);

  const stationTalk = useCallback((personId: string, turns: TalkTurn[]) => {
    patch((current) => remember(current, personId, turns));
    note("Asked at the station.");
    toReview(turns, "station");
  }, [note, patch, toReview]);

  const reviewDone = useCallback(() => {
    if (after === "next-friend") {
      setFriendIndex((index) => index + 1);
      setPhase("friends");
      return;
    }
    if (after === "station") {
      setPhase("station");
      return;
    }
    if (after === "dinner") setPhase("dinner");
    else {
      setLeg("back");
      setPhase("return");
    }
  }, [after]);

  const dinnerDone = useCallback((turns: TalkTurn[]) => {
    patch((current) => {
      let next = remember(current, "rousseau", turns);
      if (activity === "cook" && recipe && !next.cooked.includes(recipe.id)) next = { ...next, cooked: [...next.cooked, recipe.id] };
      return { ...next, day: next.day + 1 };
    });
    setActivity(null);
    setRecipe(null);
    setDayLog([]);
    setPhase("morning");
  }, [activity, patch, recipe]);

  const keep = useCallback((personId: string, turns: TalkTurn[]) => {
    if (!turns.length) return;
    patch((current) => remember(current, personId, turns));
  }, [patch]);

  return {
    loaded,
    save,
    phase,
    activity,
    restaurantId,
    recipe,
    purse,
    leg,
    board,
    wrongStop,
    friendIds,
    friendIndex,
    dayLog,
    reviewLines,
    after,
    bookOpen,
    setBookOpen,
    chooseAddress,
    reset,
    absorbPhrases,
    addOwnPhrase,
    addPage,
    movePhraseTo,
    updateJournal,
    noteStudy,
    pick,
    pickPlace,
    cancelPlace,
    leaveBriefing,
    goBy,
    waitMinute,
    ride,
    stationTalk,
    walkFromStation,
    shopDone,
    friendDone,
    mealDone,
    cardSent,
    finishPostcard,
    reviewDone,
    dinnerDone,
    keep,
    phrases: save.phrases as Phrase[],
  };
}
