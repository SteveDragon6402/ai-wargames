"use client";

import { looksFrench } from "@/app/epicerie/lib/french";
import { isOuting, isPlace, type OutingId, type PlaceId, type UnlockId } from "../world/places";
import { cleanStageCall, type StageCall } from "../world/stage";

let playing: HTMLAudioElement | null = null;
let ticket = 0;
let inflight: AbortController | null = null;
let audioCtx: AudioContext | null = null;
let sources: AudioBufferSourceNode[] = [];
let resolveWaiters: (() => void)[] = [];
let gestureListenerInstalled = false;

function ensureAudioContextUnlocked() {
  if (typeof window === "undefined") return;
  try {
    if (!audioCtx && typeof AudioContext !== "undefined") {
      audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
  if (!gestureListenerInstalled) {
    gestureListenerInstalled = true;
    const unlock = () => {
      try {
        if (!audioCtx && typeof AudioContext !== "undefined") {
          audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === "suspended") {
          void audioCtx.resume().catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }
}

function flushWaiters() {
  const list = resolveWaiters;
  resolveWaiters = [];
  for (const fn of list) fn();
}

function silence() {
  inflight?.abort();
  inflight = null;
  for (const source of sources) {
    try {
      source.stop();
    } catch {
      /* already finished */
    }
  }
  sources = [];
  if (playing) {
    playing.pause();
    playing.src = "";
    playing = null;
  }
  flushWaiters();
}

/** Stop the voice at once, including a clip or multi-speaker sequence that has not finished yet. */
export function stopHearing() {
  ticket += 1;
  silence();
}

/** Speak a line as someone in the stay. Waits until the line finishes playing so multi-speaker turns can play in sequence. */
export async function hear(character: string, text: string, language: "french" | "any" = "any"): Promise<string | null> {
  const line = text.trim();
  if (language === "french" && !looksFrench(line)) return "That's not French.";
  if (!line) return "Say something.";
  ensureAudioContextUnlocked();
  const mine = ++ticket;
  silence();
  return playSingle(character, line, mine);
}

/** Speak multiple NPC lines back-to-back (e.g. Madame Rousseau and Camille riffing in a 3-way conversation). */
export async function hearSequence(items: { character: string; text: string }[]): Promise<void> {
  const filtered = items.map((i) => ({ character: i.character, text: i.text.trim() })).filter((i) => i.text.length > 0);
  if (!filtered.length) return;
  ensureAudioContextUnlocked();
  const mine = ++ticket;
  silence();
  for (const item of filtered) {
    if (mine !== ticket) return;
    await playSingle(item.character, item.text, mine);
  }
}

async function playSingle(character: string, line: string, mine: number): Promise<string | null> {
  const controller = new AbortController();
  inflight = controller;
  let response: Response;
  try {
    response = await fetch("/api/sejour/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ character, text: line }),
      signal: controller.signal,
    });
  } catch {
    return mine === ticket ? "No connection." : null;
  }
  if (mine !== ticket) return null;
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "The voice didn't come through.";
  }
  if ((response.headers.get("content-type") ?? "").includes("mpeg")) {
    const url = URL.createObjectURL(await response.blob());
    if (mine !== ticket) {
      URL.revokeObjectURL(url);
      return null;
    }
    const audio = new Audio(url);
    playing = audio;
    return new Promise<string | null>((resolve) => {
      const done = () => {
        URL.revokeObjectURL(url);
        if (playing === audio) playing = null;
        resolve(null);
      };
      resolveWaiters.push(done);
      audio.onended = done;
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (playing === audio) playing = null;
        resolve(mine === ticket ? "The voice couldn't play." : null);
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        if (playing === audio) playing = null;
        resolve(mine === ticket ? "Your browser blocked the sound. Click again." : null);
      });
    });
  }
  return playPcm(response, mine);
}

/** Play 16-bit PCM as the bytes arrive, and resolve when the last scheduled buffer finishes playing. */
async function playPcm(response: Response, mine: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return "The voice didn't come through.";
  const rate = Number(response.headers.get("x-sample-rate")) || 24000;
  const ctx = audioCtx ?? new AudioContext();
  audioCtx = ctx;
  if (ctx.state === "suspended") {
    await Promise.race([
      ctx.resume().catch(() => undefined),
      new Promise<void>((r) => setTimeout(r, 350)),
    ]);
  }
  let pending = new Uint8Array(0);
  let next = ctx.currentTime + 0.02;
  let lastSource: AudioBufferSourceNode | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (mine !== ticket) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    if (done) break;
    if (!value?.length) continue;
    const merged = new Uint8Array(pending.length + value.length);
    merged.set(pending);
    merged.set(value, pending.length);
    const usable = merged.length - (merged.length % 2);
    pending = merged.slice(usable);
    if (usable < 2) continue;
    const samples = usable / 2;
    const buffer = ctx.createBuffer(1, samples, rate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(merged.buffer, merged.byteOffset, usable);
    for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const start = Math.max(next, ctx.currentTime);
    source.start(start);
    next = start + buffer.duration;
    sources.push(source);
    lastSource = source;
  }
  if (lastSource && mine === ticket) {
    const remainingMs = Math.max(0, (next - ctx.currentTime) * 1000);
    if (remainingMs > 20) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remainingMs + 120);
        const finish = () => {
          clearTimeout(timer);
          resolve();
        };
        resolveWaiters.push(finish);
        lastSource.onended = finish;
      });
    }
  }
  return null;
}

