export type Price = 1 | 2 | 3 | 4 | 5;

export type EraId = "robert" | "conciliator" | "blackfyre" | "dance" | "fivekings";

export type StationId = "knight" | "lesser" | "great" | "trade" | "smallfolk";

export type Option = {
  id: string;
  label: string;
  detail: string;
  points: Price;
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
  points: Price;
};

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

export const STEP_COUNT = 7;
export const ORDINARY_LIFE = 21;
export const PORTRAIT_WORDS = 20;
export const LINE_WORDS = 10;
