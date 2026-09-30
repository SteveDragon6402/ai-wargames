export type Price = 1 | 2 | 3 | 4 | 5;

export type EraId = "robert" | "conciliator" | "blackfyre" | "dance" | "fivekings";

export type StationId = "knight" | "lesser" | "great" | "trade" | "smallfolk";

export type Option = {
  id: string;
  label: string;
  detail: string;
  points: Price | 0;
};

export type Question = {
  id: string;
  prompt: string;
  options: Option[];
};

export type Answer = {
  questionId: string;
  optionId: string;
};

export type LifeChoice = {
  prompt: string;
  label: string;
  detail: string;
  points: Price | 0;
};

export type StageId = "childhood" | "youth" | "age";

export type LifeContext = {
  total: number;
  choices: LifeChoice[];
  eraId: EraId;
  years: string;
  events: string;
  born: number;
};

export type ChipSet = {
  want: string[];
  hate: string[];
  love: string[];
};

export const STEP_COUNT = 8;
export const CHILDHOOD_STEPS = 5;
export const YOUTH_STEPS = 7;
export const AGE_STEPS = 8;
export const ORDINARY_LIFE = 21;
export const PORTRAIT_WORDS = 20;
export const LINE_WORDS = 10;

export function stageForCount(count: number): StageId | null {
  if (count === CHILDHOOD_STEPS) return "childhood";
  if (count === YOUTH_STEPS) return "youth";
  if (count === AGE_STEPS) return "age";
  return null;
}
