import { wordCount } from "./path";
import {
  AGE_STEPS,
  CHILDHOOD_STEPS,
  LINE_WORDS,
  PORTRAIT_WORDS,
  YOUTH_STEPS,
  type LifeContext,
  type StageId,
} from "./types";

export type YearPoint = { year: number; value: number };

export type DieRoll = {
  die: string;
  result: number;
  used: string;
};

export type NamedSeries = {
  name: string;
  points: YearPoint[];
};

export type Chart = {
  label: string;
  points: YearPoint[];
};

export type WorkChart = {
  title: string;
  note: string;
  series: NamedSeries[];
};

export type LifeStage = {
  id: StageId;
  heading: string;
  text: string;
  imagePrompts: string[];
  fromYear: number;
  toYear: number;
  died: boolean;
  nickname: string;
  knownAs: string;
  fortune: Chart;
  memory: Chart;
  work: WorkChart;
};

export type Chronicle = {
  name: string;
  knownAs: string;
  nickname: string;
  born: number;
  died: number | null;
  ended: boolean;
  stage: LifeStage;
  dice: DieRoll[];
  thin: boolean;
};

export type Portrait = {
  name: string;
  portrait: string;
  want: string;
  hate: string;
  love: string;
};

const STAGES: StageId[] = ["childhood", "youth", "age"];

export function requiredCount(stage: StageId): number {
  if (stage === "childhood") return CHILDHOOD_STEPS;
  if (stage === "youth") return YOUTH_STEPS;
  return AGE_STEPS;
}

