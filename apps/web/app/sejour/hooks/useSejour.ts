"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Line, Turn as ShopTurn } from "@/app/epicerie/lib/shop";
import type { BakeryItem } from "../data/bakery";
import { PEOPLE, PERSON_BY_ID, pickFriends } from "../data/people";
import {
  addBookPage,
  addPhrase,
  emptySave,
  LEGACY_SAVE_KEY,
  movePhrase,
  offerPlaces,
  parseSave,
  recordAssessment,
  recordStudy,
  recordVisit,
  remember,
  SAVE_KEY,
  type Address,
  type Gap,
  type PendingInvite,
  type Save,
} from "../lib/save";
import { stopHearing, type TalkTurn } from "../lib/voice";
import { pendingEvent } from "../world/events";
import { newlyPassed } from "../world/gates";
import { GRAMMAR_BY_DAY, GRAMMAR_BY_ID, GRAMMAR_LESSONS } from "@/app/course/content/grammar";
import type { GrammarLesson } from "@/app/course/types";
import { hideNpcText, type ListeningMode } from "@/app/course/engine/answers";
import { subscribeReadingAssist } from "../lib/reading";
import { isOuting, isPlace, PLACE_INFO, type EventId, type OutingId, type PlaceId, type SceneId } from "../world/places";
import { basketCovers, suggestRecipe, type Recipe } from "../world/recipes";
import { baselineRatingsFromLines, type Ratings } from "../world/skills";
import type { StageCall } from "../world/stage";
import { TUNING } from "../world/tuning";
import { topUpWallet } from "../world/wallet";
import type { ReviewLine } from "../components/Review";

export type Phase =
  | "arrival"
  | "morning"
  | "lesson"
  | "walk"
  | "boulangerie"
  | "shop"
  | "supermarche"
  | "cooking"
  | "homemeal"
  | "meal"
  | "signup"
  | "friends"
  | "outing"
  | "event_family"
  | "event_sick"
  | "vocab"
  | "review";

type AfterReview = "morning" | "grammar" | "homemeal" | "cooking" | "next-friend" | "vocab" | "night";

function loadFromLocalStorage(): Save {
  if (typeof window === "undefined") return emptySave();
  try {
    const rawV2 = localStorage.getItem(SAVE_KEY);
    if (rawV2) {
      const parsed = parseSave(JSON.parse(rawV2));
      if (parsed) return parsed;
    }
    const rawV1 = localStorage.getItem(LEGACY_SAVE_KEY);
    if (rawV1) {
      const migrated = parseSave(JSON.parse(rawV1));
      if (migrated) return migrated;
    }
    return emptySave();
  } catch {
    return emptySave();
  }
}

/** Drop offers for places that are no longer open. A place appears only after Madame suggests it. */
function syncOfferedWithUnlocked(save: Save): Save {
  const offered = save.offered.filter((id) => save.unlocked.includes(id));
  if (offered.length === save.offered.length) return save;
  return { ...save, offered };
}

