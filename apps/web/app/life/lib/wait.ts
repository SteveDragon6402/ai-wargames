export type WaitKind = "childhood" | "youth" | "age" | "picture";

export const WRITE_SEED_MS: Record<WaitKind, number> = {
  childhood: 25_000,
  youth: 28_000,
  age: 32_000,
  picture: 14_000,
};

const KEY = "one-life-write-ms";
const KEEP = 8;
const FLOOR_MS = 4_000;
const CEIL_MS = 120_000;

export function meanMs(samples: number[], seed: number): number {
  if (samples.length === 0) return seed;
  return Math.round(samples.reduce((sum, item) => sum + item, 0) / samples.length);
}

export function appendSample(samples: number[], ms: number): number[] {
  const clamped = Math.min(CEIL_MS, Math.max(FLOOR_MS, Math.round(ms)));
  return [...samples, clamped].slice(-KEEP);
}

export function waitRatio(elapsed: number, expected: number): number {
  if (elapsed <= 0) return 0;
  const horizon = Math.max(expected, 1);
  const t = elapsed / horizon;
  if (t < 1) return 0.9 * (1 - (1 - t) ** 1.4);
  return Math.min(0.97, 0.9 + 0.07 * (1 - Math.exp(-(t - 1) * 0.7)));
}

function asSamples(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item) && item > 0);
}

function readStore(): Partial<Record<WaitKind, number[]>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const row = parsed as Record<string, unknown>;
    return {
      childhood: asSamples(row.childhood),
      youth: asSamples(row.youth),
      age: asSamples(row.age),
      picture: asSamples(row.picture),
    };
  } catch {
    return {};
  }
}

function writeStore(store: Partial<Record<WaitKind, number[]>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function expectedWriteMs(kind: WaitKind): number {
  const samples = readStore()[kind] ?? [];
  return meanMs(samples, WRITE_SEED_MS[kind]);
}

export function rememberWriteMs(kind: WaitKind, ms: number) {
  const store = readStore();
  store[kind] = appendSample(store[kind] ?? [], ms);
  writeStore(store);
}
