import {
  BELIEF,
  BENT,
  CHIPS,
  ERA_CONTEXT,
  ERA_ROWS,
  FOLK_BENT,
  FOLK_LINE,
  FOLK_RAISED,
  FOLK_WORK,
  GREAT_BLOOD,
  GREAT_RAISED,
  HOUSE_FLAVOR,
  KNIGHT_BENT,
  KNIGHT_BESIDE,
  KNIGHT_RAISED,
  KNIGHT_WHERE,
  LESSER_BENT,
  LESSER_CARRY,
  LESSER_PLACE,
  LESSER_RAISED,
  STATIONS,
  TRADE_BENCH,
  TRADE_BENT,
  TRADE_CRAFT,
  TRADE_TOWN,
  TRADE_TROUBLE,
  folkLand,
  knightOath,
  type Row,
} from "./path-data";
import type { Answer, ChipSet, EraId, LifeContext, Option, Price, Question, StationId } from "./types";

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

function greatQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("great-blood", "Which blood?", GREAT_BLOOD[era]);
  const house = picked(2, prior);
  const flavor = HOUSE_FLAVOR[house.id];
  if (!flavor) throw new Error("That house has no bent.");
  if (index === 3) return questionOf("great-bent", `What is your bent, in ${house.label}?`, BENT[flavor]);
  if (index === 4) return questionOf("great-raised", `How did ${house.label} raise you?`, GREAT_RAISED);
  if (index === 5) return questionOf("great-holds", "Who holds you, before any of this breaks?", holds(house.label));
  return questionOf("great-believe", `What do you already believe, born to ${house.label}?`, BELIEF[flavor]);
}

function holds(house: string): Row[] {
  return [
    ["sibling", "A sibling", `If ${house} spends one of you, it spends both.`, 5],
    ["parent", "A parent", "Their enemies are already yours.", 4],
    ["sword", "A sworn sword", "Someone whose work is to stand between you and the yard.", 3],
    ["forbidden", "Someone you should not love", "A closed door if anyone learns it. A life, if they do not.", 2],
    ["none", "No one", "You are free, and you will be alone when it starts.", 1],
  ];
}

function lesserQuestions(index: number, prior: Answer[], era: EraId): Question {
  const houses = lesserHouses(era);
  if (index === 2) return questionOf("lesser-house", "Which house?", houses);
  const house = picked(2, prior);
  if (index === 3) return questionOf("lesser-place", `What is your place in ${house.label}?`, LESSER_PLACE);
  if (index === 4) return questionOf("lesser-bent", `What is your bent, in ${house.label}?`, LESSER_BENT);
  if (index === 5) return questionOf("lesser-raised", `How were you raised, in ${house.label}?`, LESSER_RAISED);
  return questionOf("lesser-carry", "What loyalty or grievance do you carry in?", LESSER_CARRY);
}

function lesserHouses(era: EraId): Row[] {
  const houses: Record<EraId, Row[]> = {
    fivekings: [
      ["manderly", "House Manderly of White Harbor", "A city, silver, and room a northern house rarely has.", 5],
      ["royce", "House Royce of Runestone", "Bronze, and the Bloody Gate between you and the war.", 4],
      ["reed", "House Reed of the Neck", "Secret country. Strange room, and few friends outside the bog.", 3],
      ["frey", "House Frey of the Twins", "The crossing is power. It is also a trap.", 2],
      ["bolton", "House Bolton of the Dreadfort", "A knife of a house. Little room to be anything else.", 1],
    ],
    robert: [
      ["mallister", "House Mallister of Seagard", "A respected west-coast house, not yet spent by the war.", 5],
      ["royce", "House Royce of Runestone", "The gate, and a lord who helps start the rebellion.", 4],
      ["dustin", "House Dustin of Barrowton", "Northern, and the war will take their riders.", 3],
      ["connington", "House Connington of Griffin's Roost", "On the dragon's side. The roost does not survive the choice cleanly.", 2],
      ["darry", "House Darry", "Loyal to the dragons. The war guts houses that stay loyal.", 1],
    ],
    dance: [
      ["manderly", "House Manderly of White Harbor", "Far north, a city, and late to the dragons.", 5],
      ["blackwood", "House Blackwood of Raventree", "An old gods house in the riverlands, with a side still to pick.", 4],
      ["celtigar", "House Celtigar of Claw Isle", "Close to the dragons, and small enough to be a retainer.", 3],
      ["bracken", "House Bracken of Stone Hedge", "The old feud, and a riverlands war on the doorstep.", 2],
      ["darklyn", "House Darklyn of Duskendale", "The crownlands. This war burns towns like Duskendale.", 1],
    ],
    blackfyre: [
      ["reyne", "House Reyne of Castamere", "Rich, ambitious, and not yet broken.", 5],
      ["yronwood", "House Yronwood", "Dornish power with room to pick a pretender or refuse one.", 4],
      ["peake", "House Peake", "Three castles, and a name the rebels spend.", 3],
      ["osgrey", "House Osgrey", "A fading house. A tower, a wood, and a memory of more.", 2],
      ["butterwell", "House Butterwell of Whitewalls", "A wedding house. The rebellions know how to use a feast.", 1],
    ],
    heroes: [
      ["royce", "the Royces of the mountains", "Bronze kings behind a wall of stone.", 5],
      ["blackwood", "the Blackwoods", "An old line, not the greatest, still remembered.", 4],
      ["reed", "the Reeds of the Neck", "The bog keeps them. It also hides them.", 3],
      ["flint", "the Flints of the mountains", "Hard country, and little surplus to become anything else.", 2],
      ["bolton", "the Boltons", "Flayers. The story is already a closed one.", 1],
    ],
  };
  return houses[era];
}

function knightQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("knight-where", "Where is the tower, or the road?", KNIGHT_WHERE[era]);
  const where = picked(2, prior);
  if (index === 3) {
    return questionOf("knight-beside", `What knight's life were you born beside, in ${where.label}?`, KNIGHT_BESIDE);
  }
  if (index === 4) {
    return questionOf("knight-raised", "How were you raised, before any lord owned your sword?", KNIGHT_RAISED);
  }
  if (index === 5) return questionOf("knight-bent", "What is your bent, with no keep to answer to?", KNIGHT_BENT);
  return questionOf(
    "knight-oath",
    "What oath do you carry, or refuse, before the war looks for you?",
    knightOath(ERA_CONTEXT[era].war),
  );
}

function tradeQuestions(index: number, prior: Answer[], era: EraId): Question {
  if (index === 2) return questionOf("trade-craft", "What is the craft?", TRADE_CRAFT);
  if (index === 3) return questionOf("trade-town", "Which town holds the shop?", TRADE_TOWN[era]);
  if (index === 4) return questionOf("trade-bench", "What is your place at the bench?", TRADE_BENCH);
  if (index === 5) return questionOf("trade-bent", "What are you bent toward, besides the work?", TRADE_BENT);
  return questionOf("trade-trouble", "What trouble is already in the shop?", TRADE_TROUBLE);
}

function folkQuestions(index: number, prior: Answer[], era: EraId): Question {
  const war = ERA_CONTEXT[era].war;
  if (index === 2) return questionOf("folk-land", "Whose land?", folkLand(war));
  if (index === 3) return questionOf("folk-work", "What did your people do?", FOLK_WORK);
  if (index === 4) return questionOf("folk-raised", "How were you raised, on someone else's land?", FOLK_RAISED);
  if (index === 5) return questionOf("folk-bent", "What are you bent toward, when the work is already decided?", FOLK_BENT);
  return questionOf("folk-line", "What will you not do, or who will you not leave?", FOLK_LINE);
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
