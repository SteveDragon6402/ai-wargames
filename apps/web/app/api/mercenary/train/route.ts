import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { DESCRIPTION_MAX } from "@/app/mercenary/data/constants";
import { WIKI, resolveWikiId, wikiText, type WikiId } from "@/app/mercenary/data/wiki";
import { anthropicClient, createMessage, textOf, toolUses } from "../model";

const WIKI_IDS = Object.keys(WIKI) as WikiId[];

interface TrainUnit {
  id: string;
  name: string;
  type?: string;
  lines: string[];
}

const READ_ENTRY: Anthropic.Tool = {
  name: "read_entry",
  description: "Read the wiki entry for how this sort of soldier was trained in childhood.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string", description: "A wiki id such as swordsmen, spearmen, archers, light_cavalry, heavy_cavalry, berserkers, or bandit." } },
    required: ["id"],
  },
};

const UPDATE: Anthropic.Tool = {
  name: "update_descriptions",
  description: "Replace what each unit seems like after this week of training.",
  input_schema: {
    type: "object",
    properties: {
      units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unitId: { type: "string" },
            lines: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: DESCRIPTION_MAX,
              description: "What they seem like now. One to ten lines. Rewrite, drop, or add as the week warrants.",
            },
          },
          required: ["unitId", "lines"],
        },
      },
    },
    required: ["units"],
  },
};

function unitsOf(body: { units?: TrainUnit[] }): TrainUnit[] | null {
  if (!Array.isArray(body.units) || body.units.length !== 2) return null;
  for (const unit of body.units) {
    if (!unit?.id || !unit.name || !Array.isArray(unit.lines) || unit.lines.length < 1) return null;
    if (unit.lines.some((line) => typeof line !== "string" || !line.trim())) return null;
  }
  return body.units;
}

function readUpdate(input: unknown, expected: TrainUnit[]): Record<string, string[]> | null {
  if (!input || typeof input !== "object") return null;
  const rows = (input as { units?: unknown }).units;
  if (!Array.isArray(rows)) return null;
  const lines: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as { unitId?: unknown; id?: unknown; lines?: unknown };
    const id = typeof record.unitId === "string" ? record.unitId : typeof record.id === "string" ? record.id : "";
    const unit = expected.find((item) => item.id === id || item.name === id);
    if (!unit || !Array.isArray(record.lines)) continue;
    const next = record.lines.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean).slice(0, DESCRIPTION_MAX);
    if (next.length > 0) lines[unit.id] = next;
  }
  if (expected.some((unit) => !lines[unit.id])) return null;
  return lines;
}

function drillPrompt(companyName: string, drill: string, units: TrainUnit[]): string {
  const blocks = units
    .map((unit) => {
      const numbered = unit.lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
      return `This is a unit called ${unit.name} (id ${unit.id}).
They belong to a mercenary company called ${companyName}.
This is a description of what they seem like:
${numbered}
Their childhood trade is wiki id "${unit.type ?? ""}". Call read_entry with that id for what they were trained to be as children.`;
    })
    .join("\n\n");
  return `${blocks}

This week they have trained on: ${drill}

How would a week of that training change what they seem like? Call update_descriptions for both units. Each description is 1 to ${DESCRIPTION_MAX} lines. You may rewrite a line, drop a line, or add a line.`;
}

export async function POST(req: NextRequest) {
  const client = anthropicClient();
  if ("error" in client) return NextResponse.json({ error: client.error }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    mode?: string;
    drill?: string;
    companyName?: string;
    units?: TrainUnit[];
  } | null;
  if (!body) return NextResponse.json({ error: "The drill request was unreadable." }, { status: 400 });
  const units = unitsOf(body);
  if (!units) return NextResponse.json({ error: "Training needs two units." }, { status: 400 });

  if (body.mode === "suggest") {
    const response = await createMessage(client, {
      max_tokens: 200,
      system:
        "Suggest three drills for two mercenary units. Each drill is exactly four words. Reply with three lines, nothing else.",
      messages: [
        {
          role: "user",
          content: units.map((unit) => `${unit.name}. ${unit.lines.join(" ")}`).join("\n"),
        },
      ],
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });
    const drills = textOf(response)
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (drills.length < 2) return NextResponse.json({ error: "No drills came back." }, { status: 500 });
    return NextResponse.json({ drills });
  }

  if (!body.drill?.trim()) return NextResponse.json({ error: "Say what the drill is." }, { status: 400 });
  const companyName = body.companyName?.trim() || "the company";
  const needed = new Set(units.map((unit) => unit.type).filter((type): type is string => !!type && !!resolveWikiId(type)));
  const seen = new Set<string>();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: drillPrompt(companyName, body.drill.trim(), units) },
  ];

  for (let round = 0; round < 6; round++) {
    const response = await createMessage(client, {
      max_tokens: 1200,
      system: `You update how two units seem after one week of training. A week is not a new life. Change only what that week of drill would change.

Call read_entry for a unit's childhood trade before you rewrite them. Valid ids: ${WIKI_IDS.join(", ")}.
Then call update_descriptions once, with both units. Each description is 1 to ${DESCRIPTION_MAX} lines.`,
      tools: [READ_ENTRY, UPDATE],
      tool_choice: round >= 3 ? { type: "tool", name: "update_descriptions" } : { type: "auto" },
      messages,
    });
    if ("error" in response) return NextResponse.json({ error: response.error }, { status: 500 });

    const calls = toolUses(response);
    const updated = calls.find((call) => call.name === "update_descriptions");
    const unread = [...needed].filter((id) => !seen.has(id));
    const lines = updated && (unread.length === 0 || round >= 3) ? readUpdate(updated.input, units) : null;
    if (lines) return NextResponse.json({ lines });

    if (calls.length) {
      const results: Anthropic.Messages.ToolResultBlockParam[] = calls.map((call) => {
        if (call.name === "read_entry") {
          const raw = String((call.input as { id?: unknown }).id ?? "");
          const id = resolveWikiId(raw);
          if (id) seen.add(id);
          return {
            type: "tool_result" as const,
            tool_use_id: call.id,
            content: id ? wikiText(id) : `No entry for "${raw}". Use one of: ${WIKI_IDS.join(", ")}.`,
          };
        }
        if (call.name === "update_descriptions") {
          const content = unread.length
            ? `Read the childhood training first. Call read_entry for ${unread.join(" and ")}. Then call update_descriptions.`
            : `That update was missing a unit or had no lines. Call update_descriptions again for ${units.map((unit) => unit.id).join(" and ")}. 1 to ${DESCRIPTION_MAX} lines each.`;
          return { type: "tool_result" as const, tool_use_id: call.id, content };
        }
        return { type: "tool_result" as const, tool_use_id: call.id, content: "Unknown tool." };
      });
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: results });
      continue;
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: unread.length
        ? `Call read_entry for ${unread.join(" and ")} before you rewrite the descriptions.`
        : `Call update_descriptions now for ${units.map((unit) => `${unit.name} (${unit.id})`).join(" and ")}.`,
    });
  }

  return NextResponse.json({ error: "The drill did not come back for both units." }, { status: 500 });
}
