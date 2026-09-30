import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createLifeMessage, toolUses } from "../../mercenary/model";
import { parseStage, requiredCount, stageSystem, stageUser, thinStage, type LifeStage } from "../../../life/lib/chronicle";
import { lifeContext } from "../../../life/lib/path";
import type { Answer, StageId } from "../../../life/lib/types";

export const maxDuration = 120;

const TOOL: Anthropic.Tool = {
  name: "record_stage",
  description: "Record this sitting of the life, the dice, and the chart numbers.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      knownAs: { type: "string" },
      nickname: { type: "string" },
      heading: { type: "string" },
      text: { type: "string" },
      imagePrompts: { type: "array", items: { type: "string" } },
      born: { type: "integer" },
      fromYear: { type: "integer" },
      toYear: { type: "integer" },
      died: { type: "boolean" },
      diedYear: { type: ["integer", "null"] },
      dice: {
        type: "array",
        items: {
          type: "object",
          properties: {
            die: { type: "string" },
            result: { type: "integer" },
            used: { type: "string" },
          },
          required: ["die", "result", "used"],
        },
      },
      fortune: {
        type: "object",
        properties: {
          label: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: { year: { type: "integer" }, value: { type: "integer" } },
              required: ["year", "value"],
            },
          },
        },
        required: ["label", "points"],
      },
      memory: {
        type: "object",
        properties: {
          label: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: { year: { type: "integer" }, value: { type: "integer" } },
              required: ["year", "value"],
            },
          },
        },
        required: ["label", "points"],
      },
      work: {
        type: "object",
        properties: {
          title: { type: "string" },
          note: { type: "string" },
          series: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { year: { type: "integer" }, value: { type: "integer" } },
                    required: ["year", "value"],
                  },
                },
              },
              required: ["name", "points"],
            },
          },
        },
        required: ["title", "note", "series"],
      },
    },
    required: ["name", "knownAs", "nickname", "heading", "text", "imagePrompts", "born", "fromYear", "toYear", "died", "dice", "fortune", "memory", "work"],
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
  const ask = (content: string) =>
    createLifeMessage(client, {
      max_tokens: 6000,
      system: stageSystem(stage),
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_stage" },
      messages: [{ role: "user", content }],
    });

  const first = await ask(user);
  if ("error" in first) return NextResponse.json({ error: first.error }, { status: 500 });
  const inputs = [toolUses(first).find((item) => item.name === "record_stage")?.input];
  if (!parseStage(inputs[0], stage, context.born, givenName)) {
    const second = await ask(`${user}\n\nThe last record was incomplete. Call record_stage once with every required field, including two imagePrompts, fortune, memory, and work.`);
    if (!("error" in second)) inputs.push(toolUses(second).find((item) => item.name === "record_stage")?.input);
  }

  for (const input of inputs) {
    const written = parseStage(input, stage, context.born, givenName);
    if (written) return NextResponse.json(written);
  }
  return NextResponse.json(thinStage(context, stage, givenName));
}
