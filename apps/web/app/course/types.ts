import type { OutingId, PlaceId, SceneId, UnlockId } from "@/app/sejour/world/places";
import type { Ratings, Skill } from "@/app/sejour/world/skills";

export type VocabDomain =
  | "greetings_politeness"
  | "self_intro"
  | "numbers_prices"
  | "bakery_cafe"
  | "food_grocery"
  | "kitchen_cooking"
  | "countries_nationality"
  | "family_people"
  | "hobbies_leisure"
  | "time_days_dates"
  | "town_places_directions"
  | "restaurant"
  | "body_health"
  | "home_routine"
  | "weather_describing";

export const VOCAB_DOMAINS: readonly VocabDomain[] = [
  "greetings_politeness",
  "self_intro",
  "numbers_prices",
  "bakery_cafe",
  "food_grocery",
  "kitchen_cooking",
  "countries_nationality",
  "family_people",
  "hobbies_leisure",
  "time_days_dates",
  "town_places_directions",
  "restaurant",
  "body_health",
  "home_routine",
  "weather_describing",
] as const;

export const VOCAB_DOMAIN_LABELS: Record<VocabDomain, { label: string; week: 1 | 2 | 3 | 4 }> = {
  greetings_politeness: { label: "Greetings & Politeness", week: 1 },
  self_intro: { label: "Introducing Yourself", week: 1 },
  numbers_prices: { label: "Numbers & Prices", week: 1 },
  bakery_cafe: { label: "Bakery & Café", week: 1 },
  food_grocery: { label: "Food & Grocery", week: 2 },
  kitchen_cooking: { label: "Kitchen & Cooking", week: 2 },
  countries_nationality: { label: "Countries & Nationalities", week: 2 },
  family_people: { label: "Family & People", week: 3 },
  hobbies_leisure: { label: "Hobbies, Cinema & Sport", week: 3 },
  time_days_dates: { label: "Time, Days & Schedules", week: 3 },
  town_places_directions: { label: "Town Places & Directions", week: 3 },
  restaurant: { label: "At the Restaurant", week: 4 },
  body_health: { label: "Body, Health & Pharmacy", week: 4 },
  home_routine: { label: "Daily Routine & Home", week: 4 },
  weather_describing: { label: "Weather & Describing Things", week: 4 },
};

export interface VocabItem {
  id: string;
  fr: string;
  en: string;
  article?: "le" | "la" | "l'" | "les" | "un" | "une" | "des" | "";
  domain: VocabDomain;
  week: 1 | 2 | 3 | 4;
  core: boolean;
  exampleFr?: string;
  exampleEn?: string;
}

export type ExerciseKind = "mcq" | "gap" | "tiles" | "listen" | "translate";

export interface GrammarExercise {
  id: string;
  kind: ExerciseKind;
  prompt: string;
  /** French audio text to play for 'listen' (or optional audio on any prompt). */
  audioFr?: string;
  /** Options for 'mcq' or 'listen', or shuffled word tiles for 'tiles'. */
  options?: string[];
  /** Canonical correct answer string. */
  answer: string;
  /** Additional accepted strings (case/accent normalized). */
  accept?: string[];
  /** Short explanation shown after answering. */
  explanation: string;
}

export interface GrammarLesson {
  id: string;
  day: number;
  week: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  /** Rich markdown/structured explanation paragraphs. */
  explanation: string[];
  /** Key grammar table or callout points. */
  keyPoints: { fr: string; en: string; note?: string }[];
  /** Spoken examples with audio playback. */
  examples: { fr: string; en: string }[];
  /** Pool of exercises (8-12 per lesson). */
  exercises: GrammarExercise[];
  /** Prompt shown at the end of the lesson telling the student how to use this in Le Séjour today. */
  useItPrompt: string;
  skills: Skill[];
  domains: VocabDomain[];
}

