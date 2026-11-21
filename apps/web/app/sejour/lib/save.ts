import { looksFrench } from "@/app/epicerie/lib/french";
import { evaluate, type Assessment } from "../world/gates";
import { isOuting, isPlace, isScene, type OutingId, type PlaceId, type UnlockId } from "../world/places";
import { cleanRatings } from "../world/skills";

export const SAVE_KEY = "sejour:v2";
export const LEGACY_SAVE_KEY = "sejour:v1";

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

/** Something the scenes showed they still need. The id matches a lesson/handout. */
export interface Gap {
  id: string;
  note: string;
}

export interface PendingInvite {
  friendId: string;
  outing: OutingId;
}

export interface Save {
  version: 2;
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
  /** Lesson / handout ids they have already handled. */
  mastered: string[];
  gaps: Gap[];
  /** Coins and notes in cents that persist between days. */
  wallet: number[];
  /** Per-conversation skill ratings from the coach. */
  assessments: Assessment[];
  /** Gate ids already passed. */
  gatesPassed: string[];
  /** Place, invite, and event ids unlocked by gates. */
  unlocked: UnlockId[];
  /** Unlocked places Madame has already brought up in conversation (so their chips show). */
  offered: PlaceId[];
  /** How many times each place/scene has been completed. */
  visits: Record<string, number>;
  /** Lesson ids completed with Madame. */
  lessonsDone: string[];
  /** Lesson ids skipped with 'I already know that'. */
  lessonsSkipped: string[];
  /** Event ids already completed. */
  eventsDone: string[];
  /** Whether listening mode is switched on (hides NPC text lines). Kept in sync with listeningMode for older clients. */
  listening: boolean;
  /** auto follows the course week. off shows the words and limits listening credit. */
  listeningMode: "auto" | "on" | "off";
  /** The learner read NPC text today, so listening credit stays capped. */
  readText: boolean;
  /** Active outing invitation from a speed-friending friend. */
  pendingInvite: PendingInvite | null;
  /** Form values remembered from previous sign-up forms. */
  formProfile: Record<string, string>;
  /** Places and events explicitly unlocked by the Teacher orchestrator (starts with ['boulangerie']). */
  teacherUnlocked?: UnlockId[];
  /** Place, outing, or event chosen at breakfast, held until the lesson is done. */
  errand: string;
  /** French lines the day's reviews flagged for another pass. */
  drill: { fr: string; en: string }[];
}

export function emptySave(): Save {
  return {
    version: 2,
    day: 0,
    address: "",
    cooked: [],
    phrases: [],
    pages: [FIRST_PAGE],
    journal: "",
    memories: {},
    met: [],
    cards: [],
    mastered: [],
    gaps: [],
    wallet: [],
    assessments: [],
    gatesPassed: [],
    unlocked: ["boulangerie"],
    offered: ["boulangerie"],
    visits: {},
    lessonsDone: [],
    lessonsSkipped: [],
    eventsDone: [],
    listening: false,
    listeningMode: "auto",
    readText: false,
    pendingInvite: null,
    formProfile: {},
    teacherUnlocked: ["boulangerie"],
    errand: "",
    drill: [],
  };
}

function gap(value: unknown): Gap | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Gap;
  const id = typeof item.id === "string" ? item.id.trim().slice(0, 48) : "";
  const note = typeof item.note === "string" ? item.note.trim().slice(0, 160) : "";
  if (!/^[a-z0-9_]+$/.test(id) || !note) return null;
  return { id, note };
}

/** Fold a review into the save. Mastered ids leave the gap list. */
export function recordStudy(current: Save, incomingGaps: Gap[], incomingMastered: string[]): { gaps: Gap[]; mastered: string[] } {
  const mastered = [...current.mastered];
  for (const id of incomingMastered) {
    const clean = id.trim().slice(0, 48);
    if (!/^[a-z0-9_]+$/.test(clean) || mastered.includes(clean)) continue;
    mastered.push(clean);
  }
  const gaps = current.gaps.filter((item) => !mastered.includes(item.id));
  for (const item of incomingGaps) {
    const next = gap(item);
    if (!next || mastered.includes(next.id) || gaps.some((known) => known.id === next.id)) continue;
    gaps.push(next);
  }
  return { gaps: gaps.slice(0, 12), mastered: mastered.slice(0, 32) };
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

function parseAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { scene?: unknown; day?: unknown; ratings?: unknown };
  const scene = isScene(item.scene) ? item.scene : "host";
  const day = Number.isInteger(item.day) && (item.day as number) >= 0 ? (item.day as number) : 0;
  const ratings = cleanRatings(item.ratings);
  return { scene, day, ratings };
}