export function useSejour() {
  const [save, setSave] = useState<Save>(emptySave);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhaseState] = useState<Phase>("arrival");
  const setPhase = useCallback((next: Phase) => {
    stopHearing();
    setPhaseState(next);
  }, []);

  const [targetPlace, setTargetPlace] = useState<PlaceId | null>(null);
  const [targetOuting, setTargetOuting] = useState<PendingInvite | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventId | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [mealDish, setMealDish] = useState<{ fr: string; en: string; icon: string }>({
    fr: "une baguette fraîche",
    en: "fresh baguette",
    icon: "🥖",
  });
  const [cashAddedNote, setCashAddedNote] = useState<number>(0);

  // Pinned lesson id during the lesson phase so settling a lesson never unmounts the conversation mid-turn
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [lessonPracticed, setLessonPracticed] = useState(false);

  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friendIndex, setFriendIndex] = useState(0);

  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);
  const [reviewScene, setReviewScene] = useState<SceneId>("host");
  const [afterReview, setAfterReview] = useState<AfterReview>("night");
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);

  const [bookOpen, setBookOpen] = useState(false);
  const [stageCall, setStageCall] = useState<StageCall | null>(null);
  const [morningHostTurns, setMorningHostTurns] = useState(0);
  const [sejourDayComplete, setSejourDayComplete] = useState(false);
  const [courseDay, setCourseDay] = useState(1);
  const [listenConfirm, setListenConfirm] = useState(false);
  const [villageNote, setVillageNote] = useState("");
  const [dayClose, setDayClose] = useState<null | { streak: number; previousStreak: number; examReady: boolean }>(null);
  const [grammarDone, setGrammarDone] = useState(false);
  const [courseReady, setCourseReady] = useState(false);
  const [saveReady, setSaveReady] = useState(false);
  const booted = useRef(false);

  useEffect(() => {
    const stay = syncOfferedWithUnlocked(loadFromLocalStorage());
    setSave(stay);
    setPhase(stay.address || stay.day > 0 ? "morning" : "arrival");
    setLoaded(true);

    fetch("/api/save?game=sejour")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.save) {
          const remote = parseSave(data.save);
          if (remote) {
            if (
              !stay.address ||
              remote.day > stay.day ||
              remote.assessments.length > stay.assessments.length ||
              remote.phrases.length > stay.phrases.length
            ) {
              const synced = syncOfferedWithUnlocked(remote);
              setSave(synced);
              setPhase(synced.address || synced.day > 0 ? "morning" : "arrival");
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setSaveReady(true));

    fetch("/api/course/today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.day === "number") setCourseDay(data.day);
        setGrammarDone(Boolean(data?.dayEntry?.grammarDoneAt));
      })
      .catch(() => {})
      .finally(() => setCourseReady(true));
  }, [setPhase]);

  const openErrand = useCallback(
    (errand: string) => {
      const clear = (curr: Save) => ({ ...curr, errand: "" });
      if (errand === "event_sick" || errand === "event_family") {
        setActiveEvent(errand === "event_sick" ? "sick" : "family");
        setSave(clear);
        setPhase(errand);
        return;
      }
      if (isOuting(errand)) {
        setTargetOuting(save.pendingInvite?.outing === errand ? save.pendingInvite : { friendId: "paul", outing: errand });
        setSave(clear);
        setPhase("walk");
        return;
      }
      if (isPlace(errand)) {
        setTargetPlace(errand);
        if (errand === "epicerie" || errand === "supermarche") setRecipe(suggestRecipe(save.cooked));
        setSave(clear);
        setPhase("walk");
      }
    },
    [save.cooked, save.pendingInvite, setPhase],
  );

  useEffect(() => {
    if (!loaded || !courseReady || !saveReady || booted.current) return;
    booted.current = true;
    if (!save.errand) return;
    if (!grammarDone) {
      window.location.replace("/course/grammar");
      return;
    }
    openErrand(save.errand);
  }, [loaded, courseReady, saveReady, grammarDone, save.errand, openErrand]);

  useEffect(() => subscribeReadingAssist(() => {
    setSave((curr) => (curr.readText ? curr : { ...curr, readText: true }));
  }), []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "sejour", save }),
    }).catch(() => {});
  }, [loaded, save]);

  // Keyboard shortcut 'L' (when not typing in an input/textarea) toggles Listening Mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "l" && e.key !== "L") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setSave((curr) => {
        const hidden = hideNpcText(courseDay, "host", curr.listeningMode);
        if (hidden) {
          setListenConfirm(true);
          return curr;
        }
        return { ...curr, listeningMode: "on", listening: true };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [courseDay]);

  const textHidden = useCallback(
    (scene: string) => {
      const key = scene === "shop" ? "epicerie" : scene;
      return hideNpcText(courseDay, scene, save.listeningMode, save.visits[key] ?? 0);
    },
    [courseDay, save.listeningMode, save.visits],
  );

  const toggleListening = useCallback(() => {
    const hidden = hideNpcText(courseDay, "host", save.listeningMode);
    if (hidden) {
      setListenConfirm(true);
      return;
    }
    setSave((curr) => ({ ...curr, listeningMode: "on", listening: true }));
  }, [courseDay, save.listeningMode]);

  const confirmListeningOff = useCallback(() => {
    setListenConfirm(false);
    setSave((curr) => ({ ...curr, listeningMode: "off" as ListeningMode, listening: false, readText: true }));
  }, []);

  const chooseAddress = useCallback((address: Address) => {
    setSave((curr) => ({ ...curr, address }));
  }, []);

  const markMet = useCallback((id: string) => {
    if (!id) return;
    setSave((curr) => (curr.met.includes(id) ? curr : { ...curr, met: [...curr.met, id] }));
  }, []);

  const absorbPhrases = useCallback((incoming: { fr: string; en: string }[], source: string) => {
    setSave((curr) => {
      let phrases = curr.phrases;
      for (const item of incoming) {
        phrases = addPhrase(phrases, { fr: item.fr, en: item.en, source, day: curr.day + 1 });
      }
      return phrases === curr.phrases ? curr : { ...curr, phrases };
    });
  }, []);

  /** Real-time check when the player speaks with Madame Rousseau so introducing yourself unlocks the first gate right away. */
  const observeLiveConversation = useCallback((scene: SceneId, history: TalkTurn[], suggestedPlaces: PlaceId[]) => {
    const playerLines = history.filter((t) => t.who === "you").map((t) => t.text);
    const liveRatings = baselineRatingsFromLines(scene, playerLines, {});
    setSave((curr) => {
      let next = curr;
      if (Object.keys(liveRatings).length > 0 && scene === "host" && !curr.gatesPassed.includes("intro") && (liveRatings.intro ?? 0) >= 2) {
        next = recordAssessment(next, { scene: "host", day: curr.day, ratings: liveRatings });
      }
      if (suggestedPlaces.length > 0) {
        next = offerPlaces(next, suggestedPlaces);
      }
      return syncOfferedWithUnlocked(next);
    });
  }, []);

  const noteMorningTurn = useCallback(() => {
    setMorningHostTurns((n) => n + 1);
    setSave((curr) => {
      if (morningHostTurns + 1 >= TUNING.nudgeTurns) {
        return syncOfferedWithUnlocked(curr);
      }
      return curr;
    });
  }, [morningHostTurns]);

  const finishArrival = useCallback(
    (history: TalkTurn[]) => {
      const playerLines = history.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines("host", playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = remember(curr, "rousseau", history);
        if (!next.address) next = { ...next, address: "bonjour" };
        next = recordAssessment(next, { scene: "host", day: 0, ratings });
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      if (history.some((t) => t.who === "you")) {
        setReviewLines(history.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
        setReviewScene("host");
        setAfterReview("morning");
        setPhase("review");
      } else {
        setPhase("morning");
      }
    },
    [setPhase],
  );

  const pickPlace = useCallback(
    (place: PlaceId, hostHistory: TalkTurn[]) => {
      const nextDish = place === "epicerie" || place === "supermarche" ? suggestRecipe(save.cooked) : null;
      setRecipe(nextDish);
      setTargetPlace(place);
      setTargetOuting(null);
      setActiveEvent(null);
      const topped = topUpWallet(save.wallet, place, nextDish);
      setCashAddedNote(topped.added);
      setSave((curr) => ({
        ...remember(curr, "rousseau", hostHistory),
        wallet: topped.wallet,
        errand: place,
      }));
      setReviewLines(hostHistory.map((turn) => ({ role: turn.who === "you" ? "you" : "gerard", text: turn.text })));
      setReviewScene("host");
      setAfterReview("grammar");
      setPhase("review");
    },
    [save, setPhase],
  );

  const pickOutingInvite = useCallback(
    (invite: PendingInvite, hostHistory: TalkTurn[]) => {
      setTargetOuting(invite);
      setTargetPlace(null);
      setActiveEvent(null);
      const topped = topUpWallet(save.wallet, invite.outing, null);
      setCashAddedNote(topped.added);
      setSave((curr) => ({
        ...remember(curr, "rousseau", hostHistory),
        wallet: topped.wallet,
        pendingInvite: invite,
        errand: invite.outing,
      }));
      setReviewLines(hostHistory.map((turn) => ({ role: turn.who === "you" ? "you" : "gerard", text: turn.text })));
      setReviewScene("host");
      setAfterReview("grammar");
      setPhase("review");
    },
    [save, setPhase],
  );

  const practiceSpecificLesson = useCallback(
    (lessonId: string) => {
      stopHearing();
      setActiveLessonId(lessonId);
      setLessonPracticed(false);
      if (phase === "morning") {
        const defaultPlace: PlaceId = save.unlocked.includes("boulangerie") ? "boulangerie" : "boulangerie";
        setTargetPlace((curr) => curr ?? defaultPlace);
        setPhase("lesson");
      }
    },
    [phase, save.unlocked, setPhase],
  );

  const startEvent = useCallback(
    (ev: EventId, hostHistory: TalkTurn[]) => {
      setActiveEvent(ev);
      setTargetPlace(null);
      setTargetOuting(null);
      const errand = ev === "sick" ? "event_sick" : "event_family";
      if (ev === "sick") {
        const topped = topUpWallet(save.wallet, "pharmacie", null);
        setCashAddedNote(topped.added);
        setSave((curr) => ({
          ...remember(curr, "rousseau", hostHistory),
          wallet: topped.wallet,
          errand,
        }));
      } else {
        setSave((curr) => ({ ...remember(curr, "rousseau", hostHistory), errand }));
      }
      setReviewLines(hostHistory.map((turn) => ({ role: turn.who === "you" ? "you" : "gerard", text: turn.text })));
      setReviewScene("host");
      setAfterReview("grammar");
      setPhase("review");
    },
    [save.wallet, setPhase],
  );

  const skipCurrentLesson = useCallback((lessonId: string) => {
    stopHearing();
    setLessonPracticed(false);
    setSave((curr) => {
      const doneSet = new Set(curr.lessonsDone);
      let nextSkipped = curr.lessonsSkipped.includes(lessonId)
        ? curr.lessonsSkipped
        : [...curr.lessonsSkipped, lessonId];
      const remaining = GRAMMAR_LESSONS.filter((l) => !doneSet.has(l.id) && !nextSkipped.includes(l.id));
      if (!remaining.length) {
        nextSkipped = [lessonId];
      }
      const nextSave: Save = { ...curr, lessonsSkipped: nextSkipped };
      const idx = GRAMMAR_LESSONS.findIndex((lesson) => lesson.id === lessonId);
      const nextSpec = GRAMMAR_LESSONS[(idx + 1) % GRAMMAR_LESSONS.length] ?? GRAMMAR_LESSONS[0];
      setActiveLessonId(nextSpec.id);
      return nextSave;
    });
  }, []);

  const toggleSkipLesson = useCallback((lessonId: string) => {
    setSave((curr) => ({
      ...curr,
      lessonsSkipped: curr.lessonsSkipped.includes(lessonId)
        ? curr.lessonsSkipped.filter((id) => id !== lessonId)
        : [...curr.lessonsSkipped, lessonId],
    }));
  }, []);

  const markLessonPracticed = useCallback((lessonId: string) => {
    setLessonPracticed(true);
    setSave((curr) => ({
      ...curr,
      lessonsDone: curr.lessonsDone.includes(lessonId) ? curr.lessonsDone : [...curr.lessonsDone, lessonId],
      mastered: curr.mastered.includes(lessonId) ? curr.mastered : [...curr.mastered, lessonId],
    }));
  }, []);

  const completeLessonAndLeave = useCallback(
    (lessonId: string | null, history: TalkTurn[]) => {
      const playerSpoke = history.some((t) => t.who === "you");
      setSave((curr) => {
        let next = remember(curr, "rousseau", history);
        if (lessonId && (playerSpoke || lessonPracticed) && !next.lessonsDone.includes(lessonId)) {
          next = {
            ...next,
            lessonsDone: [...next.lessonsDone, lessonId],
            mastered: next.mastered.includes(lessonId) ? next.mastered : [...next.mastered, lessonId],
          };
        }
        return next;
      });
      setActiveLessonId(null);
      setLessonPracticed(false);
      setPhase("walk");
    },
    [lessonPracticed, setPhase],
  );

  const arriveAtDestination = useCallback(() => {
    if (targetOuting) {
      setPhase("outing");
      return;
    }
    if (targetPlace === "boulangerie") {
      setPhase("boulangerie");
    } else if (targetPlace === "epicerie") {
      setPhase("shop");
    } else if (targetPlace === "supermarche") {
      setPhase("supermarche");
    } else if (targetPlace === "bistro" || targetPlace === "auberge") {
      setPhase("meal");
    } else if (targetPlace === "speedfriending") {
      setFriendIds(pickFriends(save.day + 1, save.met));
      setFriendIndex(0);
      setPhase("signup");
    } else {
      setPhase("boulangerie");
    }
  }, [save.day, save.met, setPhase, targetOuting, targetPlace]);

  /** Used by Speed Friending sign-up form to save profile and enter the Speed Friending hall. */
  const finishSignUp = useCallback(
    (values: Record<string, string>) => {
      setSave((curr) => ({ ...curr, formProfile: values }));
      setPhase("friends");
    },
    [setPhase],
  );

  /** Used by Sport Outing sign-up form to save profile while staying inside the Outing phase. */
  const saveFormProfile = useCallback((values: Record<string, string>) => {
    setSave((curr) => ({ ...curr, formProfile: values }));
  }, []);

  const bakeryDone = useCallback(
    (turns: TalkTurn[], bought: BakeryItem[], nextWallet: number[]) => {
      const first = bought[0];
      setMealDish({
        fr: first?.fr ?? "une baguette tradition",
        en: first?.en ?? "fresh baguette",
        icon: first?.icon ?? "🥖",
      });
      setRecipe(null);
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines("boulangerie", playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = recordVisit(remember(curr, "martine", turns), "boulangerie");
        next = { ...next, wallet: nextWallet };
        if (Object.keys(ratings).length > 0) {
          next = recordAssessment(next, { scene: "boulangerie", day: curr.day + 1, ratings });
        }
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene("boulangerie");
      setAfterReview("vocab");
      setPhase("review");
    },
    [setPhase],
  );

  const shopDone = useCallback(
    (turns: ShopTurn[], basket: Line[], nextWallet: number[]) => {
      const placeId: PlaceId = targetPlace === "supermarche" ? "supermarche" : "epicerie";
      const gotAll = recipe ? basketCovers(basket, recipe.lines) : false;
      const playerLines = turns.filter((t) => t.role === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines(placeId, playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = recordVisit(curr, placeId);
        // Also count a supermarket trip toward grocery experience
        if (placeId === "supermarche") {
          next = recordVisit(next, "epicerie");
          const cashierTurns = turns
            .filter((turn) => turn.role === "you" || turn.role === "gerard")
            .map((turn) => ({ who: turn.role === "you" ? ("you" as const) : ("them" as const), text: turn.text }));
          next = remember(next, "elodie", cashierTurns);
        }
        next = {
          ...next,
          wallet: nextWallet,
          cooked: gotAll && recipe && !curr.cooked.includes(recipe.id) ? [...curr.cooked, recipe.id] : curr.cooked,
        };
        if (Object.keys(ratings).length > 0) {
          next = recordAssessment(next, { scene: placeId, day: curr.day + 1, ratings });
        }
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      if (recipe) {
        setMealDish({
          fr: recipe.fr,
          en: recipe.name,
          icon: recipe.steps.at(-1)?.resultIcon ?? "🍲",
        });
      }
      setReviewLines(
        turns
          .filter((t): t is ShopTurn & { role: "you" | "gerard" } => t.role === "you" || t.role === "gerard")
          .map((t) => ({ role: t.role, text: t.text })),
      );
      setReviewScene(placeId);
      setAfterReview("cooking");
      setPhase("review");
    },
    [recipe, setPhase, targetPlace],
  );

  const cookingDone = useCallback(() => {
    setPhase("vocab");
  }, [setPhase]);

  const finishStay = useCallback(async (playerLines: string[]) => {
    const response = await fetch("/api/course/sejour/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerLines, readingAssist: save.readText }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) : null;
      setVillageNote(body?.error ?? "Say something in French before this day can count.");
      return;
    }
    const data = await response.json().catch(() => null);
    if (data?.needsGrammar) {
      setVillageNote("Pass this morning's lesson before the day can count.");
      return;
    }
    setVillageNote("");
    if (data?.closed) {
      setDayClose({
        streak: Number(data.streak) || 1,
        previousStreak: Number(data.previousStreak) || 0,
        examReady: Boolean(data.examReady),
      });
    }
  }, [save.readText]);

  const homeMealDone = useCallback(
    (turns: TalkTurn[]) => {
      setSave((curr) => syncOfferedWithUnlocked(remember(curr, "rousseau", turns)));
      setReviewLines(turns.map((turn) => ({ role: turn.who === "you" ? "you" : "gerard", text: turn.text })));
      setReviewScene("meal");
      setAfterReview("night");
      setPhase("review");
    },
    [setPhase],
  );

  const restaurantDone = useCallback(
    (turns: TalkTurn[], nextWallet: number[]) => {
      const placeId = targetPlace === "auberge" ? "auberge" : "bistro";
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines(placeId, playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = recordVisit(remember(curr, placeId, turns), placeId);
        next = { ...next, wallet: nextWallet };
        if (Object.keys(ratings).length > 0) {
          next = recordAssessment(next, { scene: placeId, day: curr.day + 1, ratings });
        }
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene(placeId);
      setAfterReview("vocab");
      setPhase("review");
    },
    [setPhase, targetPlace],
  );

  const friendDone = useCallback(
    (personId: string, turns: TalkTurn[], invitedOuting?: OutingId | null) => {
      const person = PERSON_BY_ID[personId];
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines("speedfriending", playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = remember(curr, personId, turns, true);
        if (Object.keys(ratings).length > 0) {
          next = recordAssessment(next, { scene: "speedfriending", day: curr.day + 1, ratings });
        }
        next = syncOfferedWithUnlocked(next);
        if (invitedOuting && person) {
          next = { ...next, pendingInvite: { friendId: personId, outing: invitedOuting } };
        }
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene("speedfriending");
      setAfterReview(friendIndex + 1 < friendIds.length ? "next-friend" : "vocab");
      setPhase("review");
    },
    [friendIds.length, friendIndex, setPhase],
  );

  const outingDone = useCallback(
    (turns: TalkTurn[]) => {
      const outingId = targetOuting?.outing ?? "parc";
      const friendId = targetOuting?.friendId ?? "paul";
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines(outingId, playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        let next = recordVisit(remember(curr, friendId, turns, true), outingId);
        next = recordAssessment(next, { scene: outingId, day: curr.day + 1, ratings });
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene(outingId);
      setAfterReview("vocab");
      setPhase("review");
    },
    [setPhase, targetOuting],
  );

  const familyEventDone = useCallback(
    (turns: TalkTurn[]) => {
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines("family", playerLines, {});
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        const withHost = remember(curr, "rousseau", turns);
        const withCamille = remember(withHost, "camille", turns, true);
        let next: Save = {
          ...withCamille,
          eventsDone: withCamille.eventsDone.includes("family")
            ? withCamille.eventsDone
            : [...withCamille.eventsDone, "family"],
        };
        next = recordAssessment(next, { scene: "family", day: curr.day + 1, ratings });
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) => g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)));
          setNewUnlocks([...new Set(labels)]);
        }
        return next;
      });
      setMealDish({ fr: "un poulet rôti en famille", en: "roast chicken at the family table", icon: "🍗" });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene("family");
      setAfterReview("vocab");
      setPhase("review");
    },
    [setPhase],
  );

  const sickEventDone = useCallback(
    (turns: TalkTurn[], nextWallet: number[]) => {
      const playerLines = turns.filter((t) => t.who === "you").map((t) => t.text);
      const ratings = baselineRatingsFromLines("pharmacie", playerLines, {});
      setSave((curr) => {
        let next = recordVisit(remember(curr, "pharmacien", turns), "pharmacie");
        next = {
          ...next,
          wallet: nextWallet,
          eventsDone: curr.eventsDone.includes("sick") ? curr.eventsDone : [...curr.eventsDone, "sick"],
        };
        next = recordAssessment(next, { scene: "pharmacie", day: curr.day + 1, ratings });
        return syncOfferedWithUnlocked(next);
      });
      setReviewLines(turns.map((t) => ({ role: t.who === "you" ? "you" : "gerard", text: t.text })));
      setReviewScene("pharmacie");
      setAfterReview("vocab");
      setPhase("review");
    },
    [setPhase],
  );

  const noteStudy = useCallback(
    (gaps: Gap[], mastered: string[], ratings: Ratings = {}) => {
      setSave((curr) => {
        const beforeGates = curr.gatesPassed;
        const studied = recordStudy(curr, gaps, mastered);
        let next: Save = {
          ...curr,
          gaps: studied.gaps,
          mastered: studied.mastered,
          lessonsDone: [...new Set([...curr.lessonsDone, ...studied.mastered])],
        };
        if (Object.keys(ratings).length > 0) {
          next = recordAssessment(next, { scene: reviewScene, day: curr.day + 1, ratings });
        }
        next = syncOfferedWithUnlocked(next);
        const passedNow = newlyPassed(next, beforeGates);
        if (passedNow.length > 0) {
          const labels = passedNow.flatMap((g) =>
            g.unlocks.map((u) => (isPlace(u) ? PLACE_INFO[u].label : g.label)),
          );
          setNewUnlocks((prev) => [...new Set([...prev, ...labels])]);
        }
        return next;
      });
    },
    [reviewScene],
  );

  const reviewDone = useCallback(() => {
    setNewUnlocks([]);
    if (afterReview === "morning") {
      setMorningHostTurns(0);
      setPhase("morning");
      return;
    }
    if (afterReview === "grammar") {
      void fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "sejour", save }),
      })
        .catch(() => {})
        .finally(() => {
          window.location.assign("/course/grammar");
        });
      return;
    }
    if (afterReview === "vocab") {
      setSave((curr) => ({ ...curr, errand: "" }));
      setPhase("vocab");
      return;
    }
    if (afterReview === "cooking") {
      setPhase("cooking");
      return;
    }
    if (afterReview === "homemeal") {
      setPhase("homemeal");
      return;
    }
    if (afterReview === "next-friend") {
      setFriendIndex((idx) => idx + 1);
      setPhase("friends");
      return;
    }
    // End of day -> advance day and wake up next morning
    setSave((curr) => ({ ...curr, errand: "", drill: [] }));
    const playerLines = reviewLines.filter((line) => line.role === "you").map((line) => line.text);
    void finishStay(playerLines);
  }, [afterReview, finishStay, reviewLines, save, setPhase]);

  const rememberDrill = useCallback((phrases: { fr: string; en: string }[]) => {
    if (!phrases.length) return;
    setSave((curr) => {
      const seen = new Set(curr.drill.map((item) => item.fr));
      const next = [...curr.drill];
      for (const phrase of phrases) {
        if (!phrase.fr || seen.has(phrase.fr)) continue;
        seen.add(phrase.fr);
        next.push(phrase);
      }
      return { ...curr, drill: next.slice(0, 8) };
    });
  }, []);

  const addOwnPhrase = useCallback((fr: string, en: string, pageId?: string) => {
    setSave((curr) => ({
      ...curr,
      phrases: addPhrase(curr.phrases, { fr, en, source: "you", day: curr.day + 1, pageId }),
    }));
  }, []);

  const addPage = useCallback((title: string) => {
    setSave((curr) => ({ ...curr, pages: addBookPage(curr.pages, title) }));
  }, []);

  const movePhraseTo = useCallback((phraseId: string, pageId: string) => {
    setSave((curr) => ({ ...curr, phrases: movePhrase(curr.phrases, phraseId, pageId) }));
  }, []);

  const updateJournal = useCallback((journal: string) => {
    setSave((curr) => ({ ...curr, journal: journal.slice(0, 4000) }));
  }, []);

  const reset = useCallback(() => {
    stopHearing();
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
    fetch("/api/save?game=sejour", { method: "DELETE" }).catch(() => {});
    setSave(emptySave());
    setTargetPlace(null);
    setTargetOuting(null);
    setActiveEvent(null);
    setRecipe(null);
    setActiveLessonId(null);
    setLessonPracticed(false);
    setFriendIds([]);
    setFriendIndex(0);
    setReviewLines([]);
    setNewUnlocks([]);
    setMorningHostTurns(0);
    setPhase("arrival");
  }, [setPhase]);

  const currentLesson: GrammarLesson =
    (activeLessonId ? GRAMMAR_BY_ID[activeLessonId] : undefined) ??
    GRAMMAR_BY_DAY[Math.max(1, Math.min(28, courseDay))] ??
    GRAMMAR_LESSONS[0];
  const availableEvent = pendingEvent(save.unlocked, save.eventsDone, save.day);
  const inviteFriends = PEOPLE.filter((p) => save.met.includes(p.id));

  return {
    save,
    loaded,
    phase,
    setPhase,
    targetPlace,
    targetOuting,
    activeEvent,
    recipe,
    mealDish,
    cashAddedNote,
    friendIds,
    friendIndex,
    reviewLines,
    reviewScene,
    newUnlocks,
    bookOpen,
    setBookOpen,
    stageCall,
    setStageCall,
    currentLesson,
    lessonPracticed,
    availableEvent,
    inviteFriends,
    sejourDayComplete,
    setSejourDayComplete,
    courseDay,
    textHidden,
    listenConfirm,
    setListenConfirm,
    confirmListeningOff,
    villageNote,
    dayClose,
    toggleListening,
    chooseAddress,
    markMet,
    absorbPhrases,
    observeLiveConversation,
    noteMorningTurn,
    finishArrival,
    pickPlace,
    pickOutingInvite,
    practiceSpecificLesson,
    startEvent,
    skipCurrentLesson,
    toggleSkipLesson,
    markLessonPracticed,
    completeLessonAndLeave,
    arriveAtDestination,
    finishSignUp,
    saveFormProfile,
    bakeryDone,
    shopDone,
    cookingDone,
    homeMealDone,
    restaurantDone,
    friendDone,
    outingDone,
    familyEventDone,
    sickEventDone,
    noteStudy,
    rememberDrill,
    reviewDone,
    addOwnPhrase,
    addPage,
    movePhraseTo,
    updateJournal,
    reset,
  };
}