export interface ProbeSpec {
  id: string;
  scene: SceneId;
  days: [number, number];
  /** Uncovered vocab domain or unmastered grammar lesson id that triggers this probe. */
  unlessDomain?: VocabDomain;
  unlessGrammar?: string;
  /** Target NPC role or speed-friending slot (1-indexed: 1, 2, or 3). */
  targetRole?: string;
  targetSlot?: 1 | 2 | 3;
  /** Hidden director instruction injected into the NPC's system prompt. */
  note: string;
  /** Regex matched against the learner's own lines before this probe counts as done. */
  expect?: string;
  /** Brief description for the Teacher / Admin log. */
  description: string;
}

export type ExamSection = "listening" | "reading" | "language" | "writing";

export interface ExamBankItem {
  id: string;
  section: ExamSection;
  week: 1 | 2 | 3 | 4;
  difficulty: 1 | 2 | 3;
  topics: string[];
  domains: VocabDomain[];
  /** Question prompt (or reading text + question). */
  prompt: string;
  /** Reading passage (for 'reading') or spoken French audio script (for 'listening'). */
  stimulusFr?: string;
  /** Choices for MCQ ('listening', 'reading', 'language'). */
  options?: string[];
  /** Correct answer for objective items. */
  answer?: string;
  /** Rubric criteria for 'writing' items. */
  rubric?: string[];
}

export interface PlacementQuestion {
  id: string;
  week: 1 | 2 | 3 | 4;
  topic: string;
  prompt: string;
  audioFr?: string;
  options: string[];
  answer: string;
}

export type SupportBand = "high" | "medium" | "low";

export interface TeacherConversationNote {
  scene: SceneId;
  character?: string;
  /** Optional speed-friending outing invitation the Teacher wants this friend to offer if the conversation goes well. */
  inviteOuting?: OutingId;
  note: string;
}

export interface DayPlan {
  day: number;
  week: 1 | 2 | 3 | 4;
  lessonId: string;
  remediationLessonIds: string[];
  personalIntro: string;
  unlockedPlaces: PlaceId[];
  unlockedEvents: ("family" | "sick")[];
  conversationNotes: TeacherConversationNote[];
  vocabFocusDomains: VocabDomain[];
  examDue?: "w1" | "w2" | "w3" | "w4" | null;
}

export interface VocabProgressRecord {
  itemId: string;
  box: number;
  correct: number;
  wrong: number;
  lastSeenAt: string | null;
  nextDueAt: string | null;
  usedInConvo: boolean;
}

export interface GrammarErrorRecord {
  id: string;
  day: number;
  topic: string;
  said: string;
  correct: string;
  source: string;
  createdAt: string;
}

export interface TeacherNoteRecord {
  id: string;
  day: number;
  kind: "daily_summary" | "scribe" | "focus" | "exam_review";
  body: string;
  createdAt: string;
}

export interface LearnerFact {
  key: string;
  value: string;
  updatedAt: string;
}

export interface ExamAttemptRecord {
  id: string;
  kind: "placement" | "w1" | "w2" | "w3" | "w4";
  itemIds: string[];
  answers: Record<string, string>;
  scores: {
    overall: number;
    bySection: Partial<Record<ExamSection, number>>;
    feedback?: string;
  };
  startedAt: string;
  finishedAt: string | null;
}

export interface CourseState {
  userId: string;
  startDate: string; // YYYY-MM-DD
  timezone: string;
  placementScore: number | null;
  placementStatus: "pending" | "passed" | "disqualified";
  skippedWeeks: number;
  currentDay: number; // 1..28
  supportBand: SupportBand;
  streak: number;
  bestStreak: number;
  lastCompletedDate: string | null; // YYYY-MM-DD
  unlockedPlaces: PlaceId[];
  unlockedEvents: ("family" | "sick")[];
  lessonsCompleted: string[];
  dayPlans: Record<number, {
    plan: DayPlan;
    grammarDoneAt: string | null;
    sejourDoneAt: string | null;
    vocabDoneAt: string | null;
    examDoneAt: string | null;
    completedAt: string | null;
  }>;
  queuedDayVocabIds: string[];
}

export interface InteractionGrade {
  scene: SceneId;
  day: number;
  ratings: Ratings;
  analysis: string;
  tip: string;
  errors: { topic: string; said: string; correct: string }[];
  vocabUsed: string[];
  facts: { key: string; value: string }[];
  scribe: string;
}