function parsePendingInvite(value: unknown): PendingInvite | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { friendId?: unknown; outing?: unknown };
  if (typeof item.friendId !== "string" || !item.friendId.trim()) return null;
  if (!isOuting(item.outing)) return null;
  return { friendId: item.friendId.trim().slice(0, 24), outing: item.outing };
}

/** Parse either a v2 save or migrate a v1 save. Rejects non-séjour objects (e.g. the shop save). */
export function parseSave(raw: unknown): Save | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 && value.version !== 2) return null;
  // The shop's save has a numeric `visits` counter and `carnet`; reject it so we don't cross-load
  if (typeof value.visits === "number" && "carnet" in value) return null;
  if (!Number.isInteger(value.day) || (value.day as number) < 0) return null;

  const isV1 = value.version === 1;
  const address = value.address === "monsieur" || value.address === "madame" || value.address === "bonjour" ? value.address : "";
  const cooked = Array.isArray(value.cooked) ? value.cooked.filter((id): id is string => typeof id === "string").slice(0, 30) : [];
  const parsedPages = Array.isArray(value.pages) ? value.pages.map(bookPage).filter((item): item is BookPage => item !== null).slice(0, 24) : [];
  const pages = parsedPages.length ? parsedPages : [FIRST_PAGE];
  const known = new Set(pages.map((item) => item.id));
  const phrases = (Array.isArray(value.phrases) ? value.phrases.map(phrase).filter((item): item is Phrase => item !== null).slice(0, 120) : []).map((item) =>
    known.has(item.pageId) ? item : { ...item, pageId: pages[0].id },
  );
  const met = Array.isArray(value.met) ? value.met.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
  const cards = Array.isArray(value.cards) ? value.cards.map(card).filter((item): item is Card => item !== null).slice(0, 40) : [];
  const memories: Record<string, MemoryTurn[]> = {};
  if (value.memories && typeof value.memories === "object") {
    for (const [id, turns] of Object.entries(value.memories as Record<string, unknown>).slice(0, 30)) {
      if (!Array.isArray(turns)) continue;
      memories[id] = turns
        .filter((turn) => turn && (turn.who === "you" || turn.who === "them") && typeof turn.text === "string")
        .map((turn) => ({ who: turn.who, text: turn.text.slice(0, 400) }))
        .slice(-40);
    }
  }

  const wallet = Array.isArray(value.wallet)
    ? value.wallet.filter((c): c is number => typeof c === "number" && Number.isInteger(c) && c > 0).slice(0, 60)
    : [];

  const assessments = Array.isArray(value.assessments)
    ? value.assessments.map(parseAssessment).filter((a): a is Assessment => a !== null).slice(-80)
    : [];

  const visits: Record<string, number> = {};
  if (value.visits && typeof value.visits === "object" && !Array.isArray(value.visits)) {
    for (const [k, v] of Object.entries(value.visits as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
        visits[k.slice(0, 24)] = v;
      }
    }
  }

  const eventsDone = Array.isArray(value.eventsDone)
    ? value.eventsDone.filter((id): id is string => typeof id === "string").slice(0, 12)
    : [];

  const teacherUnlocked = Array.isArray(value.teacherUnlocked)
    ? (value.teacherUnlocked.filter((id): id is UnlockId => typeof id === "string") as UnlockId[]).slice(0, 20)
    : (["boulangerie"] as UnlockId[]);
  if (!teacherUnlocked.includes("boulangerie")) teacherUnlocked.unshift("boulangerie");

  const evaluated = evaluate({ assessments, visits, eventsDone, teacherUnlocked });
  const rawOffered = Array.isArray(value.offered)
    ? value.offered.filter((id): id is PlaceId => isPlace(id) && evaluated.unlocked.includes(id))
    : [];
  const offered: PlaceId[] = rawOffered.includes("boulangerie") ? rawOffered : ["boulangerie", ...rawOffered];

  const lessonsDone = Array.isArray(value.lessonsDone)
    ? value.lessonsDone.filter((id): id is string => typeof id === "string" && /^[a-z0-9_]+$/.test(id)).slice(0, 60)
    : [];
  const lessonsSkipped = Array.isArray(value.lessonsSkipped)
    ? value.lessonsSkipped.filter((id): id is string => typeof id === "string" && /^[a-z0-9_]+$/.test(id)).slice(0, 60)
    : [];

  const formProfile: Record<string, string> = {};
  if (value.formProfile && typeof value.formProfile === "object" && !Array.isArray(value.formProfile)) {
    for (const [k, v] of Object.entries(value.formProfile as Record<string, unknown>).slice(0, 16)) {
      if (typeof v === "string") formProfile[k.slice(0, 32)] = v.slice(0, 120);
    }
  }

  const listeningMode: Save["listeningMode"] =
    value.listeningMode === "on" || value.listeningMode === "off" ? value.listeningMode : value.listening === true ? "on" : "auto";

  return {
    version: 2,
    day: isV1 ? (value.day as number) : (value.day as number),
    address,
    cooked,
    phrases,
    pages,
    journal: typeof value.journal === "string" ? value.journal.slice(0, 4000) : "",
    memories,
    met,
    cards,
    mastered: Array.isArray(value.mastered) ? value.mastered.filter((id): id is string => typeof id === "string" && /^[a-z0-9_]+$/.test(id)).slice(0, 40) : [],
    gaps: Array.isArray(value.gaps) ? value.gaps.map(gap).filter((item): item is Gap => item !== null).slice(0, 12) : [],
    wallet,
    assessments,
    gatesPassed: evaluated.gates,
    unlocked: evaluated.unlocked,
    offered,
    visits,
    lessonsDone,
    lessonsSkipped,
    eventsDone,
    listeningMode,
    listening: listeningMode === "on",
    readText: value.readText === true,
    pendingInvite: parsePendingInvite(value.pendingInvite),
    formProfile,
    teacherUnlocked,
    errand: typeof value.errand === "string" ? value.errand.slice(0, 40) : "",
    drill: Array.isArray(value.drill)
      ? value.drill
          .filter((item): item is { fr?: unknown; en?: unknown } => Boolean(item) && typeof item === "object")
          .map((item) => ({
            fr: typeof item.fr === "string" ? item.fr.slice(0, 160) : "",
            en: typeof item.en === "string" ? item.en.slice(0, 160) : "",
          }))
          .filter((item) => item.fr)
          .slice(0, 8)
      : [],
  };
}

