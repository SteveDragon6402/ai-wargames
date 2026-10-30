"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SAVE_KEY,
  addNote,
  formatEuros,
  learnWords,
  listForDay,
  mergeLines,
  newSession,
  parseSave,
  pay,
  sumCoins,
  type Address,
  type Expression,
  type Line,
  type Save,
  type Session,
  type Turn,
} from "../lib/shop";
import { speakFrench, stopSpeaking } from "../lib/voice";
import type { GestureId } from "../lib/gerard";

export type Phase = "loading" | "intro" | "shop" | "leaving" | "debrief";

export interface Visit {
  day: number;
  basket: Line[];
  spent: number;
  transcript: Turn[];
  learned: string[];
}

interface Reply {
  line?: string;
  expression?: Expression;
  gesture?: string;
  audio?: string;
  counter?: Line[];
  till?: number | null;
  notes?: string[];
  dismissed?: boolean;
  error?: string;
}

export interface Problem {
  message: string;
  retry: () => void;
}

async function readJson(response: Response): Promise<Reply> {
  try {
    return (await response.json()) as Reply;
  } catch {
    return { error: `The shop's line went quiet (${response.status}).` };
  }
}

export function useEpicerie() {
  const [save, setSave] = useState<Save | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [shownDoor, setShownDoor] = useState(false);
  const saveRef = useRef<Save | null>(null);
  saveRef.current = save;

  useEffect(() => {
    const loaded = parseSave(window.localStorage.getItem(SAVE_KEY));
    setSave(loaded);
    setPhase(loaded.session ? "shop" : "intro");
  }, []);

  useEffect(() => {
    if (save) window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== SAVE_KEY && event.key !== null) return;
      const next = parseSave(event.newValue ?? window.localStorage.getItem(SAVE_KEY));
      saveRef.current = next;
      setSave(next);
      setPhase((current) => (next.session ? (current === "leaving" ? "leaving" : "shop") : current === "debrief" ? "debrief" : "intro"));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  const commit = useCallback((next: Save) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  const setTranscript = useCallback(
    (transcript: Turn[]) => {
      const current = saveRef.current;
      if (current?.session) commit({ ...current, session: { ...current.session, transcript } });
    },
    [commit],
  );

  const talk = useCallback(
    async (turn: Turn) => {
      const current = saveRef.current;
      const session = current?.session;
      if (!current || !session) return;
      const history = session.transcript;
      setProblem(null);
      setBusy(true);
      setTranscript([...history, turn]);

      const retry = () => {
        setTranscript(history);
        void talk(turn);
      };

      let reply: Reply;
      try {
        const response = await fetch("/api/epicerie/shopkeeper", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            turn,
            history,
            counter: session.counter,
            till: session.till,
            basket: session.basket,
            notes: current.notes,
            visits: current.visits,
            address: current.address,
          }),
        });
        reply = await readJson(response);
        if (!response.ok && !reply.error) reply.error = `The shop's line went quiet (${response.status}).`;
      } catch {
        reply = { error: "No connection. Check you are online." };
      }
      setBusy(false);

      if (reply.error || (!reply.line && !reply.gesture)) {
        setProblem({ message: reply.error ?? "Gérard didn't answer.", retry });
        return;
      }

      const line = reply.line ?? "";
      const audio = typeof reply.audio === "string" && reply.audio.trim() ? reply.audio : undefined;
      const gerard: Turn = { role: "gerard", text: line, expression: reply.expression ?? "neutral", action: reply.gesture || undefined, audio };
      setSave((value) => {
        if (!value?.session) return value;
        const notes = (reply.notes ?? []).reduce(addNote, value.notes);
        return {
          ...value,
          notes,
          carnet: learnWords(value.carnet, line, value.session.day),
          session: {
            ...value.session,
            transcript: [...value.session.transcript, gerard],
            counter: Array.isArray(reply.counter) ? reply.counter : value.session.counter,
            till: typeof reply.till === "number" ? reply.till : null,
          },
        };
      });
      if (current.voice && (audio || line)) speakFrench(audio || line);
      if (reply.dismissed) {
        setShownDoor(true);
        setPhase("leaving");
      }
    },
    [setTranscript],
  );

  const say = useCallback(
    (text: string, pointed: string | null, gesture: GestureId | null) => {
      if (busy) return;
      if (!text.trim() && !pointed && !gesture) return;
      void talk({ role: "you", text: text.trim(), pointed: pointed ?? undefined, gesture: gesture ?? undefined });
    },
    [busy, talk],
  );

  const enter = useCallback(
    (address?: Address) => {
      const current = saveRef.current;
      if (!current) return;
      const session = current.session ?? newSession(current.day);
      commit({ ...current, address: address ?? current.address, session });
      setVisit(null);
      setPhase("shop");
      if (!session.transcript.length) void talk({ role: "event", text: "The bell over the door rings as you walk in." });
    },
    [commit, talk],
  );

  const handOver = useCallback(
    (coins: number[]): boolean => {
      const session = saveRef.current?.session;
      if (!session || busy) return false;
      const result = pay(session.purse, coins, session.till);
      if (!result.ok) {
        if (result.reason !== "short" || session.till === null) return false;
        void talk({
          role: "event",
          text: `You put down ${formatEuros(result.paid)}. It is not enough, and he pushes the money back.`,
        });
        return true;
      }
      const total = session.till as number;
      const change = sumCoins(result.change);
      const next: Session = {
        ...session,
        purse: result.purse,
        basket: mergeLines(session.basket, session.counter),
        counter: [],
        till: null,
        spent: session.spent + total,
      };
      commit({ ...(saveRef.current as Save), session: next });
      void talk({
        role: "event",
        text: `You hand over ${formatEuros(result.paid)}. ${change ? `He gives you ${formatEuros(change)} change.` : "Exact money."} The shopping goes into your bag.`,
      });
      return true;
    },
    [busy, commit, talk],
  );

  const leave = useCallback(() => {
    const session = saveRef.current?.session;
    if (!session || busy) return;
    setPhase("leaving");
    void talk({
      role: "event",
      text: session.counter.length
        ? "You pick up your bag and head for the door, leaving the things on the counter."
        : "You pick up your bag and head for the door.",
    });
  }, [busy, talk]);

  const stay = useCallback(() => {
    setShownDoor(false);
    setPhase("shop");
  }, []);

  const finish = useCallback(() => {
    const current = saveRef.current;
    const session = current?.session;
    if (!current || !session) return;
    stopSpeaking();
    setVisit({
      day: session.day,
      basket: session.basket,
      spent: session.spent,
      transcript: session.transcript,
      learned: current.carnet.filter((entry) => entry.day === session.day).map((entry) => entry.itemId),
    });
    setSave({ ...current, day: current.day + 1, visits: current.visits + 1, session: null });
    setProblem(null);
    setShownDoor(false);
    setPhase("debrief");
  }, []);

  const toNextDay = useCallback(() => {
    setVisit(null);
    setPhase("intro");
  }, []);

  const setJournal = useCallback((journal: string) => {
    setSave((current) => (current ? { ...current, journal: journal.slice(0, 4000) } : current));
  }, []);

  const setVoice = useCallback((voice: boolean) => {
    if (!voice) stopSpeaking();
    setSave((current) => (current ? { ...current, voice } : current));
  }, []);

  const resetAll = useCallback(() => {
    stopSpeaking();
    window.localStorage.removeItem(SAVE_KEY);
    commit(parseSave(null));
    setVisit(null);
    setProblem(null);
    setShownDoor(false);
    setPhase("intro");
  }, [commit]);

  const session = save?.session ?? null;
  const list = listForDay(session?.day ?? save?.day ?? 0);

  return {
    save,
    session,
    list,
    phase,
    busy,
    problem,
    visit,
    shownDoor,
    say,
    enter,
    handOver,
    leave,
    stay,
    finish,
    toNextDay,
    setVoice,
    setJournal,
    resetAll,
    dismissProblem: () => setProblem(null),
  };
}
