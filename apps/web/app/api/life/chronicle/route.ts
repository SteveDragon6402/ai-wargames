import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../mercenary/model";
import { chronicleSystem, chronicleUser, fallbackCharts, portraitError, readCharts, readLife, thinChronicle, type Portrait } from "../../../life/lib/chronicle";
import { lifeContext } from "../../../life/lib/path";
import type { Answer } from "../../../life/lib/types";

export const maxDuration = 120;

const TOOL: Anthropic.Tool = {
  name: "record_life",
  description: "Record the life, the dice, and the chart numbers.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["early", "middle", "late"] },
            heading: { type: "string" },
            text: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: ["id", "heading", "text", "imagePrompt"],
        },
      },
      born: { type: "integer" },
      died: { type: "integer" },
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
          points: { type: "array", items: { type: "object", properties: { year: { type: "integer" }, value: { type: "integer" } }, required: ["year", "value"] } },
        },
        required: ["label", "points"],
      },
      memory: {
        type: "object",
        properties: {
          label: { type: "string" },
          points: { type: "array", items: { type: "object", properties: { year: { type: "integer" }, value: { type: "integer" } }, required: ["year", "value"] } },
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
                points: { type: "array", items: { type: "object", properties: { year: { type: "integer" }, value: { type: "integer" } }, required: ["year", "value"] } },
              },
              required: ["name", "points"],
            },
          },
        },
        required: ["title", "note", "series"],
      },
    },
    required: ["name", "chapters", "born", "died", "dice", "fortune", "memory", "work"],
  },
};

function answersOf(value: unknown): Answer[] | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  const answers: Answer[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const row = item as { questionId?: unknown; optionId?: unknown };
    if (typeof row.questionId !== "string" || typeof row.optionId !== "string") return null;
    answers.push({ questionId: row.questionId, optionId: row.optionId });
  }
  return answers;
}

function portraitOf(body: {
  name?: unknown;
  portrait?: unknown;
  want?: unknown;
  hate?: unknown;
  love?: unknown;
}): Portrait | null {
  if (
    typeof body.portrait !== "string" ||
    typeof body.want !== "string" ||
    typeof body.hate !== "string" ||
    typeof body.love !== "string"
  ) {
    return null;
  }
  return {
    name: typeof body.name === "string" ? body.name : "",
    portrait: body.portrait,
    want: body.want,
    hate: body.hate,
    love: body.love,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    answers?: unknown;
    name?: unknown;
    portrait?: unknown;
    want?: unknown;
    hate?: unknown;
    love?: unknown;
  } | null;
  const answers = answersOf(body?.answers);
  const portrait = body ? portraitOf(body) : null;
  if (!answers || !portrait) return NextResponse.json({ error: "The life is missing." }, { status: 400 });

  let context;
  try {
    context = lifeContext(answers);
  } catch {
    return NextResponse.json({ error: "Those choices do not make a life." }, { status: 400 });
  }
  const problem = portraitError(portrait);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const user = chronicleUser(context, portrait);
  const ask = (content: string) =>
    createMessage(client, {
      max_tokens: 8000,
      system: chronicleSystem(),
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_life" },
      messages: [{ role: "user", content }],
    });

  const first = await ask(user);
  if ("error" in first) return NextResponse.json({ error: first.error }, { status: 500 });
  const inputs = [toolUses(first).find((item) => item.name === "record_life")?.input];
  const firstStory = readLife(inputs[0], portrait.name, context.born);
  const firstCharts = readCharts(inputs[0]);
  if (!(firstStory && firstCharts)) {
    const second = await ask(`${user}\n\nThe last record was incomplete. Call record_life once with every required field, including fortune, memory, work, and three chapters.`);
    if (!("error" in second)) inputs.push(toolUses(second).find((item) => item.name === "record_life")?.input);
  }

  for (const input of inputs) {
    const story = readLife(input, portrait.name, context.born);
    const charts = readCharts(input);
    if (story && charts) return NextResponse.json({ ...story, ...charts, thin: false });
  }
  for (const input of inputs) {
    const story = readLife(input, portrait.name, context.born);
    if (!story) continue;
    const charts = inputs.map(readCharts).find((charts) => charts !== null) ?? fallbackCharts(context, story.born, story.died);
    return NextResponse.json({ ...story, ...charts, thin: false });
  }
  return NextResponse.json(thinChronicle(context, portrait.name));
}
