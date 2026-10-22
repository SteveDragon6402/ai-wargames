import { ITEMS, ITEM_BY_ID } from "../data/items";
import { DAILY_PURSE, listForDay, type DayList } from "../data/lists";

export type Expression = "neutral" | "smile" | "puzzled" | "laugh";
export const EXPRESSIONS: Expression[] = ["neutral", "smile", "puzzled", "laugh"];

export interface Line {
  itemId: string;
  qty: number;
}

export interface Turn {
  role: "you" | "gerard" | "event";
  text: string;
  /** The item the customer was pointing at when they spoke. */
  pointed?: string;
  gesture?: string;
  expression?: Expression;
  /** Gérard's hands and face, in English narration. */
  action?: string;
}

export interface Session {
  day: number;
  transcript: Turn[];
  counter: Line[];
  /** The total on the till, in cents, while a sale is open. */
  till: number | null;
  basket: Line[];
  purse: number[];
  spent: number;
}

export interface CarnetEntry {
  itemId: string;
  day: number;
}

export type Address = "monsieur" | "madame" | "unknown";

export interface Save {
  version: 1;
  address: Address;
  /** The next day to play, counted from zero. */
  day: number;
  visits: number;
  notes: string[];
  carnet: CarnetEntry[];
  session: Session | null;
  voice: boolean;
}

export const SAVE_KEY = "epicerie:v1";
export const MAX_NOTES = 12;

const DENOMINATIONS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export function isNote(cents: number): boolean {
  return cents >= 500;
}

export function formatEuros(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const part = Math.abs(cents) % 100;
  return `${cents < 0 ? "-" : ""}${whole},${String(part).padStart(2, "0")} €`;
}

export function coinLabel(cents: number): string {
  return cents >= 100 ? `${cents / 100} €` : `${cents} c`;
}

export function sumCoins(coins: number[]): number {
  return coins.reduce((total, coin) => total + coin, 0);
}

export function sortPurse(coins: number[]): number[] {
  return [...coins].sort((a, b) => b - a);
}

/** Greedy change in euro denominations. */
export function makeChange(cents: number): number[] {
  const change: number[] = [];
  let left = Math.max(0, Math.round(cents));
  for (const value of DENOMINATIONS) {
    while (left >= value) {
      change.push(value);
      left -= value;
    }
  }
  return change;
}

/** Take the given coins out of the purse, or null if the purse does not hold them. */
export function removeCoins(purse: number[], coins: number[]): number[] | null {
  const left = [...purse];
  for (const coin of coins) {
    const index = left.indexOf(coin);
    if (index === -1) return null;
    left.splice(index, 1);
  }
  return left;
}

export type PayResult =
  | { ok: true; purse: number[]; change: number[]; paid: number }
  | { ok: false; reason: "short" | "not-in-purse" | "no-sale"; paid: number };

export function pay(purse: number[], offered: number[], total: number | null): PayResult {
  const paid = sumCoins(offered);
  if (total === null) return { ok: false, reason: "no-sale", paid };
  const left = removeCoins(purse, offered);
  if (!left) return { ok: false, reason: "not-in-purse", paid };
  if (paid < total) return { ok: false, reason: "short", paid };
  const change = makeChange(paid - total);
  return { ok: true, purse: sortPurse([...left, ...change]), change, paid };
}

export function addLine(lines: Line[], itemId: string, qty: number): Line[] {
  if (!ITEM_BY_ID[itemId] || !Number.isInteger(qty) || qty < 1) return lines;
  const found = lines.find((line) => line.itemId === itemId);
  if (found) return lines.map((line) => (line.itemId === itemId ? { ...line, qty: line.qty + qty } : line));
  return [...lines, { itemId, qty }];
}

/** Remove qty of an item, or all of it when qty is omitted. */
export function removeLine(lines: Line[], itemId: string, qty?: number): Line[] {
  return lines
    .map((line) => (line.itemId === itemId ? { ...line, qty: qty === undefined ? 0 : line.qty - qty } : line))
    .filter((line) => line.qty > 0);
}

export function mergeLines(into: Line[], from: Line[]): Line[] {
  return from.reduce((acc, line) => addLine(acc, line.itemId, line.qty), into);
}

export function linesTotal(lines: Line[]): number {
  return lines.reduce((total, line) => total + (ITEM_BY_ID[line.itemId]?.price ?? 0) * line.qty, 0);
}

export function countOf(lines: Line[], itemId: string): number {
  return lines.find((line) => line.itemId === itemId)?.qty ?? 0;
}

