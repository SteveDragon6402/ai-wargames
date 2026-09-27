import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";
import { reviewTownTrigger } from "../town/review";
import type { Due } from "@/app/mercenary/lib/types";

interface MerchantBody {
  message?: string;
  history?: { role: string; text: string }[];
  place?: string;
  price?: number | null;
  filled?: boolean;
  persona?: string;
  grain?: number;
  coins?: number;
  cost?: number;
  notes?: string;
  debts?: string;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as MerchantBody | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something to the merchant." }, { status: 400 });

  if (!body.filled) return unfilled(client, body);

  const tools: Anthropic.Tool[] = [
    {
      name: "read_notes",
      description: "Read the notes you have kept on this company.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "write_note",
      description: "Keep a note about this company. One or two sentences.",
      input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    },
    {
      name: "read_stock",
      description: "Read your grain, your coins, your cost, and your posted price.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "set_price",
      description: "Post or change the price of one grain. Any whole number of coins, including zero and below your cost.",
      input_schema: { type: "object", properties: { price: { type: "integer" } }, required: ["price"] },
    },
    {
      name: "sell",
      description: "Sell some of your own grain at the posted price. payNow is how much coin moves today. The rest is a debt. If that rest waits on the bandits being beaten, say so in why. Any other later date is refused.",
      input_schema: {
        type: "object",
        properties: { amount: { type: "integer" }, payNow: { type: "integer" }, why: { type: "string" } },
        required: ["amount", "payNow"],
      },
    },
    {
      name: "speak",
      description: "Say your reply. A few sentences.",
      input_schema: { type: "object", properties: { line: { type: "string" } }, required: ["line"] },
    },
  ];

  const history = (body.history ?? []).map((turn) => `${turn.role === "player" ? "Company" : "Merchant"}: ${turn.text}`).join("\n");
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `${history ? `${history}\n` : ""}Company: ${body.message?.trim() ?? ""}` },
  ];
  let posted = Number.isInteger(body.price) ? (body.price as number) : null;
  let priceSet: number | null = null;
  let note = "";
  let sale: { amount: number; payNow: number; due: Due } | null = null;

  for (let round = 0; round < 6; round++) {
    const response = await createMessage(client, {
      max_tokens: 700,
      system: `${body.persona ?? "You sell grain."} You are in ${body.place?.trim() || "this place"}.
Grain on hand ${body.grain ?? 0}. Coins ${body.coins ?? 0}. Cost ${body.cost ?? 1} a grain. Posted price ${posted === null ? "none yet" : posted}.
Notes: ${body.notes || "None."} Debts: ${body.debts || "None."}
Read your notes before you change a price or extend credit, and write a note when you learn something about the company. Your sacks are not the village granary. You cannot sell grain you do not have. Until a price is posted, you cannot sell. Call set_price for any whole number. Then speak.`,
      tools,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const calls = toolUses(response);
    if (!calls.length) {
      const text = textOf(response);
      if (text) return NextResponse.json({ line: text, price: priceSet, note, sale });
      return NextResponse.json({ error: "The merchant said nothing." }, { status: 500 });
    }
    let spoken = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as { line?: string; text?: string; price?: number; amount?: number; payNow?: number; why?: string };
      if (call.name === "read_notes") {
        results.push({ type: "tool_result", tool_use_id: call.id, content: [body.notes, note].filter(Boolean).join("\n") || "No notes yet." });
        continue;
      }
      if (call.name === "write_note") {
        note = String(input.text ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: note ? "Noted." : "Write the note." });
        continue;
      }
      if (call.name === "read_stock") {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `Grain ${body.grain ?? 0}. Coins ${body.coins ?? 0}. Cost ${body.cost ?? 1}. Price ${posted === null ? "not posted" : posted}.`,
        });
        continue;
      }
      if (call.name === "set_price") {
        const price = input.price;
        if (!Number.isInteger(price)) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "The price is a whole number of coins." });
        } else {
          posted = price as number;
          priceSet = posted;
          results.push({ type: "tool_result", tool_use_id: call.id, content: `Posted at ${posted} coin a grain.` });
        }
        continue;
      }
      if (call.name === "sell") {
        const amount = Number(input.amount);
        const payNow = Number(input.payNow);
        const why = String(input.why ?? "").trim();
        if (posted === null) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "Post a price before you sell." });
          continue;
        }
        if (!Number.isInteger(amount) || amount < 1 || amount > (body.grain ?? 0) || !Number.isInteger(payNow) || payNow < 0) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "You cannot sell grain you do not have." });
          continue;
        }
        let due: Due = { kind: "now" };
        if (why) {
          const reviewed = await reviewTownTrigger(client, why);
          if ("error" in reviewed) {
            results.push({ type: "tool_result", tool_use_id: call.id, content: reviewed.error });
            continue;
          }
          if (reviewed.trigger !== "bandits-defeated") {
            results.push({ type: "tool_result", tool_use_id: call.id, content: "There is no such event. The only one is the bandits being beaten. Do not record it." });
            continue;
          }
          due = { kind: "trigger", trigger: "bandits-defeated" };
        }
        sale = { amount, payNow, due };
        results.push({ type: "tool_result", tool_use_id: call.id, content: `Sold ${amount}. ${payNow} now.` });
        continue;
      }
      if (call.name === "speak") {
        spoken = String(input.line ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Said." });
      }
    }
    if (spoken) return NextResponse.json({ line: spoken, price: priceSet, note, sale });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The merchant did not answer." }, { status: 500 });
}

