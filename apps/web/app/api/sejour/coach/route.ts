import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses } from "../../mercenary/model";
import { HANDOUT_IDS, HANDOUTS } from "@/app/sejour/data/handouts";

export const maxDuration = 60;

interface Turn {
  who?: string;
  text?: string;
}

const TOOL: Anthropic.Tool = {
  name: "coach",
  description: "Answer the guest about lines they said.",
  input_schema: {
    type: "object",
    properties: {
      say: {
        type: "string",
        description: "Two to five sentences, in English, with the French they needed. Answer the question they asked. Quote their line.",
      },
      handouts: {
        type: "array",
        items: { type: "string", enum: [...HANDOUT_IDS] },
        description: "Handout ids that would help with this question. Empty if none.",
      },
    },
    required: ["say"],
  },
};

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });
  const body = (await req.json().catch(() => null)) as {
    lines?: { role?: string; text?: string }[];
    scene?: string;
    quotes?: string[];
    question?: string;
    history?: Turn[];
  } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return NextResponse.json({ error: "Ask something." }, { status: 400 });
  const lines = (Array.isArray(body?.lines) ? body.lines : [])
    .map((line) => `${line?.role === "you" ? "You" : "Them"}: ${typeof line?.text === "string" ? line.text.slice(0, 400) : ""}`)
    .filter((line) => line.length > 5)
    .slice(-40);
  const quotes = (Array.isArray(body?.quotes) ? body.quotes : [])
    .filter((quote): quote is string => typeof quote === "string" && quote.trim().length > 0)
    .map((quote) => quote.trim().slice(0, 400))
    .slice(0, 2);
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((turn) => (turn?.who === "you" || turn?.who === "them") && typeof turn.text === "string")
    .slice(-8)
    .map((turn) => `${turn.who === "you" ? "Guest" : "Coach"}: ${String(turn.text).slice(0, 500)}`);
  const catalogue = HANDOUTS.map((handout) => `${handout.id}: ${handout.title}`).join("; ");
  const response = await createMessage(client, {
    max_tokens: 700,
    system: `You are a quiet coach after a scene in a French homestay. The scene is the context. The guest quoted something they said and asked a question. Answer that question. Do not start a new topic.

Vous is for Gérard, Madame Rousseau, waiters, the conductor, and anyone older. Never tell them to use tu with Gérard because he was friendly. Tu is only for a young person at speed friending, and only after that person used tu.

If a handout fits, name it in the answer and include its id. Handouts: ${catalogue}.`,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "coach" },
    messages: [
      {
        role: "user",
        content: `Scene (${typeof body?.scene === "string" ? body.scene : "shop"}):\n${lines.join("\n") || "(nothing was said)"}\n\nQuoted:\n${quotes.map((quote) => `“${quote}”`).join("\n") || "(nothing quoted)"}\n\n${history.join("\n")}\nGuest: ${question}`,
      },
    ],
  });
  if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });
  const input = (toolUses(response)[0]?.input ?? {}) as { say?: unknown; handouts?: unknown };
  const say = typeof input.say === "string" ? input.say.trim().slice(0, 1200) : "";
  if (!say) return NextResponse.json({ error: "The coach didn't answer." }, { status: 502 });
  const allowed = new Set<string>(HANDOUT_IDS);
  const handouts = (Array.isArray(input.handouts) ? input.handouts : [])
    .filter((id): id is string => typeof id === "string" && allowed.has(id))
    .slice(0, 3);
  return NextResponse.json({ say, handouts });
}
