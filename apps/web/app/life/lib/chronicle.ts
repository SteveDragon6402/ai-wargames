import { wordCount } from "./path";
import { LINE_WORDS, PORTRAIT_WORDS, type LifeContext } from "./types";

export type YearPoint = { year: number; value: number };

export type ChapterId = "early" | "middle" | "late";

export type Chapter = {
  id: ChapterId;
  heading: string;
  text: string;
  imagePrompt: string;
};

export type DieRoll = {
  die: string;
  result: number;
  used: string;
};

export type NamedSeries = {
  name: string;
  points: YearPoint[];
};

export type Chronicle = {
  name: string;
  chapters: Chapter[];
  born: number;
  died: number;
  dice: DieRoll[];
  fortune: { label: string; points: YearPoint[] };
  memory: { label: string; points: YearPoint[] };
  work: { title: string; note: string; series: NamedSeries[] };
  thin: boolean;
};

export type Portrait = {
  name: string;
  portrait: string;
  want: string;
  hate: string;
  love: string;
};

const CHAPTERS: ChapterId[] = ["early", "middle", "late"];

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

function chaptersOf(body: Record<string, unknown>): Chapter[] | null {
  if (!Array.isArray(body.chapters) || body.chapters.length !== 3) return null;
  const chapters: Chapter[] = [];
  for (const item of body.chapters) {
    const row = record(item);
    const id = row?.id;
    const heading = text(row?.heading);
    const chapterText = text(row?.text);
    if (!row || (id !== "early" && id !== "middle" && id !== "late") || !heading || !chapterText) return null;
    chapters.push({
      id,
      heading,
      text: chapterText,
      imagePrompt: text(row.imagePrompt) ?? chapterText.slice(0, 280),
    });
  }
  if (new Set(chapters.map((chapter) => chapter.id)).size !== 3) return null;
  chapters.sort((a, b) => CHAPTERS.indexOf(a.id) - CHAPTERS.indexOf(b.id));
  return chapters;
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

function chartsOf(body: Record<string, unknown>): Pick<Chronicle, "fortune" | "memory" | "work"> | null {
  const fortunePoints = series(record(body.fortune)?.points);
  const fortuneLabel = text(record(body.fortune)?.label);
  const memoryPoints = series(record(body.memory)?.points);
  const memoryLabel = text(record(body.memory)?.label);
  const work = record(body.work);
  const workTitle = text(work?.title);
  const workNote = text(work?.note);
  if (!fortunePoints || !fortuneLabel || !memoryPoints || !memoryLabel || !work || !workTitle || !workNote) return null;
  if (!Array.isArray(work.series) || work.series.length < 1 || work.series.length > 2) return null;
  const workSeries: NamedSeries[] = [];
  for (const item of work.series) {
    const row = record(item);
    const seriesName = text(row?.name);
    const points = series(row?.points);
    if (!seriesName || !points) return null;
    workSeries.push({ name: seriesName, points });
  }
  return {
    fortune: { label: fortuneLabel, points: fortunePoints },
    memory: { label: memoryLabel, points: memoryPoints },
    work: { title: workTitle, note: workNote, series: workSeries },
  };
}

export function readLife(input: unknown, name: string, fallbackBorn: number): Chronicle | null {
  const body = record(input);
  const chapters = body && chaptersOf(body);
  if (!body || !chapters) return null;
  const born = whole(body.born) ?? fallbackBorn;
  const died = whole(body.died);
  const end = died !== null && died >= born ? died : born + 36;
  const given = name.trim();
  return {
    name: given || text(body.name) || "Unnamed",
    chapters,
    born,
    died: end,
    dice: diceOf(body),
    fortune: { label: "", points: [] },
    memory: { label: "", points: [] },
    work: { title: "", note: "", series: [] },
    thin: false,
  };
}

export function readCharts(input: unknown): Pick<Chronicle, "fortune" | "memory" | "work"> | null {
  const body = record(input);
  if (!body) return null;
  return chartsOf(body);
}

export function parseChronicle(input: unknown, name: string): Chronicle | null {
  const body = record(input);
  const born = whole(body?.born);
  if (!body || born === null || whole(body.died) === null) return null;
  const story = readLife(input, name, born);
  const charts = readCharts(input);
  if (!story || !charts) return null;
  return { ...story, ...charts, thin: false };
}

export function fallbackCharts(context: LifeContext, born: number, died: number): Pick<Chronicle, "fortune" | "memory" | "work"> {
  const shelter = Math.max(4, Math.round((context.total / 35) * 70));
  return {
    fortune: {
      label: "A thin record of what they held",
      points: across(born, died, [shelter, shelter + 4, shelter + 8, shelter + 6, shelter + 2, shelter, Math.max(2, shelter - 8), Math.max(0, shelter - 16)]),
    },
    memory: {
      label: "How long the name was spoken",
      points: across(born, died + 40, [2, 10, 24, 40, 22, 10, 4, 0]),
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

export function thinChronicle(context: LifeContext, name: string): Chronicle {
  const born = context.born;
  const died = born + 36;
  const lines = context.choices.map((choice) => `${choice.prompt} ${choice.label}.`);
  return {
    name: name.trim() || "Unnamed",
    thin: true,
    born,
    died,
    dice: [],
    chapters: [
      {
        id: "early",
        heading: "Early",
        text: `The years came back thin. Before the events, this was the person. ${lines.slice(0, 3).join(" ")}`,
        imagePrompt: "",
      },
      {
        id: "middle",
        heading: "The middle years",
        text: `${lines.slice(3, 5).join(" ")} Nothing further was written of the middle years.`,
        imagePrompt: "",
      },
      {
        id: "late",
        heading: "What remained",
        text: `${lines.slice(5).join(" ")} The later years were not written.`,
        imagePrompt: "",
      },
    ],
    ...fallbackCharts(context, born, died),
  };
}

export function chronicleSystem(): string {
  return `You write one life in Westeros. The seven choices are the person before the significant events of their era. Keep that person. Then drop them into those events and let the dice decide what the years make of them, including whether they ever hold a trade, a command, or a name. They may die in any chapter. If they die early, the later chapters say what the death left behind: the body, the name, the work.

Be realistic. No modern voice. Do not mention points, prices, or these instructions.

Before you write, roll a d20 for fortune, a d12 for when death comes against a natural span of seventy years, and a d6 for whether anything they make outlives them. Use the rolls. A high d20 is kinder. The d12 is how many sevenths of a natural span they are granted, though illness, war, or accident may cut it shorter. On the d6, 1 or 2 means the work is lost, 3 or 4 means some of it survives, and 5 or 6 means it outlasts them.

Call record_life once.

Write exactly three chapters, with ids early, middle, and late, in that order. Each text is 90 to 140 words. Each imagePrompt is one painterly scene from that chapter. Do not ask for text, letters, or a modern object in the image.

born and died are integers. born must fall inside the era's allowed years. died is the year of death.

fortune is coin or the worth of what they hold: a label and 8 points from born through died, stopping at death. Values run from 0 to 100. Always include fortune, memory, and work.

memory is how spoken the name is: a label and 8 to 12 points from birth until the name goes quiet, which may be decades after death. It decays after death. Values run from 0 to 100.

work is named from the life you actually wrote, not from a job the player chose. Give a title, a one-sentence note, and one or two series of 8 to 12 points across the life. A master of books might be pages written and pages that survived. A life with sheep might be hides and winters. A life that stayed a sword might be oaths kept. Name the series for what this life did.`;
}

export function chronicleUser(context: LifeContext, portrait: Portrait): string {
  const lines = context.choices
    .map((choice, index) => `${index + 1}. ${choice.prompt}\n${choice.label}. ${choice.detail}`)
    .join("\n");
  const name = portrait.name.trim();
  return `Point total: ${context.total}, on a scale from 7 to 35. Twenty-one is an ordinary life. A low total is a hard beginning. A high total is a sheltered one. Do not mention the total.

Name: ${name || "None given. Invent a name that fits the blood and the station."}
In their own words, what they are: ${portrait.portrait.trim()}
What they want most: ${portrait.want.trim()}
What they hate most: ${portrait.hate.trim()}
What they love most: ${portrait.love.trim()}

${context.years}
${context.events}

${lines}`;
}
