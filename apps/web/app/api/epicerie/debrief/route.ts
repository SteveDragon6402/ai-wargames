import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../mercenary/model";

export const maxDuration = 60;

interface Body {
  lines?: { role?: string; text?: string }[];
}

const TOOL: Anthropic.Tool = {
  name: "debrief",
  description: "Record the glosses and the phrases worth keeping.",
  input_schema: {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        description: "One entry per shopkeeper line, in order, using the index given.",
        items: {
          type: "object",
          properties: { index: { type: "integer" }, en: { type: "string" } },
          required: ["index", "en"],
        },
      },
      phrases: {
        type: "array",
        description: "Three to six short, reusable French phrases from this conversation, or ones the learner needed.",
        items: {
          type: "object",
          properties: { fr: { type: "string" }, en: { type: "string" } },
          required: ["fr", "en"],
        },
      },
      tip: { type: "string", description: "One friendly sentence of advice for next time, in English." },
    },
    required: ["glosses", "phrases", "tip"],
  },
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as T[];
  if (typeof value === "string") {
    try {
      return asArray<T>(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

type RawDebrief = { glosses?: unknown; phrases?: unknown; tip?: unknown };

/** The model sometimes packs the whole answer, as JSON text, into one field. */
function unwrap(value: unknown): RawDebrief {
  const input = (value && typeof value === "object" ? value : {}) as RawDebrief;
  for (const field of [input.glosses, input.phrases]) {
    if (typeof field !== "string") continue;
    try {
      const parsed = JSON.parse(field) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && ("glosses" in parsed || "phrases" in parsed)) {
        return { ...input, ...(parsed as RawDebrief) };
      }
    } catch {
      continue;
    }
  }
  return input;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as Body | null;
  const lines = (Array.isArray(body?.lines) ? body.lines : [])
    .map((line, index) => ({
      index,
      role: line?.role === "gerard" ? "gerard" : line?.role === "event" ? "event" : "you",
      text: typeof line?.text === "string" ? line.text.slice(0, 400) : "",
    }))
    .filter((line) => line.text.trim())
    .slice(-60);
  if (!lines.some((line) => line.role === "gerard")) return NextResponse.json({ glosses: [], phrases: [], tip: "" });

  const script = lines
    .map((line) => (line.role === "gerard" ? `[${line.index}] Shopkeeper: ${line.text}` : line.role === "you" ? `Learner: ${line.text}` : `(${line.text})`))
    .join("\n");

  let review: { glosses: { index: number; en: string }[]; phrases: { fr: string; en: string }[]; tip: string } | null = null;
  for (let attempt = 0; attempt < 2 && !review?.glosses.length; attempt++) {
    const response = await createMessage(client, {
      max_tokens: 2000,
      system:
        "You are a kind French tutor reviewing a learner's real conversation in a French village shop. Translate each shopkeeper line into natural English, keeping its tone. Then pick phrases worth keeping. Call the debrief tool with glosses and phrases as JSON arrays.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: "debrief" },
      messages: [{ role: "user", content: script }],
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
    const input = unwrap(toolUses(response)[0]?.input);
    review = {
      glosses: asArray<{ index?: number; en?: string }>(input.glosses)
        .filter((gloss) => Number.isInteger(gloss.index) && typeof gloss.en === "string")
        .map((gloss) => ({ index: gloss.index as number, en: String(gloss.en) })),
      phrases: asArray<{ fr?: string; en?: string }>(input.phrases)
        .filter((phrase) => typeof phrase.fr === "string" && typeof phrase.en === "string")
        .slice(0, 6)
        .map((phrase) => ({ fr: String(phrase.fr), en: String(phrase.en) })),
      tip: typeof input.tip === "string" ? input.tip : "",
    };
  }
  return NextResponse.json(review);
}
