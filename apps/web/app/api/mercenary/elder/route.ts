import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { wikiText, WIKI, type WikiId } from "@/app/mercenary/data/wiki";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";
import { reviewTownTrigger } from "../town/review";

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
  workHeard?: boolean;
  leader?: string;
  bandPlace?: string;
  speaker?: string;
  books?: {
    persona?: string;
    coins?: number;
    granary?: number;
    weeksLeft?: number;
    able?: number;
    notes?: string;
    debts?: string;
  } | null;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as ElderBody | null;
  if (!body?.message?.trim()) return NextResponse.json({ error: "Say something to the elder." }, { status: 400 });

  const books = body.books ?? null;
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
      name: "tell_of_the_work",
      description: "Tell them the work that is actually open here. Call this when you explain the job. Until you call it, they cannot take the work. Then call speak.",
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
  if (books) {
    tools.push(
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
        name: "read_books",
        description: "Read the chest, the granary, the weeks of food left, the men at home, and the open debts.",
        input_schema: { type: "object", properties: {} },
      },
      {
        name: "agree_purse",
        description: "Promise a purse, paid when the bandits are beaten. Say how many coins and why. The why must be that the bandits are beaten.",
        input_schema: {
          type: "object",
          properties: { coins: { type: "integer" }, why: { type: "string" } },
          required: ["coins", "why"],
        },
      },
      {
        name: "grant_grain",
        description: "Give grain from the village granary. It is gone. It does not come back.",
        input_schema: { type: "object", properties: { amount: { type: "integer" } }, required: ["amount"] },
      },
      {
        name: "offer_muster",
        description: "Offer village men. term is permanent or temporary. salary is coins per man per week, and may be 0.",
        input_schema: {
          type: "object",
          properties: {
            count: { type: "integer" },
            term: { type: "string", enum: ["permanent", "temporary"] },
            salary: { type: "integer" },
          },
          required: ["count", "term", "salary"],
        },
      }
    );
  }

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
  const speaker = body.speaker?.trim() || "elder";
  const owed = body.rewardReady && typeof body.purse === "number" ? body.purse : null;
  const canTell = !!body.workOpen && !body.workHeard;
  let paid = false;
  let workTold = false;
  let note = "";
  let purse: number | null = null;
  let purseWhy = "";
  let grain: number | null = null;
  let muster: { count: number; term: "permanent" | "temporary"; salary: number } | null = null;
  const bookLine = books
    ? `${books.persona ?? ""} Chest ${books.coins} coins. Granary ${books.granary} grain, about ${books.weeksLeft} weeks until the harvest in week 36. ${books.able} men still at home. Notes: ${books.notes || "None."} Debts: ${books.debts || "None."} Read your notes before you grant grain, agree a purse, or offer men. Write a note when you learn something about the company.`
    : "";
  for (let round = 0; round < 6; round++) {
    const response = await createMessage(client, {
      max_tokens: 800,
      system: `You are the ${speaker} of ${placeName}. ${body.ground?.trim() ?? ""} You speak plainly, in a few sentences.
${bookLine}
${canTell ? `${body.leader ?? "A band"} is at ${body.bandPlace ?? "the wild"}. If they ask whether you need help, or you explain the job, call tell_of_the_work, then speak. The purse waits when the band is gone. Do not invent a different threat.` : "Do not invent a threat that is not in what you can read. Do not call tell_of_the_work."}
${owed !== null ? `They are owed ${owed} coins. If they tell you the work is done, call pay_the_company, then speak.` : "No purse is waiting. Do not call pay_the_company."}
You may call tools to read reputation, the bible, battle history, the decision log, and what they have done here. Past talks are in the conversation. When you are ready, call speak.`,
      tools,
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    if (!calls.length) {
      const text = textOf(response);
      if (text) return NextResponse.json({ line: text, paid, workTold, note, purse, purseWhy, grain, muster });
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
      if (call.name === "tell_of_the_work") {
        if (!canTell) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "There is no work left to tell." });
        } else {
          workTold = true;
          results.push({ type: "tool_result", tool_use_id: call.id, content: "They have heard the work. They may take it." });
        }
        continue;
      }
      if (call.name === "read_notes") {
        results.push({ type: "tool_result", tool_use_id: call.id, content: [books?.notes, note].filter(Boolean).join("\n") || "No notes yet." });
        continue;
      }
      if (call.name === "write_note") {
        note = String(input.text ?? "").trim();
        results.push({ type: "tool_result", tool_use_id: call.id, content: note ? "Noted." : "Write the note." });
        continue;
      }
      if (call.name === "read_books") {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: books ? `Chest ${books.coins}. Granary ${books.granary}, about ${books.weeksLeft} weeks. Men at home ${books.able}. Debts: ${books.debts || "None."}` : "No books.",
        });
        continue;
      }
      if (call.name === "agree_purse") {
        const coins = Number(input.coins);
        const why = String(input.why ?? "");
        const reviewed = await reviewTownTrigger(client, why);
        if ("error" in reviewed) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: reviewed.error });
        } else if (reviewed.trigger !== "bandits-defeated" || !Number.isInteger(coins) || coins < 1) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "That promise is not tied to the bandits being beaten. Do not record it." });
        } else {
          purse = coins;
          purseWhy = why.trim();
          results.push({ type: "tool_result", tool_use_id: call.id, content: `Recorded: ${coins} coins when the bandits are beaten.` });
        }
        continue;
      }
      if (call.name === "grant_grain") {
        const amount = Number(input.amount);
        if (!books || !Number.isInteger(amount) || amount < 1 || amount > (books.granary ?? 0)) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "The granary does not have that much, and what you give is gone." });
        } else {
          grain = amount;
          results.push({ type: "tool_result", tool_use_id: call.id, content: `You give ${amount} grain. It will not come back.` });
        }
        continue;
      }
      if (call.name === "offer_muster") {
        const count = Number(input.count);
        const salary = Number(input.salary);
        const term = input.term === "temporary" ? "temporary" : input.term === "permanent" ? "permanent" : null;
        if (!books || !term || !Number.isInteger(count) || count < 1 || count > (books.able ?? 0) || !Number.isInteger(salary) || salary < 0) {
          results.push({ type: "tool_result", tool_use_id: call.id, content: "That muster does not fit the men still at home." });
        } else {
          muster = { count, term, salary };
          results.push({ type: "tool_result", tool_use_id: call.id, content: `Offered ${count} men, ${term}, ${salary} coin a week.` });
        }
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
    if (spoken) return NextResponse.json({ line: spoken, paid, workTold, note, purse, purseWhy, grain, muster });
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });
  }

  return NextResponse.json({ error: "The elder did not answer." }, { status: 500 });
}
