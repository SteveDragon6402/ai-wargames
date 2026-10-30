import { looksFrench } from "@/app/epicerie/lib/french";

export const SAVE_KEY = "sejour:v1";

export type Address = "monsieur" | "madame" | "bonjour";

export interface Phrase {
  id: string;
  fr: string;
  en: string;
  source: string;
  day: number;
  pageId: string;
}

export interface BookPage {
  id: string;
  title: string;
}

export const FIRST_PAGE: BookPage = { id: "page-1", title: "First page" };

/** A scribble stroke, as pairs of x then y, each from 0 to 1000. */
export interface Card {
  id: string;
  day: number;
  text: string;
  strokes: number[][];
}

export interface MemoryTurn {
  who: "you" | "them";
  text: string;
}

/** Something the scenes showed they still need. The id matches a handout. */
export interface Gap {
  id: string;
  note: string;
}

export interface Save {
  version: 1;
  /** Mornings already finished. The stay on screen is day + 1. */
  day: number;
  address: Address | "";
  cooked: string[];
  phrases: Phrase[];
  pages: BookPage[];
  journal: string;
  memories: Record<string, MemoryTurn[]>;
  met: string[];
  cards: Card[];
  /** Handout ids they have already handled. */
  mastered: string[];
  gaps: Gap[];
}

export function emptySave(): Save {
  return { version: 1, day: 0, address: "", cooked: [], phrases: [], pages: [FIRST_PAGE], journal: "", memories: {}, met: [], cards: [], mastered: [], gaps: [] };
}

function gap(value: unknown): Gap | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Gap;
  const id = typeof item.id === "string" ? item.id.trim().slice(0, 24) : "";
  const note = typeof item.note === "string" ? item.note.trim().slice(0, 160) : "";
  if (!/^[a-z]+$/.test(id) || !note) return null;
  return { id, note };
}

/** Fold a review into the save. Mastered ids leave the gap list. */
export function recordStudy(current: Save, incomingGaps: Gap[], incomingMastered: string[]): { gaps: Gap[]; mastered: string[] } {
  const mastered = [...current.mastered];
  for (const id of incomingMastered) {
    const clean = id.trim().slice(0, 24);
    if (!/^[a-z]+$/.test(clean) || mastered.includes(clean)) continue;
    mastered.push(clean);
  }
  const gaps = current.gaps.filter((item) => !mastered.includes(item.id));
  for (const item of incomingGaps) {
    const next = gap(item);
    if (!next || mastered.includes(next.id) || gaps.some((known) => known.id === next.id)) continue;
    gaps.push(next);
  }
  return { gaps: gaps.slice(0, 12), mastered: mastered.slice(0, 16) };
}

function phrase(value: unknown): Phrase | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Phrase;
  const fr = typeof item.fr === "string" ? item.fr.trim() : "";
  if (!fr) return null;
  return {
    id: typeof item.id === "string" ? item.id.slice(0, 40) : fr.slice(0, 12),
    fr: fr.slice(0, 180),
    en: typeof item.en === "string" ? item.en.slice(0, 180) : "",
    source: typeof item.source === "string" ? item.source.slice(0, 40) : "",
    day: Number.isInteger(item.day) && item.day >= 0 ? item.day : 0,
    pageId: typeof item.pageId === "string" && item.pageId.trim() ? item.pageId.slice(0, 40) : FIRST_PAGE.id,
  };
}

function bookPage(value: unknown): BookPage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as BookPage;
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 40) : "";
  const id = typeof item.id === "string" ? item.id.trim().slice(0, 40) : "";
  if (!id || !title) return null;
  return { id, title };
}

function card(value: unknown): Card | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Card;
  const strokes = Array.isArray(item.strokes)
    ? item.strokes
        .filter((stroke) => Array.isArray(stroke))
        .map((stroke) => stroke.filter((point) => typeof point === "number" && Number.isFinite(point)).slice(0, 800))
        .slice(0, 80)
    : [];
  return {
    id: typeof item.id === "string" ? item.id.slice(0, 40) : "card",
    day: Number.isInteger(item.day) && item.day >= 0 ? item.day : 0,
    text: typeof item.text === "string" ? item.text.slice(0, 600) : "",
    strokes,
  };
}