async function unfilled(client: Anthropic, body: MerchantBody) {
  const posted = body.price === 1 ? 1 : 2;
  const tools: Anthropic.Tool[] = [
    {
      name: "agree_price",
      description: "Agree a price for this purchase of food. 2 is the posted price. 1 is as low as you will go. Never below 1. Call this, then speak.",
      input_schema: {
        type: "object",
        properties: { price: { type: "number", enum: [1, 2] } },
        required: ["price"],
      },
    },
    {
      name: "speak",
      description: "Say your reply. A few sentences about food.",
      input_schema: { type: "object", properties: { line: { type: "string" } }, required: ["line"] },
    },
  ];
  const history = (body.history ?? []).map((turn) => `${turn.role === "player" ? "Company" : "Merchant"}: ${turn.text}`).join("\n");
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `${history ? `${history}\n` : ""}Company: ${body.message?.trim() ?? ""}` },
  ];
  let agreed: 1 | 2 | null = null;
  for (let round = 0; round < 4; round++) {
    const response = await createMessage(client, {
      max_tokens: 500,
      system: `You sell food in ${body.place?.trim() || "this place"}. The posted price is 2 coins a ration. You may agree 1 coin for this purchase if they haggle, and never less. You do not sell soldiers and you do not bargain over wages. The price they are being shown now is ${posted}. If you change it, call agree_price, then speak.`,
      tools,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const calls = toolUses(response);
    if (!calls.length) {
      const text = textOf(response);
      if (text) return NextResponse.json({ line: text, price: agreed });
      return NextResponse.json({ error: "The merchant said nothing." }, { status: 500 });
    }
    let spoken = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as { line?: string; price?: number };
      if (call.name === "agree_price") {
        const price = input.price === 1 ? 1 : input.price === 2 ? 2 : null;
        if (price === null) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "The price is 1 or 2. Nothing lower." });
        } else {
          agreed = price;
          results.push({ type: "tool_result", tool_use_id: call.id, content: `Agreed: ${price} coin a ration for this purchase.` });
        }
        continue;
      }
      if (call.name === "speak") {
        spoken = String(input.line ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Said." });
      }
    }
    if (spoken) return NextResponse.json({ line: spoken, price: agreed });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }
  return NextResponse.json({ error: "The merchant did not answer." }, { status: 500 });
}