/** Record an assessment and recompute unlocked gates & places. */
export function recordAssessment(save: Save, assessment: Assessment): Save {
  const assessments = [...save.assessments, assessment].slice(-80);
  const { gates, unlocked } = evaluate({
    assessments,
    visits: save.visits,
    eventsDone: save.eventsDone,
    teacherUnlocked: save.teacherUnlocked,
  });
  return {
    ...save,
    assessments,
    gatesPassed: gates,
    unlocked,
  };
}

/** Increment the visit count for a place/scene and recompute gates. */
export function recordVisit(save: Save, place: string): Save {
  const visits = { ...save.visits, [place]: (save.visits[place] ?? 0) + 1 };
  const { gates, unlocked } = evaluate({
    assessments: save.assessments,
    visits,
    eventsDone: save.eventsDone,
    teacherUnlocked: save.teacherUnlocked,
  });
  return {
    ...save,
    visits,
    gatesPassed: gates,
    unlocked,
  };
}

/** Mark an unlocked place as offered by Madame so its chip appears in the UI. */
export function offerPlaces(save: Save, ids: readonly PlaceId[]): Save {
  const next = [...save.offered];
  for (const id of ids) {
    if (save.unlocked.includes(id) && !next.includes(id)) next.push(id);
  }
  return { ...save, offered: next };
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