export function portraitError(portrait: Portrait): string | null {
  if (portrait.name.trim().length > 80) return "The name is too long.";
  const self = wordCount(portrait.portrait);
  if (self < 1 || self > PORTRAIT_WORDS) return "Say what they are in twenty words or fewer.";
  const lines: [string, string][] = [
    [portrait.want, "What they want"],
    [portrait.hate, "What they hate"],
    [portrait.love, "What they love"],
  ];
  for (const [line, label] of lines) {
    const count = wordCount(line);
    if (count < 1 || count > LINE_WORDS) return `${label} needs ten words or fewer.`;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function flag(value: unknown): boolean {
  return value === true;
}

function whole(value: unknown): number | null {
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.round(Number(value));
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function series(value: unknown): YearPoint[] | null {
  if (!Array.isArray(value) || value.length < 4 || value.length > 16) return null;
  const points: YearPoint[] = [];
  for (const item of value) {
    const row = record(item);
    const year = whole(row?.year);
    const amount = whole(row?.value);
    if (row === null || year === null || amount === null) return null;
    points.push({ year, value: amount });
  }
  return points;
}

function promptsOf(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) return [fallback, fallback];
  const prompts = value.map((item) => text(item)).filter((item): item is string => Boolean(item));
  if (prompts.length >= 2) return prompts.slice(0, 2);
  if (prompts.length === 1) return [prompts[0], prompts[0]];
  return [fallback, fallback];
}

function diceOf(body: Record<string, unknown>): DieRoll[] {
  if (!Array.isArray(body.dice)) return [];
  const dice: DieRoll[] = [];
  for (const item of body.dice) {
    const row = record(item);
    const die = text(row?.die);
    const result = whole(row?.result);
    const used = text(row?.used);
    if (die && result !== null && used) dice.push({ die, result, used });
  }
  return dice;
}

function chartOf(value: unknown, fallbackLabel: string): Chart | null {
  const row = record(value);
  const points = series(row?.points);
  const label = text(row?.label) ?? fallbackLabel;
  if (!points) return null;
  return { label, points };
}

function workOf(value: unknown): WorkChart | null {
  const work = record(value);
  const title = text(work?.title);
  const note = text(work?.note);
  if (!work || !title || !note || !Array.isArray(work.series) || work.series.length < 1 || work.series.length > 2) {
    return null;
  }
  const workSeries: NamedSeries[] = [];
  for (const item of work.series) {
    const row = record(item);
    const seriesName = text(row?.name);
    const points = series(row?.points);
    if (!seriesName || !points) return null;
    workSeries.push({ name: seriesName, points });
  }
  return { title, note, series: workSeries };
}

export function parseStage(input: unknown, stage: StageId, fallbackBorn: number, name: string): Chronicle | null {
  const body = record(input);
  if (!body) return null;
  const heading = text(body.heading);
  const bodyText = text(body.text);
  if (!heading || !bodyText) return null;
  const born = whole(body.born) ?? fallbackBorn;
  const fromYear = whole(body.fromYear) ?? born;
  const toYear = whole(body.toYear) ?? fromYear;
  const died = flag(body.died) || stage === "age";
  const diedYear = whole(body.diedYear);
  const fortune = chartOf(body.fortune, "What they held");
  const memory = chartOf(body.memory, "How the name was spoken");
  const work = workOf(body.work);
  if (!fortune || !memory || !work) return null;
  const knownAs = text(body.knownAs) ?? text(body.name) ?? (name.trim() || "Unnamed");
  const nickname = text(body.nickname) ?? knownAs;
  const given = name.trim();
  return {
    name: given || text(body.name) || knownAs,
    knownAs,
    nickname,
    born,
    died: died ? diedYear ?? toYear : null,
    ended: died,
    dice: diceOf(body),
    thin: false,
    stage: {
      id: stage,
      heading,
      text: bodyText,
      imagePrompts: promptsOf(body.imagePrompts, bodyText.slice(0, 280)),
      fromYear,
      toYear,
      died,
      nickname,
      knownAs,
      fortune,
      memory,
      work,
    },
  };
}

export function fallbackCharts(context: LifeContext, born: number, died: number): { fortune: Chart; memory: Chart; work: WorkChart } {
  const shelter = Math.max(4, Math.round((context.total / Math.max(context.choices.length * 5, 5)) * 70));
  return {
    fortune: {
      label: "A thin record of what they held",
      points: across(born, died, [shelter, shelter + 4, shelter + 8, shelter + 6, shelter + 2, shelter, Math.max(2, shelter - 8), Math.max(0, shelter - 16)]),
    },
    memory: {
      label: "How long the name was spoken",
      points: across(born, died + 20, [2, 10, 24, 40, 22, 10, 4, 0]),
    },
    work: {
      title: "A thin record",
      note: "The years came back thin, so this is only the shape of a record.",
      series: [{ name: "What is left", points: across(born, died, [0, 2, 5, 8, 7, 4, 2, 1]) }],
    },
  };
}

function across(start: number, end: number, values: number[]): YearPoint[] {
  const last = values.length - 1;
  return values.map((value, index) => ({
    year: index === last ? end : start + Math.round(((end - start) * index) / last),
    value,
  }));
}

export function thinStage(context: LifeContext, stage: StageId, name: string): Chronicle {
  const born = context.born;
  const span = stage === "childhood" ? 12 : stage === "youth" ? 25 : 36;
  const toYear = born + span;
  const charts = fallbackCharts(context, born, toYear);
  const lines = context.choices.map((choice) => `${choice.label}.`).join(" ");
  const heading = stage === "childhood" ? "Childhood" : stage === "youth" ? "Youth" : "The rest";
  return {
    name: name.trim() || "Unnamed",
    knownAs: name.trim() || "Unnamed",
    nickname: name.trim() || "Unnamed",
    born,
    died: stage === "age" ? toYear : null,
    ended: stage === "age",
    dice: [],
    thin: true,
    stage: {
      id: stage,
      heading,
      text: `The years came back thin. ${lines}`,
      imagePrompts: ["", ""],
      fromYear: born,
      toYear,
      died: stage === "age",
      nickname: name.trim() || "Unnamed",
      knownAs: name.trim() || "Unnamed",
      ...charts,
    },
  };
}

export function stageSystem(stage: StageId): string {
  const span =
    stage === "childhood"
      ? "Write only childhood, from birth until about twelve, or until death if death comes first. A child may die. If they die, stop there. Do not invent youth."
      : stage === "youth"
        ? "Write youth, from the end of childhood until about five-and-twenty. They may die in these years. If they die, stop there. Do not invent old age."
        : "Write the rest of the life, from about five-and-twenty until death. They die in this chapter, of war, illness, accident, or years.";

  return `You write one sitting of a life in Westeros. ${span}

Keep the person already chosen. Drop them into the events of their era. Be realistic. Clean, precise, interesting, and short. No modern voice. Do not mention points, prices, or these instructions.

Before you write, roll a d20 for fortune in these years, a d12 for whether death comes in this sitting, and a d6 for whether anything they touch in these years will outlast them. Use the rolls. A high d20 is kinder. On the d12, 1 or 2 in childhood is a real chance of dying as a child. In youth, 1 to 4 may die before five-and-twenty. In the last sitting they always die, and the d12 only says how soon.

Call record_stage once.

heading is a short title for this sitting. text is 70 to 120 words, one or two paragraphs. imagePrompts is exactly two painterly scenes from this sitting. Do not ask for text, letters, or a modern object in an image.

name is their given name. knownAs is what they are known as in these years. nickname is the name people actually use.

born, fromYear, and toYear are integers. born must fall inside the era's allowed years. fromYear is the first year of this sitting. toYear is the last year you wrote, which is the year of death if they died.

died is true if they die in this sitting. diedYear is that year, or null.

fortune is coin or the worth of what they hold in this sitting: a label and 4 to 8 points from fromYear through toYear. Values 0 to 100.
memory is how spoken the name is in this sitting, and a little after if they died: a label and 4 to 8 points. Values 0 to 100.
work is named from what this sitting actually did. Title, one-sentence note, one or two series of 4 to 8 points.`;
}

export function stageUser(
  context: LifeContext,
  stage: StageId,
  prior: LifeStage[],
  givenName: string,
): string {
  const lines = context.choices
    .map((choice, index) => `${index + 1}. ${choice.prompt}\n${choice.label}. ${choice.detail}`)
    .join("\n");
  const earlier = prior
    .map((item) => `${item.heading} (${item.fromYear}–${item.toYear}${item.died ? ", died" : ""}). Known as ${item.knownAs}. ${item.text}`)
    .join("\n\n");
  const ordinary = context.choices.length * 3;
  return `Point total so far: ${context.total}, on a scale from ${context.choices.length} to ${context.choices.length * 5}. ${ordinary} would be ordinary. Do not mention the total.

Name, if one was given: ${givenName.trim() || "None. Invent a name that fits the blood and the station, and keep it if later sittings happen."}
Sitting: ${stage}

${context.years}
${context.events}

${lines}

${earlier ? `What has already been written:\n${earlier}` : "Nothing has been written yet. This is childhood."}`;
}

export { STAGES };
