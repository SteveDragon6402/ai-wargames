import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

interface MerchantBody {
  message?: string;
  history?: { role: string; text: string }[];
  place?: string;
  price?: number;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as MerchantBody | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something to the merchant." }, { status: 400 });

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
    { role: "user", content: `${history ? `${history}\n` : ""}Company: ${body.message.trim()}` },
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
