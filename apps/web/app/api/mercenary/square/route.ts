import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

function words(text: string, max: number): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, max).join(" ");
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    message?: string;
    history?: { role: string; text: string }[];
    place?: string;
    city?: boolean;
  } | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something in the square." }, { status: 400 });

  const city = !!body.city;
  const tools: Anthropic.Tool[] = [
    {
      name: "offer_levies",
      description: "Untrained people in the square agree to take service. They join free, still unarmed. Count is how many, from 1 to 10. Call this when they call for men, then speak.",
      input_schema: {
        type: "object",
        properties: { count: { type: "number" } },
        required: ["count"],
      },
    },
    {
      name: "speak",
      description: city
        ? "Say what the square answers. At most 20 words."
        : "Say what the people in the square answer. A few sentences.",
      input_schema: { type: "object", properties: { line: { type: "string" } }, required: ["line"] },
    },
  ];

  const history = (body.history ?? []).map((turn) => `${turn.role === "player" ? "Company" : "Square"}: ${turn.text}`).join("\n");
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `${history ? `${history}\n` : ""}Company: ${body.message.trim()}` },
  ];
  let levies: number | null = null;

  for (let round = 0; round < 4; round++) {
    const response = await createMessage(client, {
      max_tokens: 400,
      system: city
        ? `You are the people in the square of ${body.place?.trim() || "the city"}. Speak in at most 20 words. They are not soldiers. If the company calls for men, some may join as militia: free, untrained, unarmed. Call offer_levies with how many, then speak. Do not sell trained soldiers.`
        : `You are the people in the square of ${body.place?.trim() || "the village"}. Farmers, not soldiers. If the company calls for men, some may join free, untrained and unarmed. Call offer_levies with how many, then speak. Do not sell trained soldiers.`,
      tools,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const calls = toolUses(response);
    if (!calls.length) {
      const text = textOf(response);
      if (text) return NextResponse.json({ line: city ? words(text, 20) : text, levies });
      return NextResponse.json({ error: "The square said nothing." }, { status: 500 });
    }
    let spoken = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as { line?: string; count?: number };
      if (call.name === "offer_levies") {
        const count = Math.round(Number(input.count));
        if (!Number.isInteger(count) || count < 1 || count > 10) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "Offer between 1 and 10." });
        } else {
          levies = count;
          results.push({ type: "tool_result", tool_use_id: call.id, content: `${count} will take service, free and unarmed.` });
        }
        continue;
      }
      if (call.name === "speak") {
        spoken = String(input.line ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Said." });
      }
    }
    if (spoken) return NextResponse.json({ line: city ? words(spoken, 20) : spoken, levies });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The square did not answer." }, { status: 500 });
}
