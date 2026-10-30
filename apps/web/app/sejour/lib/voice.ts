"use client";

import { looksFrench } from "@/app/epicerie/lib/french";

let playing: HTMLAudioElement | null = null;
let ticket = 0;
let inflight: AbortController | null = null;
let audioCtx: AudioContext | null = null;
let sources: AudioBufferSourceNode[] = [];

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
  if (!playing) return;
  playing.pause();
  playing.src = "";
  playing = null;
}

/** Stop the voice at once, including a clip that has not arrived yet. */
export function stopHearing() {
  ticket += 1;
  silence();
}

/** Speak a line as someone in the stay. No browser voice. Returns an error, or null. Phrasebook lines must be French. */
export async function hear(character: string, text: string, language: "french" | "any" = "french"): Promise<string | null> {
  const line = text.trim();
  if (language === "french" && !looksFrench(line)) return "That's not French.";
  if (!line) return "Say something.";
  const mine = ++ticket;
  silence();
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
    if (mine !== ticket) return null;
    return "The voice didn't come through.";
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
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (playing === audio) playing = null;
    };
    try {
      await audio.play();
    } catch {
      if (mine !== ticket) return null;
      return "The voice didn't come through.";
    }
    return null;
  }
  return playPcm(response, mine);
}

/** Play 16-bit PCM as the bytes arrive, so a greeting is not held for the whole file. */
async function playPcm(response: Response, mine: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return "The voice didn't come through.";
  const rate = Number(response.headers.get("x-sample-rate")) || 24000;
  const ctx = audioCtx ?? new AudioContext();
  audioCtx = ctx;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  let pending = new Uint8Array(0);
  let next = ctx.currentTime + 0.02;
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
  }
  return null;
}

export interface TalkTurn {
  who: "you" | "them";
  text: string;
}

export interface TalkReply {
  line: string;
  audio: string;
  phrases: { fr: string; en: string }[];
  listed: boolean;
  paid: boolean;
  quiet: boolean;
  left: boolean;
  served: string[];
  billed: boolean;
  error?: string;
}

export async function talk(body: {
  role: "host" | "conductor" | "officer" | "friend" | "waiter";
  who: string;
  history: TalkTurn[];
  said: string;
  context: string;
  memory: string;
  opening?: boolean;
  gesture?: string;
}): Promise<TalkReply> {
  const empty: TalkReply = { line: "", audio: "", phrases: [], listed: false, paid: false, quiet: false, left: false, served: [], billed: false };
  try {
    const response = await fetch("/api/sejour/talk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Partial<TalkReply> | null;
    if (!response.ok) return { ...empty, error: data?.error ?? "They didn't answer." };
    return {
      ...empty,
      line: data?.line ?? "",
      audio: data?.audio ?? "",
      phrases: Array.isArray(data?.phrases) ? data.phrases : [],
      listed: Boolean(data?.listed),
      paid: Boolean(data?.paid),
      quiet: Boolean(data?.quiet),
      left: Boolean(data?.left),
      served: Array.isArray(data?.served) ? data.served.filter((id): id is string => typeof id === "string") : [],
      billed: Boolean(data?.billed),
      error: data?.line ? undefined : data?.error,
    };
  } catch {
    return { ...empty, error: "No connection." };
  }
}