export function parseSave(raw: unknown): Save | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Save>;
  if (value.version !== 1) return null;
  if (!Number.isInteger(value.day) || (value.day as number) < 0) return null;
  const address = value.address === "monsieur" || value.address === "madame" || value.address === "bonjour" ? value.address : "";
  const cooked = Array.isArray(value.cooked) ? value.cooked.filter((id): id is string => typeof id === "string").slice(0, 8) : [];
  const parsedPages = Array.isArray(value.pages) ? value.pages.map(bookPage).filter((item): item is BookPage => item !== null).slice(0, 24) : [];
  const pages = parsedPages.length ? parsedPages : [FIRST_PAGE];
  const known = new Set(pages.map((item) => item.id));
  const phrases = (Array.isArray(value.phrases) ? value.phrases.map(phrase).filter((item): item is Phrase => item !== null).slice(0, 80) : []).map((item) =>
    known.has(item.pageId) ? item : { ...item, pageId: pages[0].id },
  );
  const met = Array.isArray(value.met) ? value.met.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
  const cards = Array.isArray(value.cards) ? value.cards.map(card).filter((item): item is Card => item !== null).slice(0, 40) : [];
  const memories: Record<string, MemoryTurn[]> = {};
  if (value.memories && typeof value.memories === "object") {
    for (const [id, turns] of Object.entries(value.memories).slice(0, 30)) {
      if (!Array.isArray(turns)) continue;
      memories[id] = turns
        .filter((turn) => turn && (turn.who === "you" || turn.who === "them") && typeof turn.text === "string")
        .map((turn) => ({ who: turn.who, text: turn.text.slice(0, 400) }))
        .slice(-40);
    }
  }
  return {
    version: 1,
    day: value.day as number,
    address,
    cooked,
    phrases,
    pages,
    journal: typeof value.journal === "string" ? value.journal.slice(0, 4000) : "",
    memories,
    met,
    cards,
    mastered: Array.isArray(value.mastered) ? value.mastered.filter((id): id is string => typeof id === "string" && /^[a-z]+$/.test(id)).slice(0, 16) : [],
    gaps: Array.isArray(value.gaps) ? value.gaps.map(gap).filter((item): item is Gap => item !== null).slice(0, 12) : [],
  };
}

/** Add a French line. English, blanks, and duplicates are left out. */
export function addPhrase(phrases: Phrase[], input: { fr: string; en: string; source: string; day: number; pageId?: string }): Phrase[] {
  const fr = input.fr.trim().slice(0, 180);
  const en = input.en.trim().slice(0, 180);
  if (!looksFrench(fr)) return phrases;
  if (phrases.some((item) => item.fr.toLowerCase() === fr.toLowerCase())) return phrases;
  return [...phrases, { id: `${input.day}-${phrases.length}`, fr, en, source: input.source.trim().slice(0, 40) || "you", day: input.day, pageId: input.pageId || FIRST_PAGE.id }];
}

export function addBookPage(pages: BookPage[], title: string): BookPage[] {
  const name = title.trim().slice(0, 40);
  if (!name || pages.length >= 24) return pages;
  return [...pages, { id: `page-${pages.length + 1}-${name.length}`, title: name }];
}

export function movePhrase(phrases: Phrase[], phraseId: string, pageId: string): Phrase[] {
  return phrases.map((phrase) => (phrase.id === phraseId ? { ...phrase, pageId } : phrase));
}

export function remember(save: Save, personId: string, turns: MemoryTurn[], met = false): Save {
  const previous = save.memories[personId] ?? [];
  return {
    ...save,
    met: met && !save.met.includes(personId) ? [...save.met, personId] : save.met,
    memories: { ...save.memories, [personId]: [...previous, ...turns].slice(-40) },
  };
}