export interface ListProgress {
  itemId: string;
  text: string;
  note: string;
  need: number;
  have: number;
  done: boolean;
}

export function listProgress(list: DayList, basket: Line[]): ListProgress[] {
  return list.entries.map((entry) => {
    const have = countOf(basket, entry.itemId);
    return { itemId: entry.itemId, text: entry.text, note: entry.note, need: entry.qty, have, done: have >= entry.qty };
  });
}

export function listComplete(list: DayList, basket: Line[]): boolean {
  return listProgress(list, basket).every((entry) => entry.done);
}

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ");
}

/** Items whose French name appears in a line Gérard said. */
export function itemsNamedIn(line: string): string[] {
  const text = ` ${normalise(line).replace(/[^a-z0-9]+/g, " ")} `;
  return ITEMS.filter((item) =>
    item.keywords.some((keyword) => new RegExp(` ${keyword}(s|x)? `).test(text)),
  ).map((item) => item.id);
}

export function learnWords(carnet: CarnetEntry[], line: string, day: number): CarnetEntry[] {
  const known = new Set(carnet.map((entry) => entry.itemId));
  const fresh = itemsNamedIn(line).filter((id) => !known.has(id));
  return fresh.length ? [...carnet, ...fresh.map((itemId) => ({ itemId, day }))] : carnet;
}

export function newSession(day: number): Session {
  return { day, transcript: [], counter: [], till: null, basket: [], purse: sortPurse(DAILY_PURSE), spent: 0 };
}

export function freshSave(): Save {
  return { version: 1, address: "unknown", day: 0, visits: 0, notes: [], carnet: [], session: null, voice: true };
}

export function addNote(notes: string[], note: string): string[] {
  const clean = note.trim().slice(0, 300);
  if (!clean) return notes;
  return [...notes, clean].slice(-MAX_NOTES);
}

function isLines(value: unknown): value is Line[] {
  return (
    Array.isArray(value) &&
    value.every(
      (line) =>
        line &&
        typeof line === "object" &&
        typeof (line as Line).itemId === "string" &&
        Boolean(ITEM_BY_ID[(line as Line).itemId]) &&
        Number.isInteger((line as Line).qty) &&
        (line as Line).qty > 0,
    )
  );
}

function isCoins(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((coin) => DENOMINATIONS.includes(coin as number));
}

function readSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<Session>;
  if (!Number.isInteger(session.day) || (session.day as number) < 0) return null;
  if (!Array.isArray(session.transcript) || !isLines(session.counter) || !isLines(session.basket) || !isCoins(session.purse)) return null;
  const transcript = session.transcript
    .filter((turn): turn is Turn => Boolean(turn) && typeof turn.text === "string" && ["you", "gerard", "event"].includes(turn.role))
    .map((turn) => ({
      ...turn,
      expression: turn.expression && EXPRESSIONS.includes(turn.expression) ? turn.expression : undefined,
    }));
  const till = typeof session.till === "number" && session.till > 0 ? Math.round(session.till) : null;
  return {
    day: session.day as number,
    transcript,
    counter: session.counter,
    till: till !== null && session.counter.length ? till : null,
    basket: session.basket,
    purse: sortPurse(session.purse),
    spent: Number.isFinite(session.spent) ? Math.max(0, Math.round(session.spent as number)) : 0,
  };
}

/** Parse whatever is in storage; anything malformed falls back to a fresh save. */
export function parseSave(raw: string | null): Save {
  if (!raw) return freshSave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return freshSave();
  }
  if (!data || typeof data !== "object" || (data as Save).version !== 1) return freshSave();
  const save = data as Partial<Save>;
  return {
    version: 1,
    address: save.address === "monsieur" || save.address === "madame" ? save.address : "unknown",
    day: Number.isInteger(save.day) && (save.day as number) >= 0 ? (save.day as number) : 0,
    visits: Number.isInteger(save.visits) && (save.visits as number) >= 0 ? (save.visits as number) : 0,
    notes: Array.isArray(save.notes) ? save.notes.filter((note): note is string => typeof note === "string").slice(-MAX_NOTES) : [],
    carnet: Array.isArray(save.carnet)
      ? save.carnet.filter(
          (entry): entry is CarnetEntry =>
            Boolean(entry) && typeof entry.itemId === "string" && Boolean(ITEM_BY_ID[entry.itemId]) && Number.isInteger(entry.day),
        )
      : [],
    session: readSession(save.session),
    voice: save.voice !== false,
  };
}

export { listForDay };
