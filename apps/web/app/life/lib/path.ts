import {
  BENT,
  CHIPS,
  ERA_CONTEXT,
  ERA_ROWS,
  FOLK_BENT,
  FOLK_HELD,
  FOLK_RAISED,
  GREAT_BLOOD,
  GREAT_RAISED,
  HOUSE_HELD,
  KNIGHT_BENT,
  KNIGHT_HELD,
  KNIGHT_RAISED,
  KNIGHT_WHERE,
  LESSER_HOUSES,
  STATIONS,
  TRADE_BENT,
  TRADE_CRAFT,
  TRADE_HELD,
  TRADE_RAISED,
  fearOf,
  folkLand,
  purposeOf,
} from "./path-data";
import type { Answer, ChipSet, EraId, LifeContext, Option, Price, Question, StationId } from "./types";
import type { Row } from "./path-data";

function isPrice(value: Option["points"]): value is Price {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function questionOf(id: string, prompt: string, rows: Row[]): Question {
  const options: Option[] = rows.map(([optionId, label, detail, points]) => ({
    id: optionId,
    label,
    detail,
    points,
  }));
  const points = new Set(options.map((option) => option.points));
  if (options.length !== 5 || points.size !== 5 || ![...points].every(isPrice)) {
    throw new Error(`Each question needs prices 1 through 5 once: ${id}`);
  }
  if (new Set(options.map((option) => option.id)).size !== 5) {
    throw new Error(`Each question needs five different choices: ${id}`);
  }
  return { id, prompt, options };
}

function eraQuestion(): Question {
  const options: Option[] = ERA_ROWS.map(([id, label, detail]) => ({
    id,
    label,
    detail,
    points: 0,
  }));
  if (options.length !== 5 || new Set(options.map((option) => option.id)).size !== 5) {
    throw new Error("Each question needs five different choices: born");
  }
  return { id: "born", prompt: "When were you born?", options };
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
  if (raisedId === "sword") return lesser ? `What were you given to carry for ${house}?` : `What were you given to carry, of ${house}?`;
  if (raisedId === "coin") return lesser ? `What coin were you given, out of ${house}?` : `What coin did ${house} give you?`;
  if (raisedId === "study") return lesser ? `What were you given for study in ${house}?` : `What did ${house} give you for study?`;
  if (raisedId === "indulgent") return lesser ? `What were you given in ${house}?` : `What has ${house} given you?`;
  return lesser ? `What were you given in ${house}?` : `What were you given, of ${house}?`;
}

function greatQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("great-blood", "Which house?", GREAT_BLOOD[era]);
  const house = picked(2, prior);
  if (index === 3) return questionOf("great-raised", `How were you raised, in ${house.label}?`, GREAT_RAISED);
  if (index === 4) return questionOf("great-bent", `Which line did you take from ${house.label}?`, bentOf(house.id));
  const raised = picked(3, prior);
  if (index === 5) return questionOf("great-held", houseHeldPrompt(house.label, raised.id, false), heldRows(HOUSE_HELD, raised.id));
  if (index === 6) return questionOf("great-aim", "What did you decide to pursue?", purposeOf("great", raised.id));
  return questionOf("great-fear", "What do you fear?", fearOf(picked(6, prior).id));
}

function lesserQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("lesser-house", "Which house?", LESSER_HOUSES[era]);
  const house = picked(2, prior);
  if (index === 3) return questionOf("lesser-raised", `How were you raised, in ${house.label}?`, GREAT_RAISED);
  if (index === 4) return questionOf("lesser-bent", `Which line did you take from ${house.label}?`, bentOf(house.id));
  const raised = picked(3, prior);
  if (index === 5) return questionOf("lesser-held", houseHeldPrompt(house.label, raised.id, true), heldRows(HOUSE_HELD, raised.id));
  if (index === 6) return questionOf("lesser-aim", "What did you decide to pursue?", purposeOf("lesser", raised.id));
  return questionOf("lesser-fear", "What do you fear?", fearOf(picked(6, prior).id));
}

function knightQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("knight-where", "Where, in the realm?", KNIGHT_WHERE[era]);
  if (index === 3) return questionOf("knight-raised", "How were you raised?", KNIGHT_RAISED);
  if (index === 4) return questionOf("knight-bent", "Which line did you take from that knighthood?", KNIGHT_BENT);
  const raised = picked(3, prior);
  if (index === 5) {
    const knightHeld: Record<string, string> = {
      tower: "What were you given of the tower?",
      sword: "What weapon were you given?",
      pay: "What coin from the sword were you given?",
      letters: "What were you given for your letters?",
      soft: "What were you given, and not taught?",
    };
    return questionOf("knight-held", knightHeld[raised.id] ?? "What were you given?", heldRows(KNIGHT_HELD, raised.id));
  }
  if (index === 6) return questionOf("knight-aim", "What did you decide to pursue?", purposeOf("knight", raised.id));
  return questionOf("knight-fear", "What do you fear?", fearOf(picked(6, prior).id));
}

function tradeQuestions(index: number, prior: Answer[]): Question {
  if (index === 2) return questionOf("trade-craft", "What was the work?", TRADE_CRAFT);
  if (index === 3) return questionOf("trade-raised", "How were you raised, at the bench?", TRADE_RAISED);
  if (index === 4) return questionOf("trade-bent", "Which line did you take from the work?", TRADE_BENT);
  const raised = picked(3, prior);
  if (index === 5) {
    const tradeHeld: Record<string, string> = {
      own: "What of the shop were you given?",
      bench: "What tools were you given?",
      accounts: "What coin from the shop were you given?",
      letters: "What papers were you given?",
      indulgent: "What were you given away from the work?",
    };
    return questionOf("trade-held", tradeHeld[raised.id] ?? "What were you given?", heldRows(TRADE_HELD, raised.id));
  }
  if (index === 6) return questionOf("trade-aim", "What did you decide to pursue?", purposeOf("trade", raised.id));
  return questionOf("trade-fear", "What do you fear?", fearOf(picked(6, prior).id));
}

function folkQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("folk-land", "On whose land?", folkLand(ERA_CONTEXT[era].war));
  if (index === 3) return questionOf("folk-raised", "How were you raised?", FOLK_RAISED);
  if (index === 4) return questionOf("folk-bent", "Which line did you take from your people?", FOLK_BENT);
  const raised = picked(3, prior);
  if (index === 5) {
    const folkHeld: Record<string, string> = {
      roof: "What of that roof were you given?",
      work: "What tools of the work were you given?",
      stores: "What stores were you given?",
      prayers: "What holy thing were you given?",
      nothing: "What were you given, with no skill?",
    };
    return questionOf("folk-held", folkHeld[raised.id] ?? "What were you given?", heldRows(FOLK_HELD, raised.id));
  }
  if (index === 6) return questionOf("folk-aim", "What did you decide to pursue?", purposeOf("smallfolk", raised.id));
  return questionOf("folk-fear", "What do you fear?", fearOf(picked(6, prior).id));
}

export function questionAt(index: number, prior: Answer[]): Question {
  if (index < 0 || index > 7) throw new Error("That step is not in this life.");
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
  if (station === "trade") return tradeQuestions(index, prior);
  return folkQuestions(index, prior, era);
}

export function lifeContext(answers: Answer[]): LifeContext {
  if (answers.length < 1 || answers.length > 8) throw new Error("Those choices do not make a life.");
  const choices = [];
  for (let index = 0; index < answers.length; index += 1) {
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
