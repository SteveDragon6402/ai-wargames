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
    standing?: number;
    atHome?: number | null;
  } | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something in the square." }, { status: 400 });

  const city = !!body.city;
  const standing = Number.isInteger(body.standing) ? Math.max(0, body.standing as number) : 0;
  const atHome = Number.isInteger(body.atHome) ? (body.atHome as number) : null;
  const tools: Anthropic.Tool[] = [
    {
      name: "change_men",
      description: "Change how many unarmed people are offered. change adds to the number already offered. A negative change sends some back. Do not send a new total. They have not joined until they accept.",
      input_schema: {
        type: "object",
        properties: { change: { type: "integer" } },
        required: ["change"],
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
  let levies = standing;

  for (let round = 0; round < 4; round++) {
    let changedThisRound = false;
    const response = await createMessage(client, {
      max_tokens: 400,
      system: city
        ? `You are the people in the square of ${body.place?.trim() || "the city"}. Speak in at most 20 words. You are not soldiers. change_men adds or takes back men from the number already offered. An offer is not service until they accept. Call speak.`
        : `You are the people in the square of ${body.place?.trim() || "the village"}. Farmers, not soldiers. change_men adds or takes back men from the number already offered. An offer is not service until they accept. Call speak.`,
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
      const input = (call.input ?? {}) as { line?: string; change?: number };
      if (call.name === "change_men") {
        const change = Math.round(Number(input.change));
        if (!Number.isInteger(change) || change === 0) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: `Say how many to add, or how many fewer. ${levies} are already offered.` });
        } else {
          let next = Math.max(0, levies + change);
          if (atHome !== null) next = Math.min(next, atHome);
          next = Math.min(next, 40);
          levies = next;
          changedThisRound = true;
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: next > 0 ? `${next} are offered. They have not accepted.` : "No one is offered.",
          });
        }
        continue;
      }
      if (call.name === "speak") {
        spoken = String(input.line ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Said." });
      }
    }
    if (spoken && !changedThisRound) return NextResponse.json({ line: city ? words(spoken, 20) : spoken, levies });
    if (spoken && changedThisRound) {
      results.forEach((result) => {
        if (result.content === "Said.") result.content = "They have not accepted. Say that it is an offer.";
      });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The square did not answer." }, { status: 500 });
}
