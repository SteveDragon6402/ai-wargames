import {
  BENT,
  CHIPS,
  ERA_CONTEXT,
  ERA_ROWS,
  FOLK_BENT,
  FOLK_HELD,
  FOLK_RAISED,
  FOLK_WORK,
  GREAT_BLOOD,
  GREAT_PLACE,
  GREAT_RAISED,
  HOUSE_HELD,
  KNIGHT_BENT,
  KNIGHT_BESIDE,
  KNIGHT_HELD,
  KNIGHT_RAISED,
  KNIGHT_WHERE,
  LESSER_HOUSES,
  STATIONS,
  TRADE_BENCH,
  TRADE_CRAFT,
  TRADE_HELD,
  TRADE_RAISED,
  TRADE_TOWN,
  folkLand,
} from "./path-data";
import type { Answer, ChipSet, EraId, LifeContext, Option, Price, Question, StationId } from "./types";
import type { Row } from "./path-data";

const PRICES = new Set<Price>([1, 2, 3, 4, 5]);

export function questionOf(id: string, prompt: string, rows: Row[]): Question {
  const options: Option[] = rows.map(([optionId, label, detail, points]) => ({
    id: optionId,
    label,
    detail,
    points,
  }));
  const points = new Set(options.map((option) => option.points));
  if (options.length !== 5 || points.size !== 5 || [...points].some((point) => !PRICES.has(point))) {
    throw new Error(`Each question needs prices 1 through 5 once: ${id}`);
  }
  if (new Set(options.map((option) => option.id)).size !== 5) {
    throw new Error(`Each question needs five different choices: ${id}`);
  }
  return { id, prompt, options };
}

function eraQuestion(): Question {
  return questionOf("born", "When were you born?", ERA_ROWS);
}

function requireOption(question: Question, answer: Answer | undefined): Option {
  if (!answer || answer.questionId !== question.id) {
    throw new Error("That choice does not fit the question.");
  }
  const option = question.options.find((item) => item.id === answer.optionId);
  if (!option) throw new Error("That choice is not one of the five.");
  return option;
}

function eraOf(prior: Answer[]): EraId {
  const option = requireOption(eraQuestion(), prior[0]);
  return option.id as EraId;
}

function stationOf(prior: Answer[]): StationId {
  const option = requireOption(questionAt(1, prior.slice(0, 1)), prior[1]);
  return option.id as StationId;
}

function picked(index: number, prior: Answer[]): Option {
  return requireOption(questionAt(index, prior.slice(0, index)), prior[index]);
}

function bentOf(houseId: string): Row[] {
  const bent = BENT[houseId];
  if (!bent) throw new Error("That house has no bent.");
  return bent;
}

function heldRows(table: Record<string, Row[]>, raisedId: string): Row[] {
  const rows = table[raisedId];
  if (!rows) throw new Error("That raising has nothing to hold.");
  return rows;
}

function houseHeldPrompt(house: string, raisedId: string, lesser: boolean): string {
  if (raisedId === "sword") return lesser ? `What weapon do you carry for ${house}?` : `What weapon did ${house} put in your hand?`;
  if (raisedId === "coin") return lesser ? `How rich are you, out of ${house}?` : `How rich did ${house} leave you?`;
  if (raisedId === "study") return lesser ? `What do you keep for study in ${house}?` : `What did ${house} give you for study?`;
  if (raisedId === "indulgent") return lesser ? `What were you given in ${house}?` : `What has ${house} given you to enjoy?`;
  return lesser ? `What do you own in ${house}?` : `What do you hold in ${house}?`;
}

function greatQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("great-blood", "Which blood?", GREAT_BLOOD[era]);
  const house = picked(2, prior);
  if (index === 3) return questionOf("great-who", `Who are you, in ${house.label}?`, GREAT_PLACE);
  if (index === 4) return questionOf("great-raised", `How did ${house.label} raise you?`, GREAT_RAISED);
  if (index === 5) return questionOf("great-bent", `What is the bent of ${house.label}?`, bentOf(house.id));
  const raised = picked(4, prior);
  return questionOf("great-held", houseHeldPrompt(house.label, raised.id, false), heldRows(HOUSE_HELD, raised.id));
}

function lesserQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("lesser-house", "Which house?", LESSER_HOUSES[era]);
  const house = picked(2, prior);
  if (index === 3) return questionOf("lesser-who", `What is your place in ${house.label}?`, GREAT_PLACE);
  if (index === 4) return questionOf("lesser-raised", `How were you raised in ${house.label}?`, GREAT_RAISED);
  if (index === 5) return questionOf("lesser-bent", `What do you bend toward in ${house.label}?`, bentOf(house.id));
  const raised = picked(4, prior);
  return questionOf("lesser-held", houseHeldPrompt(house.label, raised.id, true), heldRows(HOUSE_HELD, raised.id));
}

function knightQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("knight-where", "Where is the sword?", KNIGHT_WHERE[era]);
  const where = picked(2, prior);
  if (index === 3) return questionOf("knight-beside", `What knight's life is this, in ${where.label}?`, KNIGHT_BESIDE);
  if (index === 4) return questionOf("knight-raised", "How were you raised to the sword?", KNIGHT_RAISED);
  if (index === 5) return questionOf("knight-bent", "What is the bent of that knighthood?", KNIGHT_BENT);
  const raised = picked(4, prior);
  const knightHeld: Record<string, string> = {
    tower: "What of the tower is yours?",
    sword: "What weapon is yours?",
    pay: "What coin from the sword is yours?",
    letters: "What do you own for your letters?",
    soft: "What were you given, and not taught?",
  };
  return questionOf("knight-held", knightHeld[raised.id] ?? "What do you own?", heldRows(KNIGHT_HELD, raised.id));
}

function tradeQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("trade-craft", "What is the craft?", TRADE_CRAFT);
  if (index === 3) return questionOf("trade-town", "Which town holds the shop?", TRADE_TOWN[era]);
  if (index === 4) return questionOf("trade-bench", "What is your place at the bench?", TRADE_BENCH);
  if (index === 5) return questionOf("trade-raised", "How were you raised to the bench?", TRADE_RAISED);
  const raised = picked(5, prior);
  const tradeHeld: Record<string, string> = {
    own: "What of the shop is yours?",
    bench: "What tools are yours?",
    accounts: "What coin from the shop is yours?",
    letters: "What papers are yours?",
    indulgent: "What were you given away from the work?",
  };
  return questionOf("trade-held", tradeHeld[raised.id] ?? "What do you own?", heldRows(TRADE_HELD, raised.id));
}

function folkQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("folk-land", "Whose land?", folkLand(ERA_CONTEXT[era].war));
  if (index === 3) return questionOf("folk-work", "What did your people do?", FOLK_WORK);
  if (index === 4) return questionOf("folk-raised", "How were you raised on that land?", FOLK_RAISED);
  if (index === 5) return questionOf("folk-bent", "What is the bent of your people?", FOLK_BENT);
  const raised = picked(4, prior);
  const folkHeld: Record<string, string> = {
    roof: "What of that roof is yours?",
    work: "What tools of the work are yours?",
    stores: "What have you stored that is yours?",
    prayers: "What holy thing is yours?",
    nothing: "What were you given, with no skill?",
  };
  return questionOf("folk-held", folkHeld[raised.id] ?? "What do you own?", heldRows(FOLK_HELD, raised.id));
}

export function questionAt(index: number, prior: Answer[]): Question {
  if (index < 0 || index > 6) throw new Error("That step is not in this life.");
  if (prior.length < index) throw new Error("Earlier choices are missing.");
  if (index === 0) return eraQuestion();
  const era = eraOf(prior);
  if (index === 1) {
    const station = STATIONS[era];
    return questionOf("station", station.prompt, station.rows);
  }
  const station = stationOf(prior);
  if (station === "great") return greatQuestions(index, prior, era);
  if (station === "lesser") return lesserQuestions(index, prior, era);
  if (station === "knight") return knightQuestions(index, prior, era);
  if (station === "trade") return tradeQuestions(index, prior, era);
  return folkQuestions(index, prior, era);
}

export function lifeContext(answers: Answer[]): LifeContext {
  if (answers.length !== 7) throw new Error("Seven choices are required.");
  const choices = [];
  for (let index = 0; index < 7; index += 1) {
    const question = questionAt(index, answers.slice(0, index));
    const option = requireOption(question, answers[index]);
    choices.push({
      prompt: question.prompt,
      label: option.label,
      detail: option.detail,
      points: option.points,
    });
  }
  const eraId = eraOf(answers);
  const era = ERA_CONTEXT[eraId];
  return {
    total: choices.reduce((sum, choice) => sum + choice.points, 0),
    choices,
    eraId,
    years: era.years,
    events: era.events,
    born: era.born,
  };
}

export function chipsFor(answers: Answer[]): ChipSet {
  const station = stationOf(answers);
  const chips = CHIPS[station];
  return {
    want: [...chips.want],
    hate: [...chips.hate],
    love: [...chips.love],
  };
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
