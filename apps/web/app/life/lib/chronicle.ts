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

export type ChartKind = "running" | "standing";

export type YearPoint = {
  year: number;
  value: number;
  note: string;
};

export type Adjudication = {
  question: string;
  chance: number;
  roll: number;
  happened: boolean;
};

export type LifeChartRecord = {
  title: string;
  unit: string;
  why: string;
  kind: ChartKind;
  points: YearPoint[];
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
  charts: LifeChartRecord[];
};

export type Chronicle = {
  name: string;
  knownAs: string;
  nickname: string;
  born: number;
  died: number | null;
  ended: boolean;
  stage: LifeStage;
  dice: Adjudication[];
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

function kindOf(value: unknown): ChartKind | null {
  if (value === "running" || value === "standing") return value;
  return null;
}

function series(value: unknown): YearPoint[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) return null;
  const points: YearPoint[] = [];
  for (const item of value) {
    const row = record(item);
    const year = whole(row?.year);
    const amount = whole(row?.value);
    if (row === null || year === null || amount === null || amount < 0 || amount > 10_000_000) return null;
    points.push({ year, value: amount, note: text(row?.note) ?? "That year." });
  }
  return points;
}

export function readingAt(points: YearPoint[], year: number): YearPoint {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return { year, value: 0, note: "" };
  if (year <= first.year) return { ...first, year };
  if (year >= last.year) return { ...last, year };
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (year > end.year) continue;
    const span = end.year - start.year;
    const t = span === 0 ? 0 : (year - start.year) / span;
    return {
      year,
      value: Math.round(start.value + (end.value - start.value) * t),
      note: year < end.year ? start.note : end.note,
    };
  }
  return { ...last, year };
}

function promptsOf(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) return [fallback, fallback];
  const prompts = value.map((item) => text(item)).filter((item): item is string => Boolean(item));
  if (prompts.length >= 2) return prompts.slice(0, 2);
  if (prompts.length === 1) return [prompts[0], prompts[0]];
  return [fallback, fallback];
}

function chartRecord(value: unknown): LifeChartRecord | null {
  const row = record(value);
  const title = text(row?.title);
  const points = series(row?.points);
  if (!row || !title || !points) return null;
  return {
    title,
    unit: text(row?.unit) ?? "people",
    why: text(row?.why) ?? title,
    kind: kindOf(row?.kind) ?? "standing",
    points,
  };
}

function chartsOf(value: unknown): LifeChartRecord[] {
  if (!Array.isArray(value)) return [];
  const charts: LifeChartRecord[] = [];
  for (const item of value) {
    if (charts.length >= 2) break;
    const chart = chartRecord(item);
    if (chart) charts.push(chart);
  }
  return charts;
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
  const charts = chartsOf(body.charts);
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
    dice: [],
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
      charts,
    },
  };
}

export function thinStage(context: LifeContext, stage: StageId, name: string): Chronicle {
  const born = context.born;
  const span = stage === "childhood" ? 12 : stage === "youth" ? 25 : 36;
  const toYear = born + span;
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
      charts: [],
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

Keep the person already chosen. Drop them into the events of their era. Be realistic. Name places, people, and the thing that moved. Clean, precise, interesting, and short. No modern voice. Do not mention points, prices, scores, or these instructions.
${
  stage === "childhood"
    ? "Childhood is who they are: where they were born, how they were raised, and the line they took. Write the child those choices make."
    : stage === "youth"
      ? "Youth is the thing they were given and the purpose they chose. Write those years around the gift and the pursuit."
      : "The last choice is what they fear. Let that fear drive these years until they die."
}

When you are sure, write it. When you are not sure — a fever, a horse, a slight, whether a child lives through winter — do not invent the outcome. Call adjudicate with the thing that might happen and the chance in a hundred that it does. A fair die is rolled for you. Use the yes or no you are given. You may adjudicate more than once. Then call record_stage.

Do not roll for a general fortune, or for how the sitting will feel. Do not adjudicate things already decided by the choices.

In the last sitting they die. Adjudicate only how, or how soon, if you are unsure. In childhood and youth they may die, but only if you adjudicate it and the roll says yes.

Call record_stage once you know the sitting.

heading is a short title for this sitting. text is 90 to 160 words, one or two paragraphs. imagePrompts is exactly two painterly scenes from this sitting. Do not ask for text, letters, or a modern object in an image.

name is their given name. knownAs is what they are known as in these years. nickname is the name people actually use.

born, fromYear, and toYear are integers. born must fall inside the era's allowed years. fromYear is the first year of this sitting. toYear is the last year you wrote, which is the year of death if they died.

died is true if they die in this sitting. diedYear is that year, or null.

charts is 0, 1, or 2 records. Zero is correct when nothing measurable moved in these years. Do not invent a chart to fill a slot. Never chart a feeling on a 0–100 scale. Never title a chart fortune, power, or how spoken the name is. Chart the thing itself.

Each chart:
- title: the quantity in plain words, for example Miles from Lannisport, or People who can repeat the name.
- unit: a real unit, for example miles, people, men, stags, dragons.
- kind: running if the number accumulates (miles ridden, coin taken, letters sent). standing if it is how many there are in that year (people who remember him, men who ride with him, mouths in the hall).
- why: one sentence that answers why this number exists. If people speak the name, say what they heard — a song, a hanging, a wedding, a raid. If miles, say the road.
- points: 2 to 8 years from fromYear through toYear. value is the real count in that unit, not 0–100. note is one short sentence of what happened that year that moved the number.`;
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
    .map((item) => {
      const measured = item.charts.map((chart) => chart.title).join("; ");
      return `${item.heading} (${item.fromYear}–${item.toYear}${item.died ? ", died" : ""}). Known as ${item.knownAs}. ${item.text}${measured ? ` Already measured: ${measured}.` : ""}`;
    })
    .join("\n\n");
  const priced = context.choices.filter((choice) => choice.points > 0).length;
  const ordinary = priced * 3;
  return `Point total so far: ${context.total}, on a scale from ${priced} to ${priced * 5}. ${ordinary} would be ordinary. The first choice is the era, and does not count. Do not mention the total.

Name, if one was given: ${givenName.trim() || "None. Invent a name that fits the blood and the station, and keep it if later sittings happen."}
Sitting: ${stage}

${context.years}
${context.events}

${lines}

${earlier ? `What has already been written:\n${earlier}` : "Nothing has been written yet. This is childhood."}`;
}

export { STAGES };
