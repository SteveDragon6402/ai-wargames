import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { wikiText, WIKI, type WikiId } from "@/app/mercenary/data/wiki";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

const WIKI_IDS = Object.keys(WIKI) as WikiId[];

interface ElderBody {
  message?: string;
  history?: { role: "player" | "elder"; text: string }[];
  reputation?: Record<string, string>;
  decisions?: { week: number; text: string }[];
  battles?: string;
  deeds?: string[];
  company?: string;
  place?: string;
  ground?: string;
  rewardReady?: boolean;
  purse?: number | null;
  workOpen?: boolean;
  leader?: string;
  bandPlace?: string;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as ElderBody | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something to the elder." }, { status: 400 });

  const tools: Anthropic.Tool[] = [
    {
      name: "read_reputation",
      description: "Read how the company is regarded.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_wiki",
      description: "Read one bible entry.",
      input_schema: { type: "object", properties: { id: { type: "string", enum: WIKI_IDS } }, required: ["id"] },
    },
    {
      name: "read_battle_history",
      description: "Read the company's battles.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_decision_log",
      description: "Read the company's significant decisions.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_village_deeds",
      description: "Read what this company has done for Millcross.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "pay_the_company",
      description: "Pay the purse the company is already owed for finished work. Call this when they say the work is done and a purse is waiting. Then call speak.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "speak",
      description: "Say your reply to the company. One short speech.",
      input_schema: { type: "object", properties: { line: { type: "string" } }, required: ["line"] },
    },
  ];

  const history = (body.history ?? [])
    .map((turn) => `${turn.role === "player" ? "Company" : "Elder"}: ${turn.text}`)
    .join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `${history ? `${history}\n` : ""}Company: ${body.message.trim()}`,
    },
  ];

  const placeName = body.place?.trim() || "this place";
  const owed = body.rewardReady && typeof body.purse === "number" ? body.purse : null;
  let paid = false;
  for (let round = 0; round < 6; round++) {
    const response = await createMessage(client, {
      max_tokens: 800,
      system: `You are the elder of ${placeName}. ${body.ground?.trim() ?? ""} You speak plainly, in a few sentences.
${body.workOpen ? `${body.leader ?? "A band"} is at ${body.bandPlace ?? "the wild"}. If they ask whether you need help, tell them that, and that the purse waits when the band is gone. Do not invent a different threat.` : "Do not invent a threat that is not in what you can read."}
${owed !== null ? `They are owed ${owed} coins. If they tell you the work is done, call pay_the_company, then speak.` : "No purse is waiting. Do not call pay_the_company."}
You may call tools to read reputation, the bible, battle history, the decision log, and what they have done here. Past talks are in the conversation. When you are ready, call speak.`,
      tools,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    if (!calls.length) {
      const text = textOf(response);
      if (text) return NextResponse.json({ line: text, paid });
      return NextResponse.json({ error: "The elder said nothing." }, { status: 500 });
    }

    let spoken = "";
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      if (call.name === "speak") {
        spoken = String(input.line ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: "Said." });
        continue;
      }
      if (call.name === "pay_the_company") {
        if (owed === null) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "There is no purse waiting. Do not pay." });
        } else {
          paid = true;
          results.push({ type: "tool_result", tool_use_id: call.id, content: `You pay them ${owed} coins.` });
        }
        continue;
      }
      let content = "Nothing there.";
      if (call.name === "read_reputation") {
        content = Object.entries(body.reputation ?? {})
          .map(([key, value]) => `${key}: ${value || "Nothing yet."}`)
          .join("\n");
      } else if (call.name === "read_wiki") {
        const id = String(input.id ?? "");
        content = (WIKI_IDS as string[]).includes(id) ? wikiText(id as WikiId) : "No such entry.";
      } else if (call.name === "read_battle_history") {
        content = body.battles?.trim() || "They have not fought.";
      } else if (call.name === "read_decision_log") {
        content = (body.decisions ?? []).map((item) => `Week ${item.week}: ${item.text}`).join("\n") || "Nothing significant.";
      } else if (call.name === "read_village_deeds") {
        content = (body.deeds ?? []).join("\n") || "They have done nothing for Millcross yet.";
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content });
    }
    if (spoken) return NextResponse.json({ line: spoken, paid });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The elder did not answer." }, { status: 500 });
}