export type TalkRole = "host" | "lesson" | "baker" | "waiter" | "friend" | "friend_outing" | "pharmacist" | "family" | "cashier";

export interface Participant {
  id: string;
  name: string;
  character: string;
  portrait?: string;
  blurb?: string;
}

export interface SpokenTurn {
  speakerId: string;
  line: string;
  audio: string;
}

export interface TalkTurn {
  who: "you" | "them";
  text: string;
  audio?: string;
  speakerId?: string;
}

export interface TalkReply {
  line: string;
  audio: string;
  turns: SpokenTurn[];
  phrases: { fr: string; en: string }[];
  suggestedPlaces: PlaceId[];
  listed: boolean;
  paid: boolean;
  quiet: boolean;
  left: boolean;
  bedtime: boolean;
  invited: OutingId | null;
  stage: StageCall | null;
  served: string[];
  billed: boolean;
  settled: string[];
  error?: string;
}

export async function talk(body: {
  role: TalkRole;
  who: string;
  participants?: Participant[];
  history: TalkTurn[];
  said: string;
  context: string;
  memory: string;
  opening?: boolean;
  gesture?: string;
  unlocked?: UnlockId[];
  knownFrench?: string[];
}): Promise<TalkReply> {
  const empty: TalkReply = {
    line: "",
    audio: "",
    turns: [],
    phrases: [],
    suggestedPlaces: [],
    listed: false,
    paid: false,
    quiet: false,
    left: false,
    bedtime: false,
    invited: null,
    stage: null,
    served: [],
    billed: false,
    settled: [],
  };
  try {
    const response = await fetch("/api/sejour/talk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Partial<TalkReply> | null;
    if (!response.ok) return { ...empty, error: data?.error ?? "They didn't answer." };
    const rawTurns = Array.isArray(data?.turns)
      ? data.turns.filter(
          (t): t is SpokenTurn =>
            Boolean(t && typeof t.line === "string" && t.line.trim() && typeof t.speakerId === "string"),
        )
      : [];
    const fallbackLine = data?.line ?? "";
    const fallbackAudio = data?.audio ?? fallbackLine;
    const turns: SpokenTurn[] =
      rawTurns.length > 0
        ? rawTurns
        : fallbackLine
          ? [{ speakerId: body.who, line: fallbackLine, audio: fallbackAudio }]
          : [];
    return {
      ...empty,
      line: turns.map((t) => t.line).join(" ") || fallbackLine,
      audio: turns[0]?.audio ?? fallbackAudio,
      turns,
      phrases: Array.isArray(data?.phrases) ? data.phrases : [],
      suggestedPlaces: Array.isArray(data?.suggestedPlaces) ? data.suggestedPlaces.filter(isPlace) : [],
      listed: Boolean(data?.listed),
      paid: Boolean(data?.paid),
      quiet: Boolean(data?.quiet),
      left: Boolean(data?.left),
      bedtime: Boolean(data?.bedtime),
      invited: isOuting(data?.invited) ? data.invited : null,
      stage: cleanStageCall(data?.stage),
      served: Array.isArray(data?.served) ? data.served.filter((id): id is string => typeof id === "string") : [],
      billed: Boolean(data?.billed),
      settled: Array.isArray(data?.settled) ? data.settled.filter((id): id is string => typeof id === "string") : [],
      error: turns.length || fallbackLine ? undefined : data?.error,
    };
  } catch {
    return { ...empty, error: "No connection." };
  }
}
