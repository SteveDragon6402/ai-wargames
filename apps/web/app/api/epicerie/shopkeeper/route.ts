import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, toolUses, textOf } from "../../mercenary/model";
import { ITEM_BY_ID } from "@/app/epicerie/data/items";
import { basketSheet, cleanLine, counterSheet, describeTurn, isGesture, neutralGesture, persona, spokenFromText, type Address } from "@/app/epicerie/lib/gerard";
import { EXPRESSIONS, addLine, formatEuros, linesTotal, removeLine, type Expression, type Line, type Turn } from "@/app/epicerie/lib/shop";

export const maxDuration = 60;

const MAX_HISTORY = 40;
const MAX_TEXT = 400;

interface Body {
  turn?: Turn;
  history?: Turn[];
  counter?: Line[];
  till?: number | null;
  basket?: Line[];
  notes?: string[];
  visits?: number;
  address?: string;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "hand_over",
    description: "Take an item off your shelf and set it on the counter for the customer. It is not paid for yet.",
    input_schema: {
      type: "object",
      properties: { item_id: { type: "string" }, qty: { type: "integer", minimum: 1, maximum: 12 } },
      required: ["item_id", "qty"],
    },
  },
  {
    name: "take_back",
    description: "Take an item off the counter and put it back on the shelf. Leave out qty to take all of it back.",
    input_schema: {
      type: "object",
      properties: { item_id: { type: "string" }, qty: { type: "integer", minimum: 1 } },
      required: ["item_id"],
    },
  },
  {
    name: "ring_up",
    description:
      "Ring up everything on the counter. The till adds the full price. Give total_cents only if you are rounding down for them; it can be at most a third off.",
    input_schema: { type: "object", properties: { total_cents: { type: "integer" } } },
  },
  {
    name: "write_note",
    description: "Write one short line in your notebook about this customer, for next time.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "speak",
    description: "Say your reply aloud. Call this last.",
    input_schema: {
      type: "object",
      properties: {
        line: { type: "string", description: "What you say, in French. One to three short sentences." },
        expression: { type: "string", enum: EXPRESSIONS },
        gesture: { type: "string", description: "Optional. What you do, in a few words of English narration." },
      },
      required: ["line", "expression"],
    },
  },
];

function cleanTurn(value: unknown): Turn | null {
  if (!value || typeof value !== "object") return null;
  const turn = value as Turn;
  if (!["you", "gerard", "event"].includes(turn.role)) return null;
  return {
    role: turn.role,
    text: String(turn.text ?? "").slice(0, MAX_TEXT),
    pointed: turn.pointed && ITEM_BY_ID[turn.pointed] ? turn.pointed : undefined,
    gesture: isGesture(turn.gesture) ? turn.gesture : undefined,
  };
}

function cleanLines(value: unknown): Line[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<Line[]>((acc, line) => addLine(acc, String(line?.itemId ?? ""), Number(line?.qty)), []);
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const turn = cleanTurn(body?.turn);
  if (!turn || turn.role === "gerard") return NextResponse.json({ error: "Nothing happened in the shop." }, { status: 400 });
  if (turn.role === "you" && !turn.text.trim() && !turn.pointed && !turn.gesture) {
    return NextResponse.json({ error: "Say something, point, or gesture." }, { status: 400 });
  }

  const history = (Array.isArray(body?.history) ? body.history : [])
    .map(cleanTurn)
    .filter((item): item is Turn => item !== null)
    .slice(-MAX_HISTORY);
  let counter = cleanLines(body?.counter);
  let till = typeof body?.till === "number" && counter.length ? Math.round(body.till) : null;
  const notes = (Array.isArray(body?.notes) ? body.notes : []).filter((note): note is string => typeof note === "string").slice(-12);
  const visits = Number.isInteger(body?.visits) ? Math.max(0, body?.visits as number) : 0;
  const basket = cleanLines(body?.basket);
  const address: Address = body?.address === "monsieur" || body?.address === "madame" ? body.address : "unknown";
  const written: string[] = [];

  const scene = [...history, turn].map(describeTurn).join("\n");
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `${scene}\n\n(${basketSheet(basket)} ${counterSheet(counter, till)})` },
  ];
  const system = persona({ notes, visits, address });

  for (let round = 0; round < 5; round++) {
    const response = await createMessage(client, { max_tokens: 600, system, tools: TOOLS, messages });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 502 });

    const calls = toolUses(response);
    if (!calls.length) {
      const spoken = spokenFromText(textOf(response));
      if (spoken) return NextResponse.json({ ...spoken, gesture: neutralGesture(spoken.gesture), counter, till, notes: written });
      return NextResponse.json({ error: "Gérard said nothing." }, { status: 502 });
    }

    let spoken: { line: string; expression: Expression; gesture: string } | null = null;
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      const reply = (content: string) => results.push({ type: "tool_result", tool_use_id: call.id, content });

      if (call.name === "hand_over") {
        const id = String(input.item_id ?? "");
        const qty = Number(input.qty);
        if (!ITEM_BY_ID[id]) {
          reply(`You do not stock "${id}". Use an id from your shelf list.`);
        } else if (!Number.isInteger(qty) || qty < 1 || qty > 12) {
          reply("Hand over a whole number, one to twelve.");
        } else {
          counter = addLine(counter, id, qty);
          till = null;
          reply(`On the counter now: ${counterSheet(counter, till)}`);
        }
        continue;
      }
      if (call.name === "take_back") {
        const id = String(input.item_id ?? "");
        const qty = input.qty === undefined ? undefined : Number(input.qty);
        if (!counter.some((line) => line.itemId === id)) {
          reply("That is not on the counter.");
        } else {
          counter = removeLine(counter, id, qty !== undefined && Number.isInteger(qty) && qty > 0 ? qty : undefined);
          till = null;
          reply(counterSheet(counter, till));
        }
        continue;
      }
      if (call.name === "ring_up") {
        const full = linesTotal(counter);
        if (!counter.length) {
          reply("The counter is empty. There is nothing to ring up.");
          continue;
        }
        const asked = input.total_cents === undefined ? full : Math.round(Number(input.total_cents));
        if (!Number.isFinite(asked) || asked > full || asked < Math.ceil(full * (2 / 3))) {
          reply(`The till will not take that. Full price is ${formatEuros(full)}; you may go down to ${formatEuros(Math.ceil(full * (2 / 3)))} at most.`);
          continue;
        }
        till = asked;
        reply(`The till shows ${formatEuros(till)}. Tell them the total.`);
        continue;
      }
      if (call.name === "write_note") {
        const text = String(input.text ?? "").trim().slice(0, 300);
        if (text) written.push(text);
        reply(text ? "Written." : "Write something.");
        continue;
      }
      if (call.name === "speak") {
        const line = cleanLine(String(input.line ?? ""));
        const expression = EXPRESSIONS.includes(input.expression as Expression) ? (input.expression as Expression) : "neutral";
        const gesture = String(input.gesture ?? "").trim().slice(0, 160);
        if (line || gesture) spoken = { line, expression, gesture };
        reply(line || gesture ? "Said." : "Say something.");
        continue;
      }
      reply("There is no such thing to do.");
    }

    if (spoken) return NextResponse.json({ ...spoken, gesture: neutralGesture(spoken.gesture), counter, till, notes: written });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "Gérard lost his train of thought." }, { status: 502 });
}
