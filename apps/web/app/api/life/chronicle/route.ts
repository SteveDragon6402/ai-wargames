import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { rollAdjudication, tellAdjudication } from "../../../life/lib/adjudicate";
import { parseStage, requiredCount, stageSystem, stageUser, type Adjudication, type LifeStage } from "../../../life/lib/chronicle";
import { lifeContext } from "../../../life/lib/path";
import { anthropicClient, createLifeMessage, toolUses } from "../../mercenary/model";
import type { Answer, StageId } from "../../../life/lib/types";

export const maxDuration = 120;

const MAX_ROUNDS = 8;
const MAX_ROLLS = 4;

const ADJUDICATE: Anthropic.Tool = {
  name: "adjudicate",
  description:
    "When you are not sure what happens, set the chance that it does. A fair hundred-sided die is rolled in Python. Do not invent the number.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The thing that might happen, in a short phrase. For example: the fever takes her.",
      },
      chance: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Chance in a hundred that it happens.",
      },
    },
    required: ["question", "chance"],
  },
};

const RECORD: Anthropic.Tool = {
  name: "record_stage",
  description: "Record this sitting of the life once you know what happened.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      knownAs: { type: "string" },
      nickname: { type: "string" },
      heading: { type: "string" },
      text: { type: "string" },
      imagePrompts: {
        type: "array",
        items: { type: "string" },
        description:
          "Exactly two scenes. First: the person close and in motion. Second: the place, wide, with weather. Describe subject, action, setting, and light. Do not name an art style.",
      },
      born: { type: "integer" },
      fromYear: { type: "integer" },
      toYear: { type: "integer" },
      died: { type: "boolean" },
      diedYear: { type: ["integer", "null"] },
      charts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            unit: { type: "string" },
            why: { type: "string" },
            kind: { type: "string", enum: ["running", "standing"] },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  year: { type: "integer" },
                  value: { type: "integer" },
                  note: { type: "string" },
                },
                required: ["year", "value", "note"],
              },
            },
          },
          required: ["title", "unit", "why", "kind", "points"],
        },
      },
    },
    required: ["name", "knownAs", "nickname", "heading", "text", "imagePrompts", "born", "fromYear", "toYear", "died", "charts"],
  },
};

function answersOf(value: unknown, count: number): Answer[] | null {
  if (!Array.isArray(value) || value.length !== count) return null;
  const answers: Answer[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const row = item as { questionId?: unknown; optionId?: unknown };
    if (typeof row.questionId !== "string" || typeof row.optionId !== "string") return null;
    answers.push({ questionId: row.questionId, optionId: row.optionId });
  }
  return answers;
}

function stageOf(value: unknown): StageId | null {
  if (value === "childhood" || value === "youth" || value === "age") return value;
  return null;
}

function priorOf(value: unknown): LifeStage[] {
  if (!Array.isArray(value)) return [];
  const prior: LifeStage[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as LifeStage;
    if (typeof row.heading === "string" && typeof row.text === "string") prior.push(row);
  }
  return prior;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    answers?: unknown;
    stage?: unknown;
    name?: unknown;
    prior?: unknown;
  } | null;
  const stage = stageOf(body?.stage);
  if (!stage) return NextResponse.json({ error: "That sitting of the life is missing." }, { status: 400 });
  const answers = answersOf(body?.answers, requiredCount(stage));
  if (!answers) return NextResponse.json({ error: "The life is missing." }, { status: 400 });
  const givenName = typeof body?.name === "string" ? body.name : "";

  let context;
  try {
    context = lifeContext(answers);
  } catch {
    return NextResponse.json({ error: "Those choices do not make a life." }, { status: 400 });
  }

  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const prior = priorOf(body?.prior);
  const user = stageUser(context, stage, prior, givenName);
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: user }];
  const dice: Adjudication[] = [];
  let lastError: string | null = null;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const mustRecord = dice.length >= MAX_ROLLS || round >= MAX_ROUNDS - 2;
    const response = await createLifeMessage(client, {
      max_tokens: 8192,
      system: stageSystem(stage),
      tools: [ADJUDICATE, RECORD],
      tool_choice: mustRecord ? { type: "tool", name: "record_stage" } : { type: "any" },
      messages,
    });
    if ("error" in response) {
      lastError = response.error;
      break;
    }

    const calls = toolUses(response);
    if (calls.length === 0) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: "Call adjudicate if you are unsure, otherwise call record_stage.",
      });
      continue;
    }

    const rolledThisTurn: Adjudication[] = [];
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    let recorded: ReturnType<typeof parseStage> = null;

    for (const call of calls) {
      if (call.name !== "adjudicate") continue;
      if (mustRecord || dice.length + rolledThisTurn.length >= MAX_ROLLS) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: "No more rolls. Call record_stage with the sitting you now know.",
        });
        continue;
      }
      const rolled = rollAdjudication(call.input);
      if ("error" in rolled) {
        results.push({ type: "tool_result", tool_use_id: call.id, content: rolled.error });
        continue;
      }
      rolledThisTurn.push(rolled);
      results.push({ type: "tool_result", tool_use_id: call.id, content: tellAdjudication(rolled) });
    }

    for (const call of calls) {
      if (call.name === "adjudicate") continue;
      if (call.name === "record_stage") {
        if (rolledThisTurn.length > 0) {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: "Use the rolls you just received, then call record_stage.",
          });
          continue;
        }
        recorded = parseStage(call.input, stage, context.born, givenName);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: recorded
            ? "Recorded."
            : "That record was incomplete. Call record_stage once with every required field, including two imagePrompts and charts (zero to two records).",
        });
        continue;
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: "Unknown tool." });
    }

    dice.push(...rolledThisTurn);

    if (recorded) return NextResponse.json({ ...recorded, dice });

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  if (lastError) return NextResponse.json({ error: lastError }, { status: 500 });
  return NextResponse.json({ error: "The years were not written." }, { status: 502 });
}
